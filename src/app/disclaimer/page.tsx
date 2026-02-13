import SiteHeader from "@/components/SiteHeader";
import SiteFooter from "@/components/SiteFooter";
import Link from "next/link";

export default function DisclaimerPage() {
  return (
    <div className="min-h-screen flex flex-col">
      <SiteHeader variant="minimal" />

      <main className="flex-1 px-4 py-16 sm:py-20">
        <div className="max-w-3xl mx-auto prose prose-slate prose-headings:text-slate-900 prose-p:text-slate-600">
          <h1 className="text-3xl font-bold text-slate-900">Disclaimer</h1>
          <p className="text-sm text-slate-500 mt-2">Last updated: February 2025</p>

          <section className="mt-8">
            <h2 className="text-xl font-semibold text-slate-900 mt-8">Medical Disclaimer</h2>
            <p>
              HairAudit provides independent, evidence-based audits of hair transplant procedures for
              <strong> informational purposes only</strong>. Our audit reports, scores, and findings
              do <strong>not</strong> constitute medical advice, diagnosis, or treatment. They are
              not a substitute for consultation with a qualified healthcare provider or hair
              restoration specialist.
            </p>
            <p>
              You should always consult a licensed medical professional before making any decisions
              regarding your health, hair restoration, or follow-up care. Do not disregard or delay
              professional medical advice based on our reports.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-slate-900 mt-8">No Guarantee of Outcomes</h2>
            <p>
              Our audits assess procedure quality based on available information and structured
              criteria. We cannot guarantee the accuracy of predictions about growth, density, or
              long-term outcomes. Individual results vary based on many factors beyond our assessment.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-slate-900 mt-8">Independence and Objectivity</h2>
            <p>
              HairAudit does not perform hair transplants and does not promote clinics, surgeons, or
              products. Our audits are intended to be independent and evidence-based. We have no
              financial interest in any clinic, surgeon, or procedure we review.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-slate-900 mt-8">Limitations of Assessment</h2>
            <p>
              Our assessments are based on the information and images you provide. The quality and
              completeness of our analysis depends on the quality and completeness of your
              submission. We do not conduct in-person examinations or physical inspections.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-slate-900 mt-8">Use of Reports</h2>
            <p>
              Our reports are intended for your personal use and for sharing with your healthcare
              providers as you see fit. They should not be used for advertising, marketing, or
              promotional purposes without our prior written consent.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-slate-900 mt-8">Contact</h2>
            <p>
              For questions about this disclaimer, contact us at{" "}
              <a href="mailto:auditor@hairaudit.com" className="text-amber-600 hover:text-amber-500">
                auditor@hairaudit.com
              </a>
              .
            </p>
          </section>

          <p className="mt-12">
            <Link href="/" className="text-amber-600 hover:text-amber-500 font-medium">
              ← Back to Home
            </Link>
          </p>
        </div>
      </main>

      <SiteFooter />
    </div>
  );
}
