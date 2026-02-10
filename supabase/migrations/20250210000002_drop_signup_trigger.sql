-- Fix: Drop the handle_new_user trigger that was causing "Database error saving new user"
-- The app creates profiles via POST /api/profiles instead (uses service role, bypasses RLS)
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
