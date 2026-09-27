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

/** Limpa todas as tabelas do schema de teste entre os casos. */
export async function resetDb() {
  await prisma.$executeRawUnsafe(
    `TRUNCATE TABLE
      "test"."RefreshToken","test"."Pagamento","test"."WebhookEvent","test"."Assinatura",
      "test"."Revisao","test"."Simulado","test"."Tarefa","test"."ConfigAlgoritmo",
      "test"."MetaSemanal","test"."Plano","test"."Usuario"
     RESTART IDENTITY CASCADE;`
  );
}

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
  usuario: { id: string; nome: string; email: string; tipo: string };
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
    payload: { nome: 'Residente Teste', email, senha: 'senha123', tipo: 'R1' },
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
    email,
    headers: { authorization: `Bearer ${body.accessToken}` },
  };
}
