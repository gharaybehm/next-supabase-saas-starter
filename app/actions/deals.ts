'use server';

import { revalidatePath } from 'next/cache';
import { createClient } from '@/utils/supabase/server';
import { createAdminClient } from '@/utils/supabase/admin';
import { z } from 'zod';
import { updateListingStatus } from './listings';

const dealSchema = z.object({
  cooperating_broker_id: z.string().uuid().optional().or(z.literal('')),
  listing_commission_pct: z.coerce.number().min(0).max(100),
  cooperating_commission_pct: z.coerce.number().min(0).max(100),
  closed_at: z.string().min(1),
  notes: z.string().optional(),
});

export async function closeDeal(
  tenantId: string,
  listingId: string,
  formData: FormData
): Promise<{ dealId?: string; error?: string }> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: 'Not authenticated' };

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db = supabase as any;

  const { data: membership } = await db
    .from('tenant_members')
    .select('role')
    .eq('tenant_id', tenantId)
    .eq('user_id', user.id)
    .single();

  const { data: listing } = await db
    .from('listings')
    .select('listing_broker_id, status, price_aed')
    .eq('id', listingId)
    .eq('tenant_id', tenantId)
    .single();

  if (!listing) return { error: 'Listing not found.' };
  if (listing.status !== 'active') return { error: 'Only active listings can be closed.' };

  const isAdmin = membership?.role === 'admin';
  const isListingBroker = listing.listing_broker_id === user.id;
  if (!isAdmin && !isListingBroker) return { error: 'Not authorized to close this listing.' };

  const raw = Object.fromEntries(formData.entries());
  const parsed = dealSchema.safeParse(raw);
  if (!parsed.success) return { error: parsed.error.issues[0].message };

  const coopBrokerId = parsed.data.cooperating_broker_id || null;
  const listingPct = parsed.data.listing_commission_pct;
  const coopPct = parsed.data.cooperating_commission_pct;

  if (coopBrokerId && Math.abs(listingPct + coopPct - 100) > 0.01) {
    return { error: 'Commission percentages must sum to 100.' };
  }

  const adminDb = createAdminClient() as any; // eslint-disable-line @typescript-eslint/no-explicit-any

  const { data: deal, error } = await adminDb
    .from('deals')
    .insert({
      tenant_id: tenantId,
      listing_id: listingId,
      listing_broker_id: listing.listing_broker_id,
      cooperating_broker_id: coopBrokerId,
      listing_commission_pct: listingPct,
      cooperating_commission_pct: coopBrokerId ? coopPct : null,
      closed_at: new Date(parsed.data.closed_at).toISOString(),
      notes: parsed.data.notes || null,
    })
    .select('id')
    .single();

  if (error || !deal) return { error: error?.message ?? 'Failed to close deal.' };

  await updateListingStatus(tenantId, listingId, 'sold');

  await adminDb.from('audit_logs').insert({
    tenant_id: tenantId,
    actor_id: user.id,
    action: 'deal_closed',
    target_type: 'listing',
    target_id: listingId,
    metadata: {
      deal_id: deal.id,
      price_aed: listing.price_aed,
      listing_commission_pct: listingPct,
      cooperating_commission_pct: coopBrokerId ? coopPct : null,
    },
  });

  revalidatePath(`/${tenantId}/listings/${listingId}`);
  return { dealId: deal.id };
}

export async function getDeal(tenantId: string, listingId: string) {
  const supabase = await createClient();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db = supabase as any;

  const { data, error } = await db
    .from('deals')
    .select(`
      id, listing_commission_pct, cooperating_commission_pct, closed_at, notes,
      listing_broker_id, cooperating_broker_id,
      listing_broker_profile:broker_profiles!deals_listing_broker_id_fkey(rera_card_no, brokerage_name),
      listing_broker_user:user_profiles!deals_listing_broker_id_fkey(full_name),
      cooperating_broker_profile:broker_profiles!deals_cooperating_broker_id_fkey(rera_card_no, brokerage_name),
      cooperating_broker_user:user_profiles!deals_cooperating_broker_id_fkey(full_name),
      listings!deals_listing_id_fkey(area, property_type, price_aed, dld_permit_no)
    `)
    .eq('tenant_id', tenantId)
    .eq('listing_id', listingId)
    .maybeSingle();

  if (error) return null;
  return data;
}

export interface MyDeal {
  id: string;
  address: string;
  listingBroker: string;
  sellingBroker: string;
  splitListing: number;
  splitSelling: number;
  amount: number;
  closedAt: string;
}

export async function getMyDeals(tenantId: string, userId: string): Promise<MyDeal[]> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const adminDb = createAdminClient() as any;

  const { data, error } = await adminDb
    .from('deals')
    .select(`
      id, listing_commission_pct, cooperating_commission_pct, closed_at,
      listing_broker_user:user_profiles!deals_listing_broker_id_fkey(full_name),
      cooperating_broker_user:user_profiles!deals_cooperating_broker_id_fkey(full_name),
      listings!deals_listing_id_fkey(area, sub_community, price_aed)
    `)
    .eq('tenant_id', tenantId)
    .or(`listing_broker_id.eq.${userId},cooperating_broker_id.eq.${userId}`)
    .order('closed_at', { ascending: false });

  if (error || !data) return [];

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return data.map((d: any) => ({
    id: d.id,
    address: d.listings?.sub_community ? `${d.listings.sub_community}, ${d.listings.area}` : (d.listings?.area ?? '—'),
    listingBroker: d.listing_broker_user?.full_name ?? '—',
    sellingBroker: d.cooperating_broker_user?.full_name ?? '—',
    splitListing: d.listing_commission_pct,
    splitSelling: d.cooperating_commission_pct ?? 0,
    amount: d.listings?.price_aed ?? 0,
    closedAt: d.closed_at,
  }));
}

export interface TenantMember {
  user_id: string;
  full_name: string;
  rera_card_no: string;
  brokerage_name: string;
}

export async function getTenantMembers(tenantId: string): Promise<TenantMember[]> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const adminDb = createAdminClient() as any;

  const { data, error } = await adminDb
    .from('tenant_members')
    .select(`
      user_id,
      user_profiles(full_name),
      broker_profiles(rera_card_no, brokerage_name)
    `)
    .eq('tenant_id', tenantId)
    .eq('role', 'worker');

  if (error || !data) return [];

  return data.map((m: any) => ({ // eslint-disable-line @typescript-eslint/no-explicit-any
    user_id: m.user_id,
    full_name: m.user_profiles?.full_name ?? 'Unknown',
    rera_card_no: m.broker_profiles?.rera_card_no ?? '',
    brokerage_name: m.broker_profiles?.brokerage_name ?? '',
  }));
}
