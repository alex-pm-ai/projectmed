import { env } from '../../../shared/env.js';
import { AppError, UnauthorizedError } from '../../../shared/errors.js';
import { assinaturaWebhookValida, mapearPreapproval, type PreapprovalMp } from '../../../domain/assinatura.js';
import type {
  CobrancaGateway,
  CriarAssinaturaInput,
  CriarAssinaturaResult,
  EventoPagamento,
  PaymentGateway,
  WebhookEntrada,
} from './PaymentGateway.js';

const API = 'https://api.mercadopago.com';

/**
 * Mercado Pago — Assinaturas (preapproval) sem plano associado.
 *
 * Vínculo com o nosso sistema: external_reference = Usuario.id e
 * Assinatura.gatewaySubId = id da preapproval. Nunca por e-mail/CPF.
 * O cartão é digitado na página do Mercado Pago (init_point) — nunca passa por nós.
 */
export class MercadoPagoGateway implements PaymentGateway {
  private async chamar<T>(metodo: string, caminho: string, corpo?: unknown): Promise<T> {
    const res = await fetch(API + caminho, {
      method: metodo,
      headers: {
        Authorization: `Bearer ${env.MERCADOPAGO_ACCESS_TOKEN}`,
        'Content-Type': 'application/json',
      },
      body: corpo === undefined ? undefined : JSON.stringify(corpo),
    });
    const json = (await res.json().catch(() => ({}))) as T & { message?: string };
    if (!res.ok) {
      throw new AppError(`Mercado Pago: ${json.message ?? res.statusText}`, 502, 'gateway_erro');
    }
    return json;
  }

  async criarAssinatura(input: CriarAssinaturaInput): Promise<CriarAssinaturaResult> {
    const anual = input.plano.intervalo === 'year';
    const pre = await this.chamar<PreapprovalMp & { init_point: string }>('POST', '/preapproval', {
      reason: `Mindfast — Plano ${input.plano.nome}`,
      external_reference: input.usuario.id,
      // Em teste o pagador precisa ser um usuário de teste do MP (ver env.ts)
      payer_email: env.MERCADOPAGO_EMAIL_COMPRADOR_TESTE || input.usuario.email,
      back_url: input.backUrl,
      status: 'pending',
      auto_recurring: {
        frequency: anual ? 12 : 1,
        frequency_type: 'months',
        transaction_amount: input.plano.preco / 100,
        currency_id: 'BRL',
      },
    });
    return { gatewaySubId: pre.id, metodo: 'cartao', checkoutUrl: pre.init_point };
  }

  async consultarAssinatura(gatewaySubId: string) {
    const pre = await this.chamar<PreapprovalMp>('GET', `/preapproval/${encodeURIComponent(gatewaySubId)}`);
    return mapearPreapproval(pre);
  }

  async listarCobrancas(gatewaySubId: string): Promise<CobrancaGateway[]> {
    const r = await this.chamar<{
      results?: {
        id: number | string;
        transaction_amount?: number;
        status?: string;
        debit_date?: string;
        date_created?: string;
        payment?: { id?: number | string; status?: string } | null;
      }[];
    }>('GET', `/authorized_payments/search?preapproval_id=${encodeURIComponent(gatewaySubId)}`);

    return (r.results ?? []).map((c) => {
      const s = c.payment?.status ?? c.status ?? '';
      const status: CobrancaGateway['status'] =
        s === 'approved' ? 'aprovado'
        : s === 'refunded' || s === 'charged_back' ? 'estornado'
        : s === 'rejected' || s === 'cancelled' ? 'recusado'
        : 'pendente';
      return {
        id: String(c.id),
        valor: Math.round((c.transaction_amount ?? 0) * 100),
        status,
        data: new Date(c.debit_date ?? c.date_created ?? Date.now()),
        paymentId: c.payment?.id ? String(c.payment.id) : undefined,
      };
    });
  }

  async estornarCobrancas(gatewaySubId: string): Promise<number> {
    const aprovadas = (await this.listarCobrancas(gatewaySubId)).filter((c) => c.status === 'aprovado' && c.paymentId);
    for (const c of aprovadas) {
      await this.chamar('POST', `/v1/payments/${c.paymentId}/refunds`, {});
    }
    return aprovadas.length;
  }

  async cancelarAssinatura(gatewaySubId: string): Promise<void> {
    await this.chamar('PUT', `/preapproval/${encodeURIComponent(gatewaySubId)}`, { status: 'cancelled' });
  }

  /**
   * Webhooks: o Mercado Pago só avisa "algo mudou no recurso X". Validamos a
   * assinatura HMAC e depois CONSULTAMOS a API — nunca confiamos no corpo do aviso.
   */
  async validarWebhook(entrada: WebhookEntrada): Promise<{ evento: EventoPagamento; eventId: string }> {
    const body = (entrada.body ?? {}) as { type?: string; action?: string; data?: { id?: string | number } };
    const dataId = entrada.query['data.id'] ?? (body.data?.id !== undefined ? String(body.data.id) : undefined);
    const tipo = entrada.query.type ?? body.type ?? '';
    const header = (n: string) => {
      const v = entrada.headers[n];
      return Array.isArray(v) ? v[0] : v;
    };

    if (!env.MERCADOPAGO_WEBHOOK_SECRET) {
      throw new AppError('Webhook do Mercado Pago sem chave secreta configurada', 503, 'webhook_nao_configurado');
    }
    const valida = assinaturaWebhookValida({
      xSignature: header('x-signature'),
      xRequestId: header('x-request-id'),
      dataId,
      segredo: env.MERCADOPAGO_WEBHOOK_SECRET,
    });
    if (!valida) throw new UnauthorizedError('Assinatura do webhook inválida');

    // Cada aviso tem um x-request-id próprio; usamos para não processar o mesmo aviso duas vezes.
    const eventId = `mp:${header('x-request-id') ?? `${tipo}:${dataId}:${body.action ?? ''}`}`;
    if (!dataId) return { eventId, evento: { tipo: 'ignorado' } };

    if (tipo === 'subscription_preapproval') {
      return { eventId, evento: { tipo: 'assinatura.sincronizar', gatewaySubId: dataId } };
    }
    if (tipo === 'subscription_authorized_payment') {
      // Uma cobrança da assinatura mudou: descobre de qual assinatura é.
      const c = await this.chamar<{ preapproval_id?: string }>('GET', `/authorized_payments/${encodeURIComponent(dataId)}`);
      if (c.preapproval_id) return { eventId, evento: { tipo: 'assinatura.sincronizar', gatewaySubId: c.preapproval_id } };
    }
    return { eventId, evento: { tipo: 'ignorado' } };
  }
}
