import { VehicleStatus } from '@prisma/client';
import { closeTestApp, getTestApp, loginAs, TINY_JPEG } from './helpers';
import { PrismaService } from '../src/common/prisma/prisma.service';
import { DEMO_COMPANY_ID } from './fixtures';

describe('fuel-fills e custos', () => {
  afterAll(async () => {
    await closeTestApp();
  });

  async function createVehicle() {
    const nest = await getTestApp();
    const prisma = nest.get(PrismaService);
    const suffix = `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
    return prisma.vehicle.create({
      data: {
        companyId: DEMO_COMPANY_ID,
        plate: `F${suffix.slice(-7).toUpperCase()}`,
        brand: 'Fiat',
        model: 'Strada',
        avgConsumption: 8.2,
        status: VehicleStatus.AVAILABLE,
        odometerKm: 125430,
      },
    });
  }

  it('ADMIN registra abastecimento e o total vem do servidor', async () => {
    const vehicle = await createVehicle();
    const admin = await loginAs('ADMIN');
    const res = await admin
      .post('/api/v1/fuel-fills')
      .field('vehicleId', vehicle.id)
      .field('occurredAt', new Date().toISOString())
      .field('odometerKm', '125682')
      .field('liters', '42.3')
      .field('pricePerLiter', '6.19')
      .field('station', 'Posto X')
      .attach('file', TINY_JPEG, { filename: 'cupom.jpg', contentType: 'image/jpeg' });
    expect(res.status).toBe(201);
    expect(res.body.fill.totalCost).toBe(261.84);
    expect(res.body.fill.vehicle.plate).toBe(vehicle.plate);
  });

  it('EMPLOYEE 403 no dashboard de custos', async () => {
    const emp = await loginAs('EMPLOYEE');
    const res = await emp.get('/api/v1/costs/dashboard');
    expect(res.status).toBe(403);
  });

  it('outro tenant não vê o abastecimento', async () => {
    const vehicle = await createVehicle();
    const admin = await loginAs('ADMIN');
    const created = await admin
      .post('/api/v1/fuel-fills')
      .field('vehicleId', vehicle.id)
      .field('occurredAt', new Date().toISOString())
      .field('odometerKm', '100')
      .field('liters', '10')
      .field('pricePerLiter', '5');
    expect(created.status).toBe(201);
    const outra = await loginAs('OUTRA_ADMIN');
    const res = await outra.get(`/api/v1/fuel-fills/${created.body.fill.id}`);
    expect(res.status).toBe(404);
  });

  it('dashboard ADMIN não inventa custo real sem par de fills', async () => {
    const admin = await loginAs('ADMIN');
    const res = await admin.get('/api/v1/costs/dashboard');
    expect(res.status).toBe(200);
    expect(res.body.spent.kind).toBe('REAL');
    expect(res.body.spent.value).not.toBeNull();
  });
});
