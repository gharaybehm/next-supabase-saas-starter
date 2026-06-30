'use server';

import { revalidatePath } from 'next/cache';
import { createClient } from '@/utils/supabase/server';
import { createAdminClient } from '@/utils/supabase/admin';
import { z } from 'zod';

const PROPERTY_TYPES = [
  'apartment','villa','townhouse','office','retail',
  'warehouse','land','penthouse','duplex','other',
] as const;

const STATUSES = ['active','pending','sold','expired'] as const;

const listingSchema = z.object({
  area: z.string().min(1),
  sub_community: z.string().optional(),
  property_type: z.enum(PROPERTY_TYPES),
  price_aed: z.coerce.number().int().positive(),
  size_sqft: z.coerce.number().positive(),
  bedrooms: z.coerce.number().int().min(0),
  bathrooms: z.coerce.number().int().min(0),
  description_en: z.string().optional(),
  description_ar: z.string().optional(),
  dld_permit_no: z.string().min(1),
  virtual_tour_url: z.string().url().optional().or(z.literal('')),
  status: z.enum(STATUSES).default('active'),
});

export async function createListing(
  tenantId: string,
  formData: FormData
): Promise<{ listingId?: string; error?: string }> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: 'Not authenticated' };

  const raw = Object.fromEntries(formData.entries());
  const parsed = listingSchema.safeParse(raw);
  if (!parsed.success) return { error: parsed.error.issues[0].message };

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db = supabase as any;

  // Verify signed agreement
  const { data: agreement } = await db
    .from('agreements')
    .select('status')
    .eq('broker_id', user.id)
    .eq('tenant_id', tenantId)
    .single();

  if (agreement?.status !== 'signed') {
    return { error: 'You must sign the Co-Brokerage Agreement before listing properties.' };
  }

  const { data: listing, error } = await db
    .from('listings')
    .insert({
      tenant_id: tenantId,
      listing_broker_id: user.id,
      ...parsed.data,
      virtual_tour_url: parsed.data.virtual_tour_url || null,
      sub_community: parsed.data.sub_community || null,
    })
    .select('id')
    .single();

  if (error || !listing) return { error: error?.message ?? 'Failed to create listing.' };

  // Add listing broker to listing_brokers table
  await db.from('listing_brokers').insert({
    listing_id: listing.id,
    broker_id: user.id,
    role: 'listing',
  });

  // Upload images (silent-fail — listing creation always succeeds)
  const imageFiles = (formData.getAll('images') as File[]).filter(
    (f) => f instanceof File && f.size > 0
  );
  if (imageFiles.length > 0) {
    try {
      const [bpResult, upResult] = await Promise.all([
        db.from('broker_profiles').select('rera_card_no').eq('user_id', user.id).single(),
        db.from('user_profiles').select('full_name').eq('id', user.id).single(),
      ]);
      const { uploadListingImages } = await import('@/app/actions/images');
      await uploadListingImages(
        listing.id, tenantId, imageFiles,
        upResult.data?.full_name ?? 'Broker',
        bpResult.data?.rera_card_no ?? ''
      );
    } catch {
      console.error('[createListing] image upload failed silently');
    }
  }

  // Audit log
  await db.from('audit_logs').insert({
    tenant_id: tenantId,
    actor_id: user.id,
    action: 'listing_created',
    target_type: 'listing',
    target_id: listing.id,
    metadata: { area: parsed.data.area, property_type: parsed.data.property_type, price_aed: parsed.data.price_aed },
  });

  revalidatePath(`/${tenantId}/listings`);
  return { listingId: listing.id };
}

export async function updateListingStatus(
  tenantId: string,
  listingId: string,
  status: typeof STATUSES[number]
): Promise<{ error?: string }> {
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

  // Admins can update any listing; brokers can only update their own
  const { data: listing } = await db
    .from('listings')
    .select('listing_broker_id')
    .eq('id', listingId)
    .eq('tenant_id', tenantId)
    .single();

  if (!listing) return { error: 'Listing not found.' };
  if (membership?.role !== 'admin' && listing.listing_broker_id !== user.id) {
    return { error: 'Not authorized to update this listing.' };
  }

  const { error } = await db
    .from('listings')
    .update({ status, updated_at: new Date().toISOString() })
    .eq('id', listingId);

  if (error) return { error: error.message };

  await db.from('audit_logs').insert({
    tenant_id: tenantId,
    actor_id: user.id,
    action: 'listing_status_changed',
    target_type: 'listing',
    target_id: listingId,
    metadata: { new_status: status },
  });

  revalidatePath(`/${tenantId}/listings`);
  revalidatePath(`/${tenantId}/listings/${listingId}`);
  return {};
}

export interface ListingFilters {
  area?: string;
  property_type?: string;
  price_min?: number;
  price_max?: number;
  size_min?: number;
  bedrooms_min?: number;
  status?: string;
  sort?: string;
}

const SORT_MAP: Record<string, { column: string; ascending: boolean }> = {
  newest:     { column: 'created_at', ascending: false },
  oldest:     { column: 'created_at', ascending: true },
  price_asc:  { column: 'price_aed',  ascending: true },
  price_desc: { column: 'price_aed',  ascending: false },
  size_asc:   { column: 'size_sqft',  ascending: true },
  size_desc:  { column: 'size_sqft',  ascending: false },
};

export async function getListings(tenantId: string, filters: ListingFilters = {}) {
  const supabase = await createClient();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db = supabase as any;

  const { column, ascending } = SORT_MAP[filters.sort ?? ''] ?? SORT_MAP.newest;

  let query = db
    .from('listings')
    .select(`
      id, area, sub_community, property_type, price_aed, size_sqft,
      bedrooms, bathrooms, status, dld_permit_no, created_at,
      listing_broker_id,
      user_profiles!listings_listing_broker_id_fkey(full_name),
      broker_profiles!listings_listing_broker_id_fkey(rera_card_no, brokerage_name),
      listing_images(storage_path, display_order)
    `)
    .eq('tenant_id', tenantId)
    .order(column, { ascending });

  if (filters.area) query = query.ilike('area', `%${filters.area}%`);
  if (filters.property_type) query = query.eq('property_type', filters.property_type);
  if (filters.price_min) query = query.gte('price_aed', filters.price_min);
  if (filters.price_max) query = query.lte('price_aed', filters.price_max);
  if (filters.size_min) query = query.gte('size_sqft', filters.size_min);
  if (filters.bedrooms_min !== undefined) query = query.gte('bedrooms', filters.bedrooms_min);
  if (filters.status) query = query.eq('status', filters.status);

  const { data, error } = await query;
  if (error) return [];
  return data ?? [];
}

export async function getListingDetail(tenantId: string, listingId: string) {
  const supabase = await createClient();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db = supabase as any;

  const { data, error } = await db
    .from('listings')
    .select(`
      *,
      user_profiles!listings_listing_broker_id_fkey(full_name, phone),
      broker_profiles!listings_listing_broker_id_fkey(rera_card_no, brokerage_name),
      listing_images(storage_path, display_order),
      listing_brokers(
        broker_id, role,
        user_profiles(full_name, phone),
        broker_profiles(rera_card_no, brokerage_name)
      )
    `)
    .eq('id', listingId)
    .eq('tenant_id', tenantId)
    .single();

  if (error) return null;
  return data;
}

export async function getCommissionConfig(tenantId: string) {
  const supabase = await createClient();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data } = await (supabase as any)
    .from('commission_config')
    .select('listing_pct, cooperating_pct')
    .eq('tenant_id', tenantId)
    .single();

  return data ?? { listing_pct: 50, cooperating_pct: 50 };
}
