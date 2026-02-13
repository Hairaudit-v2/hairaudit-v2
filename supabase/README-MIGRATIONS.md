# Supabase Migrations

Run migrations to add profiles (roles), case linking, and report failure handling:

```bash
# If using Supabase CLI:
supabase db push

# Or run manually in Supabase SQL Editor:
# 1. migrations/20250210000001_profiles_and_roles.sql
# 2. migrations/20250210000003_add_patient_id.sql (if needed)
# 3. migrations/20250210000004_reports_status_error.sql (adds reports.status, reports.error)
```

**20250210000004_reports_status_error.sql** (required for audit failure handling):
```sql
ALTER TABLE reports ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'complete';
ALTER TABLE reports ADD COLUMN IF NOT EXISTS error TEXT;
```

After migrations:
- New users get a profile with role from signup (or default "patient")
- Existing users: set role via POST /api/profiles with body `{ "role": "auditor" }` etc.
- Cases can have optional doctor_id and clinic_id for linking
- Reports support status/error for Inngest failure handling
