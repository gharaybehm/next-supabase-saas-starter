import { NextRequest } from 'next/server';
import { createClient } from '@/utils/supabase/server';
import { createAdminClient } from '@/utils/supabase/admin';
import { renderToBuffer } from '@react-pdf/renderer';
import CommissionStatementDocument, {
  type CommissionStatementData,
} from '@/app/components/pdf/CommissionStatementDocument';
import { createElement } from 'react';
import { isTeamOwnerOf } from '@/app/actions/team';

export const dynamic = 'force-dynamic';

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ tenantId: string; dealId: string }> }
) {
  const { tenantId, dealId } = await params;

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401 });
  }

  // Verify tenant membership
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db = supabase as any;
  const { data: membership } = await db
    .from('tenant_members')
    .select('role')
    .eq('tenant_id', tenantId)
    .eq('user_id', user.id)
    .single();

  if (!membership) {
    return new Response(JSON.stringify({ error: 'Forbidden' }), { status: 403 });
  }

  // Fetch deal with all related data
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const adminDb = createAdminClient() as any;
  const { data: deal, error } = await adminDb
    .from('deals')
    .select(`
      id, listing_commission_pct, cooperating_commission_pct, closed_at,
      listing_broker_id, cooperating_broker_id,
      listing_broker_user:user_profiles!deals_listing_broker_id_fkey(full_name),
      listing_broker_profile:broker_profiles!deals_listing_broker_id_fkey(rera_card_no, brokerage_name),
      cooperating_broker_user:user_profiles!deals_cooperating_broker_id_fkey(full_name),
      cooperating_broker_profile:broker_profiles!deals_cooperating_broker_id_fkey(rera_card_no, brokerage_name),
      listings!deals_listing_id_fkey(area, property_type, transaction_type, price_aed, dld_permit_no)
    `)
    .eq('id', dealId)
    .eq('tenant_id', tenantId)
    .single();

  if (error || !deal) {
    return new Response(JSON.stringify({ error: 'Deal not found' }), { status: 404 });
  }

  // Only listing broker or admin can download
  const isAdmin = membership.role === 'admin';
  const isListingBroker = deal.listing_broker_id === user.id;
  const isTeamOwner = await isTeamOwnerOf(user.id, deal.listing_broker_id);
  if (!isAdmin && !isListingBroker && !isTeamOwner) {
    return new Response(JSON.stringify({ error: 'Forbidden' }), { status: 403 });
  }

  const listing = deal['listings!deals_listing_id_fkey'] ?? deal.listings;

  const statementData: CommissionStatementData = {
    dealId: deal.id,
    closedAt: deal.closed_at,
    listing: {
      area: listing.area,
      property_type: listing.property_type,
      transaction_type: listing.transaction_type,
      price_aed: Number(listing.price_aed),
      dld_permit_no: listing.dld_permit_no,
    },
    listingBroker: {
      full_name: deal.listing_broker_user?.full_name ?? 'Unknown',
      rera_card_no: deal.listing_broker_profile?.rera_card_no ?? '',
      brokerage_name: deal.listing_broker_profile?.brokerage_name ?? '',
    },
    cooperatingBroker: deal.cooperating_broker_id
      ? {
          full_name: deal.cooperating_broker_user?.full_name ?? 'Unknown',
          rera_card_no: deal.cooperating_broker_profile?.rera_card_no ?? '',
          brokerage_name: deal.cooperating_broker_profile?.brokerage_name ?? '',
        }
      : null,
    listingCommissionPct: Number(deal.listing_commission_pct),
    cooperatingCommissionPct: deal.cooperating_commission_pct != null
      ? Number(deal.cooperating_commission_pct)
      : null,
  };

  // CommissionStatementDocument is a wrapper component that renders a <Document>
  // internally; @react-pdf/renderer's types require the element passed to
  // renderToBuffer to be a literal Document element, which doesn't structurally
  // match the wrapper's own props — cast is type-only, runtime output is unaffected.
  const buffer = await renderToBuffer(
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    createElement(CommissionStatementDocument, { data: statementData }) as any
  );

  return new Response(new Uint8Array(buffer), {
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="commission-${deal.id.slice(0, 8)}.pdf"`,
    },
  });
}
