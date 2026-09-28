import type { FastifyReply, FastifyRequest } from 'fastify';
import { verifyAccessToken } from './jwt.js';
import { prisma } from './prisma.js';
import { PaymentRequiredError, UnauthorizedError } from './errors.js';

/**
 * Autenticação: valida o access token e anexa o usuarioId à request.
 * Use em toda rota que exige login.
 */
export async function requireAuth(req: FastifyRequest, _reply: FastifyReply) {
  const header = req.headers.authorization;
  if (!header?.startsWith('Bearer ')) {
    throw new UnauthorizedError('Token ausente');
  }
  try {
    const payload = verifyAccessToken(header.slice(7));
    req.usuarioId = payload.sub;
  } catch {
    throw new UnauthorizedError('Token inválido ou expirado');
  }
}

/**
 * Gate de assinatura: só passa quem tem assinatura ATIVA e dentro da validade.
 * A verdade vem do banco (alimentado pelos webhooks do provedor), nunca do cliente.
 * Use nas rotas de CONTEÚDO (revisoes, simulados, analytics...).
 * NÃO use em /auth/* nem /billing/* (senão o usuário nunca consegue pagar).
 */
export async function requireAssinatura(req: FastifyRequest, _reply: FastifyReply) {
  const usuario = await prisma.usuario.findUnique({
    where: { id: req.usuarioId },
    select: { papel: true, assinatura: true },
  });

  // Administrador (usuário master) não depende de assinatura.
  if (usuario?.papel === 'admin') return;

  // Sem pagamento, inadimplente (atrasada), cancelada ou vencida → bloqueado.
  const assinatura = usuario?.assinatura;
  const ativa =
    assinatura &&
    assinatura.status === 'ativa' &&
    assinatura.validoAte.getTime() > Date.now();

  if (!ativa) {
    throw new PaymentRequiredError();
  }
}
