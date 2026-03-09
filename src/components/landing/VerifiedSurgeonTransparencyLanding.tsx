"use client";

import { useState } from "react";
import Link from "next/link";

// ——— Data (easy to edit) ———

const heroCompareCards = [
  {
    label: "Current Model",
    title: "Reviews & Marketing",
    description:
      "Reputation often relies on testimonials, social proof, and promotional claims.",
    variant: "neutral" as const,
  },
  {
    label: "HairAudit Model",
    title: "Evidence-Based Recognition",
    description:
      "Recognition driven by documentation quality, validated case outcomes, and transparency participation.",
    variant: "accent" as const,
  },
];

const heroStats = [
  { value: "5", label: "forensic scoring domains" },
  { value: "4", label: "recognition tiers" },
  { value: "1", label: "global transparency standard" },
];

const whyMattersPillars = [
  {
    title: "Independent Forensic Auditing",
    description:
      "Each case is reviewed through structured evidence analysis covering surgical planning, donor preservation, graft handling, implantation quality, and documentation integrity.",
  },
  {
    title: "Transparency That Builds Trust",
    description:
      "Clinics that contribute documentation help ensure their work is represented fairly and more completely, while improving audit confidence and benchmark readiness.",
  },
  {
    title: "Recognition Earned Through Evidence",
    description:
      "Awards are tied to validated performance, documentation quality, and consistency across cases — not marketing claims.",
  },
];

const recognitionTiers = [
  {
    id: "verified",
    name: "Verified",
    subtitle: "Transparency Participant",
    bullets: [
      "Actively contributes documentation to case reviews",
      "Supports fair forensic auditing",
      "Demonstrates commitment to transparency",
    ],
    premium: false,
  },
  {
    id: "silver",
    name: "Silver",
    subtitle: "Consistent Standards",
    bullets: [
      "Multiple validated cases",
      "Strong transparency participation",
      "Reliable audit quality across submissions",
    ],
    premium: false,
  },
  {
    id: "gold",
    name: "Gold",
    subtitle: "High Surgical Performance",
    bullets: [
      "High average validated audit scores",
      "Benchmark-eligible documented cases",
      "Strong consistency across domains",
    ],
    premium: true,
  },
  {
    id: "platinum",
    name: "Platinum",
    subtitle: "Elite Consistency",
    bullets: [
      "Large validated case base",
      "Exceptional transparency and documentation integrity",
      "Sustained high-performance outcomes",
    ],
    premium: true,
  },
];

const howItWorksSteps = [
  "A patient submits a case for review.",
  "The clinic is invited to contribute surgical documentation.",
  "HairAudit recalculates confidence, benchmarking, and transparency metrics.",
  "Validated performance contributes to clinic recognition and award progression.",
];

const whyClinicsJoin = [
  "Strengthen patient trust with evidence-backed transparency",
  "Ensure surgical work is reviewed more fairly and completely",
  "Improve benchmark readiness and forensic confidence",
  "Build a recognised profile within the HairAudit ecosystem",
  "Stand apart from clinics relying only on testimonials or marketing claims",
];

const dashboardPreviewBullets = [
  "Showcase transparency participation clearly",
  "Display validated case and benchmark metrics",
  "Highlight current recognition tier and next milestone",
  "Build trust using evidence instead of marketing claims",
];

const dashboardMetrics = [
  { label: "Transparency Participation Rate", value: "—" },
  { label: "Audited Cases", value: "—" },
  { label: "Doctor-Contributed Cases", value: "—" },
  { label: "Benchmark-Eligible Cases", value: "—" },
  { label: "Average Validated Score", value: "—" },
  { label: "Documentation Integrity", value: "—" },
];

const dashboardImpactItems = [
  "Confidence uplift from documentation",
  "Stronger benchmark readiness",
  "Improved forensic completeness",
  "Higher trust signal for prospective patients",
];

const dashboardChips = [
  "Verified",
  "Benchmark Active",
  "Recognition tier",
  "Validated benchmarks",
];

const commercialValueCards = [
  {
    title: "Stronger Consultation Credibility",
    description:
      "Clinics can support consultations with measurable participation, documented case quality, and validated audit metrics rather than relying only on subjective claims.",
  },
  {
    title: "Better Patient Trust",
    description:
      "Transparency participation helps prospective patients feel that the clinic is willing to stand behind its work with evidence and documentation.",
  },
  {
    title: "Clearer Differentiation",
    description:
      "A recognised HairAudit profile helps distinguish transparent clinics from competitors who rely only on marketing language or selective before-and-after promotion.",
  },
  {
    title: "Long-Term Brand Strength",
    description:
      "As the HairAudit ecosystem grows, recognised clinics may benefit from stronger profile visibility, greater trust signals, and alignment with an evidence-led quality standard.",
  },
];

const faqItems = [
  {
    question: "Does participation guarantee a higher score?",
    answer:
      "No. Participation does not guarantee a higher score. It allows the clinic's work to be assessed more fairly and completely by contributing surgical documentation and procedural context that may improve audit confidence and documentation integrity.",
  },
  {
    question: "Can clinics contribute documentation after a patient submits a case?",
    answer:
      "Yes. Clinics and surgeons can be invited to contribute procedural information after a patient has submitted a case, helping ensure the review reflects the full clinical picture.",
  },
  {
    question: "How are awards determined?",
    answer:
      "Awards are based on validated case performance, transparency participation, documentation quality, benchmark readiness, and consistency over time. They are not based on testimonials or marketing claims.",
  },
  {
    question: "What prevents the system from being gamed?",
    answer:
      "High scores above key thresholds can enter a provisional state before contributing to major awards. Award progression also depends on validated cases, consistency, benchmark-eligible submissions, and anti-gaming safeguards designed to prevent cherry-picking or inflated recognition.",
  },
  {
    question: "Is this linked to payment?",
    answer:
      "No clinic can buy a performance award. Recognition must be earned through evidence, transparency participation, and validated results. Paid services may exist around platform features or program access, but awards themselves are not purchased.",
  },
  {
    question: "Why would a clinic want to participate?",
    answer:
      "Participation supports fairer forensic review, improves confidence in documentation-led cases, strengthens profile credibility, and helps clinics stand apart through evidence-based trust rather than pure promotion.",
  },
];

// ——— Component ———

export default function VerifiedSurgeonTransparencyLanding() {
  const [openFaqIndex, setOpenFaqIndex] = useState<number | null>(0);

  return (
    <div className="min-h-screen bg-[#0a0a0f] text-slate-100">
      {/* Subtle background gradients */}
      <div
        className="fixed inset-0 pointer-events-none"
        aria-hidden
      >
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_80%_50%_at_50%_-20%,rgba(56,189,248,0.08),transparent)]" />
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_60%_40%_at_80%_60%,rgba(139,92,246,0.06),transparent)]" />
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_50%_30%_at_20%_80%,rgba(56,189,248,0.04),transparent)]" />
      </div>

      <main className="relative">
        {/* ——— 1. HERO ——— */}
        <section className="relative px-4 sm:px-6 py-16 sm:py-20 lg:py-28">
          <div className="max-w-7xl mx-auto">
            <nav className="mb-8" aria-label="Breadcrumb">
              <Link
                href="/"
                className="text-sm text-slate-500 hover:text-slate-300 transition-colors"
              >
                ← Home
              </Link>
            </nav>
            <div className="grid lg:grid-cols-2 gap-12 lg:gap-16 items-center">
              {/* Left: badge, headline, CTAs */}
              <div>
                <p className="inline-flex items-center rounded-full border border-cyan-500/30 bg-cyan-500/10 px-4 py-1.5 text-xs font-medium tracking-wide text-cyan-300">
                  HairAudit Verified Surgeon Transparency Program
                </p>
                <h1 className="mt-6 text-3xl sm:text-4xl lg:text-5xl font-bold tracking-tight text-white leading-[1.15]">
                  A new recognition standard for clinics that practice with
                  transparency and surgical excellence.
                </h1>
                <p className="mt-6 text-lg text-slate-400 max-w-xl leading-relaxed">
                  Reward clinics and surgeons who contribute evidence, support
                  fair forensic auditing, and demonstrate consistent standards
                  through validated case performance.
                </p>
                <div className="mt-8 flex flex-wrap gap-4">
                  <Link
                    href="/clinics"
                    className="inline-flex items-center justify-center px-6 py-3.5 rounded-2xl bg-cyan-500 text-slate-950 font-semibold hover:bg-cyan-400 transition-colors shadow-lg shadow-cyan-500/20"
                  >
                    Explore Participating Clinics
                  </Link>
                  <Link
                    href="/signup"
                    className="inline-flex items-center justify-center px-6 py-3.5 rounded-2xl border border-slate-600 text-slate-200 font-medium hover:border-slate-500 hover:bg-white/5 transition-colors"
                  >
                    Apply for Participation
                  </Link>
                  <Link
                    href="#recognition-tiers"
                    className="inline-flex items-center justify-center px-6 py-3.5 rounded-2xl border border-slate-600 text-slate-200 font-medium hover:border-slate-500 hover:bg-white/5 transition-colors"
                  >
                    View Recognition Criteria
                  </Link>
                </div>
                <p className="mt-4 text-sm text-slate-500">
                  <Link href="/how-it-works" className="text-cyan-400 hover:text-cyan-300 transition-colors font-medium">
                    Learn How HairAudit Works
                  </Link>
                  {" — "}step-by-step audit process and transparency ecosystem.
                </p>
              </div>

              {/* Right: premium info cards + stats */}
              <div className="space-y-4">
                {heroCompareCards.map((card) => (
                  <div
                    key={card.title}
                    className={`rounded-2xl border p-5 backdrop-blur-sm transition-shadow hover:shadow-xl ${
                      card.variant === "accent"
                        ? "border-cyan-500/30 bg-cyan-500/5 shadow-cyan-500/5"
                        : "border-white/10 bg-white/5"
                    }`}
                  >
                    <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                      {card.label}
                    </p>
                    <h3 className="mt-1 text-lg font-semibold text-white">
                      {card.title}
                    </h3>
                    <p className="mt-2 text-sm text-slate-400 leading-relaxed">
                      {card.description}
                    </p>
                  </div>
                ))}
                <div className="rounded-2xl border border-white/10 bg-white/5 backdrop-blur-sm p-5">
                  <div className="grid grid-cols-3 gap-4">
                    {heroStats.map((stat) => (
                      <div key={stat.label} className="text-center">
                        <div className="text-2xl sm:text-3xl font-bold text-cyan-400">
                          {stat.value}
                        </div>
                        <div className="mt-0.5 text-xs text-slate-500 font-medium uppercase tracking-wider">
                          {stat.label}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* ——— 2. WHY THIS MATTERS ——— */}
        <section className="relative px-4 sm:px-6 py-20 sm:py-28">
          <div className="max-w-6xl mx-auto">
            <p className="text-xs font-semibold uppercase tracking-wider text-cyan-400">
              Why this matters
            </p>
            <h2 className="mt-3 text-3xl sm:text-4xl font-bold text-white tracking-tight max-w-2xl">
              Not another badge. A structured transparency and excellence
              framework.
            </h2>
            <p className="mt-6 text-slate-400 text-lg max-w-2xl leading-relaxed">
              The program is designed to reward clinics that are willing to be
              measured properly — through contribution, documentation, validated
              outcomes, and consistency.
            </p>
            <div className="mt-12 grid sm:grid-cols-3 gap-6">
              {whyMattersPillars.map((pillar) => (
                <div
                  key={pillar.title}
                  className="rounded-2xl border border-white/10 bg-white/5 backdrop-blur-sm p-6 hover:border-white/15 transition-colors"
                >
                  <h3 className="text-lg font-semibold text-white">
                    {pillar.title}
                  </h3>
                  <p className="mt-3 text-sm text-slate-400 leading-relaxed">
                    {pillar.description}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ——— 3. RECOGNITION TIERS ——— */}
        <section
          id="recognition-tiers"
          className="relative px-4 sm:px-6 py-20 sm:py-28"
        >
          <div className="max-w-6xl mx-auto">
            <p className="text-xs font-semibold uppercase tracking-wider text-cyan-400">
              Recognition tiers
            </p>
            <h2 className="mt-3 text-3xl sm:text-4xl font-bold text-white tracking-tight">
              Awards earned through evidence, not promotion.
            </h2>
            <p className="mt-6 text-slate-400 text-lg max-w-2xl leading-relaxed">
              Awards are tied to validated case contribution, documentation
              integrity, benchmark readiness, and consistent performance over
              time.
            </p>
            <div className="mt-12 grid sm:grid-cols-2 lg:grid-cols-4 gap-6">
              {recognitionTiers.map((tier) => (
                <div
                  key={tier.id}
                  className={`rounded-2xl border p-6 flex flex-col ${
                    tier.premium
                      ? "border-amber-500/30 bg-gradient-to-b from-amber-500/10 to-transparent shadow-lg shadow-amber-500/5"
                      : "border-white/10 bg-white/5 backdrop-blur-sm"
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <span
                      className={`text-xl font-bold ${
                        tier.premium ? "text-amber-400" : "text-white"
                      }`}
                    >
                      {tier.name}
                    </span>
                    {tier.premium && (
                      <span className="rounded-full bg-amber-500/20 px-2 py-0.5 text-xs font-medium text-amber-300">
                        Prestigious
                      </span>
                    )}
                  </div>
                  <p className="mt-1 text-sm font-medium text-slate-500">
                    {tier.subtitle}
                  </p>
                  <ul className="mt-4 space-y-2 flex-1">
                    {tier.bullets.map((bullet) => (
                      <li
                        key={bullet}
                        className="text-sm text-slate-400 flex gap-2"
                      >
                        <span
                          className={
                            tier.premium ? "text-amber-500/80" : "text-cyan-500/80"
                          }
                        >
                          —
                        </span>
                        {bullet}
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ——— 3b. DASHBOARD PREVIEW ——— */}
        <section className="relative px-4 sm:px-6 py-20 sm:py-28">
          <div className="max-w-6xl mx-auto">
            <div className="grid lg:grid-cols-2 gap-12 lg:gap-16 items-start">
              {/* Left: explanatory content */}
              <div>
                <p className="text-xs font-semibold uppercase tracking-wider text-cyan-400">
                  Dashboard Preview
                </p>
                <h2 className="mt-3 text-3xl sm:text-4xl font-bold text-white tracking-tight">
                  See how your clinic could be represented inside the HairAudit
                  ecosystem.
                </h2>
                <p className="mt-6 text-slate-400 text-lg leading-relaxed">
                  A structured profile built from transparency participation,
                  validated case performance, documentation integrity, and
                  benchmark-ready evidence.
                </p>
                <ul className="mt-8 space-y-3">
                  {dashboardPreviewBullets.map((bullet) => (
                    <li key={bullet} className="flex gap-3 text-slate-400">
                      <span className="text-cyan-500 mt-1 shrink-0">✓</span>
                      <span className="leading-relaxed">{bullet}</span>
                    </li>
                  ))}
                </ul>
              </div>

              {/* Right: premium mock dashboard card */}
              <div className="rounded-2xl border border-white/15 bg-slate-900/80 backdrop-blur-sm shadow-2xl shadow-black/20 overflow-hidden">
                {/* Profile header */}
                <div className="p-5 sm:p-6 border-b border-white/10 bg-white/5">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <h3 className="text-lg font-semibold text-white">
                        Example profile layout
                      </h3>
                      <p className="mt-1 text-xs text-slate-500 uppercase tracking-wider">
                        Your metrics appear here when you participate
                      </p>
                    </div>
                    <span className="inline-flex items-center rounded-lg border border-cyan-500/40 bg-cyan-500/15 px-3 py-1.5 text-xs font-semibold text-cyan-300">
                      Verified Transparency Participant
                    </span>
                  </div>
                </div>

                {/* Metric grid */}
                <div className="p-5 sm:p-6 border-b border-white/10">
                  <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-500 mb-3">
                    Profile metrics
                  </p>
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                    {dashboardMetrics.map((m) => (
                      <div
                        key={m.label}
                        className="rounded-xl border border-white/10 bg-white/5 p-3"
                      >
                        <p className="text-[10px] font-medium uppercase tracking-wider text-slate-500 truncate">
                          {m.label}
                        </p>
                        <p className="mt-1 text-lg font-bold text-white tabular-nums">
                          {m.value}
                        </p>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Recognition panel — subtle glow */}
                <div className="p-5 sm:p-6 border-b border-white/10 relative">
                  <div className="absolute inset-0 rounded-b-2xl bg-amber-500/5 pointer-events-none" />
                  <div className="relative">
                    <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-500 mb-3">
                      Recognition
                    </p>
                    <div className="flex flex-wrap items-center gap-4">
                      <div>
                        <p className="text-[10px] font-medium uppercase tracking-wider text-slate-500">
                          Current tier
                        </p>
                        <p className="mt-0.5 text-xl font-bold text-amber-400">
                          —
                        </p>
                      </div>
                      <div className="text-slate-500">→</div>
                      <div>
                        <p className="text-[10px] font-medium uppercase tracking-wider text-slate-500">
                          Next tier
                        </p>
                        <p className="mt-0.5 text-lg font-semibold text-slate-300">
                          —
                        </p>
                      </div>
                    </div>
                    <p className="mt-4 rounded-lg border border-cyan-500/30 bg-cyan-500/10 px-3 py-2 text-sm text-cyan-200">
                      Your next milestone appears here based on validated participation
                    </p>
                  </div>
                </div>

                {/* Impact panel */}
                <div className="p-5 sm:p-6 border-b border-white/10">
                  <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-500 mb-3">
                    Transparency Impact
                  </p>
                  <ul className="space-y-2">
                    {dashboardImpactItems.map((item) => (
                      <li
                        key={item}
                        className="flex gap-2 text-sm text-slate-400"
                      >
                        <span className="text-violet-400 shrink-0">•</span>
                        {item}
                      </li>
                    ))}
                  </ul>
                </div>

                {/* Status chips */}
                <div className="p-5 sm:p-6">
                  <div className="flex flex-wrap gap-2">
                    {dashboardChips.map((chip) => (
                      <span
                        key={chip}
                        className="inline-flex items-center rounded-lg border border-white/15 bg-white/5 px-2.5 py-1 text-xs font-medium text-slate-300"
                      >
                        {chip}
                      </span>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* ——— 3c. WHY THIS MATTERS COMMERCIALLY ——— */}
        <section className="relative px-4 sm:px-6 py-20 sm:py-28">
          <div className="max-w-6xl mx-auto">
            <p className="text-xs font-semibold uppercase tracking-wider text-cyan-400">
              Commercial Advantage
            </p>
            <h2 className="mt-3 text-3xl sm:text-4xl font-bold text-white tracking-tight">
              Why evidence-based recognition matters commercially.
            </h2>
            <p className="mt-6 text-slate-400 text-lg max-w-2xl leading-relaxed">
              In a market crowded by testimonials, social proof, and promotional
              claims, structured transparency creates a stronger and more
              defensible trust signal.
            </p>
            <div className="mt-12 grid sm:grid-cols-2 lg:grid-cols-4 gap-6">
              {commercialValueCards.map((card) => (
                <div
                  key={card.title}
                  className="rounded-2xl border border-white/10 bg-white/5 backdrop-blur-sm p-6 hover:border-white/15 transition-colors"
                >
                  <h3 className="text-lg font-semibold text-white">
                    {card.title}
                  </h3>
                  <p className="mt-3 text-sm text-slate-400 leading-relaxed">
                    {card.description}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ——— 4. HOW IT WORKS ——— */}
        <section className="relative px-4 sm:px-6 py-20 sm:py-28">
          <div className="max-w-6xl mx-auto">
            <div className="grid lg:grid-cols-2 gap-12 lg:gap-16">
              {/* Left: steps */}
              <div className="rounded-2xl border border-white/10 bg-white/5 backdrop-blur-sm p-8">
                <p className="text-xs font-semibold uppercase tracking-wider text-cyan-400">
                  How it works
                </p>
                <h2 className="mt-3 text-2xl sm:text-3xl font-bold text-white tracking-tight">
                  From case upload to recognised surgical transparency.
                </h2>
                <div className="mt-8 space-y-6">
                  {howItWorksSteps.map((step, i) => (
                    <div key={i} className="flex gap-4">
                      <div className="flex-shrink-0 w-10 h-10 rounded-xl bg-cyan-500/20 border border-cyan-500/30 flex items-center justify-center text-cyan-400 font-bold">
                        {i + 1}
                      </div>
                      <p className="text-slate-300 leading-relaxed pt-1.5">
                        {step}
                      </p>
                    </div>
                  ))}
                </div>
              </div>

              {/* Right: why clinics join */}
              <div className="rounded-2xl border border-white/10 bg-white/5 backdrop-blur-sm p-8">
                <p className="text-xs font-semibold uppercase tracking-wider text-cyan-400">
                  Why clinics join
                </p>
                <h2 className="mt-3 text-2xl sm:text-3xl font-bold text-white tracking-tight">
                  A stronger profile built through evidence-backed participation.
                </h2>
                <ul className="mt-8 space-y-3">
                  {whyClinicsJoin.map((item) => (
                    <li
                      key={item}
                      className="flex gap-3 text-slate-400"
                    >
                      <span className="text-cyan-500 mt-1.5 shrink-0">✓</span>
                      <span className="leading-relaxed">{item}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </div>
        </section>

        {/* ——— 5. FAQ ——— */}
        <section id="faq" className="relative px-4 sm:px-6 py-20 sm:py-28">
          <div className="max-w-3xl mx-auto">
            <p className="text-xs font-semibold uppercase tracking-wider text-cyan-400">
              FAQ
            </p>
            <h2 className="mt-3 text-3xl sm:text-4xl font-bold text-white tracking-tight">
              Common questions from clinics and surgeons.
            </h2>
            <p className="mt-6 text-slate-400 text-lg leading-relaxed">
              Clear answers on fairness, scoring, transparency, awards, and
              participation.
            </p>
            <div className="mt-10 space-y-3">
              {faqItems.map((item, index) => {
                const isOpen = openFaqIndex === index;
                return (
                  <div
                    key={index}
                    className={`rounded-2xl border backdrop-blur-sm overflow-hidden transition-colors ${
                      isOpen
                        ? "border-cyan-500/30 bg-white/10"
                        : "border-white/10 bg-white/5 hover:border-white/15"
                    }`}
                  >
                    <button
                      type="button"
                      onClick={() =>
                        setOpenFaqIndex(isOpen ? null : index)
                      }
                      className="w-full flex items-center justify-between gap-4 p-5 sm:p-6 text-left"
                      aria-expanded={isOpen}
                      aria-controls={`faq-answer-${index}`}
                      id={`faq-question-${index}`}
                    >
                      <span className="font-semibold text-white pr-4">
                        {item.question}
                      </span>
                      <span
                        className={`flex-shrink-0 w-8 h-8 rounded-lg flex items-center justify-center text-cyan-400 transition-transform ${
                          isOpen ? "bg-cyan-500/20 rotate-180" : "bg-white/10"
                        }`}
                        aria-hidden
                      >
                        <svg
                          width="16"
                          height="16"
                          viewBox="0 0 16 16"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="2"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        >
                          <path d="M4 6l4 4 4-4" />
                        </svg>
                      </span>
                    </button>
                    <div
                      id={`faq-answer-${index}`}
                      role="region"
                      aria-labelledby={`faq-question-${index}`}
                      className={`grid transition-[grid-template-rows] duration-200 ease-out ${
                        isOpen ? "grid-rows-[1fr]" : "grid-rows-[0fr]"
                      }`}
                    >
                      <div className="min-h-0 overflow-hidden">
                        <div className="border-t border-white/10 px-5 sm:px-6 pb-5 sm:pb-6 pt-0">
                          <p className="pt-4 text-slate-400 leading-relaxed">
                            {item.answer}
                          </p>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </section>

        {/* ——— 6. FINAL CTA ——— */}
        <section className="relative px-4 sm:px-6 py-20 sm:py-28">
          <div className="max-w-4xl mx-auto">
            <div className="rounded-3xl border border-cyan-500/20 bg-gradient-to-b from-cyan-500/10 to-violet-500/5 p-8 sm:p-12 text-center backdrop-blur-sm">
              <p className="text-xs font-semibold uppercase tracking-wider text-cyan-400">
                For clinics and surgeons
              </p>
              <h2 className="mt-3 text-2xl sm:text-3xl lg:text-4xl font-bold text-white tracking-tight">
                Join the movement toward fairer, more transparent recognition in
                hair restoration.
              </h2>
              <p className="mt-6 text-slate-400 text-lg max-w-2xl mx-auto leading-relaxed">
                Position your clinic at the forefront of evidence-based trust.
                Contribute documentation, support complete forensic review, and
                become eligible for HairAudit recognition tiers.
              </p>
              <div className="mt-10 flex flex-wrap justify-center gap-4">
                <Link
                  href="/signup"
                  className="inline-flex items-center justify-center px-6 py-3.5 rounded-2xl bg-cyan-500 text-slate-950 font-semibold hover:bg-cyan-400 transition-colors shadow-lg shadow-cyan-500/20"
                >
                  Apply for Participation
                </Link>
                <Link
                  href="/clinics"
                  className="inline-flex items-center justify-center px-6 py-3.5 rounded-2xl border border-slate-600 text-slate-200 font-medium hover:border-slate-500 hover:bg-white/5 transition-colors"
                >
                  Explore Participating Clinics
                </Link>
                <Link
                  href="/how-it-works"
                  className="inline-flex items-center justify-center px-6 py-3.5 rounded-2xl border border-slate-600 text-slate-200 font-medium hover:border-slate-500 hover:bg-white/5 transition-colors"
                >
                  Learn How HairAudit Works
                </Link>
              </div>
            </div>
          </div>
        </section>
      </main>
    </div>
  );
}
