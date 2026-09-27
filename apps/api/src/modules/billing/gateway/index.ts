import { env } from '../../../shared/env.js';
import type { PaymentGateway } from './PaymentGateway.js';
import { MockGateway } from './MockGateway.js';

/**
 * Fábrica do gateway. Quando você decidir o provedor, basta criar
 * AsaasGateway/StripeGateway implementando PaymentGateway e plugar aqui.
 */
function criarGateway(): PaymentGateway {
  switch (env.PAYMENT_PROVIDER) {
    case 'mock':
      return new MockGateway();
    // case 'asaas':       return new AsaasGateway();
    // case 'stripe':      return new StripeGateway();
    // case 'mercadopago': return new MercadoPagoGateway();
    default:
      return new MockGateway();
  }
}

export const gateway = criarGateway();
