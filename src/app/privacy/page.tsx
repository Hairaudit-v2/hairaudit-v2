import SiteHeader from "@/components/SiteHeader";
import SiteFooter from "@/components/SiteFooter";
import Link from "next/link";

export default function PrivacyPage() {
  return (
    <div className="min-h-screen flex flex-col">
      <SiteHeader variant="minimal" />

      <main className="flex-1 px-4 py-16 sm:py-20">
        <div className="max-w-3xl mx-auto prose prose-slate prose-headings:text-slate-900 prose-p:text-slate-600">
          <h1 className="text-3xl font-bold text-slate-900">Privacy Policy</h1>
          <p className="text-sm text-slate-500 mt-2">Last updated: February 2025</p>

          <section className="mt-8">
            <h2 className="text-xl font-semibold text-slate-900 mt-8">1. Introduction</h2>
            <p>
              HairAudit (&quot;we,&quot; &quot;our,&quot; or &quot;us&quot;) operates hairaudit.com and provides
              independent hair transplant audit services. This Privacy Policy explains how we collect,
              use, store, and protect your personal information when you use our website and services.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-slate-900 mt-8">2. Information We Collect</h2>
            <p>We collect information you provide directly:</p>
            <ul className="list-disc pl-6 space-y-1 text-slate-600">
              <li>
                <strong>Account information:</strong> Email address, password (encrypted), and role
                (patient, doctor, clinic, or auditor)
              </li>
              <li>
                <strong>Case submissions:</strong> Photos, procedure details, answers to audit
                questions, and any other information you submit for an audit
              </li>
              <li>
                <strong>Contact information:</strong> If you contact us, we may store your email and
                message content
              </li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-slate-900 mt-8">3. How We Use Your Information</h2>
            <p>We use your information to:</p>
            <ul className="list-disc pl-6 space-y-1 text-slate-600">
              <li>Provide audit services and generate reports</li>
              <li>Manage your account and authenticate you</li>
              <li>Communicate with you about your submissions and our services</li>
              <li>Improve our website and services</li>
              <li>Comply with legal obligations</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-slate-900 mt-8">4. Confidentiality</h2>
            <p>
              All case submissions are handled confidentially. We do not share your personal
              information, photos, or audit results with third parties without your express consent,
              except as required by law or as described in this policy.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-slate-900 mt-8">5. Third-Party Services</h2>
            <p>
              We use third-party services to operate our platform: Supabase (authentication and
              database), Vercel (hosting), and Inngest (background processing). These providers
              process data on our behalf under contractual obligations to protect your information.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-slate-900 mt-8">6. Cookies</h2>
            <p>
              We use essential cookies for authentication and session management. These are
              necessary for the website to function. We may use analytics cookies to understand how
              visitors use our site; you can control cookie preferences in your browser settings.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-slate-900 mt-8">7. Data Retention</h2>
            <p>
              We retain your account and case data for as long as your account is active or as needed
              to provide services. You may request deletion of your data by contacting us.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-slate-900 mt-8">8. Your Rights</h2>
            <p>
              Depending on your location, you may have the right to access, correct, delete, or
              export your personal data. Contact us at{" "}
              <a href="mailto:manager@evolvedhair.com.au" className="text-amber-600 hover:text-amber-500">
                manager@evolvedhair.com.au
              </a>{" "}
              to exercise these rights.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-slate-900 mt-8">9. Changes</h2>
            <p>
              We may update this Privacy Policy from time to time. We will post the updated policy
              on this page and update the &quot;Last updated&quot; date. Continued use of our services
              after changes constitutes acceptance of the updated policy.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-slate-900 mt-8">10. Contact</h2>
            <p>
              For privacy-related questions, contact us at{" "}
              <a href="mailto:manager@evolvedhair.com.au" className="text-amber-600 hover:text-amber-500">
                manager@evolvedhair.com.au
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
