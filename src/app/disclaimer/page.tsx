import SiteHeader from "@/components/SiteHeader";
import SiteFooter from "@/components/SiteFooter";

export default function DisclaimerPage() {
  return (
    <div className="min-h-screen flex flex-col">
      <SiteHeader variant="minimal" />

      <main className="flex-1 px-4 py-16 sm:py-20">
        <div className="max-w-3xl mx-auto">
          <h1 className="text-3xl font-bold text-slate-900">Disclaimer</h1>
          <p className="mt-6 text-slate-600">
            HairAudit provides independent, evidence-based audits for informational purposes. Our
            reports do not constitute medical advice. Consult a qualified healthcare provider for
            medical decisions. HairAudit does not perform hair transplants and does not promote
            clinics or surgeons.
          </p>
        </div>
      </main>

      <SiteFooter />
    </div>
  );
}
