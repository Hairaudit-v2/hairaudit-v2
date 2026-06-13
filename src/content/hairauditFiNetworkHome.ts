/**
 * HairAudit homepage marketing copy for the Follicle Intelligence Network shell.
 * Keep product-specific narrative here; shared primitives live in `packages/ui`.
 */

export const HA_FI_HOME = {
  hero: {
    eyebrow: "Outcome verification · Surgical intelligence · Quality assurance",
    title: "The global quality assurance platform for hair restoration.",
    subtitle:
      "Measure surgical quality, verify outcomes and create trusted, evidence-based accountability across the hair restoration industry.",
    ctaClinic: "Request clinic access",
    ctaNetwork: "Explore the network",
  },
  trust: {
    eyebrow: "Trust & accountability",
    title: "Marketing photos are not clinical evidence.",
    description:
      "HairAudit is built for verification infrastructure — structured capture, reviewer discipline, and reporting you can stand behind in disputes, QA programmes and long-term outcome programmes.",
    problem: {
      title: "The problem",
      body:
        "Hair restoration outcomes are often judged by marketing photos, inconsistent follow-up and subjective claims.",
    },
    solution: {
      title: "The solution",
      body: "HairAudit turns each procedure into structured evidence — graft counts, density, growth, donor recovery, patient satisfaction and long-term outcome tracking.",
    },
  },
  intelligence: {
    eyebrow: "Intelligence layer",
    title: "Surgical intelligence, captured as evidence.",
    description:
      "A shared language for what happened in surgery — and what it means for growth, aesthetics and donor stewardship over time.",
    layers: [
      { title: "Surgical evidence capture", description: "Standardised intake, timelines and photo discipline so cases are comparable." },
      { title: "Growth and survival tracking", description: "Structured follow-up signals that separate shock loss from graft failure risk." },
      { title: "Donor recovery assessment", description: "Extraction pattern, density impact and long-term donor stewardship indicators." },
      { title: "Hairline design review", description: "Angles, transition zones and facial framing reviewed against clinical realism." },
      { title: "Patient satisfaction scoring", description: "Outcome perception captured alongside objective surgical markers." },
      { title: "Clinic and surgeon benchmarking", description: "Participation frameworks that reward transparency — not promotional ranking." },
    ],
  },
  audience: {
    eyebrow: "Who it is for",
    title: "Built for the teams who own surgical quality.",
    description:
      "HairAudit helps clinics, surgeons and patients measure surgical quality, verify outcomes and build trust through structured evidence.",
    segments: [
      {
        title: "Clinics",
        description: "QA programmes, internal audits, transparency packs and patient trust artefacts.",
        bullets: ["Operational consistency", "Risk-aware documentation", "Participation-ready reporting"],
      },
      {
        title: "Surgeons",
        description: "Defensible review of technique, design decisions and donor management — independent of marketing.",
        bullets: ["Peer-comparable structure", "Evidence-first narrative", "Training and remediation support"],
      },
      {
        title: "Patients",
        description: "Clear, structured review when outcomes are uncertain — without clinic sales pressure.",
        bullets: ["Plain-language reporting", "Confidence-aware findings", "Next-step guidance"],
      },
      {
        title: "Training organisations",
        description: "A verification-aligned standard for competency evidence and longitudinal outcome discipline.",
        bullets: ["Structured case evidence", "Auditability by design", "Network-grade consistency"],
      },
    ],
  },
  ecosystem: {
    eyebrow: "Ecosystem",
    title: "Connected to the Follicle Intelligence Network.",
    description:
      "HairAudit sits alongside Follicle Intelligence OS, HLI and IIOHR — and publishes into the Global Intelligence Network so verification compounds across regions and time.",
  },
  metrics: {
    eyebrow: "Operating model",
    title: "Verification infrastructure — not a review site.",
    items: [
      { label: "Evidence posture", value: "Structured", hint: "Defined inputs, timelines and reviewer discipline." },
      { label: "Independence", value: "Clear", hint: "Reporting separated from clinic promotion and sales incentives." },
      { label: "Comparability", value: "Network-grade", hint: "Criteria-aligned signals designed for benchmarking." },
    ],
  },
  finalCta: {
    eyebrow: "Access",
    title: "Build trust with measurable outcomes.",
    description: "Request HairAudit access for clinic programmes, surgeon QA workflows or patient verification.",
    button: "Request HairAudit access",
  },
} as const;
