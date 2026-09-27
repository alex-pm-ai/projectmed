import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import * as service from './revisoes.service.js';

const criarSchema = z.object({
  tipo: z.string(),
  grandeArea: z.string(),
  subArea: z.string(),
  dataRevisao: z.string(),
  tempoEstudo: z.number().int().min(0).default(0),
  questoesFeitas: z.number().int().min(0).default(0),
  questoesAcertadas: z.number().int().min(0).default(0),
  aproveitamento: z.number().int().min(0).max(100).default(0),
  status: z.enum(['Pendente', 'Concluída', 'Atrasada']),
  proximaRevisao: z.string().nullable().default(null),
  gerarRevisaoInteligente: z.boolean().default(true),
});

const concluirSchema = z.object({
  questoesFeitas: z.number().int().min(0),
  questoesAcertadas: z.number().int().min(0),
  tempoEstudo: z.number().int().min(0),
});

export async function revisoesRoutes(app: FastifyInstance) {
  app.get('/', async (req) => service.listar(req.usuarioId));

  app.post('/', async (req, reply) => {
    const input = criarSchema.parse(req.body);
    return reply.code(201).send(await service.criar(req.usuarioId, input));
  });

  app.patch('/:id', async (req) => {
    const { id } = req.params as { id: string };
    const data = criarSchema.partial().parse(req.body);
    return service.atualizar(req.usuarioId, id, data);
  });

  app.delete('/:id', async (req, reply) => {
    const { id } = req.params as { id: string };
    await service.remover(req.usuarioId, id);
    return reply.code(204).send();
  });

  app.post('/:id/concluir', async (req) => {
    const { id } = req.params as { id: string };
    const payload = concluirSchema.parse(req.body);
    return service.concluir(req.usuarioId, id, payload);
  });

  app.post('/redistribuir', async (req) => service.redistribuir(req.usuarioId));
}
