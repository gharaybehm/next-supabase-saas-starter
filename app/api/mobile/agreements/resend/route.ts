import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/utils/supabase/admin';
import { resendAgreement } from '@/utils/dropboxsign';

// Authenticates via the broker's own Supabase session JWT (Authorization:
// Bearer <access_token>), not the api_keys model in app/api/v1/middleware.ts —
// that model is for external CRM integrations authenticating as a tenant,
// not an end-user mobile session authenticating as themselves.
export async function POST(req: NextRequest) {
  const authHeader = req.headers.get('Authorization');
  if (!authHeader?.startsWith('Bearer ')) {
    return NextResponse.json({ error: 'Missing session token.' }, { status: 401 });
  }

  const token = authHeader.replace('Bearer ', '').trim();
  const admin = createAdminClient();

  const { data: { user }, error: authError } = await admin.auth.getUser(token);
  if (authError || !user) {
    return NextResponse.json({ error: 'Invalid or expired session.' }, { status: 401 });
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: agreement } = await (admin as any)
    .from('agreements')
    .select('signature_request_id, status')
    .eq('broker_id', user.id)
    .single();

  if (!agreement?.signature_request_id) {
    return NextResponse.json({ error: 'No agreement found to resend.' }, { status: 404 });
  }

  if (agreement.status === 'signed') {
    return NextResponse.json({ error: 'Agreement is already signed.' }, { status: 409 });
  }

  try {
    await resendAgreement(agreement.signature_request_id);
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Failed to resend agreement.' },
      { status: 500 }
    );
  }

  return NextResponse.json({ ok: true });
}
