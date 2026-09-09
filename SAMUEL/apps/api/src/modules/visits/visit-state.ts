/** Máquina de estados da visita (execução). Sem HTTP, sem Prisma. */

export const CHECK_IN_FROM_STATUSES = ['ASSIGNED', 'IN_ROUTE'] as const;

export type CheckInEvalOk = { ok: true };

export type CheckInEvalErr = {
  ok: false;
  statusCode: number;
  code: string;
  message: string;
};

export type CheckInEval = CheckInEvalOk | CheckInEvalErr;

export type VisitCheckInInput = {
  visitFoundInTenant: boolean;
  visitStatus: string | null;
  checkedInAt: Date | string | null;
  visitEmployeeId: string | null;
  actorRole: string;
  actorEmployeeId: string | null;
  routeStatus: string | null;
  routeEmployeeId: string | null;
};

export function evaluateVisitCheckIn(input: VisitCheckInInput): CheckInEval {
  if (input.actorRole !== 'EMPLOYEE') {
    return {
      ok: false,
      statusCode: 403,
      code: 'AUTH_FORBIDDEN',
      message: 'Apenas o funcionário de campo faz check-in.',
    };
  }
  if (!input.actorEmployeeId) {
    return {
      ok: false,
      statusCode: 403,
      code: 'EMPLOYEE_PROFILE_REQUIRED',
      message: 'Seu usuário não está vinculado a um funcionário.',
    };
  }
  if (!input.visitFoundInTenant) {
    return {
      ok: false,
      statusCode: 404,
      code: 'VISIT_NOT_FOUND',
      message: 'Visita não encontrada.',
    };
  }
  if (input.visitEmployeeId !== input.actorEmployeeId) {
    return {
      ok: false,
      statusCode: 403,
      code: 'VISIT_FORBIDDEN',
      message: 'Você não pode fazer check-in nesta visita.',
    };
  }
  if (input.checkedInAt) {
    return {
      ok: false,
      statusCode: 409,
      code: 'VISIT_ALREADY_CHECKED_IN',
      message: 'Check-in já foi registrado nesta visita.',
    };
  }
  const fromOk = (CHECK_IN_FROM_STATUSES as readonly string[]).includes(
    input.visitStatus ?? '',
  );
  if (!fromOk) {
    return {
      ok: false,
      statusCode: 422,
      code: 'VISIT_CHECKIN_NOT_ALLOWED',
      message: 'Esta visita não está disponível para check-in.',
    };
  }
  if (input.routeStatus !== 'IN_PROGRESS') {
    return {
      ok: false,
      statusCode: 422,
      code: 'ROUTE_NOT_IN_PROGRESS',
      message: 'Inicie a rota antes de fazer check-in.',
    };
  }
  if (input.routeEmployeeId !== input.actorEmployeeId) {
    return {
      ok: false,
      statusCode: 403,
      code: 'VISIT_FORBIDDEN',
      message: 'Você não pode fazer check-in nesta visita.',
    };
  }
  return { ok: true };
}

export type VisitOutcomeValue = 'DONE' | 'NO_CONTACT' | 'REFUSED' | 'FOLLOW_UP';

export type CheckOutEval = CheckInEvalOk | CheckInEvalErr;

export type VisitCheckOutInput = {
  visitFoundInTenant: boolean;
  visitStatus: string | null;
  checkedInAt: Date | string | null;
  checkedOutAt: Date | string | null;
  visitEmployeeId: string | null;
  actorRole: string;
  actorEmployeeId: string | null;
  routeStatus: string | null;
  routeEmployeeId: string | null;
  outcome: VisitOutcomeValue;
  evidenceCount: number;
  executionNotes: string | null | undefined;
  nextVisitScheduledStart: string | null | undefined;
};

export function visitStatusForOutcome(outcome: VisitOutcomeValue): 'COMPLETED' | 'FAILED' {
  return outcome === 'NO_CONTACT' || outcome === 'REFUSED' ? 'FAILED' : 'COMPLETED';
}

export function routeStopStatusForOutcome(
  outcome: VisitOutcomeValue,
): 'COMPLETED' | 'FAILED' {
  return visitStatusForOutcome(outcome) === 'FAILED' ? 'FAILED' : 'COMPLETED';
}

export function evaluateVisitCheckOut(input: VisitCheckOutInput): CheckOutEval {
  if (input.actorRole !== 'EMPLOYEE') {
    return {
      ok: false,
      statusCode: 403,
      code: 'AUTH_FORBIDDEN',
      message: 'Apenas o funcionário de campo finaliza a visita.',
    };
  }
  if (!input.actorEmployeeId) {
    return {
      ok: false,
      statusCode: 403,
      code: 'EMPLOYEE_PROFILE_REQUIRED',
      message: 'Seu usuário não está vinculado a um funcionário.',
    };
  }
  if (!input.visitFoundInTenant) {
    return {
      ok: false,
      statusCode: 404,
      code: 'VISIT_NOT_FOUND',
      message: 'Visita não encontrada.',
    };
  }
  if (input.visitEmployeeId !== input.actorEmployeeId) {
    return {
      ok: false,
      statusCode: 403,
      code: 'VISIT_FORBIDDEN',
      message: 'Você não pode finalizar esta visita.',
    };
  }
  if (!input.checkedInAt) {
    return {
      ok: false,
      statusCode: 422,
      code: 'VISIT_CHECKIN_REQUIRED',
      message: 'Faça o check-in antes de finalizar a visita.',
    };
  }
  if (input.checkedOutAt) {
    return {
      ok: false,
      statusCode: 409,
      code: 'VISIT_ALREADY_CHECKED_OUT',
      message: 'Esta visita já foi finalizada.',
    };
  }
  if (input.visitStatus !== 'IN_PROGRESS') {
    return {
      ok: false,
      statusCode: 422,
      code: 'VISIT_CHECKOUT_NOT_ALLOWED',
      message: 'Esta visita não está em atendimento.',
    };
  }
  if (input.routeStatus !== 'IN_PROGRESS') {
    return {
      ok: false,
      statusCode: 422,
      code: 'ROUTE_NOT_IN_PROGRESS',
      message: 'A rota não está em andamento.',
    };
  }
  if (input.routeEmployeeId !== input.actorEmployeeId) {
    return {
      ok: false,
      statusCode: 403,
      code: 'VISIT_FORBIDDEN',
      message: 'Você não pode finalizar esta visita.',
    };
  }

  const notes = input.executionNotes?.trim() ?? '';
  if (input.outcome !== 'DONE' && !notes) {
    return {
      ok: false,
      statusCode: 422,
      code: 'VISIT_EXECUTION_NOTES_REQUIRED',
      message: 'Observações são obrigatórias para este resultado.',
    };
  }

  if (input.outcome === 'DONE' && input.evidenceCount < 1) {
    return {
      ok: false,
      statusCode: 422,
      code: 'VISIT_EVIDENCE_REQUIRED',
      message: 'Adicione pelo menos uma foto para visita realizada.',
    };
  }

  if (input.outcome === 'FOLLOW_UP') {
    if (!input.nextVisitScheduledStart) {
      return {
        ok: false,
        statusCode: 422,
        code: 'VISIT_NEXT_SCHEDULE_REQUIRED',
        message: 'Informe a data da próxima visita.',
      };
    }
    const next = new Date(input.nextVisitScheduledStart);
    if (Number.isNaN(next.getTime()) || next.getTime() <= Date.now()) {
      return {
        ok: false,
        statusCode: 422,
        code: 'VISIT_NEXT_SCHEDULE_INVALID',
        message: 'A próxima visita deve ser agendada no futuro.',
      };
    }
  }

  if (input.nextVisitScheduledStart) {
    const next = new Date(input.nextVisitScheduledStart);
    if (Number.isNaN(next.getTime()) || next.getTime() <= Date.now()) {
      return {
        ok: false,
        statusCode: 422,
        code: 'VISIT_NEXT_SCHEDULE_INVALID',
        message: 'A próxima visita deve ser agendada no futuro.',
      };
    }
  }

  return { ok: true };
}
