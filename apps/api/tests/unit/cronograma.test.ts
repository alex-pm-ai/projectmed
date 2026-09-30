import { describe, it, expect } from 'vitest';
import { gerarCronograma, intervaloDias, type ConteudoCronograma } from '../../src/domain/cronograma.js';
import { calcularDesempenho } from '../../src/domain/desempenho.js';
import { DEFAULT_FAIXAS } from '../../src/domain/algoritmo.js';

const c = (conteudo: string, aproveitamento: number | null, area = 'Clínica Médica'): ConteudoCronograma => ({
  area,
  conteudo,
  aproveitamento,
});

const sessoesDe = (r: ReturnType<typeof gerarCronograma>, conteudo: string) =>
  r.sessoes.filter((s) => s.conteudo === conteudo).map((s) => s.offset);

describe('Cronograma Foco Prova', () => {
  it('usa as faixas do algoritmo de revisão para o intervalo', () => {
    expect(intervaloDias(20, DEFAULT_FAIXAS)).toBe(1);
    expect(intervaloDias(45, DEFAULT_FAIXAS)).toBe(4);
    expect(intervaloDias(85, DEFAULT_FAIXAS)).toBe(35);
    expect(intervaloDias(null, DEFAULT_FAIXAS)).toBe(1); // sem histórico = prioridade máxima
  });

  it('respeita faixas personalizadas pelo usuário', () => {
    const faixas = [
      { min: 0, max: 49, dias: 2, label: 'Atenção' as const },
      { min: 50, max: 100, dias: 10, label: 'Bom' as const },
    ];
    const r = gerarCronograma([c('Asma', 30)], faixas, 9, 5);
    expect(sessoesDe(r, 'Asma')).toEqual([0, 2, 4, 6, 8]);
  });

  it('conteúdo com mais erros é revisado com mais frequência', () => {
    const r = gerarCronograma([c('Fraco', 45), c('Forte', 85)], DEFAULT_FAIXAS, 30, 5);
    expect(sessoesDe(r, 'Fraco').length).toBeGreaterThan(sessoesDe(r, 'Forte').length);
    expect(sessoesDe(r, 'Fraco').slice(0, 3)).toEqual([0, 4, 8]); // a cada 4 dias (faixa 40-49%)
  });

  it('nunca passa do limite diário e nunca agenda no dia da prova ou depois', () => {
    const conteudos = Array.from({ length: 40 }, (_, i) => c(`Tema ${i}`, (i * 7) % 100));
    const r = gerarCronograma(conteudos, DEFAULT_FAIXAS, 20, 4);
    const porDia = new Map<number, number>();
    for (const s of r.sessoes) porDia.set(s.offset, (porDia.get(s.offset) ?? 0) + 1);
    expect(Math.max(...porDia.values())).toBeLessThanOrEqual(4);
    expect(Math.max(...r.sessoes.map((s) => s.offset))).toBeLessThanOrEqual(19);
    expect(Math.min(...r.sessoes.map((s) => s.offset))).toBeGreaterThanOrEqual(0);
  });

  it('prioriza os piores desempenhos quando o dia está cheio', () => {
    const r = gerarCronograma([c('Bom', 75), c('Sem histórico', null), c('Ruim', 35)], DEFAULT_FAIXAS, 10, 2);
    const primeiroDia = r.sessoes.filter((s) => s.offset === 0).map((s) => s.conteudo);
    expect(primeiroDia).toEqual(['Sem histórico', 'Ruim']);
  });

  it('garante uma revisão final antes da prova para quem já está bom', () => {
    // 85% → intervalo de 35 dias, mas a prova é em 20: precisa voltar na reta final
    const r = gerarCronograma([c('Dominado', 85)], DEFAULT_FAIXAS, 20, 5);
    const offsets = sessoesDe(r, 'Dominado');
    expect(offsets[0]).toBe(0);
    expect(offsets.length).toBe(2);
    expect(offsets[1]).toBeGreaterThanOrEqual(15); // reta final (últimos 5 dias)
  });

  it('informa o que não coube antes da prova', () => {
    const r = gerarCronograma([c('A', 10), c('B', 20), c('C', 30)], DEFAULT_FAIXAS, 1, 2);
    expect(r.sessoes).toHaveLength(2);
    expect(r.naoAgendados.map((n) => n.conteudo)).toEqual(['C']);
  });
});

describe('Desempenho histórico', () => {
  const rev = (grandeArea: string, subArea: string, feitas: number, acertadas: number, dataRevisao = '2026-09-01') => ({
    grandeArea,
    subArea,
    status: 'Concluída',
    dataRevisao,
    questoesFeitas: feitas,
    questoesAcertadas: acertadas,
  });

  it('calcula acertos/questões do conteúdo (ignora maiúsculas e acentos)', () => {
    const d = calcularDesempenho([rev('Clínica Médica', 'Asma', 10, 4), rev('clinica medica', 'ASMA', 10, 6)], []);
    expect(d.de('Clínica Médica', 'Asma')).toEqual({ aproveitamento: 50, questoes: 20, fonte: 'conteudo' });
  });

  it('usa só as 5 sessões mais recentes do conteúdo', () => {
    const antigas = Array.from({ length: 5 }, (_, i) => rev('Pediatria', 'ITU', 10, 0, `2026-01-0${i + 1}`));
    const recentes = Array.from({ length: 5 }, (_, i) => rev('Pediatria', 'ITU', 10, 10, `2026-09-0${i + 1}`));
    expect(calcularDesempenho([...antigas, ...recentes], []).de('Pediatria', 'ITU').aproveitamento).toBe(100);
  });

  it('sem histórico no conteúdo, usa o da área (revisões + simulados)', () => {
    const d = calcularDesempenho(
      [rev('Pediatria', 'ITU', 10, 8)],
      [{ detalhePorArea: [{ area: 'Pediatria', acertos: 2, total: 10 }] }]
    );
    expect(d.de('Pediatria', 'Crupe')).toEqual({ aproveitamento: 50, questoes: 20, fonte: 'area' });
    expect(d.de('Cirurgia Geral', 'Hérnias').fonte).toBe('sem_historico');
  });

  it('ignora revisões pendentes ou sem questões', () => {
    const d = calcularDesempenho(
      [{ ...rev('Preventiva', 'SUS', 10, 10), status: 'Pendente' }, rev('Preventiva', 'SUS', 0, 0)],
      []
    );
    expect(d.de('Preventiva', 'SUS').aproveitamento).toBeNull();
  });
});
