import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { requireAuth } from '../../shared/auth.middleware.js';
import { checkoutSchema } from './billing.schemas.js';
import * as billing from './billing.service.js';

const cancelarSchema = z.object({ arrependimento: z.boolean().default(false) }).default({});

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

  // Consulta o provedor e atualiza o status (volta do pagamento / "Já paguei")
  app.post('/sincronizar', { preHandler: requireAuth, config: { rateLimit: { max: 30, timeWindow: '1 minute' } } }, async (req, reply) => {
    return reply.send(await billing.sincronizar(req.usuarioId));
  });

  app.get('/cobrancas', { preHandler: requireAuth }, async (req, reply) => {
    return reply.send(await billing.listarCobrancas(req.usuarioId));
  });

  app.post('/cancelar', { preHandler: requireAuth }, async (req, reply) => {
    const { arrependimento } = cancelarSchema.parse(req.body ?? {});
    return reply.send(await billing.cancelarAssinatura(req.usuarioId, { arrependimento }));
  });
}

/**
 * Webhook do provedor — rota PÚBLICA e SEM JWT (quem chama é o provedor).
 * A segurança vem da validação da assinatura (HMAC) dentro do gateway.
 */
export async function webhookRoutes(app: FastifyInstance) {
  app.post('/webhook', async (req, reply) => {
    const result = await billing.processarWebhook({
      headers: req.headers,
      query: req.query as Record<string, string | undefined>,
      rawBody: typeof req.body === 'string' ? req.body : JSON.stringify(req.body),
      body: req.body,
    });
    return reply.send(result);
  });
}
