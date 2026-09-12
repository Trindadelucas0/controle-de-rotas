import { HttpStatus, Injectable } from '@nestjs/common';
import {
  Prisma,
  ServiceOrderPriority,
  ServiceOrderStatus,
  VisitStatus,
} from '@prisma/client';
import { PrismaService } from '../../common/prisma/prisma.service';
import { AuthUser } from '../auth/decorators/auth.decorators';
import { httpError } from '../../common/errors/http-error';
import {
  CreateServiceOrderDto,
  CreateVisitInlineDto,
  ListServiceOrdersQueryDto,
  UpdateServiceOrderDto,
} from './dto/service-orders.dto';
import { CreateVisitDto } from '../visits/dto/visits.dto';
import { allocateServiceOrderNumber } from './service-order-seq';
import {
  CustomerAddressPin,
  customerHasPin,
  visitAddressSnapshot,
} from './visit-snapshot';

@Injectable()
export class ServiceOrdersService {
  constructor(private readonly prisma: PrismaService) {}

  async list(user: AuthUser, query: ListServiceOrdersQueryDto) {
    const where: Prisma.ServiceOrderWhereInput = {
      companyId: user.companyId,
      customer: { recordSessionShell: false },
      ...(query.customerId ? { customerId: query.customerId } : {}),
      ...(query.status ? { status: query.status } : {}),
      ...(query.q?.trim()
        ? {
            OR: [
              { title: { contains: query.q.trim(), mode: 'insensitive' } },
              { description: { contains: query.q.trim(), mode: 'insensitive' } },
              { customer: { name: { contains: query.q.trim(), mode: 'insensitive' } } },
            ],
          }
        : {}),
    };

    const orders = await this.prisma.serviceOrder.findMany({
      where,
      include: {
        customer: { select: { id: true, name: true, tradeName: true } },
        _count: { select: { visits: true } },
      },
      orderBy: [{ number: 'desc' }],
      take: 200,
    });

    return {
      serviceOrders: orders.map((o) => ({
        id: o.id,
        number: o.number,
        title: o.title,
        description: o.description,
        priority: o.priority,
        status: o.status,
        dueAt: o.dueAt,
        customerId: o.customerId,
        customer: o.customer,
        visitsCount: o._count.visits,
        createdAt: o.createdAt,
        updatedAt: o.updatedAt,
      })),
    };
  }

  async getOne(user: AuthUser, id: string) {
    const order = await this.prisma.serviceOrder.findFirst({
      where: { id, companyId: user.companyId },
      include: {
        customer: {
          select: {
            id: true,
            name: true,
            tradeName: true,
            phone: true,
            street: true,
            number: true,
            city: true,
            state: true,
            latitude: true,
            longitude: true,
            locationStatus: true,
          },
        },
        visits: {
          include: {
            employee: { select: { id: true, name: true } },
            routeStop: { select: { id: true, routeId: true, sequence: true, status: true } },
            evidence: {
              select: {
                id: true,
                type: true,
                mimeType: true,
                sizeBytes: true,
                caption: true,
                originalName: true,
                createdAt: true,
              },
              orderBy: { createdAt: 'asc' },
            },
          },
          orderBy: { scheduledStart: 'asc' },
        },
      },
    });
    if (!order) {
      throw httpError(HttpStatus.NOT_FOUND, 'SERVICE_ORDER_NOT_FOUND', 'Ordem de serviço não encontrada.');
    }
    return { serviceOrder: order };
  }

  async create(user: AuthUser, dto: CreateServiceOrderDto) {
    const customer = await this.prisma.customer.findFirst({
      where: { id: dto.customerId, companyId: user.companyId },
    });
    if (!customer) {
      throw httpError(HttpStatus.NOT_FOUND, 'CUSTOMER_NOT_FOUND', 'Cliente não encontrado.');
    }

    if (dto.firstVisit) {
      this.assertCustomerPin(customer);
      if (dto.firstVisit.employeeId) {
        await this.assertEmployee(user.companyId, dto.firstVisit.employeeId);
      }
    }

    const order = await this.prisma.$transaction(async (tx) => {
      const number = await allocateServiceOrderNumber(tx, user.companyId);

      const created = await tx.serviceOrder.create({
        data: {
          companyId: user.companyId,
          customerId: customer.id,
          number,
          title: dto.title.trim(),
          description: dto.description?.trim() || null,
          priority: dto.priority ?? ServiceOrderPriority.NORMAL,
          status: ServiceOrderStatus.OPEN,
          dueAt: dto.dueAt ? new Date(dto.dueAt) : null,
          createdByUserId: user.id,
        },
      });

      if (dto.firstVisit) {
        await tx.visit.create({
          data: this.buildVisitData(user.companyId, created.id, customer, dto.firstVisit),
        });
        await tx.serviceOrder.update({
          where: { id: created.id },
          data: { status: ServiceOrderStatus.IN_PROGRESS },
        });
      }

      return created;
    });

    return this.getOne(user, order.id);
  }

  async update(user: AuthUser, id: string, dto: UpdateServiceOrderDto) {
    const existing = await this.prisma.serviceOrder.findFirst({
      where: { id, companyId: user.companyId },
    });
    if (!existing) {
      throw httpError(HttpStatus.NOT_FOUND, 'SERVICE_ORDER_NOT_FOUND', 'Ordem de serviço não encontrada.');
    }
    if (existing.status === ServiceOrderStatus.CANCELLED) {
      throw httpError(
        HttpStatus.UNPROCESSABLE_ENTITY,
        'SERVICE_ORDER_CANCELLED',
        'Ordem cancelada não pode ser editada.',
      );
    }

    await this.prisma.serviceOrder.update({
      where: { id },
      data: {
        ...(dto.title !== undefined ? { title: dto.title.trim() } : {}),
        ...(dto.description !== undefined ? { description: dto.description?.trim() || null } : {}),
        ...(dto.priority !== undefined ? { priority: dto.priority } : {}),
        ...(dto.status !== undefined ? { status: dto.status } : {}),
        ...(dto.dueAt !== undefined ? { dueAt: dto.dueAt ? new Date(dto.dueAt) : null } : {}),
      },
    });

    return this.getOne(user, id);
  }

  async cancel(user: AuthUser, id: string) {
    const existing = await this.prisma.serviceOrder.findFirst({
      where: { id, companyId: user.companyId },
    });
    if (!existing) {
      throw httpError(HttpStatus.NOT_FOUND, 'SERVICE_ORDER_NOT_FOUND', 'Ordem de serviço não encontrada.');
    }
    if (existing.status === ServiceOrderStatus.CANCELLED) {
      return this.getOne(user, id);
    }

    await this.prisma.$transaction(async (tx) => {
      await tx.serviceOrder.update({
        where: { id },
        data: { status: ServiceOrderStatus.CANCELLED },
      });
      await tx.visit.updateMany({
        where: {
          serviceOrderId: id,
          companyId: user.companyId,
          status: { in: [VisitStatus.SCHEDULED, VisitStatus.ASSIGNED, VisitStatus.RESCHEDULED] },
        },
        data: { status: VisitStatus.CANCELLED },
      });
    });

    return this.getOne(user, id);
  }

  async addVisit(user: AuthUser, serviceOrderId: string, dto: CreateVisitDto) {
    const order = await this.prisma.serviceOrder.findFirst({
      where: { id: serviceOrderId, companyId: user.companyId },
      include: { customer: true },
    });
    if (!order) {
      throw httpError(HttpStatus.NOT_FOUND, 'SERVICE_ORDER_NOT_FOUND', 'Ordem de serviço não encontrada.');
    }
    if (order.status === ServiceOrderStatus.CANCELLED) {
      throw httpError(
        HttpStatus.UNPROCESSABLE_ENTITY,
        'SERVICE_ORDER_CANCELLED',
        'Não é possível agendar visita em OS cancelada.',
      );
    }

    this.assertCustomerPin(order.customer);
    if (dto.employeeId) {
      await this.assertEmployee(user.companyId, dto.employeeId);
    }

    const visit = await this.prisma.visit.create({
      data: this.buildVisitData(user.companyId, order.id, order.customer, dto),
      include: {
        employee: { select: { id: true, name: true } },
        customer: { select: { id: true, name: true } },
        serviceOrder: { select: { id: true, number: true, title: true } },
      },
    });

    if (order.status === ServiceOrderStatus.OPEN) {
      await this.prisma.serviceOrder.update({
        where: { id: order.id },
        data: { status: ServiceOrderStatus.IN_PROGRESS },
      });
    }

    return { visit };
  }

  private buildVisitData(
    companyId: string,
    serviceOrderId: string,
    customer: CustomerAddressPin,
    dto: CreateVisitDto | CreateVisitInlineDto,
  ) {
    return {
      companyId,
      serviceOrderId,
      customerId: customer.id,
      employeeId: dto.employeeId || null,
      scheduledStart: new Date(dto.scheduledStart),
      scheduledEnd: dto.scheduledEnd ? new Date(dto.scheduledEnd) : null,
      status: VisitStatus.SCHEDULED,
      ...visitAddressSnapshot(customer),
      notes: dto.notes?.trim() || null,
    };
  }

  private assertCustomerPin(customer: CustomerAddressPin) {
    if (!customerHasPin(customer)) {
      throw httpError(
        HttpStatus.UNPROCESSABLE_ENTITY,
        'VISIT_CUSTOMER_NO_PIN',
        `Cliente "${customer.name}" não tem pin no mapa. Geocodifique o endereço antes de agendar visita.`,
      );
    }
  }

  private async assertEmployee(companyId: string, employeeId: string) {
    const employee = await this.prisma.employee.findFirst({
      where: { id: employeeId, companyId },
      select: { id: true },
    });
    if (!employee) {
      throw httpError(HttpStatus.NOT_FOUND, 'EMPLOYEE_NOT_FOUND', 'Funcionário não encontrado.');
    }
  }
}
