# Setup Guide

Follow these steps to get the app running locally for the first time.

---

## 1. Create a Supabase project

1. Go to [supabase.com](https://supabase.com) → New project
2. Once created, go to **Project Settings → API** and copy:
   - **Project URL** → `NEXT_PUBLIC_SUPABASE_URL`
   - **anon / public key** → `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - **service_role key** → `SUPABASE_SERVICE_ROLE_KEY`

---

## 2. Fill in `.env.local`

Copy `.env.local.example` to `.env.local` and fill in the values:

```env
NEXT_PUBLIC_SUPABASE_URL=https://xxxxxxxxxxxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJ...
SUPABASE_SERVICE_ROLE_KEY=eyJ...

NEXT_PUBLIC_APP_URL=http://localhost:3000

PLATFORM_NAME=Acme

# VAPID keys — generate with: npx web-push generate-vapid-keys
VAPID_PUBLIC_KEY=...
VAPID_PRIVATE_KEY=...
VAPID_SUBJECT=mailto:you@example.com
NEXT_PUBLIC_VAPID_PUBLIC_KEY=...

# Resend — leave as placeholder for now, fill in when ready
RESEND_API_KEY=your_resend_api_key
RESEND_FROM_EMAIL=invites@yourdomain.com

# Stripe — leave as placeholder for now, fill in when ready
STRIPE_SECRET_KEY=sk_test_...
STRIPE_WEBHOOK_SECRET=whsec_...
STRIPE_PRICE_ID=price_...
```

---

## 3. Run the database migrations

1. Open **Supabase Studio → SQL Editor**
2. Paste the contents of `supabase/setup.sql` and click **Run**
3. You should see no errors — all tables, policies, and indexes will be created

---

## 4. Create your admin user

1. In Supabase Studio → **Authentication → Users** → **Add user**
2. Use your email and a strong password
3. After creating, click the user row and copy the **User UID**

---

## 5. Bootstrap the admin + tenant

1. Open `supabase/bootstrap_admin.sql`
2. Replace `<YOUR_USER_UUID>` with the UUID you copied in step 4
3. Paste the file into **SQL Editor → Run**
4. You'll see a notice like `Bootstrap complete. Tenant ID: <uuid>`

The bootstrap script marks your admin tenant's subscription as `active` automatically, so you won't be blocked by the billing gate. Any additional tenants created afterwards will need to subscribe via `/<tenantId>/billing` (see Stripe setup below).

---

## 6. Run the app

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) → you'll be redirected to `/login`.

Sign in with the credentials you created in step 4.

After login → `/tenants` → auto-redirect into `/<tenantId>/dashboard`.

---

## 7. Verify core features

| Page | URL |
|------|-----|
| Dashboard | `/<tenantId>/dashboard` |
| Profile | `/<tenantId>/profile` |
| Admin panel | `/<tenantId>/admin` |
| Billing | `/<tenantId>/billing` |

The admin panel lets you create invite links for new members, manage API keys, and view the audit log.

---

## Stripe (billing)

1. Create a [Stripe](https://stripe.com) account and switch to test mode
2. Create a recurring Price (**Products → Add product**) for the subscription fee, copy its ID into `STRIPE_PRICE_ID`
3. Copy your test **Secret key** from **Developers → API keys** into `STRIPE_SECRET_KEY`
4. Install the [Stripe CLI](https://stripe.com/docs/stripe-cli) and run `stripe listen --forward-to localhost:3000/api/webhooks/stripe` locally to get a webhook signing secret for `STRIPE_WEBHOOK_SECRET` (in production, create a webhook endpoint in the Stripe dashboard pointing at `https://your-domain.com/api/webhooks/stripe` instead)
5. Subscribe to at least these webhook events: `checkout.session.completed`, `customer.subscription.updated`, `customer.subscription.deleted`, `invoice.payment_failed`

Any tenant without an `active` subscription (or within its grace period after a failed payment) is redirected to `/<tenantId>/billing` and blocked from the rest of the dashboard until the admin resolves it.

---

## Deploy to Netlify

The repo is already configured with `netlify.toml`. To deploy:

1. Push to GitHub
2. Connect the repo in [netlify.com](https://netlify.com)
3. Set all environment variables from `.env.local` in Netlify → **Site settings → Environment variables**
4. Change `NEXT_PUBLIC_APP_URL` to your Netlify domain
