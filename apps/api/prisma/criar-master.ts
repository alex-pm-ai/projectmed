import { PrismaClient } from '@prisma/client';
import { hashSenha, verificarSenha } from '../src/shared/password.js';

/**
 * Cria (ou atualiza) o usuário master — papel "admin", acessa o app sem assinatura.
 *
 * Lê MASTER_NOME, MASTER_EMAIL e MASTER_SENHA das variáveis de ambiente (nunca do código).
 * Uso local:  npm run criar-master        (lê o .env)
 * No deploy:  npm run criar-master:prod   (sem MASTER_EMAIL/MASTER_SENHA, só avisa e sai)
 *
 * Idempotente: se o usuário já existe com a mesma senha, não muda nada. Se a senha
 * mudou, grava a nova e derruba as sessões abertas.
 */
const prisma = new PrismaClient();

async function main() {
  const nome = process.env.MASTER_NOME?.trim() || 'Administrador';
  const email = process.env.MASTER_EMAIL?.trim().toLowerCase();
  const senha = process.env.MASTER_SENHA;

  if (!email || !senha) {
    console.log('Usuário master: MASTER_EMAIL/MASTER_SENHA não definidos — nada a fazer.');
    return;
  }
  if (senha.length < 12) throw new Error('MASTER_SENHA precisa ter pelo menos 12 caracteres');

  const existente = await prisma.usuario.findUnique({ where: { email } });
  if (existente) {
    const { ok } = await verificarSenha(existente.senhaHash, senha);
    if (ok && existente.papel === 'admin') {
      console.log(`Usuário master já está em dia: ${email}`);
      return;
    }
    await prisma.usuario.update({
      where: { id: existente.id },
      data: { nome, senhaHash: await hashSenha(senha), papel: 'admin', tentativasLoginFalhas: 0, bloqueadoAte: null },
    });
    // Senha trocada → invalida as sessões antigas
    await prisma.refreshToken.updateMany({ where: { usuarioId: existente.id, revoked: false }, data: { revoked: true } });
    console.log(`Usuário master atualizado: ${email}`);
    return;
  }

  await prisma.usuario.create({
    data: { nome, email, senhaHash: await hashSenha(senha), papel: 'admin', emailVerificadoEm: new Date() },
  });
  console.log(`Usuário master criado: ${email}`);
}

main()
  .then(() => prisma.$disconnect())
  .catch(async (e) => {
    console.error('❌', e instanceof Error ? e.message : e);
    await prisma.$disconnect();
    process.exit(1);
  });
