import { NextRequest, NextResponse } from 'next/server';
import { validateApiKey } from '../../middleware';
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

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { ctx, error, status } = await validateApiKey(req);
  if (error || !ctx) return NextResponse.json({ error }, { status: status ?? 401 });

  const { id } = await params;
  const admin = createAdminClient();

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error: dbError } = await (admin as any)
    .from('deals')
    .select(DEAL_SELECT)
    .eq('id', id)
    .eq('tenant_id', ctx.tenantId)
    .single();

  if (dbError || !data) return NextResponse.json({ error: 'Deal not found.' }, { status: 404 });
  return NextResponse.json({ deal: shapeDeal(data) });
}
