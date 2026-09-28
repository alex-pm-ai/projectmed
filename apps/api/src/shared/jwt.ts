import jwt from 'jsonwebtoken';
import { env } from './env.js';

// Só o access token é JWT (curto, vai no header Authorization e fica só na memória
// do navegador). O refresh token é um valor aleatório opaco num cookie httpOnly —
// ver auth.service.ts.

export interface AccessPayload {
  sub: string; // usuarioId
}

export function signAccessToken(usuarioId: string): string {
  return jwt.sign({ sub: usuarioId } satisfies AccessPayload, env.JWT_SECRET, {
    expiresIn: env.JWT_EXPIRES_IN as jwt.SignOptions['expiresIn'],
  });
}

export function verifyAccessToken(token: string): AccessPayload {
  return jwt.verify(token, env.JWT_SECRET) as AccessPayload;
}
