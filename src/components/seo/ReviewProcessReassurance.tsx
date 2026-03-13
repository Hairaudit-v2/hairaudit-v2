type ReviewProcessReassuranceProps = {
  className?: string;
};

export default function ReviewProcessReassurance({ className = "" }: ReviewProcessReassuranceProps) {
  return (
    <div className={`rounded-2xl border border-emerald-400/30 bg-emerald-400/10 p-5 ${className}`}>
      <h3 className="text-base font-semibold text-emerald-200">What happens after you submit</h3>
      <ul className="mt-3 space-y-2 text-sm text-emerald-100/90">
        <li>- We check your photos and timeline for completeness.</li>
        <li>- AI analysis prepares an evidence map for medical review.</li>
        <li>- A clinical reviewer verifies findings before your report is released.</li>
        <li>- You receive clear next-step guidance in plain language.</li>
      </ul>
      <p className="mt-3 text-xs text-emerald-100/80">
        HairAudit is independent. We do not sell surgery or clinic referrals.
      </p>
    </div>
  );
}
