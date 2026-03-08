# Auditor + Graft Integrity Smoke Test Checklist

Run these steps to verify auditor flow end-to-end.

## Prerequisites

- Auditor account: `auditor@hairaudit.com` (password set in Supabase)
- At least one submitted case with Graft Integrity estimate (or use a case that has donor/recipient photos)

## Smoke Test Steps

1. **Login as auditor**
   - Go to `/login/auditor`
   - Sign in with `auditor@hairaudit.com`
   - Expect: Redirect to `/dashboard/auditor`

2. **Open dashboard**
   - Confirm auditor dashboard loads
   - Expect: "All audit cases" list with status chips (PDF Ready, Processing, Graft Integrity Pending/Approved, etc.)

3. **Open case**
   - Click a case from the list
   - Expect: Case detail page with auditor-oriented layout
   - Expect: "Graft Integrity Review" section (or "No Graft Integrity estimate generated yet" if none)

4. **Review Graft Integrity**
   - Expand the Graft Integrity row (click "Review")
   - Expect: AI estimate summary, claimed grafts, extracted/implanted ranges, variance, confidence, evidence strength
   - Expect: Action buttons (Approve, Needs More Evidence, Reject) and manual override inputs

5. **Approve or adjust**
   - Approve (or Approve with overrides if you entered manual ranges)
   - Expect: Success message "Saved: approve" or "Approved with overrides saved"
   - Expect: Status badge updates to "approved"

6. **Verify DB update**
   - In Supabase: `graft_integrity_estimates` table
   - Expect: `auditor_status`, `audited_by`, `audited_at` updated; `auditor_adjustments` if overrides used

7. **Verify patient-visible state**
   - Log in as patient (or switch role via `/api/dev/set-role?role=patient` in dev)
   - Open same case
   - Expect: Graft Integrity card shows approved ranges (or pending/needs_more_evidence placeholder)

8. **Verify PDF behavior**
   - Generate or view report PDF for the case
   - Expect: Patient PDF shows approved Graft Integrity ranges only (or "pending auditor validation" if not approved)
   - Expect: Auditor PDF shows same; pending/rejected/needs_more_evidence should not surface high-impact claims in patient PDF

## Debug Mode

Set `DEBUG_AUDITOR=1` in development to enable optional role resolution logs (if implemented).
