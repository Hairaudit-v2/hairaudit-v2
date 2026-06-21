"use client";

import dynamic from "next/dynamic";
import Link from "next/link";
import {
  BarChart3,
  Camera,
  FileText,
  LockKeyhole,
  Microscope,
  ShieldCheck,
  Sparkles,
  Stethoscope,
} from "lucide-react";

import TrackedLink from "@/components/analytics/TrackedLink";
import PatientPhotoChecklist from "@/components/marketing/PatientPhotoChecklist";
import PatientPathwayChooser from "@/components/marketing/PatientPathwayChooser";
import PublicTrustArchitectureBlock from "@/components/marketing/PublicTrustArchitectureBlock";
import { fiHairauditPrimaryButtonClass } from "@/lib/fi-ui/hairauditPrimaryButton";
import { PUBLIC_CTAS } from "@/lib/marketing/publicMarketingCopy";
import { cn } from "@/lib/utils";
import {
  Badge,
  FeatureGrid,
  NetworkCTASection,
  NetworkEcosystemMapSection,
  NetworkHero,
  Section,
  networkButtonVariants,
} from "@/packages/ui";
import { resolveProductHref } from "@/lib/network/resolveProductHref";

const CertifiedClinicsSection = dynamic(
  () => import("@/components/home/CertifiedClinicsSection").then((m) => m.default),
  { ssr: true }
);

const PlatformProgressTeaser = dynamic(
  () => import("@/components/home/PlatformProgressTeaser").then((m) => m.default),
  { ssr: true }
);

const auditSteps = [
  {
    title: "Upload your photos",
    body: "Add your donor, hairline, crown, and timeline images through a secure patient flow.",
    icon: Camera,
  },
  {
    title: "Evidence is reviewed",
    body: "HairAudit organizes your photos, timeline, and surgery details into a consistent review record.",
    icon: Microscope,
  },
  {
    title: "Receive clear guidance",
    body: "Your report explains what the evidence supports, where confidence is limited, and what to monitor next.",
    icon: FileText,
  },
] as const;

const analysisAreas = [
  "Donor area preservation",
  "Hairline design and framing",
  "Density and placement",
  "Growth pattern and timeline",
  "Technique consistency",
  "Evidence confidence",
] as const;

const trustItems = [
  {
    title: "Independent by design",
    body: "HairAudit does not perform surgery, sell procedures, or route patients into clinic referral funnels.",
    icon: ShieldCheck,
  },
  {
    title: "Private photo handling",
    body: "Patient uploads are used for the audit workflow and are never made public without explicit permission.",
    icon: LockKeyhole,
  },
  {
    title: "Structured clinical review",
    body: "HairAudit applies consistent review standards while remaining an independent platform focused on patient clarity.",
    icon: Sparkles,
  },
] as const;

export default function HairAuditNetworkHomePage() {
  return (
    <main id="main-content" className="relative flex-1">
      <NetworkHero
        platform="hairaudit"
        eyebrow="Independent hair transplant review"
        title="Understand your hair transplant with an independent review."
        subtitle="Choose the pathway that matches your stage: planning before surgery, or independent analysis after your procedure."
        networkLabel="HairAudit · Independent review platform"
        actions={<PatientPathwayChooser layout="hero" />}
        aside={
          <div className="rounded-3xl border border-white/10 bg-white/[0.04] p-5 shadow-fi-panel backdrop-blur">
            <div className="flex items-center gap-3">
              <span className="inline-flex h-11 w-11 items-center justify-center rounded-2xl bg-amber-300/15 text-amber-200">
                <BarChart3 className="h-5 w-5" aria-hidden />
              </span>
              <div>
                <p className="text-sm font-semibold text-foreground">Audit score and evidence map</p>
                <p className="text-xs text-muted-foreground">Plain-language report, not clinic marketing.</p>
              </div>
            </div>
            <div className="mt-5 space-y-3">
              {[
                ["Donor preservation", 78],
                ["Density confidence", 64],
                ["Design naturalness", 72],
              ].map(([label, score]) => (
                <div key={label}>
                  <div className="flex items-center justify-between text-xs text-muted-foreground">
                    <span>{label}</span>
                    <span>{score}</span>
                  </div>
                  <div className="mt-1 h-2 rounded-full bg-white/10">
                    <div
                      className="h-2 rounded-full bg-gradient-to-r from-amber-300 via-sky-300 to-emerald-300"
                      style={{ width: `${score}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>
            <p className="mt-5 text-xs leading-relaxed text-muted-foreground">
              Free during public beta. AI-assisted scoring is monitored and corrected when needed.
            </p>
          </div>
        }
      />

      <Section className="border-t border-border/30">
        <div className="space-y-8">
          <div className="max-w-3xl space-y-3">
            <Badge tone="accent">Two patient pathways</Badge>
            <h2 className="font-display text-3xl font-semibold tracking-tight text-foreground sm:text-4xl">
              Pre-surgery planning or post-surgery review — pick your path.
            </h2>
            <p className="text-base leading-relaxed text-muted-foreground">
              HairAudit routes your case through the right upload checklist, intake questions, review modules, and
              report format for where you are in your hair restoration journey.
            </p>
          </div>
          <PatientPathwayChooser />
          <FeatureGrid columnsClassName="md:grid-cols-3">
            {auditSteps.map(({ title, body, icon: Icon }, index) => (
              <article
                key={title}
                className="rounded-2xl border border-border/50 bg-card/70 p-6 shadow-fi-panel"
              >
                <span className="inline-flex h-11 w-11 items-center justify-center rounded-2xl bg-sky-300/10 text-sky-200">
                  <Icon className="h-5 w-5" aria-hidden />
                </span>
                <p className="mt-5 text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">
                  Step {index + 1}
                </p>
                <h3 className="mt-2 text-xl font-semibold text-foreground">{title}</h3>
                <p className="mt-3 text-sm leading-relaxed text-muted-foreground">{body}</p>
              </article>
            ))}
          </FeatureGrid>
          <PatientPhotoChecklist surface="fi" className="mt-10" />
        </div>
      </Section>

      <Section className="border-t border-border/30">
        <div className="grid gap-10 lg:grid-cols-[0.9fr_1.1fr] lg:items-center">
          <div className="space-y-4">
            <Badge tone="neutral">What HairAudit analyses</Badge>
            <h2 className="font-display text-3xl font-semibold tracking-tight text-foreground sm:text-4xl">
              Surgical quality signals, translated into patient language.
            </h2>
            <p className="text-base leading-relaxed text-muted-foreground">
              The audit framework focuses on what patients struggle to judge from appearance alone: donor management,
              density distribution, design realism, growth context, and the strength of the available documentation.
            </p>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            {analysisAreas.map((area) => (
              <div key={area} className="rounded-2xl border border-border/50 bg-card/65 p-4">
                <div className="flex items-center gap-3">
                  <span className="inline-flex h-8 w-8 items-center justify-center rounded-xl bg-amber-300/12 text-amber-200">
                    <Stethoscope className="h-4 w-4" aria-hidden />
                  </span>
                  <p className="text-sm font-semibold text-foreground">{area}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </Section>

      <Section className="border-t border-border/30">
        <div className="space-y-8">
          <div className="max-w-3xl space-y-3">
            <Badge tone="accent">Trust and privacy</Badge>
            <h2 className="font-display text-3xl font-semibold tracking-tight text-foreground sm:text-4xl">
              Independent review, protected patient data.
            </h2>
          </div>
          <FeatureGrid columnsClassName="md:grid-cols-3">
            {trustItems.map(({ title, body, icon: Icon }) => (
              <article key={title} className="rounded-2xl border border-border/50 bg-card/70 p-6">
                <span className="inline-flex h-11 w-11 items-center justify-center rounded-2xl bg-emerald-300/10 text-emerald-200">
                  <Icon className="h-5 w-5" aria-hidden />
                </span>
                <h3 className="mt-5 text-xl font-semibold text-foreground">{title}</h3>
                <p className="mt-3 text-sm leading-relaxed text-muted-foreground">{body}</p>
              </article>
            ))}
          </FeatureGrid>
          <PublicTrustArchitectureBlock surface="fi" className="mt-8" />
          <p className="mt-8 max-w-3xl text-xs leading-relaxed text-muted-foreground">
            HairAudit is not for medical emergencies. If you have severe pain, fever, spreading redness, or other urgent
            symptoms, seek local urgent care or emergency services.
          </p>
        </div>
      </Section>

      <NetworkCTASection
        align="center"
        eyebrow="Sample report"
        title="See the structure before you begin."
        description="Preview how HairAudit turns photos and case details into scorecards, confidence notes, findings, and next-step guidance."
        actions={
          <>
            <TrackedLink
              href="/request-review"
              eventName="cta_start_free_audit_home_sample"
              className={cn(networkButtonVariants({ variant: "primary", size: "lg" }))}
            >
              {PUBLIC_CTAS.startFreeHairAudit}
            </TrackedLink>
            <Link
              href="/demo-report"
              className={cn(networkButtonVariants({ variant: "secondary", size: "lg" }))}
              prefetch
            >
              {PUBLIC_CTAS.viewSampleReport}
            </Link>
          </>
        }
      />

      <Section className="border-t border-border/30">
        <div className="grid gap-8 lg:grid-cols-[0.95fr_1.05fr] lg:items-center">
          <div className="space-y-4">
            <Badge tone="neutral">Clinics and professionals</Badge>
            <h2 className="font-display text-3xl font-semibold tracking-tight text-foreground sm:text-4xl">
              Professional pathways stay available, but separate.
            </h2>
            <p className="text-base leading-relaxed text-muted-foreground">
              Clinics and doctors can use HairAudit for internal QA, verified participation, and transparent public
              proof. Patient review remains the primary public path.
            </p>
            <div className="flex flex-col gap-3 sm:flex-row">
              <Link href="/for-clinics" className={cn(networkButtonVariants({ variant: "secondary", size: "md" }))}>
                For Clinics
              </Link>
              <Link href="/professionals" className={cn(networkButtonVariants({ variant: "ghost", size: "md" }))}>
                For Professionals
              </Link>
            </div>
          </div>
          <div className="rounded-3xl border border-border/50 bg-card/60 p-6">
            <p className="text-xs font-semibold uppercase tracking-[0.22em] text-muted-foreground">
              Standalone platform positioning
            </p>
            <p className="mt-3 text-lg font-semibold text-foreground">
              HairAudit is the independent audit layer, not a clinic marketplace and not a Follicle Intelligence
              subpage.
            </p>
            <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
              FI provides shared intelligence infrastructure and ecosystem coherence; HairAudit owns the audit
              experience, patient trust posture, and surgical review workflow.
            </p>
          </div>
        </div>
      </Section>

      <CertifiedClinicsSection />

      <PlatformProgressTeaser />

      <NetworkEcosystemMapSection
        eyebrow="Network context"
        title="Part of the Follicle Intelligence Network."
        description="HairAudit connects surgical audit signals into the broader network architecture while keeping patient audits independent, private, and evidence-led."
        resolveProductHref={resolveProductHref}
      />

      <NetworkCTASection
        id="start-free-audit"
        align="center"
        eyebrow="Start"
        title="Get clarity on your hair transplant."
        description="Start with secure upload. Add the photos you have now; the report will explain where evidence is strong and where confidence is limited."
        actions={
          <TrackedLink
            href="/request-review"
            eventName="cta_start_free_audit_home_footer"
            className={fiHairauditPrimaryButtonClass("lg")}
          >
            {PUBLIC_CTAS.startFreeHairAudit}
          </TrackedLink>
        }
      />
    </main>
  );
}
