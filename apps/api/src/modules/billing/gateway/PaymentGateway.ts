/**
 * Contrato provider-agnostic. MockGateway (dev) e MercadoPagoGateway implementam isto.
 * O resto do sistema só conhece esta interface — trocar de provedor não toca
 * em service/routes/banco.
 */
import type { SituacaoAssinatura } from '../../../domain/assinatura.js';

export interface ClienteInput {
  usuarioId: string;
  nome: string;
  email: string;
}

export interface CriarAssinaturaInput {
  /** Id do cliente no provedor (só para provedores que exigem cadastro de cliente). */
  clienteId?: string;
  usuario: { id: string; nome: string; email: string };
  plano: { id: string; nome: string; preco: number; intervalo: string; gatewayId: string | null };
  /** Para onde o provedor manda a pessoa depois de pagar. */
  backUrl: string;
}

export interface CriarAssinaturaResult {
  gatewaySubId: string;
  gatewayPayId?: string; // id da primeira cobrança, quando o provedor já cria na hora (mock)
  metodo: 'pix' | 'cartao' | 'boleto';
  pixQrCode?: string;
  /** Página de pagamento do provedor (Mercado Pago). */
  checkoutUrl?: string;
}

export interface CobrancaGateway {
  id: string;
  valor: number; // centavos
  status: 'aprovado' | 'recusado' | 'pendente' | 'estornado';
  data: Date;
  /** Id do pagamento em si (usado para estorno). */
  paymentId?: string;
}

export type EventoPagamento =
  | { tipo: 'pagamento.aprovado'; gatewayPayId: string; gatewaySubId?: string }
  | { tipo: 'pagamento.recusado'; gatewayPayId: string }
  | { tipo: 'pagamento.estornado'; gatewayPayId: string }
  | { tipo: 'assinatura.cancelada'; gatewaySubId: string }
  | { tipo: 'assinatura.renovada'; gatewaySubId: string; gatewayPayId: string }
  /** Algo mudou na assinatura: consultar o provedor e sincronizar (Mercado Pago). */
  | { tipo: 'assinatura.sincronizar'; gatewaySubId: string }
  | { tipo: 'ignorado' };

export interface WebhookEntrada {
  headers: Record<string, string | string[] | undefined>;
  query: Record<string, string | undefined>;
  rawBody: string;
  body: unknown;
}

export interface PaymentGateway {
  /** Cria (ou recupera) o cliente no provedor. Opcional: o Mercado Pago não precisa. */
  criarCliente?(input: ClienteInput): Promise<string>;

  /** Cria a assinatura recorrente (e devolve a página de pagamento, se houver). */
  criarAssinatura(input: CriarAssinaturaInput): Promise<CriarAssinaturaResult>;

  /** Situação atual da assinatura no provedor (fonte da verdade). */
  consultarAssinatura?(gatewaySubId: string): Promise<SituacaoAssinatura>;

  /** Cobranças já feitas nessa assinatura (histórico e estorno). */
  listarCobrancas?(gatewaySubId: string): Promise<CobrancaGateway[]>;

  /** Estorna as cobranças aprovadas (direito de arrependimento). Devolve quantas estornou. */
  estornarCobrancas?(gatewaySubId: string): Promise<number>;

  /** Cancela a assinatura no provedor (para de cobrar). */
  cancelarAssinatura(gatewaySubId: string): Promise<void>;

  /**
   * Valida a autenticidade do webhook e devolve o evento normalizado.
   * Lança erro se a assinatura for inválida (anti-fraude).
   */
  validarWebhook(entrada: WebhookEntrada): Promise<{ evento: EventoPagamento; eventId: string }>;
}
