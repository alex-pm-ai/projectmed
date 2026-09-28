import { PrismaClient } from '@prisma/client';
import { hashSenha } from '../src/shared/password.js';

/**
 * Cria (ou atualiza) o usuário master — papel "admin", acessa o app sem assinatura.
 *
 * Lê MASTER_NOME, MASTER_EMAIL e MASTER_SENHA do .env (nunca do código).
 * Uso:  npm run criar-master
 * Rodar de novo com outra MASTER_SENHA troca a senha e derruba as sessões abertas.
 */
const prisma = new PrismaClient();

async function main() {
  const nome = process.env.MASTER_NOME?.trim() || 'Administrador';
  const email = process.env.MASTER_EMAIL?.trim().toLowerCase();
  const senha = process.env.MASTER_SENHA;

  if (!email || !senha) throw new Error('Defina MASTER_EMAIL e MASTER_SENHA no .env');
  if (senha.length < 12) throw new Error('MASTER_SENHA precisa ter pelo menos 12 caracteres');

  const senhaHash = await hashSenha(senha);
  const usuario = await prisma.usuario.upsert({
    where: { email },
    update: { nome, senhaHash, papel: 'admin', tentativasLoginFalhas: 0, bloqueadoAte: null },
    create: { nome, email, senhaHash, papel: 'admin', emailVerificadoEm: new Date() },
  });

  // Se era uma troca de senha, invalida as sessões antigas.
  await prisma.refreshToken.updateMany({
    where: { usuarioId: usuario.id, revoked: false },
    data: { revoked: true },
  });

  console.log(`Usuário master pronto: ${usuario.email} (papel: ${usuario.papel})`);
}

main()
  .then(() => prisma.$disconnect())
  .catch(async (e) => {
    console.error('❌', e instanceof Error ? e.message : e);
    await prisma.$disconnect();
    process.exit(1);
  });
