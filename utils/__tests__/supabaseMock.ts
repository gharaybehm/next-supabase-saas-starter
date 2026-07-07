import { vi } from 'vitest';

type TableResult = { data?: unknown; error?: unknown; count?: number };

export interface ChainCall {
  table: string;
  method: string;
  args: unknown[];
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function makeChain(table: string, result: TableResult, calls: ChainCall[]): any {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const chain: any = {};
  const chainMethods = [
    'select', 'eq', 'single', 'maybeSingle', 'order', 'limit', 'range',
    'update', 'insert', 'upsert', 'delete', 'ilike', 'gte', 'lte', 'or',
  ];
  for (const method of chainMethods) {
    chain[method] = (...args: unknown[]) => {
      calls.push({ table, method, args });
      return chain;
    };
  }
  chain.then = (
    onFulfilled?: (value: TableResult) => unknown,
    onRejected?: (reason: unknown) => unknown
  ) => Promise.resolve(result).then(onFulfilled, onRejected);
  return chain;
}

// A minimal fake matching the subset of the Supabase query-builder API used
// by the app's server actions/gates/webhooks: chainable methods that all
// resolve (via `.then`) to a configurable `{ data, error }` result, whichever
// method the chain happens to end on (`.single()`, `.eq()`, etc).
export function createMockSupabase(
  tableResults: Record<string, TableResult> = {},
  authUser: { id: string; email?: string } | null = null
) {
  const calls: ChainCall[] = [];

  const client = {
    auth: {
      getUser: async () => ({ data: { user: authUser } }),
    },
    from: vi.fn((table: string) => {
      const result = tableResults[table] ?? { data: null, error: null };
      return makeChain(table, result, calls);
    }),
  };

  return { client, calls };
}
