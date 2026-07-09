import { NextRequest } from 'next/server';
import { createClient } from '@/utils/supabase/server';
import { renderToBuffer } from '@react-pdf/renderer';
import ApiDocsDocument from '@/app/components/pdf/ApiDocsDocument';
import { createElement } from 'react';

export const dynamic = 'force-dynamic';

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ tenantId: string }> }
) {
  const { tenantId } = await params;

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401 });
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: membership } = await (supabase as any)
    .from('tenant_members')
    .select('role')
    .eq('tenant_id', tenantId)
    .eq('user_id', user.id)
    .single();

  if (!membership) {
    return new Response(JSON.stringify({ error: 'Forbidden' }), { status: 403 });
  }

  // ApiDocsDocument renders a <Document> internally; @react-pdf/renderer's types
  // require the element passed to renderToBuffer to be a literal Document element,
  // which doesn't structurally match the wrapper's own props — cast is type-only,
  // runtime output is unaffected.
  const buffer = await renderToBuffer(
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    createElement(ApiDocsDocument) as any
  );

  return new Response(new Uint8Array(buffer), {
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': 'attachment; filename="rabita-api-docs.pdf"',
    },
  });
}
