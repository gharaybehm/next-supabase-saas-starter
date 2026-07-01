'use server';

import { revalidatePath } from 'next/cache';
import { createClient } from '@/utils/supabase/server';
import { createAdminClient } from '@/utils/supabase/admin';
import { watermarkImage } from '@/utils/images';
import { uploadObject, deleteObject } from '@/utils/storage';

const ALLOWED_MIME_TYPES = ['image/jpeg', 'image/png', 'image/webp'];
const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5 MB
const MAX_FILES = 10;

export async function uploadListingImages(
  listingId: string,
  tenantId: string,
  files: File[],
  brokerName: string,
  reraCard: string,
  startOrder = 0
): Promise<{ uploaded: number; failed: number }> {
  const validFiles = files
    .filter((f) => ALLOWED_MIME_TYPES.includes(f.type) && f.size <= MAX_FILE_SIZE)
    .slice(0, MAX_FILES);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const adminDb = createAdminClient() as any;
  let uploaded = 0;
  let failed = 0;

  for (let i = 0; i < validFiles.length; i++) {
    const file = validFiles[i];
    try {
      const raw = Buffer.from(await file.arrayBuffer());
      const { buffer, width, height } = await watermarkImage(raw, brokerName, reraCard);

      const storagePath = `${tenantId}/${listingId}/${crypto.randomUUID()}.jpg`;

      const { error: uploadError } = await uploadObject(storagePath, buffer, 'image/jpeg');

      if (uploadError) {
        failed++;
        continue;
      }

      await adminDb.from('listing_images').insert({
        listing_id: listingId,
        storage_path: storagePath,
        storage_provider: 'filebase',
        width,
        height,
        size_bytes: buffer.length,
        original_name: file.name,
        display_order: startOrder + i,
      });

      uploaded++;
    } catch (err) {
      console.error(`[uploadListingImages] file ${file.name} failed:`, err);
      failed++;
    }
  }

  return { uploaded, failed };
}

export async function addPhotosToListing(
  tenantId: string,
  listingId: string,
  formData: FormData
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

  const { data: listing } = await db
    .from('listings')
    .select('listing_broker_id')
    .eq('id', listingId)
    .eq('tenant_id', tenantId)
    .single();

  if (!listing) return { error: 'Listing not found.' };

  const isAdmin = membership?.role === 'admin';
  const isListingBroker = listing.listing_broker_id === user.id;
  if (!isAdmin && !isListingBroker) return { error: 'Not authorized.' };

  const files = (formData.getAll('images') as File[]).filter(
    (f) => f instanceof File && f.size > 0
  );
  if (files.length === 0) return { error: 'No images provided.' };

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const adminDb = createAdminClient() as any;

  const [bpResult, upResult, orderResult] = await Promise.all([
    adminDb.from('broker_profiles').select('rera_card_no').eq('user_id', user.id).single(),
    adminDb.from('user_profiles').select('full_name').eq('id', user.id).single(),
    adminDb.from('listing_images').select('display_order').eq('listing_id', listingId).order('display_order', { ascending: false }).limit(1).maybeSingle(),
  ]);

  const reraCard = bpResult.data?.rera_card_no ?? '';
  const brokerName = upResult.data?.full_name ?? 'Broker';
  const startOrder = (orderResult.data?.display_order ?? -1) + 1;

  const { uploaded, failed } = await uploadListingImages(listingId, tenantId, files, brokerName, reraCard, startOrder);

  if (uploaded === 0 && failed > 0) {
    return { error: 'All uploads failed. Check file types and sizes.' };
  }

  revalidatePath(`/${tenantId}/listings/${listingId}`);
  return {};
}

export async function deleteListingImage(
  tenantId: string,
  listingId: string,
  imageId: string
): Promise<{ error?: string }> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: 'Not authenticated' };

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db = supabase as any;

  const { data: membership } = await db
    .from('tenant_members').select('role').eq('tenant_id', tenantId).eq('user_id', user.id).single();

  const { data: listing } = await db
    .from('listings').select('listing_broker_id').eq('id', listingId).eq('tenant_id', tenantId).single();

  if (!listing) return { error: 'Listing not found.' };

  const isAdmin = membership?.role === 'admin';
  const isListingBroker = listing.listing_broker_id === user.id;
  if (!isAdmin && !isListingBroker) return { error: 'Not authorized.' };

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const adminDb = createAdminClient() as any;

  const { data: image } = await adminDb
    .from('listing_images').select('storage_path').eq('id', imageId).eq('listing_id', listingId).single();

  if (!image) return { error: 'Image not found.' };

  await deleteObject(image.storage_path);
  await adminDb.from('listing_images').delete().eq('id', imageId);

  revalidatePath(`/${tenantId}/listings/${listingId}`);
  return {};
}
