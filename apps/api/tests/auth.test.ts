import { describe, it, expect, beforeAll, beforeEach } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { getApp, resetDb, registrar } from './setup/helpers.js';

describe('Autenticação (/auth)', () => {
  let app: FastifyInstance;
  beforeAll(async () => {
    app = await getApp();
  });
  beforeEach(async () => {
    await resetDb();
  });

  it('registra um novo usuário e retorna access + refresh token', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/auth/register',
      payload: { nome: 'João', email: 'joao@test.com', senha: 'senha123', tipo: 'R1' },
    });
    expect(res.statusCode).toBe(201);
    const body = res.json();
    expect(body.accessToken).toBeTruthy();
    expect(body.refreshToken).toBeTruthy();
    expect(body.usuario.email).toBe('joao@test.com');
    expect(body.usuario).not.toHaveProperty('senha'); // nunca vaza a senha
  });

  it('recusa cadastro com e-mail duplicado (409)', async () => {
    await registrar(app, false, 'dup@test.com');
    const res = await app.inject({
      method: 'POST',
      url: '/auth/register',
      payload: { nome: 'Outro', email: 'dup@test.com', senha: 'senha123', tipo: 'R1' },
    });
    expect(res.statusCode).toBe(409);
  });

  it('valida o corpo do cadastro (senha curta → 400)', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/auth/register',
      payload: { nome: 'X', email: 'x@test.com', senha: '123', tipo: 'R1' },
    });
    expect(res.statusCode).toBe(400);
  });

  it('faz login com credenciais corretas', async () => {
    await registrar(app, false, 'login@test.com');
    const res = await app.inject({
      method: 'POST',
      url: '/auth/login',
      payload: { email: 'login@test.com', senha: 'senha123' },
    });
    expect(res.statusCode).toBe(200);
    expect(res.json().accessToken).toBeTruthy();
  });

  it('rejeita login com senha errada (401)', async () => {
    await registrar(app, false, 'login2@test.com');
    const res = await app.inject({
      method: 'POST',
      url: '/auth/login',
      payload: { email: 'login2@test.com', senha: 'errada' },
    });
    expect(res.statusCode).toBe(401);
  });

  it('/auth/me retorna o usuário e assinatura "sem_assinatura" para conta nova', async () => {
    const u = await registrar(app, false);
    const res = await app.inject({ method: 'GET', url: '/auth/me', headers: u.headers });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.usuario.email).toBe(u.email);
    expect(body.assinatura.ativa).toBe(false);
    expect(body.assinatura.status).toBe('sem_assinatura');
  });

  it('/auth/me sem token retorna 401', async () => {
    const res = await app.inject({ method: 'GET', url: '/auth/me' });
    expect(res.statusCode).toBe(401);
  });

  it('renova o access token via refresh válido', async () => {
    const u = await registrar(app, false);
    const res = await app.inject({
      method: 'POST',
      url: '/auth/refresh',
      payload: { refreshToken: u.refreshToken },
    });
    expect(res.statusCode).toBe(200);
    expect(res.json().accessToken).toBeTruthy();
  });

  it('rejeita refresh com token inválido (401)', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/auth/refresh',
      payload: { refreshToken: 'token-invalido' },
    });
    expect(res.statusCode).toBe(401);
  });
});
