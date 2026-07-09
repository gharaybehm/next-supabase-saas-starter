import { NextRequest, NextResponse } from 'next/server';
import { validateApiKey } from '../../middleware';
import { createAdminClient } from '@/utils/supabase/admin';

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
    .from('listings')
    .select(`
      *,
      user_profiles!listings_listing_broker_id_fkey(full_name),
      broker_profiles!listings_listing_broker_id_fkey(rera_card_no, brokerage_name),
      listing_brokers(broker_id, role, user_profiles(full_name), broker_profiles(rera_card_no))
    `)
    .eq('id', id)
    .eq('tenant_id', ctx.tenantId)
    .single();

  if (dbError || !data) return NextResponse.json({ error: 'Listing not found.' }, { status: 404 });
  return NextResponse.json({ listing: data });
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { ctx, error, status } = await validateApiKey(req);
  if (error || !ctx) return NextResponse.json({ error }, { status: status ?? 401 });

  const { id } = await params;
  const body = await req.json();
  const allowedStatuses = ['active','pending','sold','rented','expired'];

  if (!body.status || !allowedStatuses.includes(body.status)) {
    return NextResponse.json({ error: `status must be one of: ${allowedStatuses.join(', ')}` }, { status: 400 });
  }

  const admin = createAdminClient();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error: dbError } = await (admin as any)
    .from('listings')
    .update({ status: body.status, updated_at: new Date().toISOString() })
    .eq('id', id)
    .eq('tenant_id', ctx.tenantId);

  if (dbError) return NextResponse.json({ error: dbError.message }, { status: 500 });
  return NextResponse.json({ success: true, id, status: body.status });
}
