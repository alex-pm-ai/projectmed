import type { FastifyInstance } from 'fastify';
import { loginSchema, refreshSchema, registerSchema } from './auth.schemas.js';
import * as authService from './auth.service.js';
import { requireAuth } from '../../shared/auth.middleware.js';

export async function authRoutes(app: FastifyInstance) {
  app.post('/register', async (req, reply) => {
    const input = registerSchema.parse(req.body);
    const result = await authService.register(input);
    return reply.code(201).send(result);
  });

  app.post('/login', async (req, reply) => {
    const input = loginSchema.parse(req.body);
    const result = await authService.login(input);
    return reply.send(result);
  });

  app.post('/refresh', async (req, reply) => {
    const { refreshToken } = refreshSchema.parse(req.body);
    const tokens = await authService.refresh(refreshToken);
    return reply.send(tokens);
  });

  app.post('/logout', async (req, reply) => {
    const { refreshToken } = refreshSchema.parse(req.body);
    await authService.logout(refreshToken);
    return reply.code(204).send();
  });

  app.get('/me', { preHandler: requireAuth }, async (req, reply) => {
    const result = await authService.me(req.usuarioId);
    return reply.send(result);
  });
}
