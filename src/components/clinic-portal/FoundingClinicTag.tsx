/**
 * Optional display-only tag for early adopters.
 * UI-only; no backend. Pass showFoundingTag=true to display (e.g. from env or profile later).
 */

type FoundingClinicTagProps = {
  showFoundingTag?: boolean;
};

export default function FoundingClinicTag({ showFoundingTag = false }: FoundingClinicTagProps) {
  if (!showFoundingTag) return null;

  return (
    <div
      className="inline-flex flex-col rounded-xl border border-amber-300/60 bg-amber-50 px-4 py-2.5"
      role="status"
      aria-label="Founding Clinic"
    >
      <span className="text-sm font-bold text-amber-800">Founding Clinic</span>
      <span className="text-xs text-amber-700 mt-0.5">Early leader in global surgical transparency</span>
    </div>
  );
}
