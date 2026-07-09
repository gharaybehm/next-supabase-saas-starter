import { NextRequest, NextResponse } from 'next/server';
import { validateApiKey } from '../middleware';
import { createAdminClient } from '@/utils/supabase/admin';
import { createListingForBroker } from '@/app/actions/listings';
import { listingSchema } from '@/utils/validation';

export async function GET(req: NextRequest) {
  const { ctx, error, status } = await validateApiKey(req);
  if (error || !ctx) return NextResponse.json({ error }, { status: status ?? 401 });

  const sp = req.nextUrl.searchParams;
  const admin = createAdminClient();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let query = (admin as any)
    .from('listings')
    .select(`
      id, area, sub_community, transaction_type, property_type, price_aed, size_sqft,
      bedrooms, bathrooms, status, dld_permit_no, virtual_tour_url, created_at,
      user_profiles!listings_listing_broker_id_fkey(full_name),
      broker_profiles!listings_listing_broker_id_fkey(rera_card_no, brokerage_name)
    `)
    .eq('tenant_id', ctx.tenantId)
    .order('created_at', { ascending: false })
    .limit(100);

  if (sp.get('area')) query = query.ilike('area', `%${sp.get('area')}%`);
  if (sp.get('transaction_type')) query = query.eq('transaction_type', sp.get('transaction_type'));
  if (sp.get('property_type')) query = query.eq('property_type', sp.get('property_type'));
  if (sp.get('status')) query = query.eq('status', sp.get('status'));
  else query = query.eq('status', 'active');
  if (sp.get('price_min')) query = query.gte('price_aed', Number(sp.get('price_min')));
  if (sp.get('price_max')) query = query.lte('price_aed', Number(sp.get('price_max')));

  const { data, error: dbError } = await query;
  if (dbError) return NextResponse.json({ error: dbError.message }, { status: 500 });

  return NextResponse.json({ listings: data, count: data?.length ?? 0 });
}

export async function POST(req: NextRequest) {
  const { ctx, error, status } = await validateApiKey(req);
  if (error || !ctx) return NextResponse.json({ error }, { status: status ?? 401 });

  if (!ctx.brokerId) {
    return NextResponse.json(
      { error: 'This API key is not associated with a broker and cannot create listings.' },
      { status: 403 }
    );
  }

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body.' }, { status: 400 });
  }

  const parsed = listingSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0].message }, { status: 400 });
  }

  const coBrokerIds = Array.isArray(body.co_broker_ids)
    ? body.co_broker_ids.filter((id): id is string => typeof id === 'string')
    : [];

  const result = await createListingForBroker(
    ctx.tenantId,
    ctx.brokerId,
    parsed.data,
    coBrokerIds,
    { actorId: null, source: 'api_v1' }
  );

  if (result.error) {
    const status = result.error.includes('Co-Brokerage Agreement') ? 409 : 500;
    return NextResponse.json({ error: result.error }, { status });
  }

  return NextResponse.json({ listing: { id: result.listingId } }, { status: 201 });
}
