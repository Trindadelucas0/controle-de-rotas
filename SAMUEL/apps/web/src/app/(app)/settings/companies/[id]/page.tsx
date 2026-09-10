import { EditCompanyPage } from '@/components/settings/EditCompanyPage';

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <EditCompanyPage companyId={id} />;
}
