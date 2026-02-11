import SiteHeader from "@/components/SiteHeader";
import SiteFooter from "@/components/SiteFooter";
import Link from "next/link";

export default function TermsPage() {
  return (
    <div className="min-h-screen flex flex-col">
      <SiteHeader variant="minimal" />

      <main className="flex-1 px-4 py-16 sm:py-20">
        <div className="max-w-3xl mx-auto prose prose-slate prose-headings:text-slate-900 prose-p:text-slate-600">
          <h1 className="text-3xl font-bold text-slate-900">Terms of Use</h1>
          <p className="text-sm text-slate-500 mt-2">Last updated: February 2025</p>

          <section className="mt-8">
            <h2 className="text-xl font-semibold text-slate-900 mt-8">1. Acceptance of Terms</h2>
            <p>
              By accessing or using hairaudit.com and our services, you agree to be bound by these
              Terms of Use. If you do not agree, do not use our website or services.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-slate-900 mt-8">2. Description of Services</h2>
            <p>
              HairAudit provides independent, evidence-based audits of hair transplant procedures. We
              assess surgical quality, donor area integrity, graft handling, implantation accuracy,
              and expected growth outcomes. Our services are designed for patients seeking clarity
              and for clinics or surgeons seeking objective quality benchmarking. HairAudit does not
              perform hair transplants and does not promote clinics, surgeons, or products.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-slate-900 mt-8">3. Account and Registration</h2>
            <p>
              To use certain features, you must create an account. You are responsible for
              maintaining the confidentiality of your password and for all activity under your
              account. You must provide accurate and complete information and promptly update it if
              it changes.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-slate-900 mt-8">4. User Obligations</h2>
            <p>When using our services, you agree to:</p>
            <ul className="list-disc pl-6 space-y-1 text-slate-600">
              <li>Provide accurate and truthful information in your submissions</li>
              <li>Only submit content you have the right to share (e.g., your own photos or with consent)</li>
              <li>Not use our services for any illegal or unauthorised purpose</li>
              <li>Not attempt to gain unauthorised access to our systems or other user accounts</li>
              <li>Not interfere with or disrupt our services or servers</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-slate-900 mt-8">5. No Medical Advice</h2>
            <p>
              Our audit reports are for informational purposes only. They do not constitute medical
              advice, diagnosis, or treatment. You should consult a qualified healthcare provider for
              any medical decisions. See our{" "}
              <Link href="/disclaimer" className="text-amber-600 hover:text-amber-500">
                Disclaimer
              </Link>{" "}
              for further information.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-slate-900 mt-8">6. Intellectual Property</h2>
            <p>
              The HairAudit website, content, methodology, and materials are owned by HairAudit or
              its licensors. You may not copy, modify, distribute, or create derivative works without
              our prior written consent. Audit reports generated for you remain your property for
              personal use, subject to these terms.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-slate-900 mt-8">7. Limitation of Liability</h2>
            <p>
              To the fullest extent permitted by law, HairAudit shall not be liable for any indirect,
              incidental, special, consequential, or punitive damages arising from your use of our
              services. Our total liability shall not exceed the amount you paid us, if any, in the
              twelve months preceding the claim.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-slate-900 mt-8">8. Termination</h2>
            <p>
              We may suspend or terminate your account and access to our services at any time for
              violation of these terms or for any other reason. You may close your account at any
              time by contacting us.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-slate-900 mt-8">9. Changes to Terms</h2>
            <p>
              We may modify these Terms of Use at any time. We will post changes on this page and
              update the &quot;Last updated&quot; date. Continued use after changes constitutes
              acceptance. We encourage you to review these terms periodically.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-slate-900 mt-8">10. Governing Law</h2>
            <p>
              These terms shall be governed by the laws of the United States. Any disputes shall be
              resolved in the courts of the applicable jurisdiction.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-slate-900 mt-8">11. Contact</h2>
            <p>
              For questions about these terms, contact us at{" "}
              <a href="mailto:tlbpmg@gmail.com" className="text-amber-600 hover:text-amber-500">
                tlbpmg@gmail.com
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
