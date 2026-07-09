import { NextRequest, NextResponse } from 'next/server';
import { validateApiKey } from '../../../middleware';
import { createAdminClient } from '@/utils/supabase/admin';
import { uploadListingImages } from '@/app/actions/images';

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { ctx, error, status } = await validateApiKey(req);
  if (error || !ctx) return NextResponse.json({ error }, { status: status ?? 401 });

  if (!ctx.brokerId) {
    return NextResponse.json(
      { error: 'This API key is not associated with a broker and cannot upload photos.' },
      { status: 403 }
    );
  }

  const { id: listingId } = await params;
  const admin = createAdminClient();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db = admin as any;

  const { data: listing } = await db
    .from('listings')
    .select('listing_broker_id')
    .eq('id', listingId)
    .eq('tenant_id', ctx.tenantId)
    .single();

  if (!listing) return NextResponse.json({ error: 'Listing not found.' }, { status: 404 });
  if (listing.listing_broker_id !== ctx.brokerId) {
    return NextResponse.json({ error: 'This API key cannot upload photos to another broker\'s listing.' }, { status: 403 });
  }

  let formData: FormData;
  try {
    formData = await req.formData();
  } catch {
    return NextResponse.json({ error: 'Expected multipart/form-data with an "images" field.' }, { status: 400 });
  }

  const imageFiles = formData.getAll('images').filter(
    (f): f is File => f instanceof File && f.size > 0
  );
  if (imageFiles.length === 0) {
    return NextResponse.json({ error: 'No image files provided.' }, { status: 400 });
  }

  const [bpResult, upResult, orderResult] = await Promise.all([
    db.from('broker_profiles').select('rera_card_no').eq('id', ctx.brokerId).single(),
    db.from('user_profiles').select('full_name').eq('id', ctx.brokerId).single(),
    db.from('listing_images').select('display_order').eq('listing_id', listingId).order('display_order', { ascending: false }).limit(1).maybeSingle(),
  ]);

  const startOrder = (orderResult.data?.display_order ?? -1) + 1;

  const { uploaded, failed } = await uploadListingImages(
    listingId,
    ctx.tenantId,
    imageFiles,
    upResult.data?.full_name ?? 'Broker',
    bpResult.data?.rera_card_no ?? '',
    startOrder
  );

  if (uploaded === 0 && failed > 0) {
    return NextResponse.json({ error: 'All uploaded files failed to process.' }, { status: 500 });
  }

  return NextResponse.json({ uploaded, failed });
}
