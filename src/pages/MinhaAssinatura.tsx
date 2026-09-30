import { useEffect, useState } from 'react';
import { CreditCard, ExternalLink, RefreshCw } from 'lucide-react';
import { api, ApiError } from '../lib/api';
import { reais } from '../lib/format';
import { formatDate } from '../utils/dateUtils';
import { useAuthStore, type AssinaturaInfo } from '../store/authStore';

interface Cobranca {
  id: string;
  valor: number;
  status: 'aprovado' | 'recusado' | 'pendente' | 'estornado';
  metodo: string;
  createdAt: string;
}

const ROTULO_STATUS: Record<string, { texto: string; cor: string }> = {
  ativa: { texto: 'Ativa', cor: 'bg-accent/15 text-accent' },
  pendente: { texto: 'Aguardando pagamento', cor: 'bg-amber-500/15 text-amber-300' },
  pausada: { texto: 'Pagamento não aprovado', cor: 'bg-red-500/15 text-red-300' },
  cancelada: { texto: 'Cancelada', cor: 'bg-white/10 text-gray-300' },
};

const ROTULO_COBRANCA: Record<Cobranca['status'], string> = {
  aprovado: 'text-accent',
  recusado: 'text-red-300',
  pendente: 'text-amber-300',
  estornado: 'text-gray-400',
};

const data = (iso: string | null | undefined) => (iso ? formatDate(iso.slice(0, 10)) : '—');

export function MinhaAssinatura() {
  const carregarMe = useAuthStore((s) => s.carregarMe);
  const usuario = useAuthStore((s) => s.usuario);
  const [info, setInfo] = useState<AssinaturaInfo | null>(null);
  const [cobrancas, setCobrancas] = useState<Cobranca[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [processando, setProcessando] = useState(false);
  const [erro, setErro] = useState('');

  // sincronizar = status atualizado direto do Mercado Pago
  const buscar = () =>
    Promise.all([api.post<AssinaturaInfo>('/billing/sincronizar'), api.get<Cobranca[]>('/billing/cobrancas')])
      .then(([s, c]) => {
        setInfo(s);
        setCobrancas(c);
        setErro('');
      })
      .catch((e) => setErro(e instanceof ApiError ? e.message : 'Não foi possível carregar sua assinatura.'))
      .finally(() => setCarregando(false));

  function carregar() {
    setCarregando(true);
    void buscar();
  }

  useEffect(() => {
    void buscar();
  }, []);

  async function cancelar(arrependimento: boolean) {
    const msg = arrependimento
      ? 'Cancelar e pedir o reembolso integral? Seu acesso será encerrado agora.'
      : `Cancelar a assinatura? Ela não será mais renovada e você continua com acesso até ${data(info?.validoAte)}.`;
    if (!confirm(msg)) return;
    setProcessando(true);
    setErro('');
    try {
      setInfo(await api.post<AssinaturaInfo>('/billing/cancelar', { arrependimento }));
      setCobrancas(await api.get<Cobranca[]>('/billing/cobrancas'));
      await carregarMe(); // se o acesso acabou (arrependimento), o app volta para a tela de planos
    } catch (e) {
      setErro(e instanceof ApiError ? e.message : 'Não foi possível cancelar agora. Tente novamente.');
    } finally {
      setProcessando(false);
    }
  }

  if (usuario?.papel === 'admin') {
    return (
      <div className="bg-card border border-card-border rounded-xl p-5 text-sm text-gray-400">
        Conta de administrador: acesso liberado sem assinatura.
      </div>
    );
  }

  const status = info ? ROTULO_STATUS[info.status] ?? { texto: info.status, cor: 'bg-white/10 text-gray-300' } : null;
  const renovando = info?.status === 'ativa';

  return (
    <div className="space-y-6 max-w-3xl">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-bold text-white flex items-center gap-2">
          <CreditCard size={20} className="text-accent" /> Minha assinatura
        </h2>
        <button
          onClick={carregar}
          disabled={carregando}
          className="flex items-center gap-1.5 text-xs text-gray-400 hover:text-white disabled:opacity-50"
        >
          <RefreshCw size={12} className={carregando ? 'animate-spin' : ''} /> Atualizar
        </button>
      </div>

      {erro && <div className="bg-red-500/10 border border-red-500/30 rounded-xl px-4 py-3 text-sm text-red-400">{erro}</div>}

      {info && (
        <div className="bg-card border border-card-border rounded-xl p-5 space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-xs text-gray-500">Plano</p>
              <p className="text-lg font-semibold text-white">
                {info.plano?.nome ?? '—'}
                {info.plano?.preco !== undefined && (
                  <span className="text-sm font-normal text-gray-400">
                    {' '}· {reais(info.plano.preco)}/{info.plano.intervalo === 'year' ? 'ano' : 'mês'}
                  </span>
                )}
              </p>
            </div>
            {status && <span className={`text-xs font-medium px-2.5 py-1 rounded-full ${status.cor}`}>{status.texto}</span>}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
            <div className="bg-muted rounded-lg px-3 py-2">
              <p className="text-xs text-gray-500">{renovando ? 'Próxima renovação' : 'Acesso até'}</p>
              <p className="text-white">{data(info.validoAte)}</p>
            </div>
            <div className="bg-muted rounded-lg px-3 py-2">
              <p className="text-xs text-gray-500">Assinante desde</p>
              <p className="text-white">{data(info.ativadaEm)}</p>
            </div>
          </div>

          {info.status === 'pausada' && (
            <p className="text-xs text-amber-300">
              O Mercado Pago não conseguiu cobrar seu cartão. Ele tenta de novo automaticamente; você também pode
              atualizar o cartão em{' '}
              <a href="https://www.mercadopago.com.br/subscriptions" target="_blank" rel="noopener noreferrer" className="underline inline-flex items-center gap-1">
                suas assinaturas no Mercado Pago <ExternalLink size={11} />
              </a>
              .
            </p>
          )}

          {(info.status === 'ativa' || info.status === 'pausada') && (
            <div className="flex flex-wrap gap-2 pt-2 border-t border-card-border">
              {info.podeArrepender && (
                <button
                  onClick={() => void cancelar(true)}
                  disabled={processando}
                  className="text-xs font-medium text-red-300 border border-red-500/30 hover:bg-red-500/10 px-3 py-2 rounded-lg transition-colors disabled:opacity-50"
                >
                  Cancelar e pedir reembolso (até 7 dias)
                </button>
              )}
              <button
                onClick={() => void cancelar(false)}
                disabled={processando}
                className="text-xs font-medium text-gray-300 border border-card-border hover:border-red-500/40 hover:text-red-300 px-3 py-2 rounded-lg transition-colors disabled:opacity-50"
              >
                Cancelar assinatura
              </button>
            </div>
          )}
          {info.status === 'cancelada' && info.ativa && (
            <p className="text-xs text-gray-400">Assinatura cancelada — seu acesso continua até {data(info.validoAte)}.</p>
          )}
        </div>
      )}

      <div className="bg-card border border-card-border rounded-xl p-5">
        <h3 className="text-sm font-medium text-white mb-3">Cobranças</h3>
        {cobrancas.length === 0 ? (
          <p className="text-xs text-gray-500">Nenhuma cobrança ainda.</p>
        ) : (
          <ul className="divide-y divide-card-border text-sm">
            {cobrancas.map((c) => (
              <li key={c.id} className="flex items-center justify-between py-2">
                <span className="text-gray-400">{data(c.createdAt)}</span>
                <span className="text-white">{reais(c.valor)}</span>
                <span className={`text-xs capitalize ${ROTULO_COBRANCA[c.status]}`}>{c.status}</span>
              </li>
            ))}
          </ul>
        )}
        <p className="text-[11px] text-gray-500 mt-3">Os recibos são enviados pelo Mercado Pago para o e-mail da sua conta Mercado Pago.</p>
      </div>
    </div>
  );
}
