import { randomUUID } from 'node:crypto';
import type {
  ClienteInput,
  CriarAssinaturaInput,
  CriarAssinaturaResult,
  EventoPagamento,
  PaymentGateway,
  WebhookEntrada,
} from './PaymentGateway.js';

/**
 * Gateway falso para desenvolvimento/testes.
 * - criarAssinatura devolve um Pix fake (string de QR Code de mentira).
 * - validarWebhook confia no payload (em DEV) e espera o formato:
 *   { "tipo": "pagamento.aprovado", "gatewayPayId": "...", "eventId": "..." }
 *
 * Para simular o pagamento aprovado, faça um POST manual em /billing/webhook
 * (veja o README). Em produção, troque por AsaasGateway/StripeGateway.
 */
export class MockGateway implements PaymentGateway {
  async criarCliente(input: ClienteInput): Promise<string> {
    return `mock_cus_${input.usuarioId.slice(0, 8)}`;
  }

  async criarAssinatura(input: CriarAssinaturaInput): Promise<CriarAssinaturaResult> {
    const subId = `mock_sub_${randomUUID()}`;
    const payId = `mock_pay_${randomUUID()}`;
    return {
      gatewaySubId: subId,
      gatewayPayId: payId,
      metodo: 'pix',
      pixQrCode: `00020126MOCK-PIX-${input.plano.nome}-${payId}`,
    };
  }

  async cancelarAssinatura(_gatewaySubId: string): Promise<void> {
    // no-op no mock
  }

  validarWebhook(entrada: WebhookEntrada): { evento: EventoPagamento; eventId: string } {
    // Em produção: validar HMAC com PAYMENT_WEBHOOK_SECRET aqui.
    const body = entrada.body as Record<string, unknown>;
    const eventId = (body.eventId as string) ?? randomUUID();

    const tipo = body.tipo as string;
    switch (tipo) {
      case 'pagamento.aprovado':
        return {
          eventId,
          evento: {
            tipo: 'pagamento.aprovado',
            gatewayPayId: body.gatewayPayId as string,
            gatewaySubId: body.gatewaySubId as string | undefined,
          },
        };
      case 'pagamento.recusado':
        return { eventId, evento: { tipo: 'pagamento.recusado', gatewayPayId: body.gatewayPayId as string } };
      case 'pagamento.estornado':
        return { eventId, evento: { tipo: 'pagamento.estornado', gatewayPayId: body.gatewayPayId as string } };
      case 'assinatura.cancelada':
        return { eventId, evento: { tipo: 'assinatura.cancelada', gatewaySubId: body.gatewaySubId as string } };
      case 'assinatura.renovada':
        return {
          eventId,
          evento: {
            tipo: 'assinatura.renovada',
            gatewaySubId: body.gatewaySubId as string,
            gatewayPayId: body.gatewayPayId as string,
          },
        };
      default:
        return { eventId, evento: { tipo: 'ignorado' } };
    }
  }
}
