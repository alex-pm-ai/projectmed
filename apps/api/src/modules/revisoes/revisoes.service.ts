import { prisma } from '../../shared/prisma.js';
import { NotFoundError } from '../../shared/errors.js';
import { calcularAproveitamento, calcularProximaRevisao, DEFAULT_FAIXAS, type Faixa } from '../../domain/algoritmo.js';
import { today, daysFromNow, isPast } from '../../domain/date.js';

export interface CriarRevisaoInput {
  tipo: string;
  grandeArea: string;
  subArea: string;
  dataRevisao: string;
  tempoEstudo: number;
  questoesFeitas: number;
  questoesAcertadas: number;
  aproveitamento: number;
  status: string;
  proximaRevisao: string | null;
  gerarRevisaoInteligente: boolean;
}

async function getFaixas(usuarioId: string): Promise<Faixa[]> {
  const cfg = await prisma.configAlgoritmo.findUnique({ where: { usuarioId } });
  return (cfg?.faixas as unknown as Faixa[]) ?? DEFAULT_FAIXAS;
}

export function listar(usuarioId: string) {
  return prisma.revisao.findMany({
    where: { usuarioId },
    orderBy: { dataRevisao: 'desc' },
  });
}

export function criar(usuarioId: string, input: CriarRevisaoInput) {
  return prisma.revisao.create({ data: { ...input, usuarioId } });
}

export async function atualizar(usuarioId: string, id: string, data: Partial<CriarRevisaoInput>) {
  const existe = await prisma.revisao.findFirst({ where: { id, usuarioId } });
  if (!existe) throw new NotFoundError('Revisão não encontrada');
  return prisma.revisao.update({ where: { id }, data });
}

export async function remover(usuarioId: string, id: string) {
  const r = await prisma.revisao.deleteMany({ where: { id, usuarioId } });
  if (r.count === 0) throw new NotFoundError('Revisão não encontrada');
}

/** Conclui uma revisão pendente e (se inteligente) agenda a próxima automaticamente. */
export async function concluir(
  usuarioId: string,
  id: string,
  payload: { questoesFeitas: number; questoesAcertadas: number; tempoEstudo: number }
) {
  const rev = await prisma.revisao.findFirst({ where: { id, usuarioId } });
  if (!rev) throw new NotFoundError('Revisão não encontrada');

  const faixas = await getFaixas(usuarioId);
  const ap = calcularAproveitamento(payload.questoesFeitas, payload.questoesAcertadas);
  const proxima = calcularProximaRevisao(ap, today(), faixas);

  const concluida = await prisma.revisao.update({
    where: { id },
    data: {
      status: 'Concluída',
      questoesFeitas: payload.questoesFeitas,
      questoesAcertadas: payload.questoesAcertadas,
      aproveitamento: ap,
      tempoEstudo: payload.tempoEstudo,
      dataRevisao: today(),
      proximaRevisao: proxima,
    },
  });

  let novaPendente = null;
  if (rev.gerarRevisaoInteligente) {
    novaPendente = await prisma.revisao.create({
      data: {
        usuarioId,
        tipo: rev.tipo,
        grandeArea: rev.grandeArea,
        subArea: rev.subArea,
        dataRevisao: proxima,
        tempoEstudo: 0,
        questoesFeitas: 0,
        questoesAcertadas: 0,
        aproveitamento: 0,
        status: 'Pendente',
        proximaRevisao: null,
        gerarRevisaoInteligente: true,
      },
    });
  }

  return { concluida, novaPendente };
}

/** Redistribui as revisões atrasadas a partir de amanhã, em grupos por dia. */
export async function redistribuir(usuarioId: string) {
  const revisoes = await prisma.revisao.findMany({ where: { usuarioId } });
  const atrasadas = revisoes.filter(
    (r) => (r.status === 'Pendente' || r.status === 'Atrasada') && isPast(r.dataRevisao)
  );
  if (atrasadas.length === 0) return listar(usuarioId);

  const perDay = Math.ceil(atrasadas.length / 7);
  await prisma.$transaction(
    atrasadas.map((r, idx) => {
      const daysOffset = Math.floor(idx / perDay) + 1;
      return prisma.revisao.update({
        where: { id: r.id },
        data: { dataRevisao: daysFromNow(daysOffset), status: 'Pendente' },
      });
    })
  );
  return listar(usuarioId);
}
