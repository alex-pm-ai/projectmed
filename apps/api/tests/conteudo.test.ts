import { describe, it, expect, beforeAll, beforeEach } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { getApp, resetDb, registrar } from './setup/helpers.js';

describe('Tarefas (/app/tarefas)', () => {
  let app: FastifyInstance;
  beforeAll(async () => {
    app = await getApp();
  });
  beforeEach(async () => {
    await resetDb();
  });

  it('cria, alterna (toggle) e deleta uma tarefa', async () => {
    const u = await registrar(app, true);
    const criar = await app.inject({
      method: 'POST',
      url: '/app/tarefas',
      headers: u.headers,
      payload: { texto: 'revisar DPOC' },
    });
    expect(criar.statusCode).toBe(201);
    const id = criar.json().id;
    expect(criar.json().concluida).toBe(false);

    const toggle = await app.inject({
      method: 'PATCH',
      url: `/app/tarefas/${id}`,
      headers: u.headers,
      payload: { concluida: true },
    });
    expect(toggle.json().concluida).toBe(true);

    const del = await app.inject({ method: 'DELETE', url: `/app/tarefas/${id}`, headers: u.headers });
    expect(del.statusCode).toBe(204);
  });

  it('limpa todas as tarefas concluídas de uma vez', async () => {
    const u = await registrar(app, true);
    const t1 = await app.inject({ method: 'POST', url: '/app/tarefas', headers: u.headers, payload: { texto: 'feita' } });
    await app.inject({ method: 'POST', url: '/app/tarefas', headers: u.headers, payload: { texto: 'pendente' } });
    await app.inject({
      method: 'PATCH',
      url: `/app/tarefas/${t1.json().id}`,
      headers: u.headers,
      payload: { concluida: true },
    });

    await app.inject({ method: 'DELETE', url: '/app/tarefas/concluidas', headers: u.headers });
    const lista = await app.inject({ method: 'GET', url: '/app/tarefas', headers: u.headers });
    expect(lista.json().length).toBe(1);
    expect(lista.json()[0].texto).toBe('pendente');
  });
});

describe('Configuração do algoritmo (/app/config)', () => {
  let app: FastifyInstance;
  beforeAll(async () => {
    app = await getApp();
  });
  beforeEach(async () => {
    await resetDb();
  });

  it('retorna as faixas padrão quando o usuário ainda não personalizou', async () => {
    const u = await registrar(app, true);
    const res = await app.inject({ method: 'GET', url: '/app/config', headers: u.headers });
    expect(res.statusCode).toBe(200);
    expect(res.json().faixas.length).toBe(11); // 11 faixas padrão
  });

  it('salva e persiste faixas personalizadas', async () => {
    const u = await registrar(app, true);
    const faixas = [{ min: 0, max: 100, dias: 10, label: 'Bom' }];
    const put = await app.inject({ method: 'PUT', url: '/app/config', headers: u.headers, payload: { faixas } });
    expect(put.statusCode).toBe(200);

    const get = await app.inject({ method: 'GET', url: '/app/config', headers: u.headers });
    expect(get.json().faixas.length).toBe(1);
    expect(get.json().faixas[0].dias).toBe(10);
  });
});

describe('Meta semanal (/app/meta)', () => {
  let app: FastifyInstance;
  beforeAll(async () => {
    app = await getApp();
  });
  beforeEach(async () => {
    await resetDb();
  });

  it('retorna a meta padrão (150) e permite atualizar', async () => {
    const u = await registrar(app, true);
    const get1 = await app.inject({ method: 'GET', url: '/app/meta', headers: u.headers });
    expect(get1.json().meta).toBe(150);

    const put = await app.inject({ method: 'PUT', url: '/app/meta', headers: u.headers, payload: { meta: 300 } });
    expect(put.json().meta).toBe(300);

    const get2 = await app.inject({ method: 'GET', url: '/app/meta', headers: u.headers });
    expect(get2.json().meta).toBe(300);
  });
});

describe('Simulados (/app/simulados)', () => {
  let app: FastifyInstance;
  beforeAll(async () => {
    app = await getApp();
  });
  beforeEach(async () => {
    await resetDb();
  });

  it('cria um simulado com detalhe por área e lista', async () => {
    const u = await registrar(app, true);
    const res = await app.inject({
      method: 'POST',
      url: '/app/simulados',
      headers: u.headers,
      payload: {
        titulo: 'ENAMED',
        ano: '2026',
        dataRealizacao: '2026-06-10',
        tempoGasto: 150,
        questoesTotal: 100,
        questoesAcertadas: 70,
        nota: 70,
        detalhePorArea: [{ area: 'Pediatria', acertos: 15, total: 20 }],
      },
    });
    expect(res.statusCode).toBe(201);

    const lista = await app.inject({ method: 'GET', url: '/app/simulados', headers: u.headers });
    expect(lista.json().length).toBe(1);
    expect(lista.json()[0].detalhePorArea[0].area).toBe('Pediatria');
  });
});
