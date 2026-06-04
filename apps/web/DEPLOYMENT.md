# Deploying the web app to Vercel

The marketing + account site (`apps/web`) deploys to Vercel from this pnpm /
Turborepo monorepo. This is the operator checklist: project settings, the full
environment-variable list and where each value goes, and the Supabase Auth
redirect URLs that make sign-in work on the deployed domain.

> Nothing here changes app code. It documents the dashboard configuration so the
> deploy is reproducible.

## 1. Vercel project settings

In **Project → Settings → General**:

| Setting             | Value                                                          |
| ------------------- | ------------------------------------------------------------- |
| **Root Directory**  | `apps/web`                                                    |
| **Framework Preset**| Next.js (auto-detected)                                        |
| **Install Command** | `pnpm install` (default; runs at the repo root for the workspace) |
| **Build Command**   | default — `next build` (leave blank to use the preset)        |
| **Output Directory**| default — `.next` (leave blank)                               |
| **Node.js Version** | 22.x or newer (matches the repo's Node 24 target as closely as Vercel offers) |

Notes:

- With **Root Directory = `apps/web`**, Vercel still detects the pnpm workspace
  and installs from the repo root, then builds only the web app. Turborepo is
  auto-detected; no custom build command is needed.
- The repo pins **pnpm 11.5.1** via the `packageManager` field in the root
  `package.json`; Vercel honors it through Corepack. Do not override the install
  command with a different package manager.
- `engines.node` in the root `package.json` requests Node `>=24.16.0 <25`. pnpm
  only **warns** on a mismatch (it does not fail), so a Vercel Node 22 build
  still succeeds. If Vercel offers Node 24, select it to match exactly.

## 2. Environment variables

Set these in **Project → Settings → Environment Variables** (apply to
Production, Preview, and Development unless noted). Copy `apps/web/.env.example`
for local development into `apps/web/.env.local`.

| Variable                        | Public? | Required | Where to get it / what it does                                                                 |
| ------------------------------- | ------- | -------- | --------------------------------------------------------------------------------------------- |
| `NEXT_PUBLIC_SUPABASE_URL`      | Public  | Yes      | Supabase → Project Settings → API → **Project URL**. Used by `/login` and `/account`.         |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Public  | Yes      | Supabase → Project Settings → API → **anon public** key. The only Supabase key allowed client-side. |
| `INSTALLER_DOWNLOAD_URL`        | Server  | Optional | The installer asset URL (GitHub Releases / S3). `/download` 302-redirects here. Unset → download buttons open the "notify me" waitlist. **Not** `NEXT_PUBLIC` — never ships to the client. |
| `NEXT_PUBLIC_API_BASE_URL`      | Public  | Optional | Backend API base URL (AWS App Runner). **Reserved for Phase 2** — not consumed yet. Safe to leave unset for now. |

Rules of thumb:

- `NEXT_PUBLIC_*` values are inlined into the browser bundle — only ever public,
  non-secret values. The service-role key and `SUPABASE_JWT_SECRET` live on the
  backend (`apps/api`) and must **never** appear in this project.
- **Redeploy after changing `INSTALLER_DOWNLOAD_URL`.** The home page is
  statically generated, so its download-button-vs-waitlist state is baked at
  build time. (The `/download` redirect itself always reflects the current
  value, but the button on `/` only updates on the next deploy.)

## 3. Supabase Auth redirect URLs

In the Supabase dashboard → **Authentication → URL Configuration**:

- **Site URL:** your production domain, e.g. `https://meetcopilot.app`
  (or the current Vercel domain `https://ai-meeting-assistant-web-sand.vercel.app`).
- **Redirect URLs** (add every domain the callback runs on):
  - `https://<your-production-domain>/auth/callback`
  - `https://ai-meeting-assistant-web-sand.vercel.app/auth/callback` (the Vercel domain)
  - `https://*-<your-vercel-scope>.vercel.app/auth/callback` *(optional — wildcard for preview deployments, if you want sign-in to work on previews)*

Important:

- The desktop deep link **`meetcopilot://auth/callback`** is an OS-registered
  custom protocol handled by the Electron app. It is **not** a Supabase redirect
  URL — do **not** add it to the allowlist. The web `/auth/callback` page is what
  Supabase redirects to; that page then hands the code back to the desktop app
  via the `meetcopilot://` deep link.
- Both flows share the same `/auth/callback` redirect entry: the desktop PKCE
  flow returns `?code=…` and the browser implicit flow returns tokens in the URL
  hash. Adding the domain once covers both.

## 4. Custom domain

In **Vercel → Project → Settings → Domains**, add your domain (e.g.
`meetcopilot.app`) and point DNS at Vercel:

- **Apex/root** (`meetcopilot.app`): create an `A` record to Vercel's anycast IP
  `76.76.21.21`, **or** use your registrar's ALIAS/ANAME/flattened-CNAME to
  `cname.vercel-dns.com`.
- **`www` subdomain**: `CNAME` → `cname.vercel-dns.com`.

After the domain is live:

1. Update the Supabase **Site URL** and **Redirect URLs** (section 3) to the new
   domain.
2. Redeploy if you changed any build-time env var.

## 5. Post-deploy verification

- Visit `/` — landing page renders; the **Download** button reflects whether
  `INSTALLER_DOWNLOAD_URL` is set.
- Visit `/login` in a browser (no `cc`/`state`), sign in with the magic link or
  Google, and confirm you land on `/account` with your **email** and a plan
  (defaults to **Free**).
- From the **desktop app**, start sign-in and confirm the
  `meetcopilot://auth/callback` handoff still completes against the deployed
  domain (the desktop PKCE path).
