-- Billing schema: tenant-level Stripe subscriptions
-- Applies on top of 20240102000000_mls_schema.sql

CREATE TABLE IF NOT EXISTS public.subscriptions (
  id                     UUID    PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id              UUID    NOT NULL UNIQUE REFERENCES public.tenants(id) ON DELETE CASCADE,
  stripe_customer_id     TEXT,
  stripe_subscription_id TEXT,
  status                 TEXT    NOT NULL DEFAULT 'incomplete'
                         CHECK (status IN ('incomplete', 'active', 'past_due', 'canceled', 'unpaid')),
  current_period_end     TIMESTAMPTZ,
  grace_period_ends_at   TIMESTAMPTZ,
  created_at             TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at             TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.subscriptions ENABLE ROW LEVEL SECURITY;

-- Tenant members can read their own tenant's subscription status
CREATE POLICY "members_read_subscription"
  ON public.subscriptions
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.tenant_members
      WHERE tenant_members.tenant_id = subscriptions.tenant_id
        AND tenant_members.user_id = auth.uid()
    )
  );

-- Writes (checkout, webhook sync) happen exclusively via the service-role client

CREATE INDEX IF NOT EXISTS idx_subscriptions_tenant ON public.subscriptions(tenant_id);
CREATE INDEX IF NOT EXISTS idx_subscriptions_stripe_customer ON public.subscriptions(stripe_customer_id);
CREATE INDEX IF NOT EXISTS idx_subscriptions_stripe_subscription ON public.subscriptions(stripe_subscription_id);
