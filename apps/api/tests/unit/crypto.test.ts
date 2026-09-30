import { describe, it, expect } from 'vitest';
import { criptografar, descriptografar, hashDeBusca, soDigitos } from '../../src/shared/crypto.js';

// Testes puros (não usam o banco): criptografia de CPF/telefone.
describe('Criptografia de dados pessoais', () => {
  const cpf = soDigitos('123.456.789-09');

  it('criptografa e descriptografa de volta o mesmo valor', () => {
    const cifrado = criptografar(cpf);
    expect(cifrado.startsWith('v1:')).toBe(true);
    expect(cifrado).not.toContain(cpf);
    expect(descriptografar(cifrado)).toBe(cpf);
  });

  it('o mesmo CPF gera textos cifrados diferentes a cada vez (IV aleatório)', () => {
    expect(criptografar(cpf)).not.toBe(criptografar(cpf));
  });

  it('detecta adulteração do valor cifrado', () => {
    const partes = criptografar(cpf).split(':');
    partes[3] = Buffer.from('adulterado').toString('base64');
    expect(() => descriptografar(partes.join(':'))).toThrow();
  });

  it('hash de busca é determinístico (serve para achar CPF duplicado)', () => {
    expect(hashDeBusca(cpf)).toBe(hashDeBusca('12345678909'));
    expect(hashDeBusca(cpf)).not.toBe(hashDeBusca('98765432100'));
    expect(hashDeBusca(cpf)).not.toContain(cpf);
  });
});
