import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/utils/supabase/admin';
import { verifyWebhookEvent } from '@/utils/dropboxsign';

export async function POST(req: NextRequest) {
  const body = await req.text();
  const signature = req.headers.get('x-hello-signature') ?? '';

  const event = verifyWebhookEvent(body, signature);
  if (!event) {
    return new NextResponse('Invalid signature', { status: 401 });
  }

  const eventType = event.event?.eventType;
  const metadata = event.signatureRequest?.metadata as Record<string, string> | undefined;
  const userId = metadata?.user_id;
  const tenantId = metadata?.tenant_id;
  const signatureRequestId = event.signatureRequest?.signatureRequestId;

  if (!userId || !tenantId || !signatureRequestId) {
    return new NextResponse('Missing metadata', { status: 400 });
  }

  const admin = createAdminClient();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db = admin as any;

  const statusMap: Record<string, string> = {
    signature_request_viewed: 'viewed',
    signature_request_signed: 'signed',
    signature_request_declined: 'declined',
    signature_request_sent: 'sent',
  };

  const newStatus = statusMap[eventType ?? ''];
  if (!newStatus) {
    return new NextResponse('Hello API Event Received', { status: 200 });
  }

  const updateData: Record<string, unknown> = {
    status: newStatus,
    updated_at: new Date().toISOString(),
    audit_trail: db.rpc('jsonb_array_append', {
      arr: db.from('agreements').select('audit_trail').eq('broker_id', userId),
      element: { event: eventType, timestamp: new Date().toISOString() },
    }),
  };

  if (newStatus === 'signed') {
    updateData.signed_at = new Date().toISOString();
  }

  await db.from('agreements').update({
    status: newStatus,
    ...(newStatus === 'signed' ? { signed_at: new Date().toISOString() } : {}),
    updated_at: new Date().toISOString(),
  }).eq('broker_id', userId);

  await db.from('broker_profiles').update({
    agreement_status: newStatus,
    updated_at: new Date().toISOString(),
  }).eq('id', userId);

  await db.from('audit_logs').insert({
    tenant_id: tenantId,
    actor_id: userId,
    action: `agreement_${newStatus}`,
    target_type: 'agreement',
    target_id: signatureRequestId,
    metadata: { event_type: eventType, signature_request_id: signatureRequestId },
  });

  return new NextResponse('Hello API Event Received', { status: 200 });
}
