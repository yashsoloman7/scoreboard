# Production Deployment Guide (Vercel + Free Supabase / Neon Database)

This platform is architected for zero-cost cloud hosting using **Vercel** (Free Hobby Tier) and **Supabase** (Free Tier PostgreSQL + Auth + Realtime + Storage) or **Neon Serverless Postgres**.

---

## 1. Supabase Free Database & Auth Setup

1. Log into [Supabase.com](https://supabase.com) and click **"New Project"**.
2. Set a project name (e.g. `state-music-judging`) and generate a strong database password. Choose your closest region.
3. Open the **SQL Editor** in the Supabase Dashboard.
4. Copy the entire contents of [`supabase/schema.sql`](../supabase/schema.sql) and execute it.
   - This installs all tables, constraints, indexes, RLS policies, and stored procedures.
5. In **Project Settings $\rightarrow$ API**, copy:
   - `Project URL` $\rightarrow$ `NEXT_PUBLIC_SUPABASE_URL`
   - `anon public key` $\rightarrow$ `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - `service_role secret key` $\rightarrow$ `SUPABASE_SERVICE_ROLE_KEY`

---

## 2. Google OAuth Provider Setup

1. Open [Google Cloud Console](https://console.cloud.google.com/).
2. Create a project and configure the **OAuth consent screen** (User Type: External).
3. Under **Credentials**, create an **OAuth 2.0 Client ID** (Web application).
4. Set **Authorized redirect URIs** to your Supabase Auth callback:
   - `https://<your-supabase-project-ref>.supabase.co/auth/v1/callback`
5. Copy your **Client ID** and **Client Secret** into **Supabase Dashboard $\rightarrow$ Authentication $\rightarrow$ Providers $\rightarrow$ Google** and toggle **Enable Google**.

---

## 3. Vercel Deployment

1. Push your repository to GitHub / GitLab.
2. In [Vercel](https://vercel.com), click **"Add New Project"** and import the repository.
3. Add the following **Environment Variables**:
   ```env
   NEXT_PUBLIC_SUPABASE_URL=https://<your-project>.supabase.co
   NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJ...
   SUPABASE_SERVICE_ROLE_KEY=eyJ...
   NEXT_PUBLIC_APP_URL=https://your-domain.vercel.app
   ```
4. Click **Deploy**. Vercel will build and deploy the Next.js 16 application to the global edge network.

---

## 4. First Administrator Activation

1. Sign into your deployed application via Google at `/auth/login`.
2. As expected under the Zero-Trust security model, your new account will see the **"Authorization Pending"** screen.
3. In your Supabase Dashboard **Table Editor $\rightarrow$ `user_roles`**, set your user's role to `'super_admin'`.
4. Click **"Check Authorization"** in the app to access the Admin Suite and Scrutineer Control Room.
