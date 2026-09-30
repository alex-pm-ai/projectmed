/**
 * Áreas e conteúdos que todo usuário recebe na primeira vez que abre o app.
 * Depois disso são dele: pode renomear, excluir e criar novos (tabelas Area/Conteudo).
 */
export const AREAS_PADRAO: { nome: string; cor: string; conteudos: string[] }[] = [
  {
    nome: 'Cirurgia Geral',
    cor: '#22c55e',
    conteudos: [
      'Trauma abdominal', 'Abdômen agudo', 'Hérnias', 'Apendicite', 'Colecistite', 'Pancreatite',
      'Obstrução intestinal', 'Hemorragia digestiva', 'Câncer colorretal', 'Cirurgia bariátrica',
      'Queimaduras', 'Feridas e suturas', 'Politrauma', 'TCE', 'Trauma torácico',
    ],
  },
  {
    nome: 'Clínica Médica',
    cor: '#818cf8',
    conteudos: [
      'Esquizofrenia', 'TOC', 'TEA e TDAH', 'Transtorno mental na infância', 'Transtornos de Ansiedade',
      'Transtornos de humor', 'Transtornos do uso de substâncias', 'Transtornos alimentares',
      'Transtornos do neurodesenvolvimento', 'Transtorno de personalidade', 'RAPS / CAPS', 'SUS',
      'Transtorno bipolar', 'Revisão ENAMED', 'Emergências psiquiátricas', 'Hipertensão Arterial Sistêmica',
      'DPOC', 'Derrame pleural', 'Osmolaridade e Natremia', 'Hiponatremia', 'TEPT',
      'Transtorno de somatização', 'Insuficiência cardíaca', 'Arritmias', 'Pneumonia', 'IVAS',
      'Bronquiolite', 'Asma', 'Hepatites', 'Doença de Crohn', 'Colite ulcerativa', 'Diabetes mellitus',
      'Hipotireoidismo', 'Hipertireoidismo', 'Anemia', 'Leucemia', 'Linfoma', 'Nefrite',
      'Síndrome nefrótica', 'IRA e DRC', 'Sedativos e anticonvulsivantes', 'Intoxicação por lítio',
      'Intoxicação / abstinência',
    ],
  },
  {
    nome: 'Ginecologia e Obstetrícia',
    cor: '#ec4899',
    conteudos: [
      'TORCH', 'Pré-eclâmpsia', 'Diabetes gestacional', 'Trabalho de parto', 'Hemorragia pós-parto',
      'Aborto', 'Síndromes hipertensivas', 'Infecções genitais', 'Patologia cervical', 'Endometriose',
      'Mioma uterino', 'Câncer de mama', 'Câncer de colo uterino', 'Contracepção', 'Menopausa',
    ],
  },
  {
    nome: 'Pediatria',
    cor: '#f97316',
    conteudos: [
      'Icterícia neonatal', 'Triagem neonatal', 'Reanimação neonatal', 'Lactente sibilante', 'APGAR',
      'Vacinação', 'Aleitamento materno', 'Avaliação neonatal', 'Neonatologia', 'Pneumonia', 'ITU',
      'Bronquiolite', 'Diarreia', 'Otite média aguda', 'Ventilação mecânica', 'Crupe',
      'Displasia broncopulmonar', 'DPOC pediátrico', 'Convulsão febril', 'Síndrome ictérica',
      'Classificação do RN', 'Doenças exantemáticas', 'IVAS pediátrica', 'Transtornos de humor (Ped)',
      'Infecção neonatal', 'Osmolaridade e Natremia (Ped)',
    ],
  },
  {
    nome: 'Preventiva',
    cor: '#06b6d4',
    conteudos: [
      'RAPS / CAPS', 'SUS', 'Doenças exantemáticas', 'IVAS', 'Dengue', 'Hepatites', 'Tuberculose',
      'Políticas e Programas do SUS', 'Vacinação', 'Epidemiologia', 'Vigilância sanitária',
      'Saúde da mulher', 'Saúde da criança', 'Saúde do trabalhador', 'Hanseníase',
    ],
  },
];

/** Cores sugeridas para áreas novas criadas pelo usuário (em rodízio). */
export const CORES_AREA = ['#818cf8', '#f97316', '#22c55e', '#ec4899', '#06b6d4', '#eab308', '#a855f7', '#ef4444', '#14b8a6', '#f43f5e'];
