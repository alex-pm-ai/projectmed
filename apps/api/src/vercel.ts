import type { IncomingMessage, ServerResponse } from 'node:http';
import type { FastifyInstance } from 'fastify';
import { buildApp } from './app.js';

/**
 * Entrada da API na Vercel (função serverless). Empacotada pelo esbuild em
 * dist/vercel.mjs (npm run build:vercel) e exposta em /api/handler.js.
 *
 * A Vercel reescreve /api/<caminho>?<query> para /api/handler?__path=<caminho>&<query>
 * (ver vercel.json); aqui devolvemos a URL original sem o /api para o Fastify,
 * que continua com as mesmas rotas do desenvolvimento (/auth, /billing, /app...).
 */
let pronto: Promise<FastifyInstance> | null = null;

export default async function handler(req: IncomingMessage, res: ServerResponse) {
  pronto ??= buildApp().then(async (app) => {
    await app.ready();
    return app;
  });
  const app = await pronto;

  const url = new URL(req.url ?? '/', 'http://localhost');
  const caminho = url.searchParams.get('__path') ?? '';
  url.searchParams.delete('__path');
  const query = url.searchParams.toString();
  req.url = `/${caminho}${query ? `?${query}` : ''}`;

  app.server.emit('request', req, res);
}
