import { createAdminClient } from '@/utils/supabase/admin';
import { sendAgreement } from '@/utils/dropboxsign';

interface SendAndRecordParams {
  userId: string;
  tenantId: string;
  email: string;
  fullName: string;
  reraCardNo: string;
  brokerageName: string;
  tradeLicenseNo?: string;
}

// Sends the Master Co-Brokerage Agreement via Dropbox Sign and records the
// resulting signature-request id on both `agreements` and `broker_profiles`.
// Shared between registration (legacy immediate-send path, unused by default)
// and admin DLD verification (current send point per the onboarding flow).
export async function sendAndRecordAgreement(params: SendAndRecordParams): Promise<string | null> {
  const admin = createAdminClient();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db = admin as any;

  const sigRequestId = await sendAgreement(params);
  if (!sigRequestId) return null;

  await db.from('agreements').update({
    signature_request_id: sigRequestId,
    status: 'sent',
    updated_at: new Date().toISOString(),
  }).eq('broker_id', params.userId).eq('tenant_id', params.tenantId);

  await db.from('broker_profiles').update({
    agreement_status: 'sent',
    updated_at: new Date().toISOString(),
  }).eq('id', params.userId);

  await db.from('audit_logs').insert({
    tenant_id: params.tenantId,
    actor_id: params.userId,
    action: 'agreement_sent',
    target_type: 'agreement',
    target_id: params.userId,
    metadata: { signature_request_id: sigRequestId },
  });

  return sigRequestId;
}
