import { prisma } from '../../shared/prisma.js';
import { env } from '../../shared/env.js';
import { AppError, NotFoundError } from '../../shared/errors.js';
import { acessoLiberado, dentroDoArrependimento } from '../../domain/assinatura.js';
import { gateway } from './gateway/index.js';
import type { EventoPagamento, WebhookEntrada } from './gateway/PaymentGateway.js';

function addIntervalo(base: Date, intervalo: string): Date {
  const d = new Date(base);
  if (intervalo === 'year') d.setFullYear(d.getFullYear() + 1);
  else d.setMonth(d.getMonth() + 1); // default: mensal
  return d;
}

/** O Mercado Pago não aceita localhost como endereço de retorno (só um endereço público). */
function urlDeRetorno(): string {
  const publico = !/localhost|127\.0\.0\.1/.test(env.APP_URL);
  return publico ? `${env.APP_URL}/app/assinatura/retorno` : 'https://www.mercadopago.com.br';
}

export async function listarPlanos() {
  return prisma.plano.findMany({ where: { ativo: true }, orderBy: { preco: 'asc' } });
}

export async function statusAssinatura(usuarioId: string) {
  const a = await prisma.assinatura.findUnique({ where: { usuarioId }, include: { plano: true } });
  if (!a) return { status: 'sem_assinatura', ativa: false, validoAte: null, plano: null, checkoutUrl: null };
  return {
    status: a.status,
    ativa: acessoLiberado(a),
    validoAte: a.validoAte,
    ativadaEm: a.ativadaEm,
    canceladaEm: a.canceladaEm,
    podeArrepender: acessoLiberado(a) && dentroDoArrependimento(a.ativadaEm),
    checkoutUrl: a.status === 'pendente' ? a.checkoutUrl : null,
    plano: a.plano ? { nome: a.plano.nome, intervalo: a.plano.intervalo, preco: a.plano.preco } : null,
  };
}

/**
 * Inicia a assinatura no provedor e registra Assinatura(pendente).
 * O acesso só é liberado quando o provedor confirmar o pagamento
 * (sincronizar/webhook). Uma assinatura pendente anterior é cancelada no provedor.
 */
export async function criarCheckout(usuarioId: string, planoId: string) {
  const usuario = await prisma.usuario.findUnique({ where: { id: usuarioId } });
  if (!usuario) throw new NotFoundError('Usuário não encontrado');

  const plano = await prisma.plano.findUnique({ where: { id: planoId } });
  if (!plano || !plano.ativo) throw new NotFoundError('Plano não encontrado');

  const atual = await prisma.assinatura.findUnique({ where: { usuarioId } });
  if (atual && acessoLiberado(atual) && atual.status === 'ativa') {
    throw new AppError('Você já tem uma assinatura ativa', 409, 'assinatura_ativa');
  }
  if (atual?.status === 'pendente' && atual.gatewaySubId) {
    await gateway.cancelarAssinatura(atual.gatewaySubId).catch(() => undefined);
  }

  // Provedores que exigem cadastro de cliente (o Mercado Pago não exige)
  let clienteId = usuario.gatewayId ?? undefined;
  if (gateway.criarCliente && !clienteId) {
    clienteId = await gateway.criarCliente({ usuarioId: usuario.id, nome: usuario.nome, email: usuario.email });
    await prisma.usuario.update({ where: { id: usuario.id }, data: { gatewayId: clienteId } });
  }

  const result = await gateway.criarAssinatura({
    clienteId,
    usuario: { id: usuario.id, nome: usuario.nome, email: usuario.email },
    plano: { id: plano.id, nome: plano.nome, preco: plano.preco, intervalo: plano.intervalo, gatewayId: plano.gatewayId },
    backUrl: urlDeRetorno(),
  });

  // Mantém a validade de um período já pago (ex.: quem cancelou e está assinando de novo)
  const validoAte = atual && atual.validoAte.getTime() > Date.now() ? atual.validoAte : new Date();
  await prisma.assinatura.upsert({
    where: { usuarioId },
    create: {
      usuarioId,
      planoId: plano.id,
      status: 'pendente',
      gatewaySubId: result.gatewaySubId,
      checkoutUrl: result.checkoutUrl ?? null,
      validoAte,
    },
    update: {
      planoId: plano.id,
      status: 'pendente',
      gatewaySubId: result.gatewaySubId,
      checkoutUrl: result.checkoutUrl ?? null,
      validoAte,
      canceladaEm: null,
    },
  });

  if (result.gatewayPayId) {
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
  }

  return {
    metodo: result.metodo,
    checkoutUrl: result.checkoutUrl ?? null,
    pixQrCode: result.pixQrCode ?? null,
    gatewayPayId: result.gatewayPayId ?? null,
  };
}

/**
 * Consulta o provedor e atualiza a assinatura local (idempotente — pode rodar
 * quantas vezes quiser). Usado na volta do pagamento, pela tela de assinatura
 * e pelos webhooks. Também atualiza o histórico de cobranças.
 */
async function sincronizarPorGatewaySubId(gatewaySubId: string) {
  const assinatura = await prisma.assinatura.findUnique({ where: { gatewaySubId }, include: { plano: true } });
  if (!assinatura || !gateway.consultarAssinatura) return null;

  const situacao = await gateway.consultarAssinatura(gatewaySubId);
  const agora = new Date();

  const dados: { status: string; validoAte?: Date; ativadaEm?: Date; canceladaEm?: Date | null; checkoutUrl?: null } = {
    status: situacao.status,
  };
  if (situacao.status === 'ativa' && situacao.validoAte) {
    dados.validoAte = situacao.validoAte;
    dados.canceladaEm = null;
    dados.checkoutUrl = null;
    if (!assinatura.ativadaEm) dados.ativadaEm = agora;
  }
  if (situacao.status === 'cancelada' && !assinatura.canceladaEm) dados.canceladaEm = agora;

  const atualizada = await prisma.assinatura.update({ where: { id: assinatura.id }, data: dados });

  // Histórico de cobranças (Pagamento) espelhando o provedor
  if (gateway.listarCobrancas) {
    const cobrancas = await gateway.listarCobrancas(gatewaySubId).catch(() => []);
    for (const c of cobrancas) {
      await prisma.pagamento.upsert({
        where: { gatewayPayId: c.id },
        create: { usuarioId: assinatura.usuarioId, valor: c.valor, status: c.status, metodo: 'cartao', gatewayPayId: c.id },
        update: { status: c.status, valor: c.valor },
      });
    }
  }

  return atualizada;
}

export async function sincronizar(usuarioId: string) {
  const a = await prisma.assinatura.findUnique({ where: { usuarioId } });
  if (a?.gatewaySubId) await sincronizarPorGatewaySubId(a.gatewaySubId);
  return statusAssinatura(usuarioId);
}

export async function listarCobrancas(usuarioId: string) {
  return prisma.pagamento.findMany({
    where: { usuarioId },
    orderBy: { createdAt: 'desc' },
    select: { id: true, valor: true, status: true, metodo: true, createdAt: true },
  });
}

/**
 * Processa o webhook do provedor.
 * - valida a autenticidade (no gateway)
 * - deduplica via WebhookEvent.gatewayId (unique)
 * - aplica o evento (Mercado Pago: consulta a API e sincroniza)
 */
export async function processarWebhook(entrada: WebhookEntrada) {
  const { evento, eventId } = await gateway.validarWebhook(entrada);

  const jaProcessado = await prisma.webhookEvent.findUnique({ where: { gatewayId: eventId } });
  if (jaProcessado) return { status: 'duplicado' };

  await prisma.webhookEvent.create({
    data: { gatewayId: eventId, tipo: evento.tipo, payload: (entrada.body ?? {}) as object, processado: false },
  });

  await aplicarEvento(evento);

  await prisma.webhookEvent.update({ where: { gatewayId: eventId }, data: { processado: true } });
  return { status: 'ok', tipo: evento.tipo };
}

async function aplicarEvento(evento: EventoPagamento) {
  switch (evento.tipo) {
    case 'assinatura.sincronizar':
      await sincronizarPorGatewaySubId(evento.gatewaySubId);
      break;

    // Eventos do MockGateway (desenvolvimento)
    case 'pagamento.aprovado':
    case 'assinatura.renovada': {
      const pagamento = await prisma.pagamento.findUnique({ where: { gatewayPayId: evento.gatewayPayId } });
      if (!pagamento) return;
      await prisma.pagamento.update({ where: { id: pagamento.id }, data: { status: 'aprovado' } });

      const assinatura = await prisma.assinatura.findUnique({
        where: { usuarioId: pagamento.usuarioId },
        include: { plano: true },
      });
      if (!assinatura) return;

      // Renovação estende a partir da validade atual; primeira ativação parte de hoje
      const base = assinatura.validoAte.getTime() > Date.now() ? assinatura.validoAte : new Date();
      await prisma.assinatura.update({
        where: { id: assinatura.id },
        data: {
          status: 'ativa',
          validoAte: addIntervalo(base, assinatura.plano.intervalo),
          canceladaEm: null,
          checkoutUrl: null,
          ativadaEm: assinatura.ativadaEm ?? new Date(),
        },
      });
      break;
    }

    case 'pagamento.recusado':
      await prisma.pagamento.updateMany({ where: { gatewayPayId: evento.gatewayPayId }, data: { status: 'recusado' } });
      break;

    case 'pagamento.estornado': {
      const pagamento = await prisma.pagamento.findUnique({ where: { gatewayPayId: evento.gatewayPayId } });
      if (!pagamento) return;
      await prisma.pagamento.update({ where: { id: pagamento.id }, data: { status: 'estornado' } });
      await prisma.assinatura.updateMany({
        where: { usuarioId: pagamento.usuarioId },
        data: { status: 'cancelada', canceladaEm: new Date(), validoAte: new Date() },
      });
      break;
    }

    case 'assinatura.cancelada':
      await prisma.assinatura.updateMany({
        where: { gatewaySubId: evento.gatewaySubId },
        data: { status: 'cancelada', canceladaEm: new Date() },
      });
      break;

    case 'ignorado':
    default:
      break;
  }
}

/**
 * Cancela a assinatura (para de cobrar).
 * - Normal: o acesso continua até o fim do período já pago.
 * - Arrependimento (até 7 dias da contratação, CDC art. 49): estorna tudo e bloqueia na hora.
 */
export async function cancelarAssinatura(usuarioId: string, opcoes: { arrependimento?: boolean } = {}) {
  const a = await prisma.assinatura.findUnique({ where: { usuarioId } });
  if (!a) throw new NotFoundError('Assinatura não encontrada');
  if (a.status === 'cancelada') return statusAssinatura(usuarioId);

  const arrependimento = !!opcoes.arrependimento;
  if (arrependimento && !dentroDoArrependimento(a.ativadaEm)) {
    throw new AppError('O prazo de 7 dias para arrependimento já passou', 400, 'fora_do_prazo');
  }

  if (a.gatewaySubId) {
    await gateway.cancelarAssinatura(a.gatewaySubId);
    if (arrependimento && gateway.estornarCobrancas) await gateway.estornarCobrancas(a.gatewaySubId);
  }

  await prisma.assinatura.update({
    where: { usuarioId },
    data: {
      status: 'cancelada',
      canceladaEm: new Date(),
      checkoutUrl: null,
      ...(arrependimento || a.status === 'pendente' ? { validoAte: new Date() } : {}),
    },
  });
  if (a.gatewaySubId) await sincronizarPorGatewaySubId(a.gatewaySubId).catch(() => undefined);
  return statusAssinatura(usuarioId);
}
