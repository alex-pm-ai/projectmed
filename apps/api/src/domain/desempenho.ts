/**
 * Aproveitamento histórico por conteúdo e por área, a partir das revisões
 * concluídas (com questões) e dos simulados (detalhe por área).
 * Função pura — testada em tests/unit/cronograma.test.ts.
 */

export interface RevisaoHistorico {
  grandeArea: string;
  subArea: string;
  status: string;
  dataRevisao: string;
  questoesFeitas: number;
  questoesAcertadas: number;
}

export interface SimuladoHistorico {
  detalhePorArea: unknown; // [{ area, acertos, total }]
}

export interface Desempenho {
  aproveitamento: number | null; // 0-100
  questoes: number;
}

// Só as sessões mais recentes contam (o desempenho de meses atrás pesa menos que o atual).
const ULTIMAS_SESSOES = 5;

export const chave = (texto: string) =>
  texto.trim().toLocaleLowerCase('pt-BR').normalize('NFD').replace(/[̀-ͯ]/g, '');

function pct(acertos: number, total: number): Desempenho {
  return total > 0 ? { aproveitamento: Math.round((acertos / total) * 100), questoes: total } : { aproveitamento: null, questoes: 0 };
}

export function calcularDesempenho(revisoes: RevisaoHistorico[], simulados: SimuladoHistorico[]) {
  const comQuestoes = revisoes
    .filter((r) => r.status === 'Concluída' && r.questoesFeitas > 0)
    .sort((a, b) => b.dataRevisao.localeCompare(a.dataRevisao)); // mais recentes primeiro

  const porConteudo = new Map<string, { acertos: number; total: number; sessoes: number }>();
  const porArea = new Map<string, { acertos: number; total: number }>();

  for (const r of comQuestoes) {
    const k = `${chave(r.grandeArea)}|${chave(r.subArea)}`;
    const c = porConteudo.get(k) ?? { acertos: 0, total: 0, sessoes: 0 };
    if (c.sessoes < ULTIMAS_SESSOES) {
      c.acertos += r.questoesAcertadas;
      c.total += r.questoesFeitas;
      c.sessoes += 1;
      porConteudo.set(k, c);
    }
    const a = porArea.get(chave(r.grandeArea)) ?? { acertos: 0, total: 0 };
    a.acertos += r.questoesAcertadas;
    a.total += r.questoesFeitas;
    porArea.set(chave(r.grandeArea), a);
  }

  for (const s of simulados) {
    const detalhes = Array.isArray(s.detalhePorArea) ? s.detalhePorArea : [];
    for (const d of detalhes as { area?: string; acertos?: number; total?: number }[]) {
      if (!d?.area || !d.total) continue;
      const a = porArea.get(chave(d.area)) ?? { acertos: 0, total: 0 };
      a.acertos += d.acertos ?? 0;
      a.total += d.total;
      porArea.set(chave(d.area), a);
    }
  }

  return {
    /** Desempenho no conteúdo; sem histórico nele, usa o da área (fonte = 'area'). */
    de(area: string, conteudo: string): Desempenho & { fonte: 'conteudo' | 'area' | 'sem_historico' } {
      const c = porConteudo.get(`${chave(area)}|${chave(conteudo)}`);
      if (c && c.total > 0) return { ...pct(c.acertos, c.total), fonte: 'conteudo' };
      const a = porArea.get(chave(area));
      if (a && a.total > 0) return { ...pct(a.acertos, a.total), fonte: 'area' };
      return { aproveitamento: null, questoes: 0, fonte: 'sem_historico' };
    },
  };
}
