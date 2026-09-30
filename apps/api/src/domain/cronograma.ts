import type { Faixa } from './algoritmo.js';

/**
 * Geração do cronograma "Foco na Prova" — função pura (sem banco), testada em
 * tests/unit/cronograma.test.ts.
 *
 * Como funciona:
 * 1. Cada conteúdo chega com o aproveitamento histórico do usuário (acertos/questões).
 *    Sem histórico = tratado como 0% → prioridade máxima.
 * 2. O intervalo entre repetições vem das faixas do algoritmo de revisão do usuário
 *    (ex.: 45% → a cada 4 dias; 85% → a cada 35 dias).
 * 3. Simula dia a dia, de hoje até a véspera da prova, respeitando o limite de
 *    conteúdos por dia. Em cada dia entram primeiro os mais atrasados e, entre eles,
 *    os de pior desempenho. Ao estudar um conteúdo, a próxima vez é "hoje + intervalo".
 * 4. Reta final: todo conteúdo cuja próxima revisão cairia depois da prova ganha
 *    uma revisão final nos últimos dias (os de pior desempenho primeiro).
 */

export interface ConteudoCronograma {
  area: string;
  conteudo: string;
  aproveitamento: number | null; // 0-100, null = sem histórico
}

export interface SessaoCronograma extends ConteudoCronograma {
  offset: number; // dias a partir de hoje (0 = hoje)
}

export interface ResultadoCronograma {
  sessoes: SessaoCronograma[];
  naoAgendados: ConteudoCronograma[]; // não couberam antes da prova com o limite diário
  diasDisponiveis: number;
}

export function intervaloDias(aproveitamento: number | null, faixas: Faixa[]): number {
  const ap = aproveitamento ?? 0;
  const faixa = faixas.find((f) => ap >= f.min && ap <= f.max);
  return Math.max(1, faixa?.dias ?? 7);
}

export function gerarCronograma(
  conteudos: ConteudoCronograma[],
  faixas: Faixa[],
  diasDisponiveis: number, // dias de estudo antes da prova (hoje até a véspera)
  maxPorDia: number
): ResultadoCronograma {
  if (diasDisponiveis <= 0 || conteudos.length === 0) {
    return { sessoes: [], naoAgendados: [...conteudos], diasDisponiveis: Math.max(0, diasDisponiveis) };
  }

  const ultimoDia = diasDisponiveis - 1;
  // Reta final: ~1/4 do período, entre 1 e 7 dias
  const inicioReta = ultimoDia - Math.max(1, Math.min(7, Math.floor(diasDisponiveis / 4))) + 1;

  const estado = conteudos.map((c) => ({
    ...c,
    ap: c.aproveitamento ?? 0,
    intervalo: intervaloDias(c.aproveitamento, faixas),
    proximo: 0, // todos começam "devidos" hoje
    ultimo: -1,
    finalGarantida: false,
  }));

  const sessoes: SessaoCronograma[] = [];

  for (let dia = 0; dia <= ultimoDia; dia++) {
    if (dia === inicioReta) {
      // Quem só voltaria depois da prova ganha uma revisão final agora.
      for (const e of estado) {
        if (e.proximo > ultimoDia && e.ultimo < inicioReta && !e.finalGarantida) {
          e.proximo = inicioReta;
          e.finalGarantida = true;
        }
      }
    }

    const devidos = estado
      .filter((e) => e.proximo <= dia)
      .sort((a, b) => a.proximo - b.proximo || a.ap - b.ap || a.conteudo.localeCompare(b.conteudo, 'pt-BR'));

    for (const e of devidos.slice(0, maxPorDia)) {
      sessoes.push({ area: e.area, conteudo: e.conteudo, aproveitamento: e.aproveitamento, offset: dia });
      e.ultimo = dia;
      e.proximo = dia + e.intervalo;
    }
  }

  const naoAgendados = estado
    .filter((e) => e.ultimo === -1)
    .map(({ area, conteudo, aproveitamento }) => ({ area, conteudo, aproveitamento }));

  return { sessoes, naoAgendados, diasDisponiveis };
}
