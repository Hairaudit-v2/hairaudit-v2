export type PatientEducationOption = {
  title: string;
  whatItIs: string;
  whyItMayMatter: string;
  longTermGoal: string;
};

export type PatientLongTermHairEducation = {
  sectionTitle: string;
  intro: string;
  whyLongTermMatters: string;
  donorAgeingTitle: string;
  donorAgeingExplanation: string;
  options: PatientEducationOption[];
  calloutLine: string;
  closing: string;
};

export function buildPatientLongTermHairEducation(): PatientLongTermHairEducation {
  return {
    sectionTitle: "Protecting Native Hair and Future Donor Options",
    intro:
      "Hair transplant outcomes are often strongest when paired with long-term preservation. This section is educational and designed to support a focused discussion with your qualified clinician.",
    whyLongTermMatters:
      "A transplant usually redistributes available hair but does not usually stop ongoing hair loss. Surrounding native hair may still thin over time. Protecting native hair and donor quality is therefore part of long-term planning, not a short-term add-on.",
    donorAgeingTitle: "Donor ageing and hair-to-graft ratio",
    donorAgeingExplanation:
      "Donor hair quality can change with age. In some patients, donor hairs become finer and donor density reduces over time. That can lower hair-to-graft ratios, meaning each graft may carry fewer robust hairs and may deliver less cosmetic impact in future procedures. This is especially important for patients with high prior harvesting volumes, such as 5000 grafts or more, because donor reserve is already more committed.",
    options: [
      {
        title: "DHT inhibitors / DHT management",
        whatItIs:
          "Medication-based DHT management is used in suitable patients to reduce androgen-driven miniaturization.",
        whyItMayMatter:
          "It may be worth discussing to help protect surrounding native hair and, in suitable patients, may also help preserve donor-hair quality depending on clinical suitability.",
        longTermGoal:
          "Stabilize the wider hair field and reduce pressure on donor reserves for future planning.",
      },
      {
        title: "LED light therapy",
        whatItIs:
          "Low-level light therapy is a non-invasive supportive approach used in some maintenance plans.",
        whyItMayMatter:
          "It may support overall hair maintenance when used consistently in a broader clinician-guided strategy, depending on clinical suitability.",
        longTermGoal:
          "Support day-to-day preservation so future donor demand may be lower.",
      },
      {
        title: "PRP with microneedling",
        whatItIs:
          "Platelet-rich plasma with microneedling is a clinic-based adjunct used in selected patients.",
        whyItMayMatter:
          "Some patients use it to support hair caliber and maintenance, although response can vary and should be reviewed in context.",
        longTermGoal:
          "Improve long-term preservation consistency around transplanted zones.",
      },
      {
        title: "Exosomes with microneedling",
        whatItIs:
          "An emerging adjunctive approach discussed in some clinics, often paired with microneedling.",
        whyItMayMatter:
          "Evidence and protocols vary, so individualized discussion is important to keep expectations realistic and patient-safe.",
        longTermGoal:
          "Consider whether this fits a broader preservation strategy focused on future donor options.",
      },
      {
        title: "Donor protection strategy",
        whatItIs:
          "A conservative planning approach that treats the donor area as a limited long-term reserve.",
        whyItMayMatter:
          "Protecting donor quality and density can help maintain flexibility if future procedures are ever needed, especially after higher historical harvesting.",
        longTermGoal:
          "Preserve hair-to-graft value and protect future transplant options.",
      },
    ],
    calloutLine: "Saving hair today may protect your donor tomorrow.",
    closing:
      "These options are educational discussion points, not direct prescriptions. Build your long-term plan with a qualified clinician to protect native hair, preserve donor reserve, and keep future transplant options stronger over time.",
  };
}
