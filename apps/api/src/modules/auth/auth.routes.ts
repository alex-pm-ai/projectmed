import type { FastifyInstance, FastifyReply } from 'fastify';
import { env } from '../../shared/env.js';
import { loginSchema, registerSchema } from './auth.schemas.js';
import * as authService from './auth.service.js';
import { requireAuth } from '../../shared/auth.middleware.js';

// O refresh token vive só neste cookie: httpOnly (JavaScript da página não lê),
// Secure em produção (só HTTPS) e restrito às rotas /auth.
export const REFRESH_COOKIE = 'pm_refresh';

function gravarCookie(reply: FastifyReply, refreshToken: string) {
  reply.setCookie(REFRESH_COOKIE, refreshToken, {
    httpOnly: true,
    secure: env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/auth',
    maxAge: authService.REFRESH_TTL_MS / 1000,
  });
}

function apagarCookie(reply: FastifyReply) {
  reply.clearCookie(REFRESH_COOKIE, { path: '/auth' });
}

// Limite mais apertado nas rotas que aceitam senha (tentativa e erro).
const limiteSenha = { rateLimit: { max: 10, timeWindow: '1 minute' } };

export async function authRoutes(app: FastifyInstance) {
  app.post('/register', { config: limiteSenha }, async (req, reply) => {
    const input = registerSchema.parse(req.body);
    const { refreshToken, ...result } = await authService.register(input);
    gravarCookie(reply, refreshToken);
    return reply.code(201).send(result);
  });

  app.post('/login', { config: limiteSenha }, async (req, reply) => {
    const input = loginSchema.parse(req.body);
    const { refreshToken, ...result } = await authService.login(input);
    gravarCookie(reply, refreshToken);
    return reply.send(result);
  });

  app.post('/refresh', async (req, reply) => {
    try {
      const { refreshToken, accessToken } = await authService.refresh(req.cookies[REFRESH_COOKIE]);
      gravarCookie(reply, refreshToken);
      return reply.send({ accessToken });
    } catch (e) {
      apagarCookie(reply);
      throw e;
    }
  });

  app.post('/logout', async (req, reply) => {
    await authService.logout(req.cookies[REFRESH_COOKIE]);
    apagarCookie(reply);
    return reply.code(204).send();
  });

  app.post('/logout-todos', { preHandler: requireAuth }, async (req, reply) => {
    await authService.revogarTodas(req.usuarioId);
    apagarCookie(reply);
    return reply.code(204).send();
  });

  app.get('/me', { preHandler: requireAuth }, async (req, reply) => {
    const result = await authService.me(req.usuarioId);
    return reply.send(result);
  });
}
