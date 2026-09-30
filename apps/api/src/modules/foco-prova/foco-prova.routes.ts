import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { prisma } from '../../shared/prisma.js';
import { AppError } from '../../shared/errors.js';
import { DEFAULT_FAIXAS, type Faixa } from '../../domain/algoritmo.js';
import { calcularDesempenho } from '../../domain/desempenho.js';
import { gerarCronograma } from '../../domain/cronograma.js';
import { daysBetween, daysFromNow, today } from '../../domain/date.js';

const gerarSchema = z.object({
  dataProva: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  conteudoIds: z.array(z.string()).min(1, 'Selecione ao menos um conteúdo').max(1000),
  maxPorDia: z.number().int().min(1).max(50).default(6),
});

export async function focoProvaRoutes(app: FastifyInstance) {
  /**
   * Gera o cronograma: usa o histórico de acertos/erros de cada conteúdo e as faixas
   * do algoritmo de revisão do usuário (ver domain/cronograma.ts).
   * Substitui o cronograma Foco Prova pendente anterior (revisões concluídas ficam).
   */
  app.post('/cronograma', async (req) => {
    const { dataProva, conteudoIds, maxPorDia } = gerarSchema.parse(req.body);
    const usuarioId = req.usuarioId;

    const dias = daysBetween(today(), dataProva);
    if (dias <= 0) throw new AppError('A data da prova precisa ser depois de hoje', 400, 'data_invalida');

    const [conteudos, revisoes, simulados, cfg] = await Promise.all([
      prisma.conteudo.findMany({ where: { usuarioId, id: { in: conteudoIds } }, include: { area: true } }),
      prisma.revisao.findMany({ where: { usuarioId, status: 'Concluída', questoesFeitas: { gt: 0 } } }),
      prisma.simulado.findMany({ where: { usuarioId }, select: { detalhePorArea: true } }),
      prisma.configAlgoritmo.findUnique({ where: { usuarioId } }),
    ]);
    if (conteudos.length === 0) throw new AppError('Nenhum conteúdo válido selecionado', 400, 'sem_conteudos');

    const faixas = (cfg?.faixas as unknown as Faixa[]) ?? DEFAULT_FAIXAS;
    const desempenho = calcularDesempenho(revisoes, simulados);

    const resultado = gerarCronograma(
      conteudos.map((c) => ({
        area: c.area.nome,
        conteudo: c.nome,
        aproveitamento: desempenho.de(c.area.nome, c.nome).aproveitamento,
      })),
      faixas,
      dias,
      maxPorDia
    );

    await prisma.$transaction([
      prisma.revisao.deleteMany({ where: { usuarioId, origem: 'foco_prova', status: 'Pendente' } }),
      prisma.revisao.createMany({
        data: resultado.sessoes.map((s) => ({
          usuarioId,
          origem: 'foco_prova',
          tipo: 'Questoes',
          grandeArea: s.area,
          subArea: s.conteudo,
          dataRevisao: daysFromNow(s.offset),
          status: 'Pendente',
          // O cronograma já traz as próximas repetições; ao concluir, não gera outra.
          gerarRevisaoInteligente: false,
        })),
      }),
    ]);

    return {
      sessoes: resultado.sessoes.length,
      conteudos: conteudos.length,
      dias,
      naoAgendados: resultado.naoAgendados.map((n) => `${n.conteudo} (${n.area})`),
    };
  });

  /** Apaga só as revisões pendentes geradas pelo Foco Prova (as manuais ficam). */
  app.delete('/cronograma', async (req) => {
    const r = await prisma.revisao.deleteMany({
      where: { usuarioId: req.usuarioId, origem: 'foco_prova', status: 'Pendente' },
    });
    return { removidas: r.count };
  });
}
