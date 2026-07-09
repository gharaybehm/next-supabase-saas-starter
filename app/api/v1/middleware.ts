import { NextRequest } from 'next/server';
import { createHash } from 'crypto';
import { createAdminClient } from '@/utils/supabase/admin';

export interface ApiContext {
  tenantId: string;
  brokerId: string | null;
}

export async function validateApiKey(
  req: NextRequest
): Promise<{ ctx?: ApiContext; error?: string; status?: number }> {
  const authHeader = req.headers.get('Authorization');
  if (!authHeader?.startsWith('Bearer ')) {
    return { error: 'Missing API key. Provide Authorization: Bearer <key>', status: 401 };
  }

  const rawKey = authHeader.replace('Bearer ', '').trim();
  const keyHash = createHash('sha256').update(rawKey).digest('hex');

  const admin = createAdminClient();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: apiKey, error } = await (admin as any)
    .from('api_keys')
    .select('id, tenant_id, revoked_at, broker_id')
    .eq('key_hash', keyHash)
    .single();

  if (error || !apiKey) return { error: 'Invalid API key.', status: 401 };
  if (apiKey.revoked_at) return { error: 'API key has been revoked.', status: 403 };

  // Update last_used_at (best-effort, non-blocking)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (admin as any).from('api_keys').update({ last_used_at: new Date().toISOString() }).eq('id', apiKey.id).then(() => {});

  return { ctx: { tenantId: apiKey.tenant_id, brokerId: apiKey.broker_id ?? null } };
}
