export type PatientIssueContent = {
  slug: string;
  title: string;
  description: string;
  intro: string;
  explanations: string[];
  summaryPoints: string[];
  seekReviewPoints: string[];
  faqs: Array<{
    question: string;
    answer: string;
  }>;
  /** Patient-intent article slugs and/or other issue slugs for hub-style cross-links */
  relatedGuideSlugs?: string[];
};

export const patientIssueLibrary: PatientIssueContent[] = [
  {
    slug: "hair-transplant-too-thin",
    title: "Hair Transplant Looks Too Thin (Quick Guide)",
    description:
      "Short orientation when a transplant looks thin: typical timelines, how density differs from graft survival, and when independent photo review helps. Links to a long-form density guide for depth.",
    intro:
      "A thin appearance does not always mean surgery failed. Growth can still be maturing; native hair can change; planning and placement can also limit cosmetic density. This page is a concise landing overview. For spacing, calibre, lighting effects, and when judgement is fair, read [hair transplant density too low: delay or quality problem?](/hair-transplant-density-too-low).",
    explanations: [
      "Many patients need many months before transplanted hair reaches mature calibre and coverage. If you are early in recovery, thinness may still improve.",
      "If density still looks low after the usual growth window, common contributors include low cosmetic yield from grafts, conservative graft counts for the area, placement strategy, or ongoing native hair thinning—not one single explanation.",
      "Structured review helps separate timeline effects from quality signals using dated photos, donor context, and recipient pattern—not a mirror snapshot alone.",
    ],
    summaryPoints: [
      "Thin appearance can be temporary early on.",
      "Persistent thinness can reflect planning, yield, or native hair change.",
      "Photo timeline quality changes how much can be concluded.",
      "Independent review clarifies what the evidence supports today.",
    ],
    seekReviewPoints: [
      "Density remains clearly low late in the expected maturation window.",
      "Visible scalp stays widespread in transplanted zones as months pass.",
      "Clinic explanations do not match what you see across your timeline.",
      "You want neutral documentation before corrective discussions.",
    ],
    faqs: [
      {
        question: "How long should I wait before judging final density?",
        answer:
          "Many results mature over roughly nine to twelve months; some change a little beyond that. Your surgeon’s follow-up plan still matters.",
      },
      {
        question: "Can medication affect density outcomes?",
        answer:
          "Yes. Ongoing native hair loss can change appearance even when transplanted grafts survive.",
      },
      {
        question: "Can HairAudit tell me if I need a second surgery?",
        answer:
          "HairAudit provides independent evidence review and documentation. Treatment decisions belong with your clinician.",
      },
    ],
    relatedGuideSlugs: [
      "hair-transplant-density-too-low",
      "when-is-a-hair-transplant-final",
      "why-does-my-hair-transplant-look-worse-in-bright-light",
    ],
  },
  {
    slug: "hair-transplant-not-growing",
    title: "Hair Transplant Not Growing: Normal Delay or Red Flag?",
    description:
      "Shedding and slow regrowth are common early. This short guide frames when limited growth may still fit normal variation—and when structured review helps interpret your photos fairly.",
    intro:
      "After surgery, shedding is common and regrowth can start gradually; timelines vary. This page highlights useful mileposts without turning anxiety into a premature verdict. For shedding versus longer-term yield, read [shock loss vs graft failure](/shock-loss-vs-graft-failure). For a timeline-focused discussion of when delay is more concerning, read [when is hair transplant growth delay normal vs concerning?](/when-is-hair-transplant-growth-delay-normal-vs-concerning).",
    explanations: [
      "A common pattern is shedding in the first months, then gradual regrowth as fine hairs emerge and thicken—speed differs between people.",
      "If improvement stays very limited across later follow-up photos, the timeline may deserve closer scrutiny alongside day 0 documentation and donor context.",
      "Poor yield, trauma, healing issues, and missing photos can all affect interpretation—photos do not prove every biological detail alone.",
    ],
    summaryPoints: [
      "Early shedding is often part of recovery.",
      "Growth curves vary; total absence of progress over time raises concern.",
      "Consistent lighting and angles improve review quality.",
      "Independent assessment can organize what your timeline appears to show.",
    ],
    seekReviewPoints: [
      "Very limited visible progress well into the later growth window.",
      "No meaningful cosmetic improvement when maturity would usually be expected.",
      "Patchy non-growth patterns with uneven zones.",
      "You want clear evidence before difficult clinic conversations.",
    ],
    faqs: [
      {
        question: "Is minimal visible growth at a few months post-op always a failure?",
        answer:
          "Not always. Some patients start slower. Context, shedding history, and dated photos matter.",
      },
      {
        question: "Can shock loss look like failed growth?",
        answer:
          "Yes. Temporary thinning can delay how improvement looks even when follicles are still viable.",
      },
      {
        question: "What evidence should I upload for review?",
        answer:
          "Pre-op, immediate post-op, donor views, and monthly progress photos with similar angles and lighting.",
      },
    ],
    relatedGuideSlugs: [
      "when-is-hair-transplant-growth-delay-normal-vs-concerning",
      "shock-loss-vs-graft-failure",
      "when-is-a-hair-transplant-final",
      "hair-transplant-graft-failure",
    ],
  },
  {
    slug: "hair-transplant-donor-overharvested",
    title: "Donor Overharvesting After FUE: Concise Signs & Context",
    description:
      "FUE donor areas can look patchy or thin for several reasons, including normal healing and haircut effects. Learn what may suggest overharvesting versus appearance that may still settle, and when independent review helps.",
    intro:
      "Patients often search specifically about the FUE donor area. Some post-operative change is expected; uneven extraction or aggressive harvesting can produce lasting donor thinning. This short page orients you quickly. For donor patterns and documentation, read [overharvested donor area: what to look for](/overharvested-donor-area). For typical healing versus appearances that merit scrutiny, read [normal donor healing after FUE](/normal-donor-healing-after-fue).",
    explanations: [
      "Overharvesting often appears as uneven density, visible patchiness, or scalp show-through in the donor when hair is worn short—but lighting and length change perception.",
      "Not every thin donor appearance means severe structural loss. A timeline helps distinguish healing-related change from long-term homogeneity problems.",
      "Independent review compares donor photos over time to describe whether extraction pattern appears conservative, concentrated, or visually disproportionate—within photo limits.",
    ],
    summaryPoints: [
      "Donor safety affects long-term options.",
      "Patchy zones may reflect concentrated extraction.",
      "Hair length and lighting strongly affect donor reads.",
      "Timeline documentation reduces single-photo misreads.",
    ],
    seekReviewPoints: [
      "Persistent patchy donor appearance after healing has settled.",
      "You avoid short styles because extraction pattern is visible.",
      "You worry donor reserve is compromised before another procedure.",
      "You want objective records for clinical discussions.",
    ],
    faqs: [
      {
        question: "Can donor thinning look better over time?",
        answer:
          "Some appearance changes improve as hair lengthens, but extraction-related homogeneity problems may remain visible.",
      },
      {
        question: "Is overharvesting only an FUE issue?",
        answer:
          "It is discussed most often with FUE extraction patterns, but donor stewardship matters for any harvesting approach.",
      },
      {
        question: "Can HairAudit measure exact donor depletion?",
        answer:
          "HairAudit provides structured visual assessment and documentation. Exact counts may require in-person clinical tools.",
      },
    ],
    relatedGuideSlugs: [
      "overharvested-donor-area",
      "normal-donor-healing-after-fue",
      "shock-loss-vs-graft-failure",
    ],
  },
  {
    slug: "bad-hair-transplant-hairline",
    title: "Hairline Concerns After Hair Transplant (Quick Guide)",
    description:
      "Shape, angle, density transition, and temple framing affect whether a hairline looks believable. A fast overview—plus when independent review may clarify design and photographic evidence.",
    intro:
      "Hairline concerns are often about softness, proportions, and transitions—not only height. Early results can look harsh before maturation. For a deeper read focused on unnatural patterns, see [unnatural hairline after hair transplant](/unnatural-hairline-after-hair-transplant). For naturalness cues beyond the hairline alone, see [what makes a hair transplant look natural](/what-makes-a-hair-transplant-look-natural).",
    explanations: [
      "Common concerns include an overly straight edge, abrupt density steps, low placement for age and facial balance, or angulation that fights natural flow.",
      "Some harshness can soften as hair matures, but structural design limits may persist.",
      "Close frontal and oblique photos help separate temporary recovery appearance from durable design issues.",
    ],
    summaryPoints: [
      "The hairline is one of the most visible quality markers.",
      "Early harshness does not always equal final design failure.",
      "Direction and transition matter as much as line shape.",
      "Independent review can document what appears visible in photos.",
    ],
    seekReviewPoints: [
      "The hairline still looks unnatural late in maturation.",
      "Pluggy or abrupt transition remains obvious in consistent photos.",
      "Design feels misaligned with facial proportions.",
      "You want technical documentation before corrective planning.",
    ],
    faqs: [
      {
        question: "Can a harsh hairline soften naturally?",
        answer:
          "Sometimes, while calibre and styling improve. If harshness persists late in recovery, concern is more significant.",
      },
      {
        question: "Does a low hairline always mean poor surgery?",
        answer:
          "Not always. Suitability depends on age, donor reserve, and long-term loss planning.",
      },
      {
        question: "Can this be corrected?",
        answer:
          "Some cases can improve with careful planning. HairAudit can provide objective evidence to support that discussion.",
      },
    ],
    relatedGuideSlugs: [
      "unnatural-hairline-after-hair-transplant",
      "what-makes-a-hair-transplant-look-natural",
      "temple-work-and-frontal-framing",
    ],
  },
  {
    slug: "hair-transplant-graft-failure",
    title: "Signs a Hair Transplant May Have Failed: Survival, Timing & Evidence",
    description:
      "Worried grafts did not survive? How timing, shedding, and visible growth interact—what photos may suggest, what they cannot prove alone, and how independent review structures evidence (not a diagnosis).",
    intro:
      "\"Failed transplant\" is not one narrow pattern. Poor growth can overlap with normal delay, shock shedding, or unmet density expectations. This concise page focuses on survival concerns and timing. Compare shedding with longer-term yield in [shock loss vs graft failure](/shock-loss-vs-graft-failure). For evidence limits from photography, read [hair transplant graft failure: what photos can and cannot show](/hair-transplant-graft-failure-what-photos-can-and-cannot-show). If you are weighing revision versus waiting, see [repair vs wait after poor hair transplant growth](/repair-vs-wait-after-poor-hair-transplant-growth).",
    explanations: [
      "Low survival can be partial or widespread and may involve multiple technical and healing factors; photos cannot prove every microscopic detail.",
      "The same sparse appearance can mean different things at different months—timing matters when interpreting concern.",
      "Independent review describes visible patterns and confidence limits rather than replacing your surgeon’s clinical judgement.",
    ],
    summaryPoints: [
      "Slow growth is not automatically graft failure.",
      "Failure-style patterns are interpreted with timeline evidence.",
      "Technical and healing factors can both affect outcomes.",
      "Neutral documentation supports next-step conversations.",
    ],
    seekReviewPoints: [
      "Minimal growth in major transplanted zones when maturity would usually be expected.",
      "Large mismatch between claimed graft count and visible cosmetic yield—documented as well as possible.",
      "Broad non-survival concern rather than a single slow zone.",
      "You want a neutral record before corrective consultation.",
    ],
    faqs: [
      {
        question: "Can graft failure be proven from photos alone?",
        answer:
          "Photos can support visible patterns strongly, but conclusions depend on evidence quality and timeline completeness.",
      },
      {
        question: "Could poor growth still improve after the first year?",
        answer:
          "Meaningful change is less common after late timelines, though small shifts can occur.",
      },
      {
        question: "What is the benefit of independent review?",
        answer:
          "It provides structured, unbiased documentation of what the evidence appears to show—useful for planning discussions.",
      },
    ],
    relatedGuideSlugs: [
      "shock-loss-vs-graft-failure",
      "hair-transplant-graft-failure-what-photos-can-and-cannot-show",
      "repair-vs-wait-after-poor-hair-transplant-growth",
      "when-is-hair-transplant-growth-delay-normal-vs-concerning",
    ],
  },
];
