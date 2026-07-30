import type { PatientIntentArticle } from "./types";
import { buildDonorHealingChooserHref } from "@/lib/patient/patientEntryContext";

export const normalDonorHealingAfterFueArticle: PatientIntentArticle = {
  slug: "normal-donor-healing-after-fue",
  pathname: "/normal-donor-healing-after-fue",
  seoTitle: "Normal Donor Healing After FUE: Timeline & When to Worry | HairAudit",
  metaDescription:
    "What often looks compatible with FUE donor healing versus patterns that may deserve closer attention—six-stage timeline, photo guidance, and when independent review can help.",
  h1: "Normal Donor Healing After FUE: What Often Looks Concerning (But Is Not Always)",
  intro:
    "The donor area after FUE can look red, speckled, or temporarily thinner while follicles recover and hair regrows at different speeds. Patients often worry about overharvesting when they are still seeing normal post-operative change. This guide separates common healing appearances from donor patterns that may warrant a more structured look at your photos—not a diagnosis, but clearer framing of what the visible evidence can support.",
  shortAnswer:
    "Early FUE donor redness, crusting, and a dotted or thinner look often fit the reported healing stage, especially with short hair and harsh lighting. Overharvesting concerns are more about long-term homogeneity, concentrated patchiness once healing has settled, and how the donor reads across dated photos—not about how alarming a single early-week image feels.",
  keyTakeaways: [
    "Timeline matters: early roughness is not the same conversation as late donor depletion patterns.",
    "Hair length and lighting change how ‘thin’ the donor appears in photos.",
    "Rear, left, and right donor views support a fairer independent review than one photograph.",
    "For contrast, read [overharvested donor area: what to look for](/overharvested-donor-area) and the short [donor overharvesting overview](/hair-transplant-donor-overharvested)—with consistent dated photos.",
    "Photo review clarifies what the evidence supports; it does not replace clinical donor metrics.",
  ],
  experience: "donor_healing",
  sections: [
    {
      id: "why-donor-anxiety",
      heading: "Why donor anxiety is so common after FUE",
      blocks: [
        {
          type: "p",
          text: "FUE leaves many small extraction sites. During healing, the donor can look different from day to day depending on swelling, crusting, lighting, hair length, and camera angle. Short hair makes the scalp easier to see, which can amplify concern even when density is within an acceptable range for that stage.",
        },
      ],
    },
    {
      id: "early-healing",
      heading: "Early healing: what patients often notice first",
      blocks: [
        {
          type: "p",
          text: "In the first weeks, redness, small scabs or crusts, and a “dotted” appearance can be part of routine healing. Some patients also notice temporary thinning from stress-related shedding around the donor. That does not automatically mean follicles were destroyed at scale; it can reflect a shock response that improves as the months pass.",
        },
        {
          type: "p",
          text: "If your clinic gave you a recovery timetable, it is reasonable to follow it—but photos still matter because everyone heals on a slightly different curve.",
        },
      ],
    },
    {
      id: "later-donor-read",
      heading: "Later donor appearance: when the long-term pattern starts to show",
      blocks: [
        {
          type: "p",
          text: "As hair lengthens and inflammation settles, the donor usually looks more uniform. The question patients are really asking at this stage is whether the donor still looks naturally homogeneous—whether thinning looks evenly distributed or concentrated in visible patches under neutral lighting.",
        },
        {
          type: "p",
          text: "For donor-focused warning patterns and documentation tips, read [overharvested donor area: what to look for](/overharvested-donor-area). For shedding confusion that can affect both donor and recipient reads, see [shock loss vs graft failure](/shock-loss-vs-graft-failure).",
        },
      ],
    },
    {
      id: "not-the-same-as-overharvesting",
      heading: "Normal healing is not the same conversation as overharvesting",
      blocks: [
        {
          type: "p",
          text: "Overharvesting concerns are usually about extraction distribution, donor reserve, and whether thinning appears disproportionate once healing has progressed—not about whether the donor looked rough for a period right after surgery.",
        },
        {
          type: "p",
          text: "A concise issue-oriented overview lives on [donor overharvesting after FUE](/hair-transplant-donor-overharvested).",
        },
      ],
    },
    {
      id: "photos-help",
      heading: "Photos that make donor interpretation more reliable",
      blocks: [
        {
          type: "p",
          text: "The most useful donor documentation usually includes rear and side views, consistent lighting, multiple time points, and more than one hair length if you can manage it. A full checklist is on [what photos are needed for a proper hair transplant review](/what-photos-are-needed-for-a-proper-hair-transplant-review).",
        },
      ],
    },
    {
      id: "limits",
      heading: "Limits of photo-based review",
      blocks: [
        {
          type: "p",
          text: "Photos can support structured observations about visible density patterns and how they change over time. They do not replace an in-person clinical exam when your surgeon needs to assess skin quality, scarring, or other factors directly.",
        },
        {
          type: "p",
          text: "If you want an independent, evidence-based read of your timeline, you can begin a donor-focused Post-Surgery Audit from this page, or [view a sample HairAudit report](/demo-report).",
        },
      ],
    },
  ],
  faqs: [
    {
      question: "How long does the FUE donor area take to heal?",
      answer:
        "Surface healing often progresses over days to a few weeks, while a clearer long-term donor pattern usually needs several months and fairer hair length. Exact timing varies; photographs help document change but do not replace your clinic’s advice.",
    },
    {
      question: "Why does my donor area look patchy after FUE?",
      answer:
        "Short hair, lighting, temporary shedding, and uneven early regrowth can all make the donor look patchy. Persistent concentrated irregularity after healing has settled may deserve structured review with rear and side views.",
    },
    {
      question: "Can donor shock loss recover?",
      answer:
        "Temporary donor shedding can improve over months for many patients. Photos across dates help frame the trend, but recovery is individual and is not guaranteed by any online guide.",
    },
    {
      question: "When can donor overharvesting be assessed reliably?",
      answer:
        "Early post-operative roughness is usually the wrong moment for that conversation. A more reliable discussion tends to wait until healing has settled and multi-view, dated photographs are available—and still does not replace clinical donor metrics.",
    },
    {
      question: "What donor photographs are needed for an independent review?",
      answer:
        "Rear, left, and right donor views are the priority for a donor-focused review. Optional close-ups and earlier donor images add context. Neutral lighting, dry hair, and consistent distance improve reliability. Recipient views may still be needed for a complete Post-Surgery Audit.",
    },
    {
      question: "When should I contact a doctor about my donor area?",
      answer:
        "Increasing pain, spreading redness, discharge, fever, persistent bleeding, or rapidly worsening swelling are better assessed directly rather than from photographs alone. Contact your treating clinic, local doctor, or urgent medical service depending on severity.",
    },
    {
      question: "Can bright lighting make the donor area look thinner?",
      answer:
        "Yes. Harsh overhead or bright directional light can increase scalp contrast and make short-haired donor zones look thinner than they feel under gentler indoor light. Neutral lighting and consistent distance support a fairer comparison.",
    },
    {
      question: "Can HairAudit confirm overharvesting from one photograph?",
      answer:
        "No. A single image is often not enough evidence. HairAudit helps organise what the available photographs can support and when closer clinical assessment is sensible. It does not confirm overharvesting, infection, or remaining graft capacity from photos alone.",
    },
  ],
  ctaLead: "Unsure whether your donor pattern looks like expected healing for your stage?",
  ctaSupporting:
    "Start a donor-focused Post-Surgery Audit. You will confirm your review type before a case is created—HairAudit will not invent a third pathway or declare overharvesting from this page.",
  cta: {
    label: "Check My Donor Healing",
    href: buildDonorHealingChooserHref(),
    analyticsId: "donor_cta_clicked",
    destination: "/request-review",
    entryContext: "donor_healing",
    recommendedPathway: "post_surgery",
  },
  relatedSlugs: [
    "overharvested-donor-area",
    "hair-transplant-donor-overharvested",
    "shock-loss-vs-graft-failure",
    "what-photos-are-needed-for-a-proper-hair-transplant-review",
    "donor-reserve-and-future-options",
  ],
};
