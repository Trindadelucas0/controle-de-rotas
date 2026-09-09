import { ServiceOrderDetailPage } from '@/components/services/ServicesPages';

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <ServiceOrderDetailPage id={id} />;
}
