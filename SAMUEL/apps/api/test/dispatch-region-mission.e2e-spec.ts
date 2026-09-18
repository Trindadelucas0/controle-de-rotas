import { EmployeeStatus, VehicleStatus } from '@prisma/client';
import { closeTestApp, getTestApp, loginAs } from './helpers';
import { PrismaService } from '../src/common/prisma/prisma.service';
import { DEMO_COMPANY_ID, TEST_USERS } from './fixtures';
import { businessDayYmd } from '../src/common/date/business-day';

describe('POST /api/v1/routes/dispatch-region-mission', () => {
  afterAll(async () => {
    await closeTestApp();
  });

  async function seedDispatchIds() {
    const nest = await getTestApp();
    const prisma = nest.get(PrismaService);
    const user = await prisma.user.findUnique({ where: { email: TEST_USERS.EMPLOYEE } });
    if (!user) throw new Error('employee de teste ausente');
    const employee = await prisma.employee.findFirst({
      where: { companyId: DEMO_COMPANY_ID, userId: user.id, status: EmployeeStatus.ACTIVE },
    });
    if (!employee) throw new Error('employee ativo ausente');
    const suffix = `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
    const vehicle = await prisma.vehicle.create({
      data: {
        companyId: DEMO_COMPANY_ID,
        plate: `R${suffix.slice(-7).toUpperCase()}`,
        brand: 'Test',
        model: 'Region',
        status: VehicleStatus.AVAILABLE,
      },
    });
    return { employeeId: employee.id, vehicleId: vehicle.id };
  }

  it('422 sem centro', async () => {
    const ids = await seedDispatchIds();
    const admin = await loginAs('ADMIN');
    const res = await admin.post('/api/v1/routes/dispatch-region-mission').send({
      date: businessDayYmd(),
      employeeId: ids.employeeId,
      vehicleId: ids.vehicleId,
    });
    expect(res.status).toBe(422);
    expect(res.body.code).toBe('REGION_CENTER_REQUIRED');
  });

  it('publica com raio 5000 e origem = centro', async () => {
    const ids = await seedDispatchIds();
    const admin = await loginAs('ADMIN');
    const latitude = -23.5505;
    const longitude = -46.6333;
    const res = await admin.post('/api/v1/routes/dispatch-region-mission').send({
      date: businessDayYmd(),
      employeeId: ids.employeeId,
      vehicleId: ids.vehicleId,
      latitude,
      longitude,
    });
    expect([200, 201]).toContain(res.status);
    const route = res.body.route;
    expect(route.recordNewCustomer).toBe(true);
    expect(route.assignmentRegionRadiusMeters).toBe(5000);
    expect(route.assignmentRegionName).toBe('Raio 5 km');
    expect(route.originLatitude).toBe(latitude);
    expect(route.originLongitude).toBe(longitude);
    expect(route.assignmentRegionLatitude).toBe(latitude);
    expect(route.assignmentRegionLongitude).toBe(longitude);
  });

  it('EMPLOYEE 403', async () => {
    const ids = await seedDispatchIds();
    const employee = await loginAs('EMPLOYEE');
    const res = await employee.post('/api/v1/routes/dispatch-region-mission').send({
      date: businessDayYmd(),
      employeeId: ids.employeeId,
      vehicleId: ids.vehicleId,
      latitude: -23.55,
      longitude: -46.63,
    });
    expect(res.status).toBe(403);
    expect(res.body.code).toBe('AUTH_FORBIDDEN');
  });
});
