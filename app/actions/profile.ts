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
