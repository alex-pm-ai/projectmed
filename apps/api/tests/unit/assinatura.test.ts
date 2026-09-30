import { describe, it, expect } from 'vitest';
import { createHmac } from 'node:crypto';
import {
  acessoLiberado,
  assinaturaWebhookValida,
  dentroDoArrependimento,
  mapearPreapproval,
} from '../../src/domain/assinatura.js';

const DIA = 24 * 60 * 60 * 1000;
const agora = new Date('2026-10-01T12:00:00Z');

describe('Acesso pela assinatura', () => {
  it('libera quem pagou e está dentro do período', () => {
    expect(acessoLiberado({ status: 'ativa', validoAte: new Date(agora.getTime() + DIA) }, agora)).toBe(true);
  });

  it('bloqueia quem nunca pagou (pendente), mesmo com data futura', () => {
    expect(acessoLiberado({ status: 'pendente', validoAte: new Date(agora.getTime() + DIA) }, agora)).toBe(false);
  });

  it('inadimplência: bloqueia sozinho quando o período pago acaba', () => {
    expect(acessoLiberado({ status: 'ativa', validoAte: new Date(agora.getTime() - 1) }, agora)).toBe(false);
  });

  it('cancelou: continua até o fim do período já pago', () => {
    expect(acessoLiberado({ status: 'cancelada', validoAte: new Date(agora.getTime() + 5 * DIA) }, agora)).toBe(true);
    expect(acessoLiberado({ status: 'cancelada', validoAte: new Date(agora.getTime() - DIA) }, agora)).toBe(false);
  });

  it('sem assinatura: bloqueado', () => {
    expect(acessoLiberado(null, agora)).toBe(false);
  });
});

describe('Status do Mercado Pago → nosso status', () => {
  const pre = (extra: object) => ({ id: 'abc', status: 'authorized', ...extra });

  it('autorizada e já cobrada → ativa até a próxima cobrança (+1 dia de folga)', () => {
    const s = mapearPreapproval(
      pre({ next_payment_date: '2026-11-01T10:00:00.000-03:00', summarized: { charged_quantity: 1 } })
    );
    expect(s.status).toBe('ativa');
    expect(s.validoAte?.toISOString()).toBe('2026-11-02T13:00:00.000Z');
  });

  it('autorizada mas a 1ª cobrança ainda não aprovou → continua pendente (sem acesso)', () => {
    const s = mapearPreapproval(pre({ next_payment_date: '2026-10-01T10:00:00.000-03:00', summarized: { charged_quantity: 0 } }));
    expect(s.status).toBe('pendente');
    expect(s.validoAte).toBeNull();
  });

  it('pending, paused e cancelled', () => {
    expect(mapearPreapproval(pre({ status: 'pending' })).status).toBe('pendente');
    expect(mapearPreapproval(pre({ status: 'paused' })).status).toBe('pausada');
    expect(mapearPreapproval(pre({ status: 'cancelled' })).status).toBe('cancelada');
  });
});

describe('Assinatura do webhook do Mercado Pago', () => {
  const segredo = 'segredo-de-teste';
  const assinar = (id: string, requestId: string, ts: string) =>
    createHmac('sha256', segredo).update(`id:${id};request-id:${requestId};ts:${ts};`).digest('hex');

  it('aceita aviso assinado corretamente', () => {
    const v1 = assinar('abc123', 'req-1', '1700000000');
    expect(
      assinaturaWebhookValida({ xSignature: `ts=1700000000,v1=${v1}`, xRequestId: 'req-1', dataId: 'ABC123', segredo })
    ).toBe(true); // id alfanumérico entra em minúsculas no manifesto
  });

  it('recusa aviso forjado, sem assinatura ou com outro id', () => {
    const v1 = assinar('abc123', 'req-1', '1700000000');
    expect(assinaturaWebhookValida({ xSignature: `ts=1700000000,v1=${'0'.repeat(64)}`, xRequestId: 'req-1', dataId: 'abc123', segredo })).toBe(false);
    expect(assinaturaWebhookValida({ xSignature: undefined, xRequestId: 'req-1', dataId: 'abc123', segredo })).toBe(false);
    expect(assinaturaWebhookValida({ xSignature: `ts=1700000000,v1=${v1}`, xRequestId: 'req-1', dataId: 'outro', segredo })).toBe(false);
  });
});

describe('Direito de arrependimento (7 dias)', () => {
  it('dentro e fora do prazo', () => {
    expect(dentroDoArrependimento(new Date(agora.getTime() - 6 * DIA), agora)).toBe(true);
    expect(dentroDoArrependimento(new Date(agora.getTime() - 8 * DIA), agora)).toBe(false);
    expect(dentroDoArrependimento(null, agora)).toBe(false);
  });
});
