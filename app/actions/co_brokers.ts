'use server';

import { revalidatePath } from 'next/cache';
import { createClient } from '@/utils/supabase/server';
import { createAdminClient } from '@/utils/supabase/admin';
import { isTeamOwnerOf } from './team';

export async function addCoBroker(
  tenantId: string,
  listingId: string,
  brokerId: string
): Promise<{ error?: string }> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: 'Not authenticated' };

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db = supabase as any;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const adminDb = createAdminClient() as any;

  const [membershipResult, listingResult] = await Promise.all([
    db.from('tenant_members').select('role').eq('tenant_id', tenantId).eq('user_id', user.id).single(),
    db.from('listings').select('listing_broker_id').eq('id', listingId).eq('tenant_id', tenantId).single(),
  ]);

  const listing = listingResult.data;
  if (!listing) return { error: 'Listing not found.' };

  const isAdmin = membershipResult.data?.role === 'admin';
  const isListingBroker = listing.listing_broker_id === user.id;
  const isTeamOwner = await isTeamOwnerOf(user.id, listing.listing_broker_id);
  if (!isAdmin && !isListingBroker && !isTeamOwner) return { error: 'Not authorized.' };

  // Enforce max 3 brokers
  const { count } = await adminDb
    .from('listing_brokers')
    .select('id', { count: 'exact', head: true })
    .eq('listing_id', listingId);

  if ((count ?? 0) >= 3) {
    return { error: 'Maximum 3 brokers per DLD listing.' };
  }

  // Verify the target broker is a member of this tenant
  const { data: targetMembership } = await adminDb
    .from('tenant_members')
    .select('user_id')
    .eq('tenant_id', tenantId)
    .eq('user_id', brokerId)
    .single();

  if (!targetMembership) return { error: 'Broker is not a member of this community.' };

  const { error } = await adminDb.from('listing_brokers').insert({
    listing_id: listingId,
    broker_id: brokerId,
    role: 'co-listing',
  });

  if (error) {
    if (error.code === '23505') return { error: 'This broker is already on this listing.' };
    return { error: error.message };
  }

  await adminDb.from('audit_logs').insert({
    tenant_id: tenantId,
    actor_id: user.id,
    action: 'co_broker_added',
    target_type: 'listing',
    target_id: listingId,
    metadata: { listing_id: listingId, co_broker_id: brokerId },
  });

  revalidatePath(`/${tenantId}/listings/${listingId}`);
  return {};
}

export async function removeCoBroker(
  tenantId: string,
  listingId: string,
  brokerId: string
): Promise<{ error?: string }> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: 'Not authenticated' };

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db = supabase as any;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const adminDb = createAdminClient() as any;

  const [membershipResult, listingResult] = await Promise.all([
    db.from('tenant_members').select('role').eq('tenant_id', tenantId).eq('user_id', user.id).single(),
    db.from('listings').select('listing_broker_id').eq('id', listingId).eq('tenant_id', tenantId).single(),
  ]);

  const listing = listingResult.data;
  if (!listing) return { error: 'Listing not found.' };

  const isAdmin = membershipResult.data?.role === 'admin';
  const isListingBroker = listing.listing_broker_id === user.id;
  const isTeamOwner = await isTeamOwnerOf(user.id, listing.listing_broker_id);
  if (!isAdmin && !isListingBroker && !isTeamOwner) return { error: 'Not authorized.' };

  // Prevent removing the primary listing broker
  const { data: row } = await adminDb
    .from('listing_brokers')
    .select('role')
    .eq('listing_id', listingId)
    .eq('broker_id', brokerId)
    .single();

  if (!row) return { error: 'Broker not found on this listing.' };
  if (row.role === 'listing') return { error: 'Cannot remove the primary listing broker.' };

  await adminDb.from('listing_brokers').delete().eq('listing_id', listingId).eq('broker_id', brokerId);

  await adminDb.from('audit_logs').insert({
    tenant_id: tenantId,
    actor_id: user.id,
    action: 'co_broker_removed',
    target_type: 'listing',
    target_id: listingId,
    metadata: { listing_id: listingId, co_broker_id: brokerId },
  });

  revalidatePath(`/${tenantId}/listings/${listingId}`);
  return {};
}
