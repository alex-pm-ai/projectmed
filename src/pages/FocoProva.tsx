import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { ChevronDown, FolderCog, Info, Pencil, Plus, Search, Target, Trash2, X } from 'lucide-react';
import { useStore } from '../store/useStore';
import { ApiError } from '../lib/api';
import { Checkbox } from '../components/ui/Checkbox';
import { getFaixa } from '../utils/algoritmoRevisao';
import { today, daysBetween, formatDate } from '../utils/dateUtils';
import type { Area, Conteudo, ResultadoCronograma } from '../types';

const campo =
  'w-full bg-muted border border-card-border rounded-lg px-3 py-2.5 text-sm text-white placeholder-gray-600 focus:outline-none focus:border-accent';
const botaoSecundario =
  'flex items-center gap-1.5 text-xs font-medium text-gray-300 border border-card-border hover:border-accent/50 hover:text-white px-3 py-2 rounded-lg transition-colors';

// Busca sem diferenciar maiúsculas/acentos ("clinica" encontra "Clínica")
const normalizar = (t: string) => t.toLocaleLowerCase('pt-BR').normalize('NFD').replace(/[̀-ͯ]/g, '');

function mensagemDeErro(e: unknown) {
  return e instanceof ApiError ? e.message : 'Não foi possível conectar ao servidor.';
}

export function FocoProva() {
  const { areas, revisoes, configAlgoritmo, gerarCronograma, apagarCronograma, criarConteudo, removerConteudo } =
    useStore();

  const [dataProva, setDataProva] = useState('');
  const [maxPorDia, setMaxPorDia] = useState(6);
  const [selecionados, setSelecionados] = useState<Set<string>>(new Set());
  const [busca, setBusca] = useState('');
  const [filtroArea, setFiltroArea] = useState('');
  const [fechadas, setFechadas] = useState<Set<string>>(new Set());
  const [painel, setPainel] = useState<'nenhum' | 'conteudo' | 'areas'>('nenhum');
  const [resultado, setResultado] = useState<ResultadoCronograma | null>(null);
  const [erro, setErro] = useState('');
  const [gerando, setGerando] = useState(false);

  const pendentesFoco = revisoes.filter((r) => r.origem === 'foco_prova' && r.status === 'Pendente').length;
  const diasAteProva = dataProva ? daysBetween(today(), dataProva) : 0;

  // Áreas e conteúdos já chegam em ordem alfabética do servidor; aqui só filtramos.
  const areasVisiveis = useMemo(() => {
    const termo = normalizar(busca.trim());
    return areas
      .filter((a) => !filtroArea || a.id === filtroArea)
      .map((a) => ({ ...a, conteudos: a.conteudos.filter((c) => !termo || normalizar(c.nome).includes(termo)) }))
      .filter((a) => a.conteudos.length > 0 || (!termo && a.id === filtroArea));
  }, [areas, busca, filtroArea]);

  const idsVisiveis = areasVisiveis.flatMap((a) => a.conteudos.map((c) => c.id));
  const todosVisiveisMarcados = idsVisiveis.length > 0 && idsVisiveis.every((id) => selecionados.has(id));
  const algunsVisiveisMarcados = idsVisiveis.some((id) => selecionados.has(id));

  function marcar(ids: string[], marcado: boolean) {
    setSelecionados((s) => {
      const novo = new Set(s);
      for (const id of ids) {
        if (marcado) novo.add(id);
        else novo.delete(id);
      }
      return novo;
    });
  }

  function alternarArea(id: string) {
    setFechadas((s) => {
      const novo = new Set(s);
      if (novo.has(id)) novo.delete(id);
      else novo.add(id);
      return novo;
    });
  }

  async function handleGerar() {
    setErro('');
    setResultado(null);
    setGerando(true);
    try {
      const r = await gerarCronograma(dataProva, [...selecionados], maxPorDia);
      setResultado(r);
      setSelecionados(new Set());
    } catch (e) {
      setErro(mensagemDeErro(e));
    } finally {
      setGerando(false);
    }
  }

  async function handleApagar() {
    if (!confirm(`Apagar as ${pendentesFoco} revisões pendentes do cronograma Foco Prova? As revisões já concluídas continuam no histórico.`)) return;
    setErro('');
    try {
      await apagarCronograma();
      setResultado(null);
    } catch (e) {
      setErro(mensagemDeErro(e));
    }
  }

  async function handleRemoverConteudo(c: Conteudo) {
    if (!confirm(`Excluir o conteúdo "${c.nome}"? As revisões já feitas continuam no histórico.`)) return;
    try {
      await removerConteudo(c.id);
      marcar([c.id], false);
    } catch (e) {
      setErro(mensagemDeErro(e));
    }
  }

  const podeGerar = selecionados.size > 0 && diasAteProva > 0 && !gerando;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-xl font-bold text-white flex items-center gap-2">
            <Target size={20} className="text-accent" />
            Planejamento Foco Prova
          </h2>
          <p className="text-sm text-gray-500 mt-1 max-w-2xl">
            Monte um cronograma até a data da prova. Os conteúdos em que você mais erra voltam com mais
            frequência, seguindo o seu{' '}
            <Link to="/app/config" className="text-accent hover:underline">
              algoritmo de revisão
            </Link>
            .
          </p>
        </div>
        {pendentesFoco > 0 && (
          <button
            onClick={handleApagar}
            className="flex items-center gap-2 text-red-400 hover:text-red-300 text-xs font-medium border border-red-500/30 px-3 py-2 rounded-lg hover:bg-red-500/10 transition-colors"
          >
            <Trash2 size={12} />
            Apagar cronograma ({pendentesFoco})
          </button>
        )}
      </div>

      {resultado && (
        <div className="bg-accent/10 border border-accent/30 rounded-xl px-4 py-3 text-sm text-accent space-y-1">
          <p>
            Cronograma gerado: {resultado.sessoes} revisões de {resultado.conteudos} conteúdo(s) em {resultado.dias}{' '}
            dia(s). Veja no{' '}
            <Link to="/app/calendario" className="underline">
              Calendário
            </Link>
            .
          </p>
          {resultado.substituidas > 0 && (
            <p className="text-xs text-gray-300">
              {resultado.substituidas} revisão(ões) automática(s) pendente(s) desses conteúdos foram substituídas pelo
              cronograma, para não haver revisões duplicadas.
            </p>
          )}
          {resultado.naoAgendados.length > 0 && (
            <p className="text-amber-300 text-xs">
              Não couberam antes da prova com o limite de {maxPorDia} por dia: {resultado.naoAgendados.join(', ')}.
              Aumente o limite diário ou selecione menos conteúdos.
            </p>
          )}
        </div>
      )}

      {erro && (
        <div className="bg-red-500/10 border border-red-500/30 rounded-xl px-4 py-3 text-sm text-red-400">{erro}</div>
      )}

      {/* Configuração */}
      <div className="bg-card border border-card-border rounded-xl p-5">
        <h3 className="text-sm font-medium text-white mb-4">Configuração do intensivo</h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs text-gray-400 mb-1.5">Data da prova</label>
            <input
              type="date"
              value={dataProva}
              onChange={(e) => setDataProva(e.target.value)}
              min={today()}
              className={campo}
            />
            {dataProva && diasAteProva > 0 && (
              <p className="text-[11px] text-gray-500 mt-1">
                {diasAteProva} dia(s) de estudo até {formatDate(dataProva)} (a prova não entra no cronograma).
              </p>
            )}
          </div>
          <div>
            <label className="block text-xs text-gray-400 mb-1.5">Máximo de conteúdos por dia</label>
            <div className="flex">
              <input
                type="number"
                min={1}
                max={50}
                value={maxPorDia}
                onChange={(e) => setMaxPorDia(Math.min(50, Math.max(1, Number(e.target.value) || 1)))}
                className={`${campo} rounded-r-none`}
              />
              <span className="bg-muted border border-l-0 border-card-border rounded-r-lg px-3 text-xs text-gray-500 flex items-center whitespace-nowrap">
                POR DIA
              </span>
            </div>
          </div>
        </div>

        <details className="mt-4 group">
          <summary className="flex items-center gap-1.5 text-xs text-gray-400 cursor-pointer list-none hover:text-white">
            <Info size={13} className="text-accent" />
            Como o cronograma é montado
            <ChevronDown size={13} className="group-open:rotate-180 transition-transform" />
          </summary>
          <ul className="mt-3 space-y-1.5 text-xs text-gray-400 list-disc pl-5">
            <li>
              Para cada conteúdo usamos o seu histórico de acertos (as 5 sessões mais recentes). Sem histórico no
              conteúdo, vale o da área (revisões e simulados). Sem nenhum histórico, ele é tratado como prioridade máxima.
            </li>
            <li>
              O intervalo entre as repetições vem das faixas do seu{' '}
              <Link to="/app/config" className="text-accent hover:underline">
                algoritmo de revisão
              </Link>{' '}
              — quanto menor o aproveitamento, mais cedo o conteúdo volta.
            </li>
            <li>Em cada dia entram primeiro os conteúdos mais atrasados e com pior desempenho, até o limite diário.</li>
            <li>Na reta final, todo conteúdo ganha pelo menos uma revisão antes da prova.</li>
            <li>Gerar de novo substitui o cronograma pendente anterior — as revisões já concluídas continuam.</li>
            <li>
              Enquanto um conteúdo estiver no cronograma, ele segue só o cronograma: não recebe revisões automáticas
              extras ao registrar estudo ou concluir revisões.
            </li>
          </ul>
        </details>
      </div>

      {/* Conteúdos */}
      <div className="bg-card border border-card-border rounded-xl p-5">
        <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
          <h3 className="text-sm font-medium text-white">Selecione os conteúdos</h3>
          <div className="flex gap-2">
            <button onClick={() => setPainel(painel === 'conteudo' ? 'nenhum' : 'conteudo')} className={botaoSecundario}>
              <Plus size={13} /> Novo conteúdo
            </button>
            <button onClick={() => setPainel(painel === 'areas' ? 'nenhum' : 'areas')} className={botaoSecundario}>
              <FolderCog size={13} /> Gerenciar áreas
            </button>
          </div>
        </div>

        {painel === 'conteudo' && (
          <NovoConteudo
            areas={areas}
            areaInicial={filtroArea}
            onCriar={async (areaId, nome) => {
              await criarConteudo(areaId, nome);
              setFechadas((s) => {
                const novo = new Set(s);
                novo.delete(areaId);
                return novo;
              });
            }}
            onFechar={() => setPainel('nenhum')}
          />
        )}
        {painel === 'areas' && <GerenciarAreas areas={areas} onFechar={() => setPainel('nenhum')} />}

        <div className="flex flex-col sm:flex-row gap-2 mb-4">
          <div className="relative flex-1">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" />
            <input
              value={busca}
              onChange={(e) => setBusca(e.target.value)}
              placeholder="Pesquisar conteúdo..."
              className={`${campo} pl-9 py-2`}
            />
          </div>
          <select value={filtroArea} onChange={(e) => setFiltroArea(e.target.value)} className={`${campo} sm:w-64 py-2`}>
            <option value="">Todas as áreas</option>
            {areas.map((a) => (
              <option key={a.id} value={a.id}>
                {a.nome}
              </option>
            ))}
          </select>
        </div>

        <div className="flex items-center justify-between mb-3">
          <Checkbox
            checked={todosVisiveisMarcados}
            indeterminate={!todosVisiveisMarcados && algunsVisiveisMarcados}
            onChange={(v) => marcar(idsVisiveis, v)}
            label={`Selecionar todos (${idsVisiveis.length})`}
            disabled={idsVisiveis.length === 0}
          />
          <span className="text-[11px] text-gray-500 hidden sm:block">% = seu aproveitamento no conteúdo</span>
        </div>

        <div className="space-y-3 max-h-[32rem] overflow-y-auto pr-1">
          {areasVisiveis.length === 0 && (
            <p className="text-sm text-gray-500 text-center py-8">Nenhum conteúdo encontrado.</p>
          )}
          {areasVisiveis.map((area) => {
            const ids = area.conteudos.map((c) => c.id);
            const marcados = ids.filter((id) => selecionados.has(id)).length;
            const aberta = !fechadas.has(area.id) || busca.trim() !== '';
            return (
              <div key={area.id} className="border border-card-border rounded-xl overflow-hidden">
                <div className="flex items-center gap-3 px-3 py-2.5 bg-white/[0.02]">
                  <Checkbox
                    checked={marcados > 0 && marcados === ids.length}
                    indeterminate={marcados > 0 && marcados < ids.length}
                    onChange={(v) => marcar(ids, v)}
                    disabled={ids.length === 0}
                    ariaLabel={`Selecionar todos de ${area.nome}`}
                  />
                  <button
                    onClick={() => alternarArea(area.id)}
                    className="flex-1 flex items-center gap-2 text-left min-w-0"
                    aria-expanded={aberta}
                  >
                    <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: area.cor }} />
                    <span className="text-sm font-medium text-white truncate">{area.nome}</span>
                    <span className="text-[11px] text-gray-500 flex-shrink-0">
                      {marcados}/{ids.length}
                    </span>
                    <ChevronDown
                      size={14}
                      className={`ml-auto text-gray-500 flex-shrink-0 transition-transform ${aberta ? 'rotate-180' : ''}`}
                    />
                  </button>
                </div>
                {aberta && (
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2 p-3">
                    {area.conteudos.length === 0 && (
                      <p className="text-xs text-gray-500 col-span-full">Nenhum conteúdo nesta área ainda.</p>
                    )}
                    {area.conteudos.map((c) => (
                      <CartaoConteudo
                        key={c.id}
                        conteudo={c}
                        marcado={selecionados.has(c.id)}
                        onMarcar={(v) => marcar([c.id], v)}
                        onRemover={() => handleRemoverConteudo(c)}
                        rotulo={c.aproveitamento === null ? null : getFaixa(c.aproveitamento, configAlgoritmo)?.label ?? null}
                      />
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3 mt-4 pt-4 border-t border-card-border">
          <span className="text-xs text-gray-500">
            {selecionados.size} conteúdo(s) selecionado(s)
            {!dataProva && selecionados.size > 0 && ' · escolha a data da prova'}
          </span>
          <button
            onClick={handleGerar}
            disabled={!podeGerar}
            className="flex items-center gap-2 bg-primary hover:bg-primary/90 disabled:bg-gray-700 disabled:text-gray-400 disabled:cursor-not-allowed text-primary-foreground text-sm font-medium px-4 py-2 rounded-lg transition-colors"
          >
            <Target size={14} />
            {gerando ? 'Gerando...' : pendentesFoco > 0 ? 'Gerar novo cronograma' : 'Gerar cronograma'}
          </button>
        </div>
      </div>
    </div>
  );
}

const COR_ROTULO = {
  Atenção: 'text-red-300 bg-red-500/10 border-red-500/20',
  Bom: 'text-amber-300 bg-amber-500/10 border-amber-500/20',
  Excelente: 'text-accent bg-accent/10 border-accent/20',
} as const;

function CartaoConteudo({
  conteudo: c,
  marcado,
  onMarcar,
  onRemover,
  rotulo,
}: {
  conteudo: Conteudo;
  marcado: boolean;
  onMarcar: (v: boolean) => void;
  onRemover: () => void;
  rotulo: keyof typeof COR_ROTULO | null;
}) {
  const dica =
    c.fonte === 'conteudo'
      ? `${c.aproveitamento}% de acerto em ${c.questoes} questões deste conteúdo`
      : c.fonte === 'area'
        ? `Sem questões neste conteúdo — usando a média da área (${c.aproveitamento}%)`
        : 'Sem histórico ainda — entra como prioridade máxima';

  return (
    <div
      className={`group flex items-center gap-2.5 px-3 py-2.5 rounded-lg border transition-colors ${
        marcado ? 'border-accent/40 bg-accent/5' : 'border-card-border hover:border-white/20'
      }`}
    >
      <Checkbox
        checked={marcado}
        onChange={onMarcar}
        size="sm"
        className="min-w-0 flex-1"
        label={<span className="text-xs text-white truncate block">{c.nome}</span>}
      />
      <span
        title={dica}
        className={`text-[10px] px-1.5 py-0.5 rounded border flex-shrink-0 ${
          rotulo ? COR_ROTULO[rotulo] : 'text-gray-500 border-card-border'
        }`}
      >
        {c.aproveitamento === null ? 'novo' : `${c.fonte === 'area' ? '~' : ''}${c.aproveitamento}%`}
      </span>
      <button
        onClick={onRemover}
        title="Excluir conteúdo"
        aria-label={`Excluir ${c.nome}`}
        className="text-gray-600 hover:text-red-400 opacity-0 group-hover:opacity-100 focus:opacity-100 transition-opacity flex-shrink-0"
      >
        <Trash2 size={12} />
      </button>
    </div>
  );
}

function NovoConteudo({
  areas,
  areaInicial,
  onCriar,
  onFechar,
}: {
  areas: Area[];
  areaInicial: string;
  onCriar: (areaId: string, nome: string) => Promise<void>;
  onFechar: () => void;
}) {
  const [nome, setNome] = useState('');
  const [areaId, setAreaId] = useState(areaInicial || areas[0]?.id || '');
  const [erro, setErro] = useState('');
  const [ok, setOk] = useState('');

  async function salvar(e: React.FormEvent) {
    e.preventDefault();
    setErro('');
    setOk('');
    try {
      await onCriar(areaId, nome.trim());
      setOk(`"${nome.trim()}" adicionado.`);
      setNome('');
    } catch (err) {
      setErro(mensagemDeErro(err));
    }
  }

  return (
    <form onSubmit={salvar} className="mb-4 p-4 rounded-xl border border-accent/20 bg-accent/[0.03] space-y-3">
      <div className="flex items-center justify-between">
        <p className="text-xs font-medium text-white">Novo conteúdo</p>
        <button type="button" onClick={onFechar} aria-label="Fechar" className="text-gray-500 hover:text-white">
          <X size={14} />
        </button>
      </div>
      {areas.length === 0 ? (
        <p className="text-xs text-gray-400">Crie uma área primeiro em "Gerenciar áreas".</p>
      ) : (
        <div className="flex flex-col sm:flex-row gap-2">
          <input
            value={nome}
            onChange={(e) => setNome(e.target.value)}
            placeholder="Ex.: Síndrome coronariana aguda"
            required
            maxLength={120}
            autoFocus
            className={`${campo} py-2 flex-1`}
          />
          <select value={areaId} onChange={(e) => setAreaId(e.target.value)} className={`${campo} py-2 sm:w-56`}>
            {areas.map((a) => (
              <option key={a.id} value={a.id}>
                {a.nome}
              </option>
            ))}
          </select>
          <button
            type="submit"
            disabled={!nome.trim() || !areaId}
            className="bg-primary hover:bg-primary/90 disabled:bg-gray-700 disabled:text-gray-400 text-primary-foreground text-sm font-medium px-4 py-2 rounded-lg transition-colors"
          >
            Adicionar
          </button>
        </div>
      )}
      {erro && <p className="text-xs text-red-400">{erro}</p>}
      {ok && <p className="text-xs text-accent">{ok}</p>}
    </form>
  );
}

function GerenciarAreas({ areas, onFechar }: { areas: Area[]; onFechar: () => void }) {
  const { criarArea, renomearArea, removerArea } = useStore();
  const [nova, setNova] = useState('');
  const [editando, setEditando] = useState<{ id: string; nome: string } | null>(null);
  const [erro, setErro] = useState('');

  async function executar(acao: () => Promise<void>) {
    setErro('');
    try {
      await acao();
      return true;
    } catch (e) {
      setErro(mensagemDeErro(e));
      return false;
    }
  }

  return (
    <div className="mb-4 p-4 rounded-xl border border-accent/20 bg-accent/[0.03] space-y-3">
      <div className="flex items-center justify-between">
        <p className="text-xs font-medium text-white">Áreas de estudo</p>
        <button type="button" onClick={onFechar} aria-label="Fechar" className="text-gray-500 hover:text-white">
          <X size={14} />
        </button>
      </div>

      <form
        onSubmit={async (e) => {
          e.preventDefault();
          if (await executar(() => criarArea(nova.trim()))) setNova('');
        }}
        className="flex gap-2"
      >
        <input
          value={nova}
          onChange={(e) => setNova(e.target.value)}
          placeholder="Nova área (ex.: Ortopedia)"
          maxLength={120}
          className={`${campo} py-2 flex-1`}
        />
        <button
          type="submit"
          disabled={!nova.trim()}
          className="bg-primary hover:bg-primary/90 disabled:bg-gray-700 disabled:text-gray-400 text-primary-foreground text-sm font-medium px-4 py-2 rounded-lg transition-colors"
        >
          Criar
        </button>
      </form>

      <ul className="divide-y divide-card-border">
        {areas.map((a) => (
          <li key={a.id} className="flex items-center gap-2 py-2">
            <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: a.cor }} />
            {editando?.id === a.id ? (
              <form
                className="flex-1 flex gap-2"
                onSubmit={async (e) => {
                  e.preventDefault();
                  if (await executar(() => renomearArea(a.id, editando.nome.trim()))) setEditando(null);
                }}
              >
                <input
                  value={editando.nome}
                  onChange={(e) => setEditando({ id: a.id, nome: e.target.value })}
                  autoFocus
                  maxLength={120}
                  className={`${campo} py-1.5 flex-1`}
                />
                <button type="submit" className="text-xs text-accent hover:underline">
                  Salvar
                </button>
                <button type="button" onClick={() => setEditando(null)} className="text-xs text-gray-500 hover:text-white">
                  Cancelar
                </button>
              </form>
            ) : (
              <>
                <span className="flex-1 text-sm text-white truncate">{a.nome}</span>
                <span className="text-[11px] text-gray-500">{a.conteudos.length} conteúdo(s)</span>
                <button
                  onClick={() => setEditando({ id: a.id, nome: a.nome })}
                  title="Renomear"
                  aria-label={`Renomear ${a.nome}`}
                  className="text-gray-500 hover:text-white p-1"
                >
                  <Pencil size={12} />
                </button>
                <button
                  onClick={() => {
                    if (confirm(`Excluir a área "${a.nome}" e os ${a.conteudos.length} conteúdo(s) dela? As revisões já feitas continuam no histórico.`))
                      void executar(() => removerArea(a.id));
                  }}
                  title="Excluir"
                  aria-label={`Excluir ${a.nome}`}
                  className="text-gray-500 hover:text-red-400 p-1"
                >
                  <Trash2 size={12} />
                </button>
              </>
            )}
          </li>
        ))}
      </ul>
      <p className="text-[11px] text-gray-500">
        Renomear uma área também atualiza o nome nas suas revisões, para o histórico de acertos continuar ligado a ela.
      </p>
      {erro && <p className="text-xs text-red-400">{erro}</p>}
    </div>
  );
}
