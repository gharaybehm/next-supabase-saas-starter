'use server';

import { revalidatePath } from 'next/cache';
import { createClient } from '@/utils/supabase/server';

export interface NotificationPrefs {
  notify_new_listings: boolean;
  notify_deal_updates: boolean;
  notify_monthly_statements: boolean;
}

export async function getNotificationPrefs(): Promise<NotificationPrefs> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { notify_new_listings: true, notify_deal_updates: true, notify_monthly_statements: true };

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data } = await (supabase as any)
    .from('user_profiles')
    .select('notify_new_listings, notify_deal_updates, notify_monthly_statements')
    .eq('id', user.id)
    .single();

  return {
    notify_new_listings: data?.notify_new_listings ?? true,
    notify_deal_updates: data?.notify_deal_updates ?? true,
    notify_monthly_statements: data?.notify_monthly_statements ?? true,
  };
}

export interface ProfileDetails {
  full_name: string;
  phone: string;
  rera_card_no: string;
}

export async function updateProfileDetails(
  tenantId: string,
  details: Partial<ProfileDetails>
): Promise<{ error?: string }> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: 'Not authenticated' };

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db = supabase as any;

  if (details.full_name !== undefined || details.phone !== undefined) {
    const { error } = await db
      .from('user_profiles')
      .update({
        ...(details.full_name !== undefined && { full_name: details.full_name }),
        ...(details.phone !== undefined && { phone: details.phone }),
        updated_at: new Date().toISOString(),
      })
      .eq('id', user.id);

    if (error) return { error: error.message };
  }

  if (details.rera_card_no !== undefined) {
    const { data: existing } = await db
      .from('broker_profiles')
      .select('brokerage_name')
      .eq('id', user.id)
      .single();

    const { error } = await db
      .from('broker_profiles')
      .upsert(
        {
          id: user.id,
          rera_card_no: details.rera_card_no,
          brokerage_name: existing?.brokerage_name ?? '',
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'id' }
      );

    if (error) return { error: error.message };
  }

  revalidatePath(`/${tenantId}/profile`);
  return {};
}

const LICENSE_MAX_BYTES = 10 * 1024 * 1024;
const LICENSE_ALLOWED_TYPES: Record<string, string> = {
  'application/pdf': 'pdf',
  'image/jpeg': 'jpg',
  'image/png': 'png',
};
const LICENSE_RENEWAL_INTERVAL_MS = 365 * 24 * 60 * 60 * 1000;

export async function isLicenseRenewalDue(tenantId: string): Promise<boolean> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return false;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data } = await (supabase as any)
    .from('broker_profiles')
    .select('dld_license_renewed_at')
    .eq('id', user.id)
    .single();

  if (!data) return false;
  if (!data.dld_license_renewed_at) return true;
  return Date.now() - new Date(data.dld_license_renewed_at).getTime() >= LICENSE_RENEWAL_INTERVAL_MS;
}

export async function renewBrokerLicense(
  tenantId: string,
  formData: FormData
): Promise<{ error?: string }> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: 'Not authenticated' };

  const file = formData.get('dld_license_file') as File | null;
  if (!file || file.size === 0) return { error: 'Please upload a copy of your DLD broker license.' };
  const ext = LICENSE_ALLOWED_TYPES[file.type];
  if (!ext) return { error: 'License file must be a PDF, JPG, or PNG.' };
  if (file.size > LICENSE_MAX_BYTES) return { error: 'License file must be under 10MB.' };

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db = supabase as any;

  const { data: existing } = await db
    .from('broker_profiles')
    .select('dld_license_path')
    .eq('id', user.id)
    .single();

  const newPath = `${tenantId}/${user.id}/${crypto.randomUUID()}.${ext}`;
  const buffer = Buffer.from(await file.arrayBuffer());
  const { error: uploadError } = await supabase.storage
    .from('dld-licenses')
    .upload(newPath, buffer, { contentType: file.type });

  if (uploadError) return { error: 'License upload failed, please try again.' };

  const { error: updateError } = await db
    .from('broker_profiles')
    .update({
      dld_license_path: newPath,
      dld_license_renewed_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq('id', user.id);

  if (updateError) return { error: updateError.message };

  if (existing?.dld_license_path) {
    await supabase.storage.from('dld-licenses').remove([existing.dld_license_path]);
  }

  await db.from('audit_logs').insert({
    tenant_id: tenantId,
    actor_id: user.id,
    action: 'broker_license_renewed',
    target_type: 'user',
    target_id: user.id,
    metadata: {},
  });

  revalidatePath(`/${tenantId}/profile`);
  return {};
}

export async function updateNotificationPrefs(
  tenantId: string,
  prefs: Partial<NotificationPrefs>
): Promise<{ error?: string }> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: 'Not authenticated' };

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error } = await (supabase as any)
    .from('user_profiles')
    .update({ ...prefs, updated_at: new Date().toISOString() })
    .eq('id', user.id);

  if (error) return { error: error.message };

  revalidatePath(`/${tenantId}/profile`);
  return {};
}
