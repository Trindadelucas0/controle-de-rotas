import { EditVehiclePage } from '@/components/vehicles/VehiclesPages';

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <EditVehiclePage id={id} />;
}
