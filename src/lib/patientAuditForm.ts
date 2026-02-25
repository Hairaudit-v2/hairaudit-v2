// Patient Audit Form v2 — streamlined, data-rich, ~5–6 min
// Optimized for patients who may not know technical details
// "Not Sure" / "Not clear" options to avoid bad data

export type PatientAuditAnswers = Record<string, string | number | string[] | boolean | null>;

export const PATIENT_AUDIT_SECTIONS = [
  {
    id: "clinic_procedure",
    title: "Clinic & Procedure Details",
    questions: [
      { id: "clinic_name", prompt: "Clinic Name", type: "text", placeholder: "ABC Hair Clinic", required: true },
      {
        id: "clinic_country",
        prompt: "Clinic Country",
        type: "select",
        options: [
          { value: "turkey", label: "Turkey" },
          { value: "spain", label: "Spain" },
          { value: "india", label: "India" },
          { value: "thailand", label: "Thailand" },
          { value: "mexico", label: "Mexico" },
          { value: "brazil", label: "Brazil" },
          { value: "argentina", label: "Argentina" },
          { value: "colombia", label: "Colombia" },
          { value: "australia", label: "Australia" },
          { value: "uk", label: "United Kingdom" },
          { value: "usa", label: "United States" },
          { value: "canada", label: "Canada" },
          { value: "uae", label: "UAE" },
          { value: "belgium", label: "Belgium" },
          { value: "germany", label: "Germany" },
          { value: "poland", label: "Poland" },
          { value: "greece", label: "Greece" },
          { value: "other", label: "Other" },
        ],
        required: true,
      },
      {
        id: "clinic_country_other",
        prompt: "Clinic country (if Other)",
        type: "text",
        placeholder: "e.g. Portugal",
        required: false,
        dependsOn: { questionId: "clinic_country", value: "other" },
      },
      { id: "clinic_city", prompt: "Clinic City", type: "text", placeholder: "Istanbul", required: true },
      { id: "procedure_date", prompt: "Date of Procedure", type: "date", required: true },
      {
        id: "procedure_type",
        prompt: "Type of Procedure",
        type: "select",
        options: [
          { value: "fue", label: "FUE" },
          { value: "fut", label: "FUT" },
          { value: "dhi", label: "DHI" },
          { value: "robotic", label: "Robotic" },
          { value: "not_sure", label: "Not Sure" },
          { value: "other", label: "Other" },
        ],
        required: true,
        help: "Choose what you were told; 'Not Sure' is okay.",
      },
      {
        id: "procedure_type_other",
        prompt: "Procedure type (if Other)",
        type: "text",
        placeholder: "e.g. Combined",
        required: false,
        dependsOn: { questionId: "procedure_type", value: "other" },
      },
      { id: "surgeon_name", prompt: "Surgeon's Name (optional)", type: "text", placeholder: "Dr. Smith", required: false },
      { id: "patient_name", prompt: "Your Name (optional, for privacy)", type: "text", placeholder: "John Doe", required: false },
    ],
  },
  {
    id: "transparency",
    title: "Transparency & Process",
    questions: [
      { id: "preop_consult", prompt: "Did you have a pre-operative consultation?", type: "yesno", required: true },
      {
        id: "doctor_present_extraction",
        prompt: "Was a doctor present during graft extraction?",
        type: "select",
        options: [
          { value: "yes", label: "Yes" },
          { value: "no", label: "No" },
          { value: "not_sure", label: "Not Sure" },
        ],
        required: true,
      },
      {
        id: "doctor_present_implant",
        prompt: "Was a doctor present during graft implantation?",
        type: "select",
        options: [
          { value: "yes", label: "Yes" },
          { value: "no", label: "No" },
          { value: "not_sure", label: "Not Sure" },
        ],
        required: true,
      },
      { id: "graft_number_disclosed", prompt: "Were you told the graft count?", type: "yesno", required: true },
      {
        id: "graft_number_received",
        prompt: "Graft number (if you were given one)",
        type: "number",
        min: 0,
        max: 20000,
        placeholder: "e.g. 3500",
        required: false,
        help: "Only if you were given a number.",
      },
      {
        id: "donor_shaving",
        prompt: "Donor area shaving",
        type: "select",
        options: [
          { value: "full_shave", label: "Yes (full shave)" },
          { value: "partial_shave", label: "Partial shave" },
          { value: "no", label: "No" },
        ],
        required: true,
      },
      {
        id: "surgery_duration",
        prompt: "Surgery duration",
        type: "select",
        options: [
          { value: "under_4h", label: "Less than 4 hours" },
          { value: "4_6h", label: "4–6 hours" },
          { value: "6_8h", label: "6–8 hours" },
          { value: "8_plus", label: "8+ hours" },
        ],
        required: true,
      },
    ],
  },
  {
    id: "cost",
    title: "Cost & Value Transparency",
    questions: [
      {
        id: "total_paid_currency",
        prompt: "Currency",
        type: "select",
        options: [
          { value: "usd", label: "USD ($)" },
          { value: "eur", label: "EUR (€)" },
          { value: "gbp", label: "GBP (£)" },
          { value: "try", label: "TRY (₺)" },
          { value: "inr", label: "INR (₹)" },
          { value: "thb", label: "THB (฿)" },
          { value: "mxn", label: "MXN ($)" },
          { value: "aud", label: "AUD ($)" },
          { value: "other", label: "Other" },
        ],
        required: true,
      },
      {
        id: "total_paid_currency_other",
        prompt: "Currency (if Other)",
        type: "text",
        placeholder: "e.g. CAD, CHF",
        required: false,
        dependsOn: { questionId: "total_paid_currency", value: "other" },
      },
      {
        id: "total_paid_amount",
        prompt: "Total Amount Paid",
        type: "number",
        min: 0,
        max: 500000,
        placeholder: "5000",
        required: true,
      },
      {
        id: "cost_model",
        prompt: "How was the cost structured?",
        type: "select",
        options: [
          { value: "per_graft", label: "Per graft" },
          { value: "per_session", label: "Per session" },
          { value: "package", label: "Package" },
          { value: "not_clear", label: "Not clear" },
        ],
        required: true,
      },
      {
        id: "what_included",
        prompt: "What was included?",
        type: "checkbox",
        options: [
          { value: "procedure", label: "Procedure" },
          { value: "medications", label: "Medications" },
          { value: "followup", label: "Follow-up" },
          { value: "prp", label: "PRP" },
          { value: "accommodation", label: "Accommodation" },
          { value: "transport", label: "Transport" },
          { value: "other", label: "Other" },
        ],
        required: false,
      },
      {
        id: "what_included_other",
        prompt: "Other inclusions (please specify)",
        type: "text",
        required: false,
        dependsOn: { questionId: "what_included", hasValue: "other" },
      },
    ],
  },
  {
    id: "surgical_experience",
    title: "Surgical Experience",
    questions: [
      {
        id: "pain_level",
        prompt: "Pain level during surgery",
        type: "slider",
        min: 1,
        max: 10,
        help: "1 = No pain, 10 = Severe pain",
        required: true,
      },
      {
        id: "post_op_swelling",
        prompt: "Post-operative swelling",
        type: "select",
        options: [
          { value: "none", label: "None" },
          { value: "mild", label: "Mild" },
          { value: "moderate", label: "Moderate" },
          { value: "severe", label: "Severe" },
        ],
        required: true,
      },
      {
        id: "bleeding_issue",
        prompt: "Any significant bleeding?",
        type: "select",
        options: [
          { value: "yes", label: "Yes" },
          { value: "no", label: "No" },
          { value: "not_sure", label: "Not Sure" },
        ],
        required: true,
      },
    ],
  },
  {
    id: "recovery",
    title: "Recovery & Complications",
    questions: [
      {
        id: "recovery_time",
        prompt: "Recovery time",
        type: "select",
        options: [
          { value: "under_1_week", label: "Less than 1 week" },
          { value: "1_2_weeks", label: "1–2 weeks" },
          { value: "2_4_weeks", label: "2–4 weeks" },
          { value: "4_plus_weeks", label: "4+ weeks" },
        ],
        required: true,
      },
      {
        id: "shock_loss",
        prompt: "Did you experience shock loss (temporary shedding)?",
        type: "select",
        options: [
          { value: "yes", label: "Yes" },
          { value: "no", label: "No" },
          { value: "not_sure", label: "Not Sure" },
        ],
        required: true,
      },
      { id: "complications", prompt: "Any complications?", type: "yesno", required: true },
      {
        id: "complications_details",
        prompt: "Complication details",
        type: "textarea",
        placeholder: "Describe what happened",
        required: false,
        dependsOn: { questionId: "complications", value: "yes" },
      },
    ],
  },
  {
    id: "results",
    title: "Results (Contextualized)",
    questions: [
      {
        id: "months_since",
        prompt: "Months since procedure",
        type: "select",
        options: [
          { value: "under_3", label: "Less than 3 months" },
          { value: "3_6", label: "3–6 months" },
          { value: "6_9", label: "6–9 months" },
          { value: "9_12", label: "9–12 months" },
          { value: "12_plus", label: "12+ months" },
        ],
        required: true,
      },
      {
        id: "density_satisfaction",
        prompt: "Density satisfaction",
        type: "rating",
        min: 1,
        max: 5,
        help: "1 = Very dissatisfied, 5 = Very satisfied",
        required: true,
      },
      {
        id: "hairline_naturalness",
        prompt: "Hairline naturalness",
        type: "rating",
        min: 1,
        max: 5,
        help: "1 = Poor, 5 = Excellent",
        required: true,
      },
      {
        id: "donor_appearance",
        prompt: "Donor area appearance",
        type: "rating",
        min: 1,
        max: 5,
        help: "1 = Poor, 5 = Excellent",
        required: true,
      },
      {
        id: "would_repeat",
        prompt: "Would you repeat the procedure with this clinic?",
        type: "select",
        options: [
          { value: "yes", label: "Yes" },
          { value: "no", label: "No" },
          { value: "not_sure", label: "Not Sure" },
        ],
        required: true,
      },
      { id: "would_recommend", prompt: "Would you recommend this clinic?", type: "yesno", required: true },
    ],
  },
];

export type PatientFormQuestion = {
  id: string;
  prompt: string;
  type: string;
  required?: boolean;
  placeholder?: string;
  help?: string;
  options?: { value: string; label: string }[];
  min?: number;
  max?: number;
  dependsOn?: { questionId: string; value?: string; hasValue?: string };
};
