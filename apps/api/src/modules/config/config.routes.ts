import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { prisma } from '../../shared/prisma.js';
import { DEFAULT_FAIXAS } from '../../domain/algoritmo.js';
import type { Prisma } from '@prisma/client';

const faixaSchema = z.object({
  min: z.number().int(),
  max: z.number().int(),
  dias: z.number().int().min(1),
  label: z.enum(['Atenção', 'Bom', 'Excelente']),
});

const putSchema = z.object({ faixas: z.array(faixaSchema).min(1) });

export async function configRoutes(app: FastifyInstance) {
  // GET → config do usuário, ou o padrão se ainda não personalizou
  app.get('/', async (req) => {
    const cfg = await prisma.configAlgoritmo.findUnique({ where: { usuarioId: req.usuarioId } });
    return { faixas: cfg?.faixas ?? DEFAULT_FAIXAS };
  });

  app.put('/', async (req) => {
    const { faixas } = putSchema.parse(req.body);
    const json = faixas as unknown as Prisma.InputJsonValue;
    const cfg = await prisma.configAlgoritmo.upsert({
      where: { usuarioId: req.usuarioId },
      create: { usuarioId: req.usuarioId, faixas: json },
      update: { faixas: json },
    });
    return { faixas: cfg.faixas };
  });
}
