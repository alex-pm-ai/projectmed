import { prisma } from '../../shared/prisma.js';
import { NotFoundError } from '../../shared/errors.js';
import { gateway } from './gateway/index.js';
import type { EventoPagamento, WebhookEntrada } from './gateway/PaymentGateway.js';

function addIntervalo(base: Date, intervalo: string): Date {
  const d = new Date(base);
  if (intervalo === 'year') d.setFullYear(d.getFullYear() + 1);
  else d.setMonth(d.getMonth() + 1); // default: mensal
  return d;
}

export async function listarPlanos() {
  return prisma.plano.findMany({ where: { ativo: true }, orderBy: { preco: 'asc' } });
}

export async function statusAssinatura(usuarioId: string) {
  const a = await prisma.assinatura.findUnique({
    where: { usuarioId },
    include: { plano: true },
  });
  if (!a) return { status: 'sem_assinatura', ativa: false, validoAte: null, plano: null };
  return {
    status: a.status,
    ativa: a.status === 'ativa' && a.validoAte.getTime() > Date.now(),
    validoAte: a.validoAte,
    plano: a.plano ? { nome: a.plano.nome, intervalo: a.plano.intervalo } : null,
  };
}

/**
 * Inicia a assinatura: garante cliente no provedor, cria a cobrança (Pix/cartão)
 * e registra Assinatura(pendente) + Pagamento(pendente). O acesso só é liberado
 * quando o webhook de aprovação chegar.
 */
export async function criarCheckout(usuarioId: string, planoId: string) {
  const usuario = await prisma.usuario.findUnique({ where: { id: usuarioId } });
  if (!usuario) throw new NotFoundError('Usuário não encontrado');

  const plano = await prisma.plano.findUnique({ where: { id: planoId } });
  if (!plano || !plano.ativo) throw new NotFoundError('Plano não encontrado');

  // 1. Garante o cliente no provedor
  let gatewayId = usuario.gatewayId;
  if (!gatewayId) {
    gatewayId = await gateway.criarCliente({
      usuarioId: usuario.id,
      nome: usuario.nome,
      email: usuario.email,
    });
    await prisma.usuario.update({ where: { id: usuario.id }, data: { gatewayId } });
  }

  // 2. Cria a assinatura + primeira cobrança no provedor
  const result = await gateway.criarAssinatura({
    clienteId: gatewayId,
    plano: {
      id: plano.id,
      nome: plano.nome,
      preco: plano.preco,
      intervalo: plano.intervalo,
      gatewayId: plano.gatewayId,
    },
  });

  // 3. Persiste estado pendente (acesso ainda NÃO liberado)
  await prisma.assinatura.upsert({
    where: { usuarioId },
    create: {
      usuarioId,
      planoId: plano.id,
      status: 'pendente',
      gatewaySubId: result.gatewaySubId,
      validoAte: new Date(), // inválida até pagar
    },
    update: {
      planoId: plano.id,
      status: 'pendente',
      gatewaySubId: result.gatewaySubId,
      canceladaEm: null,
    },
  });

  await prisma.pagamento.create({
    data: {
      usuarioId,
      valor: plano.preco,
      status: 'pendente',
      metodo: result.metodo,
      gatewayPayId: result.gatewayPayId,
      pixQrCode: result.pixQrCode ?? null,
    },
  });

  return {
    metodo: result.metodo,
    pixQrCode: result.pixQrCode ?? null,
    checkoutUrl: result.checkoutUrl ?? null,
    gatewayPayId: result.gatewayPayId,
  };
}

/**
 * Processa o webhook do provedor. Esta é a ÚNICA fonte de verdade do pagamento.
 * - valida assinatura HMAC (no gateway)
 * - deduplica via WebhookEvent.gatewayId (unique)
 * - atualiza Assinatura/Pagamento de forma atômica
 */
export async function processarWebhook(entrada: WebhookEntrada) {
  const { evento, eventId } = gateway.validarWebhook(entrada);

  // Dedupe: se já vimos este evento, não reprocessa
  const jaProcessado = await prisma.webhookEvent.findUnique({ where: { gatewayId: eventId } });
  if (jaProcessado) return { status: 'duplicado' };

  await prisma.webhookEvent.create({
    data: { gatewayId: eventId, tipo: evento.tipo, payload: entrada.body as object, processado: false },
  });

  await aplicarEvento(evento);

  await prisma.webhookEvent.update({ where: { gatewayId: eventId }, data: { processado: true } });
  return { status: 'ok', tipo: evento.tipo };
}

async function aplicarEvento(evento: EventoPagamento) {
  switch (evento.tipo) {
    case 'pagamento.aprovado':
    case 'assinatura.renovada': {
      const pagamento = await prisma.pagamento.findUnique({
        where: { gatewayPayId: evento.gatewayPayId },
      });
      if (!pagamento) return;

      await prisma.pagamento.update({
        where: { id: pagamento.id },
        data: { status: 'aprovado' },
      });

      const assinatura = await prisma.assinatura.findUnique({
        where: { usuarioId: pagamento.usuarioId },
        include: { plano: true },
      });
      if (!assinatura) return;

      // Renovação estende a partir da validade atual; primeira ativação parte de hoje
      const base =
        assinatura.validoAte.getTime() > Date.now() ? assinatura.validoAte : new Date();
      const validoAte = addIntervalo(base, assinatura.plano.intervalo);

      await prisma.assinatura.update({
        where: { id: assinatura.id },
        data: { status: 'ativa', validoAte, canceladaEm: null },
      });
      break;
    }

    case 'pagamento.recusado': {
      await prisma.pagamento.updateMany({
        where: { gatewayPayId: evento.gatewayPayId },
        data: { status: 'recusado' },
      });
      break;
    }

    case 'pagamento.estornado': {
      const pagamento = await prisma.pagamento.findUnique({
        where: { gatewayPayId: evento.gatewayPayId },
      });
      if (!pagamento) return;
      await prisma.pagamento.update({ where: { id: pagamento.id }, data: { status: 'estornado' } });
      await prisma.assinatura.updateMany({
        where: { usuarioId: pagamento.usuarioId },
        data: { status: 'cancelada', canceladaEm: new Date() },
      });
      break;
    }

    case 'assinatura.cancelada': {
      await prisma.assinatura.updateMany({
        where: { gatewaySubId: evento.gatewaySubId },
        data: { status: 'cancelada', canceladaEm: new Date() },
      });
      break;
    }

    case 'ignorado':
    default:
      break;
  }
}

/** Cancela a assinatura (no provedor e localmente). Mantém acesso até validoAte. */
export async function cancelarAssinatura(usuarioId: string) {
  const a = await prisma.assinatura.findUnique({ where: { usuarioId } });
  if (!a) throw new NotFoundError('Assinatura não encontrada');
  if (a.gatewaySubId) await gateway.cancelarAssinatura(a.gatewaySubId);
  await prisma.assinatura.update({
    where: { usuarioId },
    data: { status: 'cancelada', canceladaEm: new Date() },
  });
  return { status: 'cancelada', acessoAte: a.validoAte };
}
