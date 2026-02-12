import Link from "next/link";
import Image from "next/image";
import SiteHeader from "@/components/SiteHeader";
import SiteFooter from "@/components/SiteFooter";

export default function AboutPage() {
  return (
    <div className="min-h-screen flex flex-col">
      <SiteHeader />

      <main className="flex-1 px-4 py-16 sm:py-20">
        <div className="max-w-3xl mx-auto">
          <div className="rounded-xl overflow-hidden border border-slate-200 shadow-lg mb-10">
            <Image
              src="/images/hero.jpg"
              alt="Hair transplant audit"
              width={1200}
              height={600}
              className="w-full h-auto"
            />
          </div>
          <h1 className="text-3xl sm:text-4xl font-bold text-slate-900">
            About HairAudit
          </h1>
          <p className="mt-6 text-slate-600">
            HairAudit was created to bring transparency, accountability, and clinical clarity to the
            hair restoration industry. We provide independent audits of hair transplant procedures by
            analysing surgical technique, donor area integrity, graft handling, implantation accuracy,
            and post-operative standards using structured medical review methods.
          </p>
          <p className="mt-4 text-slate-600">
            Our reports are designed to give patients clarity, support corrective planning, and help
            clinics and surgeons benchmark surgical quality — without bias or promotion.
          </p>
          <p className="mt-4 text-slate-600">
            HairAudit does not perform hair transplants and does not promote clinics or surgeons. Our
            role is to deliver unbiased, evidence-based reporting that supports informed patient
            decisions, corrective planning, and continuous improvement across the industry.
          </p>
          <div className="mt-10">
            <Link
              href="/signup"
              className="inline-flex items-center justify-center px-6 py-3 rounded-xl bg-amber-500 text-slate-900 font-semibold hover:bg-amber-400 transition-colors"
            >
              Request an Audit
            </Link>
          </div>
        </div>
      </main>

      <SiteFooter />
    </div>
  );
}
