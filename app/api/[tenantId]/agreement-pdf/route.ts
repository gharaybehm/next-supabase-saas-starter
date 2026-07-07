import { NextRequest } from 'next/server';
import { createClient } from '@/utils/supabase/server';
import { createAdminClient } from '@/utils/supabase/admin';
import { downloadSignedFile } from '@/utils/dropboxsign';

export const dynamic = 'force-dynamic';

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ tenantId: string }> }
) {
  const { tenantId } = await params;

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401 });
  }

  const admin = createAdminClient();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db = admin as any;

  const { data: agreement } = await db
    .from('agreements')
    .select('status, signature_request_id')
    .eq('broker_id', user.id)
    .eq('tenant_id', tenantId)
    .single();

  if (!agreement || agreement.status !== 'signed' || !agreement.signature_request_id) {
    return new Response(JSON.stringify({ error: 'Agreement not signed yet' }), { status: 403 });
  }

  try {
    const buffer = await downloadSignedFile(agreement.signature_request_id);
    return new Response(new Uint8Array(buffer), {
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': 'attachment; filename="master-co-brokerage-agreement.pdf"',
      },
    });
  } catch {
    return new Response(JSON.stringify({ error: 'Failed to fetch signed document' }), { status: 502 });
  }
}
