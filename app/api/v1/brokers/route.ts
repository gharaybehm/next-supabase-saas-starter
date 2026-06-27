import { NextRequest, NextResponse } from 'next/server';
import { validateApiKey } from '../middleware';
import { createAdminClient } from '@/utils/supabase/admin';

export async function GET(req: NextRequest) {
  const { ctx, error, status } = await validateApiKey(req);
  if (error || !ctx) return NextResponse.json({ error }, { status: status ?? 401 });

  const admin = createAdminClient();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error: dbError } = await (admin as any)
    .from('tenant_members')
    .select(`
      user_id, role, created_at,
      user_profiles(full_name),
      broker_profiles(rera_card_no, brokerage_name, dld_verified, agreement_status)
    `)
    .eq('tenant_id', ctx.tenantId)
    .order('created_at');

  if (dbError) return NextResponse.json({ error: dbError.message }, { status: 500 });

  // Only expose brokers with signed agreements
  const brokers = (data ?? []).filter(
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (m: any) => m.broker_profiles?.agreement_status === 'signed'
  );

  return NextResponse.json({ brokers, count: brokers.length });
}
