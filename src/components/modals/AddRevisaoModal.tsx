import { useState } from 'react';
import { Modal } from '../ui/Modal';
import { Checkbox } from '../ui/Checkbox';
import { useStore } from '../../store/useStore';
import { ApiError } from '../../lib/api';
import { SUB_AREAS } from '../../data/areas';
import { calcularAproveitamento, calcularProximaRevisao, getFaixa } from '../../utils/algoritmoRevisao';
import { today, formatDate } from '../../utils/dateUtils';
import type { GrandeArea, TipoAtividade } from '../../types';

interface Props {
  open: boolean;
  onClose: () => void;
}

const TIPOS: { valor: TipoAtividade; rotulo: string }[] = [
  { valor: 'Questoes', rotulo: 'Questões' },
  { valor: 'Flashcards', rotulo: 'Flashcards' },
  { valor: 'Aula', rotulo: 'Aula' },
];

const campo =
  'w-full bg-muted border border-card-border rounded-lg px-3 py-2 text-sm text-white placeholder-gray-600 focus:outline-none focus:border-accent';

// Mesmas cores das faixas do algoritmo usadas no Foco Prova
const COR_FAIXA = {
  Atenção: 'bg-red-500/15 text-red-300',
  Bom: 'bg-amber-500/15 text-amber-300',
  Excelente: 'bg-accent/15 text-accent',
} as const;

// Compara nomes sem diferenciar maiúsculas/acentos (igual ao servidor)
const normalizar = (t: string) => t.trim().toLocaleLowerCase('pt-BR').normalize('NFD').replace(/[̀-ͯ]/g, '');

function somarDias(data: string, dias: number) {
  const d = new Date(data + 'T12:00:00');
  d.setDate(d.getDate() + dias);
  return d.toISOString().split('T')[0];
}

/**
 * Registrar estudo (questões, flashcards ou aula).
 * Com "agendar próxima revisão", a data da próxima vez vem das faixas do algoritmo
 * de revisão; ao concluir essa revisão, o servidor agenda a seguinte, e assim por diante.
 */
export function AddRevisaoModal({ open, onClose }: Props) {
  const { addRevisao, configAlgoritmo, areas, revisoes } = useStore();
  const [tipo, setTipo] = useState<TipoAtividade>('Questoes');
  const [area, setArea] = useState<GrandeArea>(areas[0]?.nome ?? 'Clínica Médica');
  const [subArea, setSubArea] = useState('');
  const [data, setData] = useState(today());
  const [tempo, setTempo] = useState('');
  const [feitas, setFeitas] = useState('');
  const [acertadas, setAcertadas] = useState('');
  const [agendar, setAgendar] = useState(true);
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState('');

  // Áreas configuradas pelo usuário (já em ordem alfabética) + as especiais de Flashcards/Simulados
  const opcoesArea = [
    ...areas.map((a) => a.nome),
    ...['Flashcards', 'Simulados'].filter((n) => !areas.some((a) => a.nome === n)),
  ];
  const sugestoes = areas.find((a) => a.nome === area)?.conteudos.map((c) => c.nome) ?? SUB_AREAS[area] ?? [];

  const f = Number(feitas) || 0;
  const a = Number(acertadas) || 0;
  const semQuestoes = f === 0;
  const aproveitamento = calcularAproveitamento(f, a);
  const faixa = semQuestoes ? null : getFaixa(aproveitamento, configAlgoritmo);
  const menorIntervalo = Math.min(...configAlgoritmo.faixas.map((x) => x.dias));
  // Sem questões (ex.: aula), não há aproveitamento: agenda pelo menor intervalo configurado.
  const proxima = semQuestoes ? somarDias(data, menorIntervalo) : calcularProximaRevisao(aproveitamento, data, configAlgoritmo);
  const acertosInvalidos = a > f;

  // Conteúdo que está no cronograma Foco Prova segue o cronograma: não agendamos outra
  // revisão automática (evita duas pendentes do mesmo conteúdo).
  const conteudo = subArea.trim() || (tipo === 'Flashcards' ? 'Sessão de Flashcards' : 'Geral');
  const proximaFoco = revisoes
    .filter(
      (r) =>
        r.origem === 'foco_prova' &&
        r.status === 'Pendente' &&
        r.dataRevisao >= data &&
        normalizar(r.grandeArea) === normalizar(area) &&
        normalizar(r.subArea) === normalizar(conteudo)
    )
    .map((r) => r.dataRevisao)
    .sort()[0];

  const nomeItem = tipo === 'Flashcards' ? 'Cards' : 'Questões';

  function limpar() {
    setFeitas('');
    setAcertadas('');
    setTempo('');
    setSubArea('');
    setErro('');
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (acertosInvalidos) return;
    setErro('');
    setSalvando(true);

    try {
      await addRevisao({
        tipo,
        grandeArea: area,
        subArea: conteudo,
        dataRevisao: data,
        tempoEstudo: Number(tempo) || 0,
        questoesFeitas: f,
        questoesAcertadas: a,
        aproveitamento,
        status: 'Concluída',
        gerarRevisaoInteligente: agendar,
        proximaRevisao: agendar ? (proximaFoco ?? proxima) : null,
      });

      if (agendar && !proximaFoco) {
        await addRevisao({
          tipo,
          grandeArea: area,
          subArea: conteudo,
          dataRevisao: proxima,
          tempoEstudo: 0,
          questoesFeitas: 0,
          questoesAcertadas: 0,
          aproveitamento: 0,
          status: 'Pendente',
          gerarRevisaoInteligente: true,
          proximaRevisao: null,
        });
      }

      limpar();
      onClose();
    } catch (err) {
      setErro(err instanceof ApiError ? err.message : 'Não foi possível salvar. Verifique sua conexão e tente de novo.');
    } finally {
      setSalvando(false);
    }
  }

  return (
    <Modal open={open} onClose={onClose} title="Registrar estudo">
      <form onSubmit={handleSubmit} className="space-y-5">
        {/* Tipo */}
        <div role="radiogroup" aria-label="Tipo de atividade" className="grid grid-cols-3 gap-1 p-1 bg-muted border border-card-border rounded-lg">
          {TIPOS.map((t) => (
            <button
              key={t.valor}
              type="button"
              role="radio"
              aria-checked={tipo === t.valor}
              onClick={() => setTipo(t.valor)}
              className={`py-1.5 rounded-md text-sm font-medium transition-colors ${
                tipo === t.valor ? 'bg-primary text-primary-foreground' : 'text-gray-400 hover:text-white'
              }`}
            >
              {t.rotulo}
            </button>
          ))}
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs text-gray-400 mb-1.5">Grande área</label>
            <select value={area} onChange={(e) => { setArea(e.target.value); setSubArea(''); }} className={campo}>
              {opcoesArea.map((op) => <option key={op} value={op}>{op}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-xs text-gray-400 mb-1.5">{tipo === 'Aula' ? 'Aula / conteúdo' : 'Conteúdo'}</label>
            <input
              list={`conteudos-${area}`}
              value={subArea}
              onChange={(e) => setSubArea(e.target.value)}
              placeholder="Ex.: Esquizofrenia"
              className={campo}
            />
            <datalist id={`conteudos-${area}`}>
              {sugestoes.map((s) => <option key={s} value={s} />)}
            </datalist>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs text-gray-400 mb-1.5">Data do estudo</label>
            <input type="date" value={data} max={today()} onChange={(e) => setData(e.target.value)} className={campo} />
          </div>
          <div>
            <label className="block text-xs text-gray-400 mb-1.5">Tempo de estudo (min)</label>
            <input type="number" min="0" value={tempo} onChange={(e) => setTempo(e.target.value)} placeholder="Ex.: 45" className={campo} />
          </div>
        </div>

        {/* Desempenho */}
        <div className="border border-card-border rounded-xl p-4 space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium text-gray-300">Desempenho</span>
            {tipo === 'Aula' && <span className="text-[11px] text-gray-500">Opcional — preencha se fez questões</span>}
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs text-gray-400 mb-1.5">{nomeItem} feitas</label>
              <input type="number" min="0" value={feitas} onChange={(e) => setFeitas(e.target.value)} placeholder="0" className={campo} />
            </div>
            <div>
              <label className="block text-xs text-gray-400 mb-1.5">{nomeItem} acertadas</label>
              <input
                type="number"
                min="0"
                value={acertadas}
                onChange={(e) => setAcertadas(e.target.value)}
                placeholder="0"
                className={`${campo} ${acertosInvalidos ? 'border-red-500/60' : ''}`}
              />
            </div>
          </div>
          {acertosInvalidos && <p className="text-xs text-red-400">Os acertos não podem ser maiores que o total.</p>}

          <div className="bg-muted rounded-lg p-3 flex items-center justify-between">
            <div>
              <p className="text-xs text-gray-500 mb-0.5">Aproveitamento</p>
              <p className="text-2xl font-bold text-white">{semQuestoes ? '—' : `${aproveitamento}%`}</p>
            </div>
            <span
              className={`text-xs font-medium px-2 py-0.5 rounded-full ${
                faixa ? COR_FAIXA[faixa.label] : 'bg-white/5 text-gray-400'
              }`}
            >
              {faixa ? faixa.label.toUpperCase() : 'SEM QUESTÕES'}
            </span>
          </div>
        </div>

        {/* Agendamento */}
        <div className={`rounded-lg border px-3 py-3 transition-colors ${agendar ? 'border-accent/40 bg-accent/5' : 'border-card-border'}`}>
          <Checkbox checked={agendar} onChange={setAgendar} label={<span className="text-sm text-white">Agendar próxima revisão automaticamente</span>} />
          <p className="text-xs text-gray-500 mt-1.5 pl-[26px]">
            {agendar && proximaFoco ? (
              <>
                Este conteúdo está no seu cronograma Foco Prova — a próxima revisão dele já está marcada para{' '}
                <span className="text-accent">{formatDate(proximaFoco)}</span>. Não vamos agendar outra.
              </>
            ) : agendar ? (
              <>
                Próxima revisão em <span className="text-accent">{formatDate(proxima)}</span>
                {semQuestoes
                  ? ` — sem questões, usamos o menor intervalo do seu algoritmo (${menorIntervalo} dia${menorIntervalo > 1 ? 's' : ''}).`
                  : ` — faixa "${faixa?.label}" do seu algoritmo de revisão.`}{' '}
                Ao concluí-la, a seguinte é agendada pelo novo resultado.
              </>
            ) : (
              'O estudo fica só no histórico, sem revisão agendada.'
            )}
          </p>
        </div>

        {erro && (
          <div className="bg-red-500/10 border border-red-500/30 rounded-lg px-3 py-2 text-xs text-red-400">{erro}</div>
        )}

        <div className="flex justify-end gap-3 pt-1">
          <button type="button" onClick={onClose} className="px-4 py-2 text-sm text-gray-400 hover:text-white transition-colors">
            Cancelar
          </button>
          <button
            type="submit"
            disabled={salvando || acertosInvalidos}
            className="px-5 py-2 bg-primary hover:bg-primary/90 disabled:bg-gray-700 disabled:text-gray-400 text-primary-foreground text-sm font-medium rounded-lg transition-colors"
          >
            {salvando ? 'Salvando...' : 'Salvar'}
          </button>
        </div>
      </form>
    </Modal>
  );
}
