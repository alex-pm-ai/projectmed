import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { prisma } from '../../shared/prisma.js';
import { NotFoundError } from '../../shared/errors.js';

const criarSchema = z.object({ texto: z.string().min(1) });
const updateSchema = z.object({
  texto: z.string().min(1).optional(),
  concluida: z.boolean().optional(),
});

export async function tarefasRoutes(app: FastifyInstance) {
  app.get('/', async (req) =>
    prisma.tarefa.findMany({ where: { usuarioId: req.usuarioId }, orderBy: { createdAt: 'desc' } })
  );

  app.post('/', async (req, reply) => {
    const { texto } = criarSchema.parse(req.body);
    const tarefa = await prisma.tarefa.create({ data: { usuarioId: req.usuarioId, texto } });
    return reply.code(201).send(tarefa);
  });

  // DELETE específico ANTES do /:id para não colidir
  app.delete('/concluidas', async (req, reply) => {
    await prisma.tarefa.deleteMany({ where: { usuarioId: req.usuarioId, concluida: true } });
    return reply.code(204).send();
  });

  app.patch('/:id', async (req) => {
    const { id } = req.params as { id: string };
    const data = updateSchema.parse(req.body);
    const existe = await prisma.tarefa.findFirst({ where: { id, usuarioId: req.usuarioId } });
    if (!existe) throw new NotFoundError('Tarefa não encontrada');
    return prisma.tarefa.update({ where: { id }, data });
  });

  app.delete('/:id', async (req, reply) => {
    const { id } = req.params as { id: string };
    const r = await prisma.tarefa.deleteMany({ where: { id, usuarioId: req.usuarioId } });
    if (r.count === 0) throw new NotFoundError('Tarefa não encontrada');
    return reply.code(204).send();
  });
}
