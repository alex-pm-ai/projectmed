import { prisma } from '../../shared/prisma.js';
import { env } from '../../shared/env.js';
import { signAccessToken } from '../../shared/jwt.js';
import { gerarToken, sha256 } from '../../shared/crypto.js';
import { acessoLiberado } from '../../domain/assinatura.js';
import { hashSenha, verificarSenha, verificarSenhaFalsa } from '../../shared/password.js';
import { AppError, ConflictError, UnauthorizedError, NotFoundError } from '../../shared/errors.js';
import type { LoginInput, RegisterInput } from './auth.schemas.js';

export const REFRESH_TTL_MS = env.REFRESH_TOKEN_DIAS * 24 * 60 * 60 * 1000;

// Depois de MAX_FALHAS senhas erradas seguidas, a conta fica bloqueada por BLOQUEIO_MS.
const MAX_FALHAS = 5;
const BLOQUEIO_MS = 15 * 60 * 1000;

/**
 * Emite um par de tokens:
 * - accessToken: JWT curto, devolvido no corpo da resposta.
 * - refreshToken: valor aleatório que vai SÓ no cookie httpOnly (ver auth.routes.ts).
 *   No banco guardamos apenas o SHA-256 dele.
 */
async function emitirTokens(usuarioId: string) {
  const accessToken = signAccessToken(usuarioId);
  const { token: refreshToken, tokenHash } = gerarToken();

  await prisma.refreshToken.create({
    data: { usuarioId, tokenHash, expiresAt: new Date(Date.now() + REFRESH_TTL_MS) },
  });

  return { accessToken, refreshToken };
}

function publicUser(u: {
  id: string;
  nome: string;
  email: string;
  tipo: string | null;
  papel: string;
  emailVerificadoEm: Date | null;
}) {
  return {
    id: u.id,
    nome: u.nome,
    email: u.email,
    tipo: u.tipo,
    papel: u.papel,
    emailVerificado: !!u.emailVerificadoEm,
  };
}

export async function register(input: RegisterInput) {
  const existe = await prisma.usuario.findUnique({ where: { email: input.email } });
  if (existe) throw new ConflictError('E-mail já cadastrado');

  const usuario = await prisma.usuario.create({
    data: {
      nome: input.nome,
      email: input.email,
      senhaHash: await hashSenha(input.senha),
      tipo: input.tipo,
      ultimoLoginEm: new Date(),
    },
  });

  const tokens = await emitirTokens(usuario.id);
  return { ...tokens, usuario: publicUser(usuario) };
}

export async function login(input: LoginInput) {
  const usuario = await prisma.usuario.findUnique({ where: { email: input.email } });
  if (!usuario) {
    await verificarSenhaFalsa(input.senha); // mesmo tempo de resposta de um e-mail existente
    throw new UnauthorizedError('E-mail ou senha inválidos');
  }

  if (usuario.bloqueadoAte && usuario.bloqueadoAte.getTime() > Date.now()) {
    throw new AppError('Muitas tentativas. Tente novamente em alguns minutos.', 429, 'conta_bloqueada');
  }

  const { ok, precisaRehash } = await verificarSenha(usuario.senhaHash, input.senha);
  if (!ok) {
    const falhas = usuario.tentativasLoginFalhas + 1;
    await prisma.usuario.update({
      where: { id: usuario.id },
      data: falhas >= MAX_FALHAS
        ? { tentativasLoginFalhas: 0, bloqueadoAte: new Date(Date.now() + BLOQUEIO_MS) }
        : { tentativasLoginFalhas: falhas },
    });
    throw new UnauthorizedError('E-mail ou senha inválidos');
  }

  await prisma.usuario.update({
    where: { id: usuario.id },
    data: {
      tentativasLoginFalhas: 0,
      bloqueadoAte: null,
      ultimoLoginEm: new Date(),
      // Hash antigo (bcrypt) → regrava em Argon2id agora que temos a senha correta
      ...(precisaRehash ? { senhaHash: await hashSenha(input.senha) } : {}),
    },
  });

  const tokens = await emitirTokens(usuario.id);
  return { ...tokens, usuario: publicUser(usuario) };
}

export async function refresh(refreshToken: string | undefined) {
  if (!refreshToken) throw new UnauthorizedError('Sessão expirada, faça login novamente');

  const stored = await prisma.refreshToken.findUnique({ where: { tokenHash: sha256(refreshToken) } });
  if (!stored) throw new UnauthorizedError('Sessão expirada, faça login novamente');

  // Token já usado sendo reapresentado = provável roubo (o dono legítimo já recebeu um novo).
  // Por segurança, derruba todas as sessões desse usuário.
  if (stored.revoked) {
    await revogarTodas(stored.usuarioId);
    throw new UnauthorizedError('Sessão expirada, faça login novamente');
  }
  if (stored.expiresAt.getTime() < Date.now()) {
    throw new UnauthorizedError('Sessão expirada, faça login novamente');
  }

  // Rotação: revoga o antigo e emite um novo par
  await prisma.refreshToken.update({ where: { id: stored.id }, data: { revoked: true } });
  return emitirTokens(stored.usuarioId);
}

export async function logout(refreshToken: string | undefined) {
  if (!refreshToken) return;
  await prisma.refreshToken.updateMany({
    where: { tokenHash: sha256(refreshToken) },
    data: { revoked: true },
  });
}

/** "Sair de todos os dispositivos" — e também usado ao trocar a senha. */
export async function revogarTodas(usuarioId: string) {
  await prisma.refreshToken.updateMany({
    where: { usuarioId, revoked: false },
    data: { revoked: true },
  });
}

export async function me(usuarioId: string) {
  const usuario = await prisma.usuario.findUnique({
    where: { id: usuarioId },
    include: { assinatura: { include: { plano: true } } },
  });
  if (!usuario) throw new NotFoundError('Usuário não encontrado');

  const a = usuario.assinatura;
  const assinaturaAtiva = acessoLiberado(a);

  // Admin entra sem assinatura (mesma regra do requireAssinatura).
  if (usuario.papel === 'admin') {
    return {
      usuario: publicUser(usuario),
      assinatura: { status: 'admin', validoAte: null, ativa: true, plano: null },
    };
  }

  return {
    usuario: publicUser(usuario),
    assinatura: a
      ? {
          status: a.status,
          validoAte: a.validoAte,
          ativa: assinaturaAtiva,
          plano: a.plano ? { nome: a.plano.nome, intervalo: a.plano.intervalo } : null,
        }
      : { status: 'sem_assinatura', validoAte: null, ativa: false, plano: null },
  };
}
