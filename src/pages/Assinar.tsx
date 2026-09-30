import { useCallback, useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Check, CreditCard, ExternalLink, Loader2, LogOut, ShieldCheck } from 'lucide-react';
import { useAuthStore, type AssinaturaInfo } from '../store/authStore';
import { api, ApiError } from '../lib/api';
import { reais } from '../lib/format';
import { Logo } from '../components/ui/Logo';

interface Plano {
  id: string;
  nome: string;
  preco: number;
  intervalo: string;
}

interface CheckoutResp {
  metodo: string;
  checkoutUrl: string | null;
  pixQrCode: string | null;
  gatewayPayId: string | null; // só no modo de desenvolvimento (mock)
}

const POR_PERIODO = (intervalo: string) => (intervalo === 'year' ? 'ano' : 'mês');

/**
 * Tela de quem ainda não tem acesso: escolhe o plano e paga no Mercado Pago.
 * O Mercado Pago não volta para "localhost", então em desenvolvimento a página de
 * pagamento abre em outra aba e esta tela confere o pagamento sozinha a cada 5 s.
 */
export function Assinar() {
  const carregarMe = useAuthStore((s) => s.carregarMe);
  const logout = useAuthStore((s) => s.logout);
  const usuario = useAuthStore((s) => s.usuario);

  const [searchParams, setSearchParams] = useSearchParams();
  const planoParam = searchParams.get('plano');

  const [planos, setPlanos] = useState<Plano[]>([]);
  const [situacao, setSituacao] = useState<AssinaturaInfo | null>(null);
  const [checkout, setCheckout] = useState<CheckoutResp | null>(null);
  const [carregando, setCarregando] = useState(false);
  const [verificando, setVerificando] = useState(false);
  const [erro, setErro] = useState('');

  // Consulta o Mercado Pago; se o pagamento foi aprovado, recarrega a sessão e o app abre.
  const verificar = useCallback(async () => {
    setVerificando(true);
    try {
      const s = await api.post<AssinaturaInfo>('/billing/sincronizar');
      setSituacao(s);
      if (s.ativa) await carregarMe();
    } catch {
      /* tenta de novo no próximo ciclo */
    } finally {
      setVerificando(false);
    }
  }, [carregarMe]);

  useEffect(() => {
    api.get<Plano[]>('/billing/planos').then(setPlanos).catch(() => setErro('Não foi possível carregar os planos.'));
    // Voltou do Mercado Pago ou reabriu o app com pagamento pendente: confere o status
    api
      .post<AssinaturaInfo>('/billing/sincronizar')
      .then(async (s) => {
        setSituacao(s);
        if (s.ativa) await carregarMe();
      })
      .catch(() => undefined);
  }, [carregarMe]);

  const urlPagamento = checkout?.checkoutUrl ?? situacao?.checkoutUrl ?? null;
  const aguardando = !!urlPagamento || !!checkout;

  // Enquanto aguarda o pagamento, confere a cada 5 s (só com a aba visível)
  useEffect(() => {
    if (!aguardando) return;
    const iv = setInterval(() => {
      if (document.visibilityState === 'visible') void verificar();
    }, 5000);
    return () => clearInterval(iv);
  }, [aguardando, verificar]);

  // Veio de /planos com um plano escolhido → já prepara o pagamento
  useEffect(() => {
    if (!planoParam || checkout || carregando) return;
    if (!planos.some((p) => p.id === planoParam)) return;
    setSearchParams({}, { replace: true });
    void assinar(planoParam);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [planoParam, planos]);

  async function assinar(planoId: string) {
    setCarregando(true);
    setErro('');
    try {
      setCheckout(await api.post<CheckoutResp>('/billing/checkout', { planoId }));
    } catch (e) {
      setErro(e instanceof ApiError ? e.message : 'Não foi possível iniciar o pagamento.');
    } finally {
      setCarregando(false);
    }
  }

  // Modo de desenvolvimento (PAYMENT_PROVIDER=mock): simula a aprovação
  async function simularPagamento() {
    if (!checkout?.gatewayPayId) return;
    await api.post('/billing/webhook', {
      tipo: 'pagamento.aprovado',
      gatewayPayId: checkout.gatewayPayId,
      eventId: 'evt_' + Date.now(),
    });
    await carregarMe();
  }

  function trocarPlano() {
    setCheckout(null);
    setSituacao((s) => (s ? { ...s, checkoutUrl: null } : s));
  }

  const aviso =
    situacao?.status === 'pausada'
      ? 'O pagamento da sua assinatura não foi aprovado. Atualize o cartão no Mercado Pago ou assine novamente.'
      : situacao?.status === 'cancelada'
        ? 'Sua assinatura foi encerrada. Escolha um plano para voltar a estudar com a Mindfast.'
        : '';

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-background px-4 py-10">
      <div className="w-full max-w-md">
        <div className="flex items-center justify-between mb-8">
          <Logo size="md" />
          <button
            onClick={() => logout()}
            className="flex items-center gap-1.5 text-xs text-gray-500 hover:text-red-400 transition-colors"
          >
            <LogOut size={13} /> Sair
          </button>
        </div>

        {!aguardando ? (
          <div className="bg-card border border-card-border rounded-2xl p-6">
            <h1 className="text-lg font-bold text-white mb-1">Olá, {usuario?.nome?.split(' ')[0] ?? 'estudante'}!</h1>
            <p className="text-sm text-gray-500 mb-5">Escolha um plano para liberar o acesso à plataforma.</p>

            {aviso && (
              <div className="mb-4 bg-amber-500/10 border border-amber-500/30 rounded-lg px-3 py-2 text-xs text-amber-300">
                {aviso}
              </div>
            )}

            <div className="space-y-3">
              {planos.map((p) => (
                <div key={p.id} className="border border-card-border rounded-xl p-4 hover:border-accent/50 transition-colors">
                  <div className="flex items-center justify-between mb-3">
                    <div>
                      <p className="text-sm font-medium text-white">{p.nome}</p>
                      <p className="text-xs text-gray-500">{p.intervalo === 'year' ? 'Cobrança anual' : 'Cobrança mensal'}</p>
                    </div>
                    <p className="text-lg font-bold text-white">
                      {reais(p.preco)}
                      <span className="text-xs font-normal text-gray-500">/{POR_PERIODO(p.intervalo)}</span>
                    </p>
                  </div>
                  <button
                    onClick={() => assinar(p.id)}
                    disabled={carregando}
                    className="w-full flex items-center justify-center gap-2 py-2 rounded-lg bg-primary hover:bg-primary/90 disabled:bg-gray-700 text-primary-foreground text-sm font-medium transition-colors"
                  >
                    <CreditCard size={14} />
                    {carregando ? 'Preparando...' : 'Assinar com cartão'}
                  </button>
                </div>
              ))}
            </div>

            <ul className="mt-5 space-y-1.5 text-xs text-gray-500">
              <li className="flex items-center gap-2"><Check size={12} className="text-accent" /> Renovação automática — cancele quando quiser</li>
              <li className="flex items-center gap-2"><Check size={12} className="text-accent" /> Arrependeu? Reembolso integral em até 7 dias</li>
              <li className="flex items-center gap-2"><ShieldCheck size={12} className="text-accent" /> Pagamento seguro pelo Mercado Pago — não guardamos seu cartão</li>
            </ul>

            {erro && <p className="text-xs text-red-400 mt-4">{erro}</p>}
          </div>
        ) : (
          <div className="bg-card border border-card-border rounded-2xl p-6 text-center">
            <h1 className="text-lg font-bold text-white mb-1">Finalize o pagamento</h1>

            {urlPagamento ? (
              <>
                <p className="text-sm text-gray-500 mb-5">
                  O pagamento é feito na página segura do Mercado Pago. Assim que for aprovado, seu acesso é liberado
                  aqui automaticamente.
                </p>
                <a
                  href={urlPagamento}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="w-full flex items-center justify-center gap-2 py-2.5 rounded-lg bg-primary hover:bg-primary/90 text-primary-foreground text-sm font-medium transition-colors"
                >
                  Abrir página de pagamento <ExternalLink size={14} />
                </a>
              </>
            ) : (
              <p className="text-sm text-gray-500 mb-5">Modo de desenvolvimento: nenhuma cobrança real é feita.</p>
            )}

            <div className="flex items-center justify-center gap-2 text-sm text-accent my-5">
              <Loader2 size={15} className="animate-spin" />
              Aguardando a confirmação do pagamento...
            </div>

            {urlPagamento && (
              <button
                onClick={() => void verificar()}
                disabled={verificando}
                className="w-full py-2 rounded-lg border border-card-border text-gray-300 hover:border-accent/50 hover:text-white text-sm transition-colors disabled:opacity-60"
              >
                {verificando ? 'Verificando...' : 'Já concluí o pagamento'}
              </button>
            )}

            {checkout?.gatewayPayId && (
              <button
                onClick={simularPagamento}
                className="w-full py-2 rounded-lg border border-accent/30 bg-accent/10 text-accent text-xs font-medium hover:bg-accent/20 transition-colors flex items-center justify-center gap-2"
              >
                <Check size={13} /> Simular pagamento aprovado (DEV)
              </button>
            )}

            <button onClick={trocarPlano} className="mt-4 text-xs text-gray-500 hover:text-gray-300 transition-colors">
              Escolher outro plano
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
