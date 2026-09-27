import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { prisma } from '../../shared/prisma.js';
import { NotFoundError } from '../../shared/errors.js';
import type { Prisma } from '@prisma/client';

const detalheSchema = z.object({
  area: z.string(),
  acertos: z.number().int().min(0),
  total: z.number().int().min(0),
});

const criarSchema = z.object({
  titulo: z.string(),
  ano: z.string(),
  dataRealizacao: z.string(),
  tempoGasto: z.number().int().min(0).default(0),
  questoesTotal: z.number().int().min(0),
  questoesAcertadas: z.number().int().min(0),
  nota: z.number().int().min(0).max(100),
  detalhePorArea: z.array(detalheSchema).default([]),
});

export async function simuladosRoutes(app: FastifyInstance) {
  app.get('/', async (req) =>
    prisma.simulado.findMany({ where: { usuarioId: req.usuarioId }, orderBy: { dataRealizacao: 'desc' } })
  );

  app.post('/', async (req, reply) => {
    const input = criarSchema.parse(req.body);
    const simulado = await prisma.simulado.create({
      data: {
        usuarioId: req.usuarioId,
        titulo: input.titulo,
        ano: input.ano,
        dataRealizacao: input.dataRealizacao,
        tempoGasto: input.tempoGasto,
        questoesTotal: input.questoesTotal,
        questoesAcertadas: input.questoesAcertadas,
        nota: input.nota,
        detalhePorArea: input.detalhePorArea as unknown as Prisma.InputJsonValue,
      },
    });
    return reply.code(201).send(simulado);
  });

  app.delete('/:id', async (req, reply) => {
    const { id } = req.params as { id: string };
    const r = await prisma.simulado.deleteMany({ where: { id, usuarioId: req.usuarioId } });
    if (r.count === 0) throw new NotFoundError('Simulado não encontrado');
    return reply.code(204).send();
  });
}
