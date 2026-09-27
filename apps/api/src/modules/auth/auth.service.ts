import bcrypt from 'bcryptjs';
import { prisma } from '../../shared/prisma.js';
import { signAccessToken, signRefreshToken, verifyRefreshToken } from '../../shared/jwt.js';
import { ConflictError, UnauthorizedError, NotFoundError } from '../../shared/errors.js';
import type { LoginInput, RegisterInput } from './auth.schemas.js';

const REFRESH_TTL_MS = 7 * 24 * 60 * 60 * 1000;

async function emitirTokens(usuarioId: string) {
  const accessToken = signAccessToken(usuarioId);
  const { token: refreshToken } = signRefreshToken(usuarioId);

  await prisma.refreshToken.create({
    data: {
      usuarioId,
      token: refreshToken,
      expiresAt: new Date(Date.now() + REFRESH_TTL_MS),
    },
  });

  return { accessToken, refreshToken };
}

function publicUser(u: { id: string; nome: string; email: string; tipo: string }) {
  return { id: u.id, nome: u.nome, email: u.email, tipo: u.tipo };
}

export async function register(input: RegisterInput) {
  const existe = await prisma.usuario.findUnique({ where: { email: input.email } });
  if (existe) throw new ConflictError('E-mail já cadastrado');

  const senhaHash = await bcrypt.hash(input.senha, 10);
  const usuario = await prisma.usuario.create({
    data: { nome: input.nome, email: input.email, senha: senhaHash, tipo: input.tipo },
  });

  const tokens = await emitirTokens(usuario.id);
  return { ...tokens, usuario: publicUser(usuario) };
}

export async function login(input: LoginInput) {
  const usuario = await prisma.usuario.findUnique({ where: { email: input.email } });
  if (!usuario) throw new UnauthorizedError('Credenciais inválidas');

  const ok = await bcrypt.compare(input.senha, usuario.senha);
  if (!ok) throw new UnauthorizedError('Credenciais inválidas');

  const tokens = await emitirTokens(usuario.id);
  return { ...tokens, usuario: publicUser(usuario) };
}

export async function refresh(refreshToken: string) {
  let payload;
  try {
    payload = verifyRefreshToken(refreshToken);
  } catch {
    throw new UnauthorizedError('Refresh token inválido');
  }

  const stored = await prisma.refreshToken.findUnique({ where: { token: refreshToken } });
  if (!stored || stored.revoked || stored.expiresAt.getTime() < Date.now()) {
    throw new UnauthorizedError('Sessão expirada, faça login novamente');
  }

  // Rotação: revoga o antigo e emite um novo par
  await prisma.refreshToken.update({ where: { id: stored.id }, data: { revoked: true } });
  return emitirTokens(payload.sub);
}

export async function logout(refreshToken: string) {
  await prisma.refreshToken.updateMany({
    where: { token: refreshToken },
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
  const assinaturaAtiva = !!a && a.status === 'ativa' && a.validoAte.getTime() > Date.now();

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
