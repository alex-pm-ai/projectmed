export type TipoAtividade = 'Questoes' | 'Flashcards' | 'Aula' | 'Simulado';

// Áreas são configuráveis por usuário (tabela Area) — qualquer nome é válido.
export type GrandeArea = string;

export type StatusRevisao = 'Pendente' | 'Concluída' | 'Atrasada';

export interface Revisao {
  id: string;
  tipo: TipoAtividade;
  grandeArea: GrandeArea;
  subArea: string;
  dataRevisao: string;       // YYYY-MM-DD
  tempoEstudo: number;       // minutos
  questoesFeitas: number;
  questoesAcertadas: number;
  aproveitamento: number;    // 0-100
  status: StatusRevisao;
  proximaRevisao: string | null;
  gerarRevisaoInteligente: boolean;
  origem?: 'manual' | 'foco_prova';
  createdAt: string;
}

export interface DetalheAreaSimulado {
  area: GrandeArea;
  acertos: number;
  total: number;
}

export interface Simulado {
  id: string;
  titulo: string;
  ano: string;
  dataRealizacao: string;
  tempoGasto: number;   // minutos
  questoesTotal: number;
  questoesAcertadas: number;
  nota: number;         // 0-100
  detalhePorArea: DetalheAreaSimulado[];
}

export interface Tarefa {
  id: string;
  texto: string;
  concluida: boolean;
  createdAt: string;
}

export interface FaixaAlgoritmo {
  min: number;
  max: number;
  dias: number;
  label: 'Atenção' | 'Bom' | 'Excelente';
}

export interface ConfigAlgoritmo {
  faixas: FaixaAlgoritmo[];
}

export interface Conteudo {
  id: string;
  areaId: string;
  nome: string;
  aproveitamento: number | null; // histórico de acertos (0-100); null = sem histórico
  questoes: number;
  fonte: 'conteudo' | 'area' | 'sem_historico';
}

export interface Area {
  id: string;
  nome: string;
  cor: string;
  conteudos: Conteudo[]; // em ordem alfabética
}

export interface ResultadoCronograma {
  sessoes: number;
  conteudos: number;
  dias: number;
  substituidas: number; // revisões automáticas pendentes trocadas pelo cronograma
  naoAgendados: string[];
}
