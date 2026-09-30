import { AREA_COLORS } from '../data/areas';
import type { Area } from '../types';

const COR_PADRAO = '#a3a3a3';

/** Cor de uma área pelo nome: a configurada pelo usuário, senão a padrão antiga, senão cinza. */
export function corDaArea(nome: string, areas: Area[]): string {
  return areas.find((a) => a.nome === nome)?.cor ?? AREA_COLORS[nome] ?? COR_PADRAO;
}
