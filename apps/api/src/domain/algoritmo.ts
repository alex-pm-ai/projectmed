export interface Faixa {
  min: number;
  max: number;
  dias: number;
  label: 'Atenção' | 'Bom' | 'Excelente';
}

export const DEFAULT_FAIXAS: Faixa[] = [
  { min: 0, max: 29, dias: 1, label: 'Atenção' },
  { min: 30, max: 39, dias: 3, label: 'Atenção' },
  { min: 40, max: 49, dias: 4, label: 'Atenção' },
  { min: 50, max: 54, dias: 5, label: 'Atenção' },
  { min: 55, max: 59, dias: 7, label: 'Atenção' },
  { min: 60, max: 64, dias: 14, label: 'Bom' },
  { min: 65, max: 69, dias: 18, label: 'Bom' },
  { min: 70, max: 74, dias: 22, label: 'Bom' },
  { min: 75, max: 79, dias: 26, label: 'Bom' },
  { min: 80, max: 89, dias: 35, label: 'Excelente' },
  { min: 90, max: 100, dias: 45, label: 'Excelente' },
];

export function calcularAproveitamento(feitas: number, acertadas: number): number {
  if (feitas === 0) return 0;
  return Math.round((acertadas / feitas) * 100);
}

export function calcularProximaRevisao(aproveitamento: number, dataRevisao: string, faixas: Faixa[]): string {
  const faixa = faixas.find((f) => aproveitamento >= f.min && aproveitamento <= f.max);
  const dias = faixa?.dias ?? 7;
  const data = new Date(dataRevisao + 'T12:00:00');
  data.setDate(data.getDate() + dias);
  return data.toISOString().split('T')[0];
}
