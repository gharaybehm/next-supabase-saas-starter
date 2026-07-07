import { redirect } from 'next/navigation';

export default async function AdminIndexPage({
  params,
}: {
  params: Promise<{ tenantId: string }>;
}) {
  const { tenantId } = await params;
  redirect(`/${tenantId}/admin/verification`);
}
