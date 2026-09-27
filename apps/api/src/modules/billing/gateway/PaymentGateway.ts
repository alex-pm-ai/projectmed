/**
 * Contrato provider-agnostic. Asaas, Stripe ou Mercado Pago implementam isto.
 * O resto do sistema só conhece esta interface — trocar de provedor não toca
 * em service/routes/banco.
 */

export interface ClienteInput {
  usuarioId: string;
  nome: string;
  email: string;
}

export interface CriarAssinaturaInput {
  clienteId: string;
  plano: { id: string; nome: string; preco: number; intervalo: string; gatewayId: string | null };
}

export interface CriarAssinaturaResult {
  gatewaySubId: string;
  gatewayPayId: string; // id da primeira cobrança (idempotência)
  metodo: 'pix' | 'cartao' | 'boleto';
  pixQrCode?: string;
  checkoutUrl?: string;
}

export type EventoPagamento =
  | { tipo: 'pagamento.aprovado'; gatewayPayId: string; gatewaySubId?: string }
  | { tipo: 'pagamento.recusado'; gatewayPayId: string }
  | { tipo: 'pagamento.estornado'; gatewayPayId: string }
  | { tipo: 'assinatura.cancelada'; gatewaySubId: string }
  | { tipo: 'assinatura.renovada'; gatewaySubId: string; gatewayPayId: string }
  | { tipo: 'ignorado' };

export interface WebhookEntrada {
  headers: Record<string, string | string[] | undefined>;
  rawBody: string;
  body: unknown;
}

export interface PaymentGateway {
  /** Cria (ou recupera) o cliente no provedor e devolve o id externo. */
  criarCliente(input: ClienteInput): Promise<string>;

  /** Cria a assinatura recorrente e a primeira cobrança (Pix/cartão). */
  criarAssinatura(input: CriarAssinaturaInput): Promise<CriarAssinaturaResult>;

  /** Cancela a assinatura no provedor. */
  cancelarAssinatura(gatewaySubId: string): Promise<void>;

  /**
   * Valida a assinatura HMAC do webhook e devolve o evento normalizado.
   * Lança erro se a assinatura for inválida (anti-fraude).
   * Devolve o id único do evento para deduplicação.
   */
  validarWebhook(entrada: WebhookEntrada): { evento: EventoPagamento; eventId: string };
}
