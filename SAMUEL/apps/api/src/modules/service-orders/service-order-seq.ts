import { HttpStatus } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { httpError } from '../../common/errors/http-error';

export async function allocateServiceOrderNumber(
  tx: Prisma.TransactionClient,
  companyId: string,
): Promise<number> {
  const seqRows = await tx.$queryRaw<{ service_order_seq: number }[]>`
    UPDATE companies
    SET service_order_seq = service_order_seq + 1, updated_at = NOW()
    WHERE id = ${companyId}::uuid
    RETURNING service_order_seq
  `;
  const number = seqRows[0]?.service_order_seq;
  if (!number) {
    throw httpError(
      HttpStatus.INTERNAL_SERVER_ERROR,
      'SERVICE_ORDER_SEQ_FAILED',
      'Falha ao numerar OS.',
    );
  }
  return number;
}
