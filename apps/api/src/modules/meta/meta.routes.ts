import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { prisma } from '../../shared/prisma.js';

const putSchema = z.object({ meta: z.number().int().min(1) });

export async function metaRoutes(app: FastifyInstance) {
  app.get('/', async (req) => {
    const m = await prisma.metaSemanal.findUnique({ where: { usuarioId: req.usuarioId } });
    return { meta: m?.meta ?? 150 };
  });

  app.put('/', async (req) => {
    const { meta } = putSchema.parse(req.body);
    const m = await prisma.metaSemanal.upsert({
      where: { usuarioId: req.usuarioId },
      create: { usuarioId: req.usuarioId, meta },
      update: { meta },
    });
    return { meta: m.meta };
  });
}
