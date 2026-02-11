import SiteHeader from "@/components/SiteHeader";
import SiteFooter from "@/components/SiteFooter";

export default function PrivacyPage() {
  return (
    <div className="min-h-screen flex flex-col">
      <SiteHeader variant="minimal" />

      <main className="flex-1 px-4 py-16 sm:py-20">
        <div className="max-w-3xl mx-auto">
          <h1 className="text-3xl font-bold text-slate-900">Privacy Policy</h1>
          <p className="mt-6 text-slate-600">
            This page is a placeholder. Please add your privacy policy content here. All submissions
            to HairAudit are handled confidentially and never shared without consent.
          </p>
        </div>
      </main>

      <SiteFooter />
    </div>
  );
}
