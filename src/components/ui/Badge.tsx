interface Props {
  label: string;
  color?: string;
}

const COLORS: Record<string, string> = {
  'Flashcards':              'bg-purple-500/20 text-purple-300 border-purple-500/30',
  'Clínica Médica':          'bg-indigo-500/20 text-indigo-300 border-indigo-500/30',
  'Pediatria':               'bg-orange-500/20 text-orange-300 border-orange-500/30',
  'Cirurgia Geral':          'bg-green-500/20 text-green-300 border-green-500/30',
  'Ginecologia e Obstetrícia':'bg-pink-500/20 text-pink-300 border-pink-500/30',
  'Preventiva':              'bg-cyan-500/20 text-cyan-300 border-cyan-500/30',
  'Simulados':               'bg-red-500/20 text-red-300 border-red-500/30',
  'Questoes':                'bg-blue-500/20 text-blue-300 border-blue-500/30',
  'Aula':                    'bg-yellow-500/20 text-yellow-300 border-yellow-500/30',
  'Concluída':               'bg-green-500/20 text-green-300 border-green-500/30',
  'Pendente':                'bg-gray-500/20 text-gray-300 border-gray-500/30',
  'Atrasada':                'bg-red-500/20 text-red-300 border-red-500/30',
  'Atenção':                 'bg-red-500/20 text-red-300 border-red-500/30',
  'Bom':                     'bg-yellow-500/20 text-yellow-300 border-yellow-500/30',
  'Excelente':               'bg-green-500/20 text-green-300 border-green-500/30',
};

export function Badge({ label }: Props) {
  const cls = COLORS[label] ?? 'bg-gray-500/20 text-gray-300 border-gray-500/30';
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium border ${cls}`}>
      {label}
    </span>
  );
}
