import type { FastifyInstance } from 'fastify';
import { requireAuth } from '../../shared/auth.middleware.js';
import { checkoutSchema } from './billing.schemas.js';
import * as billing from './billing.service.js';

export async function billingRoutes(app: FastifyInstance) {
  // Público: lista de planos (para a tela de paywall)
  app.get('/planos', async (_req, reply) => {
    return reply.send(await billing.listarPlanos());
  });

  // Autenticadas (NÃO passam pelo gate de assinatura — senão ninguém pagaria)
  app.get('/assinatura', { preHandler: requireAuth }, async (req, reply) => {
    return reply.send(await billing.statusAssinatura(req.usuarioId));
  });

  app.post('/checkout', { preHandler: requireAuth }, async (req, reply) => {
    const { planoId } = checkoutSchema.parse(req.body);
    return reply.send(await billing.criarCheckout(req.usuarioId, planoId));
  });

  app.post('/cancelar', { preHandler: requireAuth }, async (req, reply) => {
    return reply.send(await billing.cancelarAssinatura(req.usuarioId));
  });
}

/**
 * Webhook do provedor — rota PÚBLICA e SEM JWT (quem chama é o provedor).
 * A segurança vem da validação da assinatura HMAC dentro do gateway.
 * rawBody é capturado para validação de assinatura em produção.
 */
export async function webhookRoutes(app: FastifyInstance) {
  app.post('/webhook', async (req, reply) => {
    const result = await billing.processarWebhook({
      headers: req.headers,
      rawBody: typeof req.body === 'string' ? req.body : JSON.stringify(req.body),
      body: req.body,
    });
    return reply.send(result);
  });
}
