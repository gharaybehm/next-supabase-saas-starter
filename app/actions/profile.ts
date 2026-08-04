'use server';

import { revalidatePath } from 'next/cache';
import { createClient } from '@/utils/supabase/server';

export interface NotificationPrefs {
  email_notifications: boolean;
}

export async function getNotificationPrefs(): Promise<NotificationPrefs> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { email_notifications: true };

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data } = await (supabase as any)
    .from('user_profiles')
    .select('email_notifications')
    .eq('id', user.id)
    .single();

  return {
    email_notifications: data?.email_notifications ?? true,
  };
}

export interface ProfileDetails {
  full_name: string;
  phone: string;
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

  const { error } = await db
    .from('user_profiles')
    .update({
      ...(details.full_name !== undefined && { full_name: details.full_name }),
      ...(details.phone !== undefined && { phone: details.phone }),
      updated_at: new Date().toISOString(),
    })
    .eq('id', user.id);

  if (error) return { error: error.message };

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
