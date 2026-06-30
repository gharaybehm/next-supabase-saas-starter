# Micro MLS — Setup Guide

Follow these steps to get the app running locally for the first time.

---

## 1. Create a Supabase project

1. Go to [supabase.com](https://supabase.com) → New project
2. Choose a region close to Dubai (e.g. Frankfurt or Singapore)
3. Once created, go to **Project Settings → API** and copy:
   - **Project URL** → `NEXT_PUBLIC_SUPABASE_URL`
   - **anon / public key** → `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - **service_role key** → `SUPABASE_SERVICE_ROLE_KEY`

---

## 2. Fill in `.env.local`

Open `.env.local` and replace the placeholder values:

```env
NEXT_PUBLIC_SUPABASE_URL=https://xxxxxxxxxxxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJ...
SUPABASE_SERVICE_ROLE_KEY=eyJ...

NEXT_PUBLIC_APP_URL=http://localhost:3000

# Dropbox Sign — leave as placeholder for now, fill in when ready
DROPBOX_SIGN_API_KEY=your_dropbox_sign_api_key
DROPBOX_SIGN_WEBHOOK_SECRET=your_webhook_secret

# Platform identity (shown in the co-brokerage agreement)
PLATFORM_NAME=Micro MLS
PLATFORM_ADDRESS=Dubai, UAE
PLATFORM_REP=Platform Administrator

# VAPID keys (pre-generated — paste these in)
VAPID_PUBLIC_KEY=BNSyvoUzsHmrxGX40iHXGqXVb21nH_ze7Mjrq0I5xAutjniCAJ69xQsAfA0-jOKcdJ7Utvm2UQbE488QMuEr4D0
VAPID_PRIVATE_KEY=X8hg7ttDFue9g6NJByDtcct5Dil9rjROOA45d_5t-yY
VAPID_SUBJECT=mailto:gharaybehm@gmail.com
NEXT_PUBLIC_VAPID_PUBLIC_KEY=BNSyvoUzsHmrxGX40iHXGqXVb21nH_ze7Mjrq0I5xAutjniCAJ69xQsAfA0-jOKcdJ7Utvm2UQbE488QMuEr4D0
```

---

## 3. Run the database migrations

1. Open **Supabase Studio → SQL Editor**
2. Paste the contents of `supabase/setup.sql` and click **Run**
3. You should see no errors — all tables, policies, and indexes will be created

---

## 4. Create your admin user

1. In Supabase Studio → **Authentication → Users** → **Add user**
2. Use email `gharaybehm@gmail.com` and a strong password
3. After creating, click the user row and copy the **User UID**

---

## 5. Bootstrap the admin + tenant

1. Open `supabase/bootstrap_admin.sql`
2. Replace `<YOUR_USER_UUID>` with the UUID you copied in step 4
3. Paste the file into **SQL Editor → Run**
4. You'll see a notice like `Bootstrap complete. Tenant ID: <uuid>`

---

## 6. Run the app

```bash
cd platform
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) → you'll be redirected to `/login`.

Sign in with the credentials you created in step 4.

After login → `/tenants` → auto-redirect into `/<tenantId>/dashboard`.

---

## 7. Verify Phase 1 features

| Page | URL |
|------|-----|
| Dashboard | `/<tenantId>/dashboard` |
| Listings | `/<tenantId>/listings` |
| New listing | `/<tenantId>/listings/new` |
| Admin panel | `/<tenantId>/admin` |

The admin panel lets you create invite links for brokers, configure commission splits, manage API keys, and view the audit log.

---

## Optional: Dropbox Sign (agreement engine)

1. Create a Dropbox Sign (formerly HelloSign) account
2. Get your API key from **Settings → API**
3. Set a webhook endpoint in Dropbox Sign → `https://your-domain.com/api/webhooks/dropboxsign`
4. Copy the webhook secret into `DROPBOX_SIGN_WEBHOOK_SECRET`
5. Fill `DROPBOX_SIGN_API_KEY` in `.env.local`

Without this, the platform works fine — brokers just won't be prompted to sign the agreement until it's configured.

---

## Deploy to Netlify

The repo is already configured with `netlify.toml`. To deploy:

1. Push to GitHub
2. Connect the repo in [netlify.com](https://netlify.com)
3. Set all environment variables from `.env.local` in Netlify → **Site settings → Environment variables**
4. Change `NEXT_PUBLIC_APP_URL` to your Netlify domain (e.g. `https://micro-mls.netlify.app`)
5. Update the Dropbox Sign webhook URL to match
