import { NextRequest, NextResponse } from 'next/server';
import { validateApiKey } from '../middleware';
import { createAdminClient } from '@/utils/supabase/admin';

export async function GET(req: NextRequest) {
  const { ctx, error, status } = await validateApiKey(req);
  if (error || !ctx) return NextResponse.json({ error }, { status: status ?? 401 });

  const sp = req.nextUrl.searchParams;
  const admin = createAdminClient();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let query = (admin as any)
    .from('listings')
    .select(`
      id, area, sub_community, property_type, price_aed, size_sqft,
      bedrooms, bathrooms, status, dld_permit_no, virtual_tour_url, created_at,
      user_profiles!listings_listing_broker_id_fkey(full_name),
      broker_profiles!listings_listing_broker_id_fkey(rera_card_no, brokerage_name)
    `)
    .eq('tenant_id', ctx.tenantId)
    .order('created_at', { ascending: false })
    .limit(100);

  if (sp.get('area')) query = query.ilike('area', `%${sp.get('area')}%`);
  if (sp.get('property_type')) query = query.eq('property_type', sp.get('property_type'));
  if (sp.get('status')) query = query.eq('status', sp.get('status'));
  else query = query.eq('status', 'active');
  if (sp.get('price_min')) query = query.gte('price_aed', Number(sp.get('price_min')));
  if (sp.get('price_max')) query = query.lte('price_aed', Number(sp.get('price_max')));

  const { data, error: dbError } = await query;
  if (dbError) return NextResponse.json({ error: dbError.message }, { status: 500 });

  return NextResponse.json({ listings: data, count: data?.length ?? 0 });
}
