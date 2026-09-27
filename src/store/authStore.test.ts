import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { useAuthStore } from './authStore';

// Respostas que imitam o objeto Response usado pelo lib/api.ts (status, ok, json()).
function res(status: number, body: unknown) {
  return {
    status,
    ok: status >= 200 && status < 300,
    json: async () => body,
  } as Response;
}

const usuario = { id: 'u1', nome: 'João', email: 'joao@test.com', tipo: 'R1' };
const assinatura = {
  status: 'ativa',
  ativa: true,
  validoAte: '2099-01-01T00:00:00.000Z',
  plano: { nome: 'Mensal', intervalo: 'mensal' },
};

const estadoInicial = {
  accessToken: null,
  refreshToken: null,
  usuario: null,
  assinatura: null,
  carregado: false,
};

describe('authStore.carregarMe — recuperação de token expirado', () => {
  beforeEach(() => {
    useAuthStore.setState(estadoInicial);
  });
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('com token expirado, renova via refresh e completa o carregamento', async () => {
    let meCalls = 0;
    vi.stubGlobal(
      'fetch',
      vi.fn((url: string) => {
        if (url.endsWith('/auth/me')) {
          meCalls += 1;
          // 1ª chamada: token velho → 401. 2ª (após refresh): sucesso.
          return Promise.resolve(
            meCalls === 1
              ? res(401, { error: 'unauthorized', message: 'Token ausente' })
              : res(200, { usuario, assinatura })
          );
        }
        if (url.endsWith('/auth/refresh')) {
          return Promise.resolve(res(200, { accessToken: 'novo-access', refreshToken: 'novo-refresh' }));
        }
        return Promise.resolve(res(404, {}));
      })
    );

    useAuthStore.setState({ accessToken: 'token-velho', refreshToken: 'rt-valido' });
    await useAuthStore.getState().carregarMe();

    const s = useAuthStore.getState();
    expect(s.carregado).toBe(true);
    expect(s.usuario?.email).toBe('joao@test.com');
    expect(s.assinatura?.ativa).toBe(true);
    expect(s.accessToken).toBe('novo-access'); // token foi renovado
    expect(meCalls).toBe(2); // tentou, renovou e repetiu
  });

  it('com token expirado e refresh inválido, faz logout e cai no Login', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn((url: string) => {
        if (url.endsWith('/auth/me')) {
          return Promise.resolve(res(401, { error: 'unauthorized', message: 'Token ausente' }));
        }
        if (url.endsWith('/auth/refresh')) {
          return Promise.resolve(res(401, { error: 'unauthorized', message: 'Refresh inválido' }));
        }
        if (url.endsWith('/auth/logout')) {
          return Promise.resolve(res(204, null));
        }
        return Promise.resolve(res(404, {}));
      })
    );

    useAuthStore.setState({ accessToken: 'token-velho', refreshToken: 'rt-expirado' });
    await useAuthStore.getState().carregarMe();

    const s = useAuthStore.getState();
    // Sessão morta → sem token → App renderiza o <Login/> em vez de travar no loader.
    expect(s.accessToken).toBeNull();
    expect(s.refreshToken).toBeNull();
    expect(s.usuario).toBeNull();
    expect(s.carregado).toBe(false);
  });

  it('com erro de rede (API fora do ar), propaga o erro sem deslogar', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(() => Promise.reject(new TypeError('Failed to fetch')))
    );

    useAuthStore.setState({ accessToken: 'token-valido', refreshToken: 'rt-valido' });

    await expect(useAuthStore.getState().carregarMe()).rejects.toThrow();

    const s = useAuthStore.getState();
    // Erro transitório não deve destruir a sessão.
    expect(s.accessToken).toBe('token-valido');
    expect(s.carregado).toBe(false);
  });
});
