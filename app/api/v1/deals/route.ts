import { NextRequest, NextResponse } from 'next/server';
import { validateApiKey } from '../middleware';
import { createAdminClient } from '@/utils/supabase/admin';

const DEAL_SELECT = `
  id, listing_id, listing_broker_id, cooperating_broker_id,
  listing_commission_pct, cooperating_commission_pct,
  closed_at, notes, created_at,
  listing:listings!deals_listing_id_fkey(
    id, area, sub_community, property_type, price_aed, size_sqft, bedrooms, bathrooms, dld_permit_no
  ),
  lbu:user_profiles!deals_listing_broker_id_fkey(full_name),
  lbp:broker_profiles!deals_listing_broker_id_fkey(rera_card_no, brokerage_name),
  cbu:user_profiles!deals_cooperating_broker_id_fkey(full_name),
  cbp:broker_profiles!deals_cooperating_broker_id_fkey(rera_card_no, brokerage_name)
`;

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function shapeDeal(raw: any) {
  return {
    id: raw.id,
    listing_id: raw.listing_id,
    listing: raw.listing,
    listing_broker_id: raw.listing_broker_id,
    listing_broker: {
      id: raw.listing_broker_id,
      full_name: raw.lbu?.full_name ?? null,
      rera_card_no: raw.lbp?.rera_card_no ?? null,
      brokerage_name: raw.lbp?.brokerage_name ?? null,
    },
    cooperating_broker_id: raw.cooperating_broker_id,
    cooperating_broker: raw.cooperating_broker_id
      ? {
          id: raw.cooperating_broker_id,
          full_name: raw.cbu?.full_name ?? null,
          rera_card_no: raw.cbp?.rera_card_no ?? null,
          brokerage_name: raw.cbp?.brokerage_name ?? null,
        }
      : null,
    listing_commission_pct: raw.listing_commission_pct,
    cooperating_commission_pct: raw.cooperating_commission_pct,
    closed_at: raw.closed_at,
    notes: raw.notes,
    created_at: raw.created_at,
  };
}

export async function GET(req: NextRequest) {
  const { ctx, error, status } = await validateApiKey(req);
  if (error || !ctx) return NextResponse.json({ error }, { status: status ?? 401 });

  const sp = req.nextUrl.searchParams;
  const admin = createAdminClient();

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let query = (admin as any)
    .from('deals')
    .select(DEAL_SELECT)
    .eq('tenant_id', ctx.tenantId)
    .order('closed_at', { ascending: false });

  if (sp.get('listing_id')) query = query.eq('listing_id', sp.get('listing_id'));
  if (sp.get('from')) query = query.gte('closed_at', sp.get('from'));
  if (sp.get('to')) query = query.lte('closed_at', sp.get('to'));

  const limit = Math.min(Number(sp.get('limit') ?? 100), 200);
  query = query.limit(limit);

  const { data, error: dbError } = await query;
  if (dbError) return NextResponse.json({ error: dbError.message }, { status: 500 });

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const deals = (data ?? []).map((row: any) => shapeDeal(row));
  return NextResponse.json({ deals, count: deals.length });
}

export async function POST(req: NextRequest) {
  const { ctx, error, status } = await validateApiKey(req);
  if (error || !ctx) return NextResponse.json({ error }, { status: status ?? 401 });

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body.' }, { status: 400 });
  }

  const { listing_id, cooperating_broker_id, listing_commission_pct, cooperating_commission_pct, closed_at, notes } = body;

  if (!listing_id || typeof listing_id !== 'string') {
    return NextResponse.json({ error: 'listing_id is required.' }, { status: 400 });
  }
  if (typeof listing_commission_pct !== 'number') {
    return NextResponse.json({ error: 'listing_commission_pct must be a number.' }, { status: 400 });
  }

  const coopBrokerId = typeof cooperating_broker_id === 'string' && cooperating_broker_id ? cooperating_broker_id : null;

  if (coopBrokerId) {
    if (typeof cooperating_commission_pct !== 'number') {
      return NextResponse.json({ error: 'cooperating_commission_pct is required when cooperating_broker_id is set.' }, { status: 400 });
    }
    if (Math.abs(listing_commission_pct + (cooperating_commission_pct as number) - 100) > 0.01) {
      return NextResponse.json({ error: 'Commission percentages must sum to 100.' }, { status: 400 });
    }
  }

  const admin = createAdminClient();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const adminDb = admin as any;

  const { data: listing, error: listingError } = await adminDb
    .from('listings')
    .select('id, listing_broker_id, status, price_aed')
    .eq('id', listing_id)
    .eq('tenant_id', ctx.tenantId)
    .single();

  if (listingError || !listing) {
    return NextResponse.json({ error: 'Listing not found.' }, { status: 404 });
  }
  if (listing.status !== 'active') {
    return NextResponse.json({ error: 'Only active listings can be closed.' }, { status: 409 });
  }

  const closedAtIso = closed_at && typeof closed_at === 'string'
    ? new Date(closed_at).toISOString()
    : new Date().toISOString();

  const { data: deal, error: insertError } = await adminDb
    .from('deals')
    .insert({
      tenant_id: ctx.tenantId,
      listing_id,
      listing_broker_id: listing.listing_broker_id,
      cooperating_broker_id: coopBrokerId,
      listing_commission_pct,
      cooperating_commission_pct: coopBrokerId ? cooperating_commission_pct : null,
      closed_at: closedAtIso,
      notes: typeof notes === 'string' && notes ? notes : null,
    })
    .select('id')
    .single();

  if (insertError || !deal) {
    return NextResponse.json({ error: insertError?.message ?? 'Failed to create deal.' }, { status: 500 });
  }

  await adminDb
    .from('listings')
    .update({ status: 'sold', updated_at: new Date().toISOString() })
    .eq('id', listing_id)
    .eq('tenant_id', ctx.tenantId);

  // Fire-and-forget audit log (no session user for API key requests)
  adminDb.from('audit_logs').insert({
    tenant_id: ctx.tenantId,
    actor_id: null,
    action: 'deal_closed',
    target_type: 'listing',
    target_id: listing_id,
    metadata: {
      deal_id: deal.id,
      price_aed: listing.price_aed,
      listing_commission_pct,
      cooperating_commission_pct: coopBrokerId ? cooperating_commission_pct : null,
      source: 'api_v1',
    },
  }).then(() => {});

  const { data: fullDeal, error: fetchError } = await adminDb
    .from('deals')
    .select(DEAL_SELECT)
    .eq('id', deal.id)
    .single();

  if (fetchError || !fullDeal) {
    return NextResponse.json({ error: 'Deal created but failed to fetch details.' }, { status: 500 });
  }

  return NextResponse.json({ deal: shapeDeal(fullDeal) }, { status: 201 });
}
