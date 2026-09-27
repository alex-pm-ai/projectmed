import { describe, it, expect, beforeAll, beforeEach } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { getApp, resetDb, registrar } from './setup/helpers.js';

const baseRevisao = {
  tipo: 'Questoes',
  grandeArea: 'Pediatria',
  subArea: 'ITU',
  tempoEstudo: 0,
  questoesFeitas: 0,
  questoesAcertadas: 0,
  aproveitamento: 0,
  proximaRevisao: null,
  gerarRevisaoInteligente: true,
};

describe('Revisões (/app/revisoes)', () => {
  let app: FastifyInstance;
  beforeAll(async () => {
    app = await getApp();
  });
  beforeEach(async () => {
    await resetDb();
  });

  it('cria uma revisão e ela aparece na listagem do usuário', async () => {
    const u = await registrar(app, true);
    const criar = await app.inject({
      method: 'POST',
      url: '/app/revisoes',
      headers: u.headers,
      payload: { ...baseRevisao, dataRevisao: '2026-06-27', status: 'Pendente' },
    });
    expect(criar.statusCode).toBe(201);

    const lista = await app.inject({ method: 'GET', url: '/app/revisoes', headers: u.headers });
    expect(lista.json().length).toBe(1);
    expect(lista.json()[0].subArea).toBe('ITU');
  });

  it('concluir uma revisão pendente gera AUTOMATICAMENTE a próxima (revisão inteligente)', async () => {
    const u = await registrar(app, true);
    const criada = await app.inject({
      method: 'POST',
      url: '/app/revisoes',
      headers: u.headers,
      payload: { ...baseRevisao, dataRevisao: '2026-06-20', status: 'Pendente', gerarRevisaoInteligente: true },
    });
    const id = criada.json().id;

    const concluir = await app.inject({
      method: 'POST',
      url: `/app/revisoes/${id}/concluir`,
      headers: u.headers,
      payload: { questoesFeitas: 10, questoesAcertadas: 9, tempoEstudo: 30 },
    });
    const body = concluir.json();
    expect(body.concluida.status).toBe('Concluída');
    expect(body.concluida.aproveitamento).toBe(90); // 9/10
    expect(body.novaPendente).not.toBeNull();
    expect(body.novaPendente.status).toBe('Pendente');

    // total agora = 2 (a concluída + a nova pendente)
    const lista = await app.inject({ method: 'GET', url: '/app/revisoes', headers: u.headers });
    expect(lista.json().length).toBe(2);
  });

  it('NÃO gera próxima quando gerarRevisaoInteligente = false', async () => {
    const u = await registrar(app, true);
    const criada = await app.inject({
      method: 'POST',
      url: '/app/revisoes',
      headers: u.headers,
      payload: { ...baseRevisao, dataRevisao: '2026-06-20', status: 'Pendente', gerarRevisaoInteligente: false },
    });
    const id = criada.json().id;

    const concluir = await app.inject({
      method: 'POST',
      url: `/app/revisoes/${id}/concluir`,
      headers: u.headers,
      payload: { questoesFeitas: 10, questoesAcertadas: 5, tempoEstudo: 40 },
    });
    expect(concluir.json().novaPendente).toBeNull();
    const lista = await app.inject({ method: 'GET', url: '/app/revisoes', headers: u.headers });
    expect(lista.json().length).toBe(1);
  });

  it('redistribui as revisões atrasadas para datas futuras', async () => {
    const u = await registrar(app, true);
    // cria 3 revisões pendentes no passado
    for (const sub of ['A', 'B', 'C']) {
      await app.inject({
        method: 'POST',
        url: '/app/revisoes',
        headers: u.headers,
        payload: { ...baseRevisao, subArea: sub, dataRevisao: '2020-01-01', status: 'Pendente' },
      });
    }
    const res = await app.inject({ method: 'POST', url: '/app/revisoes/redistribuir', headers: u.headers });
    expect(res.statusCode).toBe(200);
    const hoje = new Date().toISOString().split('T')[0];
    for (const r of res.json()) {
      expect(r.dataRevisao > hoje).toBe(true); // todas foram para o futuro
    }
  });

  it('deleta uma revisão', async () => {
    const u = await registrar(app, true);
    const criada = await app.inject({
      method: 'POST',
      url: '/app/revisoes',
      headers: u.headers,
      payload: { ...baseRevisao, dataRevisao: '2026-06-27', status: 'Pendente' },
    });
    const id = criada.json().id;
    const del = await app.inject({ method: 'DELETE', url: `/app/revisoes/${id}`, headers: u.headers });
    expect(del.statusCode).toBe(204);
    const lista = await app.inject({ method: 'GET', url: '/app/revisoes', headers: u.headers });
    expect(lista.json().length).toBe(0);
  });

  it('ISOLAMENTO: um usuário não enxerga nem deleta revisão de outro', async () => {
    const a = await registrar(app, true);
    const b = await registrar(app, true);

    const criada = await app.inject({
      method: 'POST',
      url: '/app/revisoes',
      headers: a.headers,
      payload: { ...baseRevisao, dataRevisao: '2026-06-27', status: 'Pendente' },
    });
    const id = criada.json().id;

    // B não vê a revisão de A
    const listaB = await app.inject({ method: 'GET', url: '/app/revisoes', headers: b.headers });
    expect(listaB.json().length).toBe(0);

    // B não consegue deletar a revisão de A
    const delB = await app.inject({ method: 'DELETE', url: `/app/revisoes/${id}`, headers: b.headers });
    expect(delB.statusCode).toBe(404);
  });
});
