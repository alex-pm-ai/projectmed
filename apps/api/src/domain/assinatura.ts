import { createHmac, timingSafeEqual } from 'node:crypto';

/**
 * Regras de assinatura — funções puras, testadas em tests/unit/assinatura.test.ts.
 */

export type StatusAssinatura = 'pendente' | 'ativa' | 'pausada' | 'cancelada';

/**
 * Quem pode usar o app: quem já pagou e está dentro do período pago.
 * "Pendente" (nunca pagou) nunca libera. Cancelada/pausada continuam liberadas
 * até o fim do período já pago; inadimplência bloqueia sozinha quando
 * validoAte passa sem a renovação ser aprovada.
 */
export function acessoLiberado(a: { status: string; validoAte: Date } | null | undefined, agora = new Date()): boolean {
  return !!a && a.status !== 'pendente' && a.validoAte.getTime() > agora.getTime();
}

// Folga para a cobrança do dia da renovação ser processada antes de bloquear.
const FOLGA_MS = 24 * 60 * 60 * 1000;

/** O que interessa do objeto "preapproval" (assinatura) do Mercado Pago. */
export interface PreapprovalMp {
  id: string;
  status: string; // pending | authorized | paused | cancelled
  external_reference?: string | null;
  next_payment_date?: string | null;
  summarized?: { charged_quantity?: number | null; last_charged_date?: string | null } | null;
}

export interface SituacaoAssinatura {
  status: StatusAssinatura;
  /** Até quando o acesso vale. null = não mexer na validade atual. */
  validoAte: Date | null;
  jaCobrou: boolean;
}

/** Converte o status do Mercado Pago para o nosso. */
export function mapearPreapproval(pre: PreapprovalMp): SituacaoAssinatura {
  const jaCobrou = (pre.summarized?.charged_quantity ?? 0) > 0 || !!pre.summarized?.last_charged_date;
  const proxima = pre.next_payment_date ? new Date(pre.next_payment_date) : null;

  switch (pre.status) {
    case 'authorized':
      // Autorizada mas a 1ª cobrança ainda não aprovou → continua pendente (sem acesso).
      if (!jaCobrou || !proxima) return { status: 'pendente', validoAte: null, jaCobrou };
      // Pago até a próxima cobrança (+ folga de 1 dia).
      return { status: 'ativa', validoAte: new Date(proxima.getTime() + FOLGA_MS), jaCobrou };
    case 'paused':
      return { status: 'pausada', validoAte: null, jaCobrou };
    case 'cancelled':
      return { status: 'cancelada', validoAte: null, jaCobrou };
    default:
      return { status: 'pendente', validoAte: null, jaCobrou };
  }
}

/**
 * Confere a assinatura do webhook do Mercado Pago (header x-signature = "ts=...,v1=...").
 * O Mercado Pago assina o texto "id:<data.id>;request-id:<x-request-id>;ts:<ts>;"
 * com HMAC-SHA256 usando a chave secreta configurada no painel.
 */
export function assinaturaWebhookValida(params: {
  xSignature: string | undefined;
  xRequestId: string | undefined;
  dataId: string | undefined;
  segredo: string;
}): boolean {
  const { xSignature, xRequestId, dataId, segredo } = params;
  if (!xSignature || !dataId) return false;

  const partes = Object.fromEntries(
    xSignature.split(',').map((p) => {
      const [k, ...v] = p.trim().split('=');
      return [k, v.join('=')];
    })
  );
  const ts = partes.ts;
  const v1 = partes.v1;
  if (!ts || !v1) return false;

  // Ids alfanuméricos vêm em minúsculas no manifesto (regra do Mercado Pago)
  const id = /^[a-z0-9]+$/i.test(dataId) ? dataId.toLowerCase() : dataId;
  let manifesto = `id:${id};`;
  if (xRequestId) manifesto += `request-id:${xRequestId};`;
  manifesto += `ts:${ts};`;

  const esperado = createHmac('sha256', segredo).update(manifesto).digest('hex');
  const a = Buffer.from(esperado, 'hex');
  const b = Buffer.from(v1, 'hex');
  return a.length === b.length && timingSafeEqual(a, b);
}

/** Direito de arrependimento (CDC art. 49): até 7 dias da contratação. */
export function dentroDoArrependimento(ativadaEm: Date | null, agora = new Date()): boolean {
  if (!ativadaEm) return false;
  return agora.getTime() - ativadaEm.getTime() <= 7 * 24 * 60 * 60 * 1000;
}
