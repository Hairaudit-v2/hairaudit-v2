import Link from "next/link";
import Image from "next/image";
import SiteHeader from "@/components/SiteHeader";
import SiteFooter from "@/components/SiteFooter";

const services = [
  {
    title: "Patient Hair Transplant Audit",
    desc: "In-depth analysis of hair restoration procedures. Independent review of a patient's hair transplant procedure, including donor area integrity, graft placement, hairline design, and likely growth performance.",
  },
  {
    title: "Post-Procedure Outcome Analysis",
    desc: "Assessment of surgical outcomes following a hair transplant, identifying strengths, risks, and factors that may influence final growth and density.",
  },
  {
    title: "Donor Area & Extraction Review",
    desc: "Detailed analysis of donor area management, extraction patterns, spacing, and potential over-harvesting or trauma.",
  },
  {
    title: "Implantation & Hairline Design Review",
    desc: "Comprehensive evaluation of hair transplant techniques, graft angles, density distribution, and direction.",
  },
  {
    title: "Clinic & Surgeon Benchmark Audits",
    desc: "Structured audits for clinics and surgeons seeking objective quality benchmarking.",
  },
];

export default function ServicesPage() {
  return (
    <div className="min-h-screen flex flex-col">
      <SiteHeader />

      <main className="flex-1 px-4 py-16 sm:py-20">
        <div className="max-w-4xl mx-auto">
          <h1 className="text-3xl sm:text-4xl font-bold text-slate-900">
            Our services
          </h1>
          <p className="mt-4 text-slate-600">
            Each audit focuses on surgical quality, donor area management, graft handling,
            implantation accuracy, and expected growth outcomes. Our services are designed to support
            patients seeking clarity, clinics aiming to benchmark performance, and surgeons committed
            to quality improvement.
          </p>
          <p className="mt-2 text-slate-600">
            HairAudit does not perform hair transplants and does not promote clinics or practitioners.
          </p>
          <div className="mt-10 rounded-xl overflow-hidden border border-slate-200 shadow-lg mb-12">
            <Image
              src="/images/patient-report-sample.jpg"
              alt="Sample patient audit report"
              width={1200}
              height={800}
              className="w-full h-auto"
            />
            <p className="p-4 text-sm text-slate-500 bg-slate-50">
              Sample patient audit report
            </p>
          </div>
          <div className="mt-12 space-y-8">
            {services.map((s) => (
              <div
                key={s.title}
                className="p-6 rounded-xl bg-white border border-slate-200 shadow-sm"
              >
                <h2 className="text-xl font-semibold text-slate-900">{s.title}</h2>
                <p className="mt-2 text-slate-600">{s.desc}</p>
              </div>
            ))}
          </div>
          <div className="mt-10 grid sm:grid-cols-2 gap-6">
            <div className="rounded-xl overflow-hidden border border-slate-200">
              <Image
                src="/images/clinic-feedback.jpg"
                alt="Clinic audit sample"
                width={600}
                height={400}
                className="w-full h-auto"
              />
              <p className="p-3 text-sm text-slate-500 bg-slate-50">Clinic benchmark audit sample</p>
            </div>
            <div className="rounded-xl overflow-hidden border border-slate-200">
              <Image
                src="/images/doctors-feedback.jpg"
                alt="Surgeon audit sample"
                width={600}
                height={400}
                className="w-full h-auto"
              />
              <p className="p-3 text-sm text-slate-500 bg-slate-50">Surgeon benchmark audit sample</p>
            </div>
          </div>
          <div className="mt-12">
            <Link
              href="/signup"
              className="inline-flex items-center justify-center px-6 py-3 rounded-xl bg-amber-500 text-slate-900 font-semibold hover:bg-amber-400 transition-colors"
            >
              Submit your case
            </Link>
          </div>
        </div>
      </main>

      <SiteFooter />
    </div>
  );
}
