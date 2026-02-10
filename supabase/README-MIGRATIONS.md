# Supabase Migrations

Run the migration to add profiles (roles) and case doctor/clinic linking:

```bash
# If using Supabase CLI:
supabase db push

# Or run manually in Supabase SQL Editor:
# Copy contents of migrations/20250210000001_profiles_and_roles.sql
```

After migration:
- New users get a profile with role from signup (or default "patient")
- Existing users: set role via POST /api/profiles with body `{ "role": "auditor" }` etc.
- Cases can have optional doctor_id and clinic_id for linking
