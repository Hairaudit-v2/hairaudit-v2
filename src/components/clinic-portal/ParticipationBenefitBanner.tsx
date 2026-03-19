/**
 * Small highlighted banner at top of clinic dashboard.
 * Encourages clinics to make cases public.
 */

export default function ParticipationBenefitBanner() {
  return (
    <div
      className="mb-6 rounded-xl border border-cyan-200 bg-cyan-50/90 px-4 py-3 text-sm text-cyan-900"
      role="region"
      aria-label="Participation benefit"
    >
      <p className="font-medium">
        Clinics with publicly verified cases are viewed more favourably by patients and appear more strongly within HairAudit discovery surfaces.
      </p>
    </div>
  );
}
