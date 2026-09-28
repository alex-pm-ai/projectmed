import type { FastifyInstance } from 'fastify';
import { buildApp } from '../../src/app.js';
import { prisma } from '../../src/shared/prisma.js';

export { prisma };

let appInstance: FastifyInstance | null = null;

/** App Fastify único e reutilizado (usa app.inject — não abre porta). */
export async function getApp(): Promise<FastifyInstance> {
  if (!appInstance) {
    appInstance = await buildApp();
    await appInstance.ready();
  }
  return appInstance;
}

/** Limpa todas as tabelas do banco de teste entre os casos. */
export async function resetDb() {
  const tabelas = [
    'RefreshToken', 'TokenUsoUnico', 'Pagamento', 'WebhookEvent', 'Assinatura',
    'Revisao', 'Simulado', 'Tarefa', 'ConfigAlgoritmo', 'MetaSemanal', 'Plano', 'Usuario',
  ];
  // No MySQL o TRUNCATE não passa por cima de chaves estrangeiras; desliga a checagem
  // numa transação para que tudo rode na mesma conexão.
  await prisma.$transaction([
    prisma.$executeRawUnsafe('SET FOREIGN_KEY_CHECKS = 0'),
    ...tabelas.map((t) => prisma.$executeRawUnsafe(`TRUNCATE TABLE \`${t}\``)),
    prisma.$executeRawUnsafe('SET FOREIGN_KEY_CHECKS = 1'),
  ]);
}

/** Extrai o refresh token do cookie httpOnly devolvido pela API. */
export function refreshDoCookie(res: { cookies: { name: string; value: string }[] }): string {
  return res.cookies.find((c) => c.name === 'pm_refresh')?.value ?? '';
}

export const SENHA_TESTE = 'Residente#2026';

/** Garante que exista ao menos um plano (para os testes de billing). */
export async function ensurePlano() {
  const existe = await prisma.plano.findFirst();
  if (existe) return existe;
  return prisma.plano.create({ data: { nome: 'Mensal', preco: 4990, intervalo: 'month' } });
}

let counter = 0;

interface UsuarioTeste {
  accessToken: string;
  refreshToken: string;
  usuario: { id: string; nome: string; email: string; tipo: string; emailVerificado: boolean };
  email: string;
  headers: { authorization: string };
}

/**
 * Registra um usuário novo. Se comAssinatura=true, cria uma assinatura ativa
 * direto no banco (atalho para testar rotas protegidas pelo gate).
 */
export async function registrar(
  app: FastifyInstance,
  comAssinatura = false,
  emailParam?: string
): Promise<UsuarioTeste> {
  const email = emailParam ?? `user_${Date.now()}_${counter++}@test.com`;
  const res = await app.inject({
    method: 'POST',
    url: '/auth/register',
    payload: { nome: 'Residente Teste', email, senha: SENHA_TESTE, tipo: 'R1' },
  });
  const body = res.json();

  if (comAssinatura) {
    const plano = await ensurePlano();
    await prisma.assinatura.create({
      data: {
        usuarioId: body.usuario.id,
        planoId: plano.id,
        status: 'ativa',
        validoAte: new Date(Date.now() + 1000 * 60 * 60 * 24 * 365),
      },
    });
  }

  return {
    ...body,
    refreshToken: refreshDoCookie(res),
    email,
    headers: { authorization: `Bearer ${body.accessToken}` },
  };
}
