import 'fastify';

declare module 'fastify' {
  interface FastifyRequest {
    usuarioId: string;
  }
}
