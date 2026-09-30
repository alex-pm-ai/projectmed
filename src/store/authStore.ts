import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { api, API_URL, ApiError } from '../lib/api';
import { useStore } from './useStore';

// Evita disparar /auth/me (e um possível /auth/refresh) em duplicidade quando
// carregarMe() é chamado mais de uma vez em paralelo (ex.: StrictMode em dev).
let meInFlight: Promise<void> | null = null;

export interface UsuarioAuth {
  id: string;
  nome: string;
  email: string;
  tipo: string;
  papel: string; // usuario | admin
  emailVerificado: boolean;
}

export interface AssinaturaInfo {
  status: string; // sem_assinatura | pendente | ativa | pausada | cancelada | admin
  ativa: boolean;
  validoAte: string | null;
  plano: { nome: string; intervalo: string; preco?: number } | null;
  // Detalhes vindos de /billing/assinatura e /billing/sincronizar
  ativadaEm?: string | null;
  canceladaEm?: string | null;
  podeArrepender?: boolean;
  checkoutUrl?: string | null;
}

interface TokensResp {
  accessToken: string;
  usuario: UsuarioAuth;
}

interface MeResp {
  usuario: UsuarioAuth;
  assinatura: AssinaturaInfo;
}

interface AuthState {
  // Só em memória: some ao recarregar a página e é renovado pelo cookie httpOnly.
  accessToken: string | null;
  usuario: UsuarioAuth | null;
  assinatura: AssinaturaInfo | null;
  carregado: boolean; // /auth/me já resolveu nesta sessão

  login: (email: string, senha: string) => Promise<void>;
  register: (nome: string, email: string, senha: string) => Promise<void>;
  logout: () => Promise<void>;
  carregarMe: () => Promise<void>;
  tentarRefresh: () => Promise<boolean>;
  marcarAssinaturaInativa: () => void;
}

// Versões antigas guardavam os tokens no localStorage (chave "dalk-auth"): apaga.
try {
  localStorage.removeItem('dalk-auth');
} catch {
  /* navegador sem localStorage */
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      accessToken: null,
      usuario: null,
      assinatura: null,
      carregado: false,

      login: async (email, senha) => {
        const r = await api.post<TokensResp>('/auth/login', { email, senha });
        set({ accessToken: r.accessToken, usuario: r.usuario });
        await get().carregarMe();
      },

      register: async (nome, email, senha) => {
        const r = await api.post<TokensResp>('/auth/register', { nome, email, senha });
        set({ accessToken: r.accessToken, usuario: r.usuario });
        await get().carregarMe();
      },

      carregarMe: async () => {
        if (meInFlight) return meInFlight;
        meInFlight = (async () => {
          try {
            const r = await api.get<MeResp>('/auth/me');
            set({ usuario: r.usuario, assinatura: r.assinatura, carregado: true });
          } catch (e) {
            // Token expirado/inválido: tenta renovar via refresh e repetir uma vez.
            // (api.ts não auto-renova rotas /auth/*, então tratamos aqui.)
            if (e instanceof ApiError && e.status === 401) {
              const ok = await get().tentarRefresh();
              if (ok) {
                const r = await api.get<MeResp>('/auth/me');
                set({ usuario: r.usuario, assinatura: r.assinatura, carregado: true });
                return;
              }
              // Refresh falhou → sessão morta: limpa tudo e cai no Login.
              await get().logout();
              return;
            }
            // Erro de rede (API fora do ar etc.) → propaga para quem chamou.
            throw e;
          } finally {
            meInFlight = null;
          }
        })();
        return meInFlight;
      },

      tentarRefresh: async () => {
        // O refresh token vai sozinho no cookie httpOnly (credentials: 'include').
        try {
          const res = await fetch(API_URL + '/auth/refresh', { method: 'POST', credentials: 'include' });
          if (!res.ok) return false;
          const d = (await res.json()) as { accessToken: string };
          set({ accessToken: d.accessToken });
          return true;
        } catch {
          return false;
        }
      },

      logout: async () => {
        try {
          await api.post('/auth/logout');
        } catch {
          /* ignora */
        }
        set({ accessToken: null, usuario: null, assinatura: null, carregado: false });
        useStore.getState().limpar();
      },

      marcarAssinaturaInativa: () => {
        const a = get().assinatura;
        set({
          assinatura: a
            ? { ...a, ativa: false }
            : { status: 'inativa', ativa: false, validoAte: null, plano: null },
        });
      },
    }),
    {
      name: 'pm-auth',
      // Persiste só o usuário (nome/e-mail, para a interface). Nenhum token vai para o
      // localStorage: o access token fica em memória e o refresh token no cookie httpOnly.
      partialize: (s) => ({ usuario: s.usuario }),
    }
  )
);
