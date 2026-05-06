# 🎓 AcademeIQ Platform

A production-grade, multi-tenant College Academic Performance Management Platform built with React, TypeScript, Tailwind CSS, and Supabase.

A **single unified web application** serving three distinct user roles:
- **Admin Portal** (`/admin/*`) — College administrators manage colleges, departments, faculty, parents, and audit logs
- **Faculty Portal** (`/faculty/*`) — Faculty manage students, create tests, enter marks, and publish rankings
- **Parent Portal** (`/parent/*`) — Parents view their child's published rankings and progress (NEVER raw marks)

---

## 📋 Table of Contents

1. [Architecture Overview](#-architecture-overview)
2. [Prerequisites](#-prerequisites)
3. [Quick Start](#-quick-start)
4. [Detailed Setup Guide](#-detailed-setup-guide)
5. [Project Structure](#-project-structure)
6. [Authentication Flows](#-authentication-flows)
7. [Database & Security](#-database--security)
8. [Edge Functions](#-edge-functions)
9. [Available Scripts](#-available-scripts)
10. [Deployment](#-deployment)
11. [Troubleshooting](#-troubleshooting)

---

## 🏗 Architecture Overview

| Layer | Technology |
|-------|-----------|
| Frontend | React 18, Vite, TypeScript (strict), Tailwind CSS |
| State | React Query (TanStack Query) + React Context |
| Backend | Supabase (Auth, PostgREST, Storage, Edge Functions) |
| Database | PostgreSQL with Row Level Security (RLS) |
| Auth | Email+Password (admin/faculty), Phone OTP (parents) |
| Edge Runtime | Deno (Supabase Edge Functions) |
| Monorepo | pnpm workspaces |

### Key Security Principles

- **Multi-tenant isolation** — every row scoped by `college_id`
- **Row Level Security** enabled on every table — no exceptions
- **Parents have ZERO access to the `marks` table** at any layer
- **Faculty access only their assigned batches**
- **Rankings only visible after publish**
- **Audit logs are immutable** (no UPDATE / DELETE permitted)

---

## 📦 Prerequisites

Install these tools before getting started:

| Tool | Version | Install |
|------|---------|---------|
| Node.js | 18.x or later | https://nodejs.org/ |
| pnpm | 8.x or later | `npm install -g pnpm` |
| Supabase CLI | latest | https://supabase.com/docs/guides/cli |
| Docker Desktop | latest | https://www.docker.com/products/docker-desktop/ (required for local Supabase) |
| Git | latest | https://git-scm.com/ |

You will also need:

- A **Supabase project** (free tier works) — sign up at https://supabase.com
- A **Resend account** for emails (optional, only for notifications) — https://resend.com
- A **Twilio account** if you want production SMS OTP (Supabase has built-in test OTP)

---

## ⚡ Quick Start

```bash
# 1. Install dependencies
pnpm install

# 2. Copy environment variables
cp .env.example .env
# (then edit .env with your Supabase credentials)

# 3. Apply database migrations
supabase link --project-ref your-project-ref
supabase db push

# 4. Seed test data (optional)
psql "$SUPABASE_DB_URL" -f supabase/seed.sql

# 5. Deploy Edge Functions
supabase functions deploy recalculate-rankings
supabase functions deploy validate-bulk-upload
supabase functions deploy send-notification

# 6. Start the dev server
pnpm dev
```

Open http://localhost:5173 in your browser.

---

## 🔧 Detailed Setup Guide

### Step 1: Clone & Install

```bash
git clone <your-repo-url> academeiq-platform
cd academeiq-platform
pnpm install
```

### Step 2: Create a Supabase Project

1. Go to https://app.supabase.com and create a new project
2. Wait ~2 minutes for the project to provision
3. From the project dashboard, grab these values:
   - **Project URL** → `Settings → API → Project URL`
   - **anon public key** → `Settings → API → Project API keys → anon public`
   - **service_role key** → `Settings → API → Project API keys → service_role` (keep secret!)

### Step 3: Configure Environment Variables

```bash
cp .env.example .env
```

Edit `.env`:

```env
VITE_SUPABASE_URL=https://your-project-ref.supabase.co
VITE_SUPABASE_ANON_KEY=eyJhbGc...
SUPABASE_SERVICE_ROLE_KEY=eyJhbGc...
RESEND_API_KEY=re_...
```

> ⚠️ **Never commit `.env` to git.** It is already in `.gitignore`.

### Step 4: Link Supabase CLI

```bash
supabase login
supabase link --project-ref your-project-ref
```

### Step 5: Apply Migrations

The `supabase/migrations/` folder contains three files that must be applied in order:

```bash
supabase db push
```

This creates:
- All tables (`001_schema.sql`)
- Row Level Security policies (`002_rls.sql`)
- Stored functions and triggers (`003_functions_triggers.sql`)

### Step 6: Seed Sample Data (Optional)

```bash
# Get your DB connection string from: Settings → Database → Connection string → URI
psql "postgresql://postgres:[YOUR-PASSWORD]@db.[PROJECT-REF].supabase.co:5432/postgres" -f supabase/seed.sql
```

This inserts:
- 1 sample college, 2 departments, 3 batches
- 30 sample students
- 2 sample tests with marks and rankings

### Step 7: Configure Authentication

In your Supabase Dashboard:

1. **Email Auth** (for Admin/Faculty):
   - Go to `Authentication → Providers → Email`
   - Enable "Email" provider
   - Disable "Confirm email" for faster admin onboarding (or keep enabled for production)

2. **Phone Auth** (for Parents):
   - Go to `Authentication → Providers → Phone`
   - Enable "Phone" provider
   - For testing: enable "Test phone numbers" and add a number with a fixed OTP
   - For production: configure Twilio / MessageBird credentials

3. **Site URL**:
   - `Authentication → URL Configuration`
   - Set Site URL to `http://localhost:5173` (dev) or your production URL
   - Add redirect URLs as needed

### Step 8: Create the First Admin User

Since admin accounts are not self-registerable, create one via SQL:

```sql
-- 1. Create the auth user (you can do this via Supabase Dashboard → Authentication → Add user)
-- 2. Then create their profile:
INSERT INTO profiles (id, college_id, role, full_name, is_active)
VALUES (
  '<auth-user-uuid>',
  '<college-uuid>',  -- from seed or your college row
  'admin',
  'System Administrator',
  true
);
```

### Step 9: Deploy Edge Functions

```bash
# Set secrets for the functions
supabase secrets set RESEND_API_KEY=re_your_key
supabase secrets set FROM_EMAIL=noreply@yourdomain.com

# Deploy all three functions
supabase functions deploy recalculate-rankings --no-verify-jwt
supabase functions deploy validate-bulk-upload
supabase functions deploy send-notification
```

> Note: `recalculate-rankings` is deployed `--no-verify-jwt` because it needs to authorize callers manually using the service role.

### Step 10: Run the App

```bash
pnpm dev
```

Visit http://localhost:5173 — you should see the login page.

---

## 📁 Project Structure

```
academeiq-platform/
├── apps/
│   └── web/                              # Single unified web application
│       ├── src/
│       │   ├── features/
│       │   │   ├── auth/                 # Login, OTP, role selector
│       │   │   ├── admin/pages/          # Admin portal pages
│       │   │   ├── faculty/pages/        # Faculty portal pages
│       │   │   └── parent/pages/         # Parent portal pages
│       │   ├── components/               # Shared UI components
│       │   ├── hooks/                    # useAuth, useStudents, etc.
│       │   ├── lib/                      # supabaseClient, validators, csv parser
│       │   ├── router/                   # Route guards & router config
│       │   ├── types/                    # TypeScript types
│       │   ├── App.tsx
│       │   ├── main.tsx
│       │   └── index.css
│       ├── index.html
│       ├── vite.config.ts
│       ├── tailwind.config.ts
│       ├── postcss.config.js
│       ├── tsconfig.json
│       └── package.json
│
├── packages/
│   └── shared/                           # Shared types & supabase client
│       ├── lib/supabaseClient.ts
│       ├── types/index.ts
│       └── package.json
│
├── supabase/
│   ├── migrations/
│   │   ├── 001_schema.sql                # Tables + indexes
│   │   ├── 002_rls.sql                   # Row Level Security policies
│   │   └── 003_functions_triggers.sql    # Triggers + ranking function
│   ├── functions/
│   │   ├── recalculate-rankings/index.ts
│   │   ├── validate-bulk-upload/index.ts
│   │   └── send-notification/index.ts
│   ├── config.toml
│   └── seed.sql
│
├── pnpm-workspace.yaml
├── package.json
├── .env.example
├── .gitignore
└── README.md                             # this file
```

---

## 🔐 Authentication Flows

### Faculty / Admin Login
1. User visits `/login`
2. Enters email + password
3. `supabase.auth.signInWithPassword()` is called
4. On success, profile is fetched, role checked
5. Redirect: `admin → /admin/dashboard`, `faculty → /faculty/dashboard`
6. Role mismatch → forced sign-out

### Parent Login
1. User visits `/login` and switches to "Parent" tab
2. Enters phone number → `supabase.auth.signInWithOtp({ phone })`
3. Enters 6-digit OTP → `supabase.auth.verifyOtp(...)`
4. System checks `parent_student_map` for verified children:
   - **No verified child** → `/parent/pending`
   - **One child** → `/parent/dashboard`
   - **Multiple children** → `/parent/select-child`

### Admin Direct Access
The admin portal is accessed at `/admin/*` after login. The login page itself is shared; routing is enforced by `RequireRole('admin')`.

---

## 🗄 Database & Security

### Tables (15 total)

`colleges`, `academic_years`, `departments`, `profiles`, `batches`, `faculty_batch_assignments`, `students`, `parent_student_map`, `tests`, `test_subjects`, `marks`, `rankings`, `audit_log`

### Row Level Security Highlights

| Table | Parent | Faculty | Admin |
|-------|--------|---------|-------|
| `marks` | ❌ NO ACCESS | ✅ assigned batches | ✅ college-wide |
| `rankings` | ✅ verified child + published | ✅ assigned batches | ✅ college-wide |
| `students` | ✅ verified child only | ✅ assigned batches | ✅ college-wide |
| `tests` | ✅ published, child's batch | ✅ assigned batches | ✅ college-wide |
| `audit_log` | ❌ | ❌ | ✅ READ-only |

All tables enforce `college_id = get_my_college_id()` for tenant isolation.

---

## ⚡ Edge Functions

### `recalculate-rankings`
Triggered when faculty locks a test. Computes weighted marks, dense rank, and batch rank via the `recalculate_rankings(test_id)` stored procedure.

### `validate-bulk-upload`
Validates CSV uploads of students. Checks USN format, name presence, date parseability, and detects duplicates within payload and against existing DB rows.

### `send-notification`
Sends emails to parents when a test is published, using the Resend API.

---

## 📜 Available Scripts

| Command | Description |
|---------|-------------|
| `pnpm dev` | Start the web app (http://localhost:5173) |
| `pnpm build` | Build for production |
| `pnpm preview` | Preview production build locally |
| `pnpm lint` | Lint all workspaces |
| `pnpm typecheck` | TypeScript check |
| `pnpm supabase:start` | Start local Supabase |
| `pnpm supabase:reset` | Reset local DB and reapply migrations |
| `pnpm supabase:push` | Push migrations to linked project |
| `pnpm supabase:functions:deploy` | Deploy Edge Functions |

---

## 🚀 Deployment

### Frontend (Vercel / Netlify / Cloudflare Pages)

1. Connect your git repo
2. Set the build command to: `pnpm install && pnpm build`
3. Output directory: `apps/web/dist`
4. Add the environment variables from `.env`
5. Deploy

### Backend (Supabase)

Already running on Supabase. Just push your migrations and deploy Edge Functions:

```bash
supabase db push
supabase functions deploy
```

---

## 🛟 Troubleshooting

**❌ "Missing Supabase environment variables"**
→ Make sure `.env` exists at the project root and contains `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY`. Restart the dev server after editing.

**❌ "permission denied for table X"**
→ Row Level Security is working correctly! It means the current user does not have access to that row. Check the user's role and the corresponding policy in `002_rls.sql`.

**❌ Phone OTP not arriving**
→ In dev, configure a "test phone" in `Authentication → Providers → Phone` with a fixed OTP. For production, set up Twilio credentials.

**❌ "function recalculate_rankings does not exist"**
→ Migrations were not applied in order. Run `supabase db reset` or manually apply `003_functions_triggers.sql`.

**❌ Tailwind classes not working**
→ Ensure `apps/web/tailwind.config.ts` content paths match your file structure and that `@tailwind` directives are in `index.css`.

---

## 📄 License

MIT — feel free to use this as a foundation for your own academic platform.

---

**Built with ❤️ — happy shipping!**
