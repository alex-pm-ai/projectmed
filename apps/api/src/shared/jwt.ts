import jwt from 'jsonwebtoken';
import { randomUUID } from 'node:crypto';
import { env } from './env.js';

export interface AccessPayload {
  sub: string; // usuarioId
}

export interface RefreshPayload {
  sub: string;
  jti: string; // id único do refresh token (para revogação)
}

export function signAccessToken(usuarioId: string): string {
  return jwt.sign({ sub: usuarioId } satisfies AccessPayload, env.JWT_SECRET, {
    expiresIn: env.JWT_EXPIRES_IN as jwt.SignOptions['expiresIn'],
  });
}

export function signRefreshToken(usuarioId: string): { token: string; jti: string } {
  const jti = randomUUID();
  const token = jwt.sign({ sub: usuarioId, jti } satisfies RefreshPayload, env.JWT_REFRESH_SECRET, {
    expiresIn: env.JWT_REFRESH_EXPIRES_IN as jwt.SignOptions['expiresIn'],
  });
  return { token, jti };
}

export function verifyAccessToken(token: string): AccessPayload {
  return jwt.verify(token, env.JWT_SECRET) as AccessPayload;
}

export function verifyRefreshToken(token: string): RefreshPayload {
  return jwt.verify(token, env.JWT_REFRESH_SECRET) as RefreshPayload;
}
