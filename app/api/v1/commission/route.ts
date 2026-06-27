import { NextRequest, NextResponse } from 'next/server';
import { validateApiKey } from '../middleware';
import { createAdminClient } from '@/utils/supabase/admin';

export async function GET(req: NextRequest) {
  const { ctx, error, status } = await validateApiKey(req);
  if (error || !ctx) return NextResponse.json({ error }, { status: status ?? 401 });

  const admin = createAdminClient();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data } = await (admin as any)
    .from('commission_config')
    .select('listing_pct, cooperating_pct, updated_at')
    .eq('tenant_id', ctx.tenantId)
    .single();

  return NextResponse.json({
    commission: data ?? { listing_pct: 50, cooperating_pct: 50 },
  });
}
