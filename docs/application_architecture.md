# SCM Financial Management Application - Architecture Overview

## Goals
- Provide authenticated access for three profiles: Administrator, Médecin, Remplaçant.
- Allow administrators to import monthly redevance data (CSV/Excel/manual) and track status (Appelée, Payée, En attente de paiement).
- Offer personalized dashboards for practitioners and a global multi-year financial view for the SCM.
- Persist at least four years of historical data.

## Supabase Building Blocks
- **Authentication**: Supabase Auth with email/password or SSO; RLS policies enforce role-based access.
- **Database**: PostgreSQL schema with tables for users, profiles, invoices (redevances), payments, and yearly aggregates.
- **Storage**: Optional Supabase Storage bucket `imports` for original CSV/Excel uploads.
- **Edge Functions (optional)**: Normalize uploaded CSV/Excel files into the `redevances` table and trigger aggregate refreshes.

## Data Model
- `profiles`: links Supabase `auth.users` to a `role` enum (`admin`, `medecin`, `remplacant`) and practitioner metadata (name, specialty, SCM identifier).
- `redevances`: one row per monthly call (appel) with amounts and status (`appelee`, `payee`, `en_attente`).
- `payments`: optional ledger of individual payments tied to a redevance for reconciliation.
- `annual_summaries`: materialized or derived view storing yearly totals by practitioner and status for fast dashboards.

See `docs/supabase_schema.sql` for full DDL and policies.

## Role Capabilities
- **Administrateur**
  - Upload/import monthly CSV/Excel, map columns, and confirm parsing results.
  - Edit status and amounts; view global dashboards (current year + last 3 years).
  - Filter by practitioner, role (medecin/remplacant), status, and period.
- **Médecin / Remplaçant**
  - Read-only access to their own redevances and payments.
  - Filters by month/year; dashboard cards for appelée, payée, en attente.

## UI Flow (example React/Next.js + Supabase client)
1. **Login**
   - Email/password -> Supabase Auth. After login, query `profiles` to determine role and route.
2. **Admin Dashboard**
   - Cards: totals called, paid, pending (current year). Charts: monthly trend, status distribution.
   - Table: all redevances with inline status edit and CSV export.
   - Import wizard: upload file -> preview parsed rows -> confirm import -> trigger edge function to upsert.
3. **Practitioner Dashboard**
   - Personalized totals (appelée/payée/en attente) for selected period.
   - Table of redevances with status and payment history.
   - Filter by month/year; optional download as CSV.

## Security & RLS Strategy
- Use `auth.uid()` to join `profiles.user_id`.
- RLS policies:
  - Practitioners: `select` on `redevances` and `payments` where `practitioner_id = auth.uid()`.
  - Admins: `select/insert/update` on all rows; `delete` is optional and usually restricted.
- Edge functions or triggers enforce status transitions (e.g., payée requires `paid_amount >= called_amount`).

## Import Pipeline (CSV/Excel)
1. Upload file to `imports` bucket with metadata (year, month, uploader).
2. Edge function parses file (using `xlsx` or `csv-parse`), validates columns, and inserts into `staging_imports`.
3. Validation step ensures unique `(practitioner_id, period)` and positive amounts.
4. Approved rows are upserted into `redevances`; trigger refresh on `annual_summaries` materialized view.

## Dashboards & Queries
- **Global yearly view** (admin):
  ```sql
  select year, role, sum(called_amount) called, sum(paid_amount) paid,
         sum(case when status = 'en_attente' then called_amount - paid_amount else 0 end) pending
  from annual_summaries
  group by year, role
  order by year desc;
  ```
- **Practitioner view**:
  ```sql
  select month, year, called_amount, paid_amount, status
  from redevances
  where practitioner_id = auth.uid() and year >= extract(year from now()) - 3
  order by year desc, month desc;
  ```

## Environment Configuration
- Supabase URL: `https://ixwzkhitzykokvzggmix.supabase.co`
- Anon/publishable key stored in frontend env (e.g., `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`).
- Service role key stored only in server-side environments for imports/edge functions.

## Next Steps
- Implement the SQL schema and RLS policies from `docs/supabase_schema.sql` in Supabase SQL editor.
- Scaffold frontend (React/Next.js or similar) with protected routes for each role.
- Build import wizard using Supabase Storage + edge function for parsing.
- Add automated tests for role-based access and aggregation correctness.
