import { prisma } from '../../shared/prisma.js';
import { ConflictError, NotFoundError } from '../../shared/errors.js';
import { AREAS_PADRAO, CORES_AREA } from '../../domain/conteudosPadrao.js';
import { calcularDesempenho } from '../../domain/desempenho.js';

const porNome = (a: { nome: string }, b: { nome: string }) => a.nome.localeCompare(b.nome, 'pt-BR');

/** Na primeira vez, copia as áreas/conteúdos padrão para o usuário (depois são dele). */
async function garantirAreasIniciais(usuarioId: string) {
  const u = await prisma.usuario.findUnique({ where: { id: usuarioId }, select: { areasIniciadasEm: true } });
  if (!u || u.areasIniciadasEm) return;

  await prisma.$transaction(async (tx) => {
    for (const a of AREAS_PADRAO) {
      const area = await tx.area.create({ data: { usuarioId, nome: a.nome, cor: a.cor } });
      await tx.conteudo.createMany({
        data: [...new Set(a.conteudos)].map((nome) => ({ usuarioId, areaId: area.id, nome })),
        skipDuplicates: true,
      });
    }
    await tx.usuario.update({ where: { id: usuarioId }, data: { areasIniciadasEm: new Date() } });
  });
}

/** Áreas e conteúdos em ordem alfabética, cada conteúdo com o desempenho histórico. */
export async function listar(usuarioId: string) {
  await garantirAreasIniciais(usuarioId);

  const [areas, revisoes, simulados] = await Promise.all([
    prisma.area.findMany({ where: { usuarioId }, include: { conteudos: true } }),
    prisma.revisao.findMany({ where: { usuarioId, status: 'Concluída', questoesFeitas: { gt: 0 } } }),
    prisma.simulado.findMany({ where: { usuarioId }, select: { detalhePorArea: true } }),
  ]);
  const desempenho = calcularDesempenho(revisoes, simulados);

  return areas.sort(porNome).map((a) => ({
    id: a.id,
    nome: a.nome,
    cor: a.cor,
    conteudos: a.conteudos.sort(porNome).map((c) => ({
      id: c.id,
      areaId: a.id,
      nome: c.nome,
      ...desempenho.de(a.nome, c.nome),
    })),
  }));
}

async function areaDoUsuario(usuarioId: string, id: string) {
  const area = await prisma.area.findFirst({ where: { id, usuarioId } });
  if (!area) throw new NotFoundError('Área não encontrada');
  return area;
}

async function nomeAreaLivre(usuarioId: string, nome: string, ignorarId?: string) {
  const existe = await prisma.area.findFirst({ where: { usuarioId, nome, NOT: ignorarId ? { id: ignorarId } : undefined } });
  if (existe) throw new ConflictError('Já existe uma área com esse nome');
}

export async function criarArea(usuarioId: string, input: { nome: string; cor?: string }) {
  await nomeAreaLivre(usuarioId, input.nome);
  const total = await prisma.area.count({ where: { usuarioId } });
  return prisma.area.create({
    data: { usuarioId, nome: input.nome, cor: input.cor ?? CORES_AREA[total % CORES_AREA.length] },
  });
}

/** Renomear a área também renomeia nas revisões, para o histórico continuar ligado a ela. */
export async function atualizarArea(usuarioId: string, id: string, input: { nome?: string; cor?: string }) {
  const area = await areaDoUsuario(usuarioId, id);
  if (input.nome && input.nome !== area.nome) await nomeAreaLivre(usuarioId, input.nome, id);

  const [atualizada] = await prisma.$transaction([
    prisma.area.update({ where: { id }, data: input }),
    ...(input.nome && input.nome !== area.nome
      ? [prisma.revisao.updateMany({ where: { usuarioId, grandeArea: area.nome }, data: { grandeArea: input.nome } })]
      : []),
  ]);
  return atualizada;
}

/** Exclui a área e seus conteúdos. As revisões já feitas continuam no histórico. */
export async function removerArea(usuarioId: string, id: string) {
  await areaDoUsuario(usuarioId, id);
  await prisma.area.delete({ where: { id } });
}

async function conteudoDoUsuario(usuarioId: string, id: string) {
  const c = await prisma.conteudo.findFirst({ where: { id, usuarioId }, include: { area: true } });
  if (!c) throw new NotFoundError('Conteúdo não encontrado');
  return c;
}

async function nomeConteudoLivre(areaId: string, nome: string, ignorarId?: string) {
  const existe = await prisma.conteudo.findFirst({ where: { areaId, nome, NOT: ignorarId ? { id: ignorarId } : undefined } });
  if (existe) throw new ConflictError('Esse conteúdo já existe nessa área');
}

export async function criarConteudo(usuarioId: string, input: { areaId: string; nome: string }) {
  await areaDoUsuario(usuarioId, input.areaId);
  await nomeConteudoLivre(input.areaId, input.nome);
  return prisma.conteudo.create({ data: { usuarioId, areaId: input.areaId, nome: input.nome } });
}

/** Renomear ou mudar de área também atualiza as revisões desse conteúdo. */
export async function atualizarConteudo(usuarioId: string, id: string, input: { nome?: string; areaId?: string }) {
  const atual = await conteudoDoUsuario(usuarioId, id);
  const novaArea = input.areaId ? await areaDoUsuario(usuarioId, input.areaId) : atual.area;
  const novoNome = input.nome ?? atual.nome;
  if (novaArea.id !== atual.areaId || novoNome !== atual.nome) await nomeConteudoLivre(novaArea.id, novoNome, id);

  const [atualizado] = await prisma.$transaction([
    prisma.conteudo.update({ where: { id }, data: { nome: novoNome, areaId: novaArea.id } }),
    prisma.revisao.updateMany({
      where: { usuarioId, grandeArea: atual.area.nome, subArea: atual.nome },
      data: { grandeArea: novaArea.nome, subArea: novoNome },
    }),
  ]);
  return atualizado;
}

export async function removerConteudo(usuarioId: string, id: string) {
  await conteudoDoUsuario(usuarioId, id);
  await prisma.conteudo.delete({ where: { id } });
}
