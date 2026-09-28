import { describe, it, expect, beforeAll, beforeEach } from 'vitest';
import type { FastifyInstance } from 'fastify';
import bcrypt from 'bcryptjs';
import { getApp, resetDb, registrar, refreshDoCookie, prisma, SENHA_TESTE } from './setup/helpers.js';

describe('Autenticação (/auth)', () => {
  let app: FastifyInstance;
  beforeAll(async () => {
    app = await getApp();
  });
  beforeEach(async () => {
    await resetDb();
  });

  const login = (email: string, senha: string) =>
    app.inject({ method: 'POST', url: '/auth/login', payload: { email, senha } });

  const refresh = (token: string) =>
    app.inject({ method: 'POST', url: '/auth/refresh', cookies: { pm_refresh: token } });

  it('registra um usuário: access token no corpo, refresh token só no cookie httpOnly', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/auth/register',
      payload: { nome: 'Ana', email: 'ana@test.com', senha: SENHA_TESTE, tipo: 'R1' },
    });
    expect(res.statusCode).toBe(201);
    const body = res.json();
    expect(body.accessToken).toBeTruthy();
    expect(body).not.toHaveProperty('refreshToken'); // não fica acessível ao JavaScript
    expect(body.usuario.email).toBe('ana@test.com');
    expect(body.usuario).not.toHaveProperty('senhaHash'); // nunca vaza a senha

    const cookie = res.cookies.find((c) => c.name === 'pm_refresh');
    expect(cookie?.value).toBeTruthy();
    expect(cookie?.httpOnly).toBe(true);
    expect(cookie?.path).toBe('/auth');
  });

  it('guarda a senha como hash Argon2id e o refresh token só como hash', async () => {
    const u = await registrar(app);
    const db = await prisma.usuario.findUniqueOrThrow({ where: { id: u.usuario.id } });
    expect(db.senhaHash.startsWith('$argon2id$')).toBe(true);
    expect(db.senhaHash).not.toContain(SENHA_TESTE);

    const tokens = await prisma.refreshToken.findMany({ where: { usuarioId: u.usuario.id } });
    expect(tokens).toHaveLength(1);
    expect(tokens[0].tokenHash).not.toBe(u.refreshToken);
  });

  it('normaliza o e-mail (maiúsculas e espaços viram a mesma conta)', async () => {
    await registrar(app, false, 'alex@test.com');
    const dup = await app.inject({
      method: 'POST',
      url: '/auth/register',
      payload: { nome: 'Outro', email: '  ALEX@Test.com ', senha: SENHA_TESTE, tipo: 'R1' },
    });
    expect(dup.statusCode).toBe(409);
    expect((await login(' Alex@TEST.com', SENHA_TESTE)).statusCode).toBe(200);
  });

  it('recusa senha curta ou comum demais (400)', async () => {
    for (const senha of ['1234567', 'senha123', '12345678']) {
      const res = await app.inject({
        method: 'POST',
        url: '/auth/register',
        payload: { nome: 'Xis', email: 'x@test.com', senha, tipo: 'R1' },
      });
      expect(res.statusCode).toBe(400);
    }
  });

  it('faz login com credenciais corretas', async () => {
    await registrar(app, false, 'login@test.com');
    const res = await login('login@test.com', SENHA_TESTE);
    expect(res.statusCode).toBe(200);
    expect(res.json().accessToken).toBeTruthy();
    expect(refreshDoCookie(res)).toBeTruthy();
  });

  it('mesma mensagem para senha errada e e-mail inexistente (não revela quem tem conta)', async () => {
    await registrar(app, false, 'login2@test.com');
    const senhaErrada = await login('login2@test.com', 'errada-123');
    const naoExiste = await login('ninguem@test.com', 'errada-123');
    expect(senhaErrada.statusCode).toBe(401);
    expect(naoExiste.statusCode).toBe(401);
    expect(senhaErrada.json().message).toBe(naoExiste.json().message);
  });

  it('bloqueia a conta por alguns minutos após 5 senhas erradas seguidas', async () => {
    await registrar(app, false, 'bloq@test.com');
    for (let i = 0; i < 5; i++) {
      expect((await login('bloq@test.com', 'errada-123')).statusCode).toBe(401);
    }
    // Mesmo com a senha certa, fica bloqueado
    const res = await login('bloq@test.com', SENHA_TESTE);
    expect(res.statusCode).toBe(429);
    expect(res.json().error).toBe('conta_bloqueada');
  });

  it('aceita hash bcrypt antigo e o converte para Argon2id no login', async () => {
    const u = await registrar(app, false, 'legado@test.com');
    await prisma.usuario.update({
      where: { id: u.usuario.id },
      data: { senhaHash: await bcrypt.hash('Senha-Antiga#1', 10) },
    });

    expect((await login('legado@test.com', 'Senha-Antiga#1')).statusCode).toBe(200);
    const db = await prisma.usuario.findUniqueOrThrow({ where: { id: u.usuario.id } });
    expect(db.senhaHash.startsWith('$argon2id$')).toBe(true);
  });

  it('/auth/me retorna o usuário e assinatura "sem_assinatura" para conta nova', async () => {
    const u = await registrar(app, false);
    const res = await app.inject({ method: 'GET', url: '/auth/me', headers: u.headers });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.usuario.email).toBe(u.email);
    expect(body.usuario.emailVerificado).toBe(false);
    expect(body.assinatura.ativa).toBe(false);
    expect(body.assinatura.status).toBe('sem_assinatura');
  });

  it('usuário admin (master) acessa o conteúdo sem assinatura', async () => {
    const u = await registrar(app);
    const semAssinatura = await app.inject({ method: 'GET', url: '/app/ping', headers: u.headers });
    expect(semAssinatura.statusCode).toBe(402);

    await prisma.usuario.update({ where: { id: u.usuario.id }, data: { papel: 'admin' } });
    const comoAdmin = await app.inject({ method: 'GET', url: '/app/ping', headers: u.headers });
    expect(comoAdmin.statusCode).toBe(200);

    const me = (await app.inject({ method: 'GET', url: '/auth/me', headers: u.headers })).json();
    expect(me.usuario.papel).toBe('admin');
    expect(me.assinatura.ativa).toBe(true);
  });

  it('/auth/me sem token retorna 401', async () => {
    const res = await app.inject({ method: 'GET', url: '/auth/me' });
    expect(res.statusCode).toBe(401);
  });

  it('renova o access token via cookie de refresh e troca o cookie (rotação)', async () => {
    const u = await registrar(app, false);
    const res = await refresh(u.refreshToken);
    expect(res.statusCode).toBe(200);
    expect(res.json().accessToken).toBeTruthy();
    const novo = refreshDoCookie(res);
    expect(novo).toBeTruthy();
    expect(novo).not.toBe(u.refreshToken);
  });

  it('rejeita refresh sem cookie ou com token inválido (401)', async () => {
    expect((await app.inject({ method: 'POST', url: '/auth/refresh' })).statusCode).toBe(401);
    expect((await refresh('token-invalido')).statusCode).toBe(401);
  });

  it('reuso de refresh token já usado derruba todas as sessões (proteção contra roubo)', async () => {
    const u = await registrar(app, false);
    const novo = refreshDoCookie(await refresh(u.refreshToken));

    // Alguém reapresenta o token antigo → recusado e TODAS as sessões caem
    expect((await refresh(u.refreshToken)).statusCode).toBe(401);
    expect((await refresh(novo)).statusCode).toBe(401);
  });

  it('logout revoga o refresh token do cookie', async () => {
    const u = await registrar(app, false);
    const res = await app.inject({ method: 'POST', url: '/auth/logout', cookies: { pm_refresh: u.refreshToken } });
    expect(res.statusCode).toBe(204);
    expect((await refresh(u.refreshToken)).statusCode).toBe(401);
  });

  it('logout-todos revoga as sessões de todos os dispositivos', async () => {
    const u = await registrar(app, false);
    const outroDispositivo = refreshDoCookie(await login(u.email, SENHA_TESTE));

    const res = await app.inject({ method: 'POST', url: '/auth/logout-todos', headers: u.headers });
    expect(res.statusCode).toBe(204);
    expect((await refresh(u.refreshToken)).statusCode).toBe(401);
    expect((await refresh(outroDispositivo)).statusCode).toBe(401);
  });
});
