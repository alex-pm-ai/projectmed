import { describe, it, expect, beforeAll, beforeEach } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { getApp, resetDb, registrar, ensurePlano, prisma } from './setup/helpers.js';

describe('Billing e gate de assinatura', () => {
  let app: FastifyInstance;
  beforeAll(async () => {
    app = await getApp();
  });
  beforeEach(async () => {
    await resetDb();
  });

  it('lista os planos disponíveis (rota pública)', async () => {
    await ensurePlano();
    const res = await app.inject({ method: 'GET', url: '/billing/planos' });
    expect(res.statusCode).toBe(200);
    expect(res.json().length).toBeGreaterThan(0);
  });

  it('BLOQUEIA conteúdo (/app) sem assinatura ativa → 402', async () => {
    const u = await registrar(app, false); // sem assinatura
    const res = await app.inject({ method: 'GET', url: '/app/ping', headers: u.headers });
    expect(res.statusCode).toBe(402);
    expect(res.json().error).toBe('assinatura_inativa');
  });

  it('checkout cria cobrança pendente (Pix) e NÃO libera o acesso ainda', async () => {
    const u = await registrar(app, false);
    const plano = await ensurePlano();

    const res = await app.inject({
      method: 'POST',
      url: '/billing/checkout',
      headers: u.headers,
      payload: { planoId: plano.id },
    });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.metodo).toBe('pix');
    expect(body.pixQrCode).toBeTruthy();
    expect(body.gatewayPayId).toBeTruthy();

    // ainda bloqueado (pagamento não confirmado)
    const ping = await app.inject({ method: 'GET', url: '/app/ping', headers: u.headers });
    expect(ping.statusCode).toBe(402);
  });

  it('webhook de pagamento aprovado LIBERA o acesso (gate passa a 200)', async () => {
    const u = await registrar(app, false);
    const plano = await ensurePlano();

    const checkout = await app.inject({
      method: 'POST',
      url: '/billing/checkout',
      headers: u.headers,
      payload: { planoId: plano.id },
    });
    const { gatewayPayId } = checkout.json();

    const webhook = await app.inject({
      method: 'POST',
      url: '/billing/webhook',
      payload: { tipo: 'pagamento.aprovado', gatewayPayId, eventId: 'evt_1' },
    });
    expect(webhook.json().status).toBe('ok');

    const ping = await app.inject({ method: 'GET', url: '/app/ping', headers: u.headers });
    expect(ping.statusCode).toBe(200);

    // /auth/me reflete a assinatura ativa
    const me = await app.inject({ method: 'GET', url: '/auth/me', headers: u.headers });
    expect(me.json().assinatura.ativa).toBe(true);
  });

  it('webhook duplicado é ignorado (idempotência)', async () => {
    const u = await registrar(app, false);
    const plano = await ensurePlano();
    const checkout = await app.inject({
      method: 'POST',
      url: '/billing/checkout',
      headers: u.headers,
      payload: { planoId: plano.id },
    });
    const { gatewayPayId } = checkout.json();
    const payload = { tipo: 'pagamento.aprovado', gatewayPayId, eventId: 'evt_dup' };

    const first = await app.inject({ method: 'POST', url: '/billing/webhook', payload });
    const second = await app.inject({ method: 'POST', url: '/billing/webhook', payload });
    expect(first.json().status).toBe('ok');
    expect(second.json().status).toBe('duplicado');
  });

  it('webhook de estorno cancela a assinatura', async () => {
    const u = await registrar(app, false);
    const plano = await ensurePlano();
    const checkout = await app.inject({
      method: 'POST',
      url: '/billing/checkout',
      headers: u.headers,
      payload: { planoId: plano.id },
    });
    const { gatewayPayId } = checkout.json();

    await app.inject({
      method: 'POST',
      url: '/billing/webhook',
      payload: { tipo: 'pagamento.aprovado', gatewayPayId, eventId: 'evt_ok' },
    });
    await app.inject({
      method: 'POST',
      url: '/billing/webhook',
      payload: { tipo: 'pagamento.estornado', gatewayPayId, eventId: 'evt_estorno' },
    });

    const assinatura = await prisma.assinatura.findUnique({ where: { usuarioId: u.usuario.id } });
    expect(assinatura?.status).toBe('cancelada');

    const ping = await app.inject({ method: 'GET', url: '/app/ping', headers: u.headers });
    expect(ping.statusCode).toBe(402); // acesso revogado
  });
});
