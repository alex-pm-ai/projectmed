import { env } from '../../../shared/env.js';
import type { PaymentGateway } from './PaymentGateway.js';
import { MockGateway } from './MockGateway.js';
import { MercadoPagoGateway } from './MercadoPagoGateway.js';

/**
 * Fábrica do gateway. PAYMENT_PROVIDER=mock (dev, sem cobrança) ou mercadopago.
 */
function criarGateway(): PaymentGateway {
  switch (env.PAYMENT_PROVIDER) {
    case 'mock':
      return new MockGateway();
    case 'mercadopago':
      return new MercadoPagoGateway();
    default:
      return new MockGateway();
  }
}

export const gateway = criarGateway();
