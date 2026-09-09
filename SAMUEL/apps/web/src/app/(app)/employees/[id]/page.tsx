import { EditEmployeePage } from '@/components/employees/EmployeesPages';

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <EditEmployeePage id={id} />;
}
