import { EditCustomerPage } from '@/components/customers/CustomersPages';

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <EditCustomerPage id={id} />;
}
