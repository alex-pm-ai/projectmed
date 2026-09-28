import { createCipheriv, createDecipheriv, createHash, createHmac, randomBytes } from 'node:crypto';
import { env } from './env.js';

/**
 * Criptografia de campos sensíveis (CPF, telefone) com AES-256-GCM.
 *
 * Formato salvo no banco: "v1:<iv>:<tag>:<conteúdo>" (partes em base64).
 * O "v1" identifica a chave usada — permite trocar a chave no futuro
 * (adicionando v2) sem perder o que já foi gravado.
 *
 * As chaves vêm de variáveis de ambiente (DATA_ENCRYPTION_KEY / DATA_HMAC_KEY),
 * nunca do código. Sem a DATA_ENCRYPTION_KEY os dados ficam ilegíveis.
 */

const VERSAO = 'v1';

function chave(base64: string, nome: string): Buffer {
  const buf = Buffer.from(base64, 'base64');
  if (buf.length !== 32) throw new Error(`${nome} precisa ter 32 bytes em base64`);
  return buf;
}

export function criptografar(texto: string): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', chave(env.DATA_ENCRYPTION_KEY, 'DATA_ENCRYPTION_KEY'), iv);
  const conteudo = Buffer.concat([cipher.update(texto, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return [VERSAO, iv.toString('base64'), tag.toString('base64'), conteudo.toString('base64')].join(':');
}

export function descriptografar(valor: string): string {
  const [versao, iv, tag, conteudo] = valor.split(':');
  if (versao !== VERSAO || !iv || !tag || !conteudo) throw new Error('Formato criptografado inválido');
  const decipher = createDecipheriv(
    'aes-256-gcm',
    chave(env.DATA_ENCRYPTION_KEY, 'DATA_ENCRYPTION_KEY'),
    Buffer.from(iv, 'base64')
  );
  decipher.setAuthTag(Buffer.from(tag, 'base64'));
  return Buffer.concat([decipher.update(Buffer.from(conteudo, 'base64')), decipher.final()]).toString('utf8');
}

/** HMAC determinístico: mesmo valor → mesmo hash. Serve para buscar/deduplicar sem descriptografar. */
export function hashDeBusca(valor: string): string {
  return createHmac('sha256', chave(env.DATA_HMAC_KEY, 'DATA_HMAC_KEY')).update(valor).digest('hex');
}

/** Token aleatório para cookies/links (256 bits) e o hash que vai para o banco. */
export function gerarToken(): { token: string; tokenHash: string } {
  const token = randomBytes(32).toString('base64url');
  return { token, tokenHash: sha256(token) };
}

export function sha256(valor: string): string {
  return createHash('sha256').update(valor).digest('hex');
}

/** Mantém só os dígitos (para CPF/telefone antes de criptografar/indexar). */
export function soDigitos(valor: string): string {
  return valor.replace(/\D/g, '');
}
