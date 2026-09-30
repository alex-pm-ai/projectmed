import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import * as service from './areas.service.js';

const nome = z.string().trim().min(1, 'Informe um nome').max(120);
const cor = z.string().regex(/^#[0-9a-fA-F]{6}$/, 'Cor inválida');

const areaSchema = z.object({ nome, cor: cor.optional() });
const conteudoSchema = z.object({ areaId: z.string().min(1), nome });

export async function areasRoutes(app: FastifyInstance) {
  app.get('/', async (req) => service.listar(req.usuarioId));

  app.post('/', async (req, reply) => {
    const input = areaSchema.parse(req.body);
    return reply.code(201).send(await service.criarArea(req.usuarioId, input));
  });

  app.patch('/:id', async (req) => {
    const { id } = req.params as { id: string };
    return service.atualizarArea(req.usuarioId, id, areaSchema.partial().parse(req.body));
  });

  app.delete('/:id', async (req, reply) => {
    const { id } = req.params as { id: string };
    await service.removerArea(req.usuarioId, id);
    return reply.code(204).send();
  });
}

export async function conteudosRoutes(app: FastifyInstance) {
  app.post('/', async (req, reply) => {
    const input = conteudoSchema.parse(req.body);
    return reply.code(201).send(await service.criarConteudo(req.usuarioId, input));
  });

  app.patch('/:id', async (req) => {
    const { id } = req.params as { id: string };
    return service.atualizarConteudo(req.usuarioId, id, conteudoSchema.partial().parse(req.body));
  });

  app.delete('/:id', async (req, reply) => {
    const { id } = req.params as { id: string };
    await service.removerConteudo(req.usuarioId, id);
    return reply.code(204).send();
  });
}
