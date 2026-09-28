import { hash, verify } from '@node-rs/argon2';
import bcrypt from 'bcryptjs';

/**
 * Senhas: Argon2id com os parâmetros recomendados pela OWASP
 * (19 MiB de memória, 2 iterações, 1 thread — os padrões do @node-rs/argon2).
 * A senha nunca é guardada nem "descriptografada": só comparamos hashes.
 */
export async function hashSenha(senha: string): Promise<string> {
  return hash(senha);
}

/**
 * Confere a senha contra o hash salvo. Aceita hashes bcrypt antigos ($2a$/$2b$):
 * nesse caso `precisaRehash` volta true para o chamador regravar em Argon2id.
 */
export async function verificarSenha(
  senhaHash: string,
  senha: string
): Promise<{ ok: boolean; precisaRehash: boolean }> {
  if (senhaHash.startsWith('$2')) {
    const ok = await bcrypt.compare(senha, senhaHash);
    return { ok, precisaRehash: ok };
  }
  try {
    return { ok: await verify(senhaHash, senha), precisaRehash: false };
  } catch {
    return { ok: false, precisaRehash: false };
  }
}

// Hash de uma senha aleatória, usado para gastar o mesmo tempo quando o e-mail
// não existe (assim o tempo de resposta não revela quais e-mails têm conta).
let hashFalso: Promise<string> | null = null;
export async function verificarSenhaFalsa(senha: string): Promise<void> {
  hashFalso ??= hash('senha-inexistente-' + Math.random());
  await verify(await hashFalso, senha).catch(() => false);
}

// Senhas fracas demais para aceitar, mesmo com 8+ caracteres.
const SENHAS_COMUNS = new Set([
  '12345678', '123456789', '1234567890', '87654321', '11111111', '00000000',
  'password', 'password1', 'senha123', 'senha1234', 'senhasenha', 'qwerty123',
  'qwertyui', 'abcd1234', 'abc12345', 'iloveyou', 'mudar123', 'admin123',
  'mindfast', 'mindfast1', 'residencia', 'medicina', 'medicina1',
]);

export function senhaEhComum(senha: string): boolean {
  return SENHAS_COMUNS.has(senha.toLowerCase());
}
