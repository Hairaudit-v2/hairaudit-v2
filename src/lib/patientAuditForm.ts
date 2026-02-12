// Patient Audit Form schema — patient self-reported experience (5–10 min)
// Separate from clinical audit rubric (auditor assessment)

export type PatientAuditAnswers = Record<string, string | number | string[] | boolean | null>;

export const PATIENT_AUDIT_SECTIONS = [
  {
    id: "basic",
    title: "Basic Information",
    questions: [
      {
        id: "patient_name",
        prompt: "Name of Patient",
        type: "text",
        placeholder: "John Doe",
        required: false,
        help: "Optional for privacy.",
      },
      {
        id: "clinic_name",
        prompt: "Clinic Name",
        type: "text",
        placeholder: "ABC Hair Clinic",
        required: true,
      },
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
        id: "clinic_city",
        prompt: "Clinic City",
        type: "text",
        placeholder: "Istanbul",
        required: true,
      },
      {
        id: "procedure_date",
        prompt: "Date of Procedure",
        type: "date",
        required: true,
      },
    ],
  },
  {
    id: "procedure",
    title: "Procedure Experience",
    questions: [
      {
        id: "pain_during",
        prompt: "Pain During Procedure",
        type: "rating",
        min: 1,
        max: 10,
        help: "1 = No Pain, 10 = Severe Pain",
        required: true,
      },
      {
        id: "pain_after",
        prompt: "Pain After Procedure",
        type: "rating",
        min: 1,
        max: 10,
        help: "1 = No Pain, 10 = Severe Pain",
        required: true,
      },
      {
        id: "procedure_type",
        prompt: "Type of Procedure",
        type: "select",
        options: [
          { value: "fue", label: "FUE" },
          { value: "fut", label: "FUT" },
          { value: "dhi", label: "DHI" },
          { value: "robotic", label: "Robotic" },
          { value: "other", label: "Other" },
        ],
        required: true,
      },
      {
        id: "procedure_type_other",
        prompt: "Procedure type (if Other)",
        type: "text",
        required: false,
        dependsOn: { questionId: "procedure_type", value: "other" },
      },
      {
        id: "surgeon_name",
        prompt: "Surgeon's Name (if known)",
        type: "text",
        placeholder: "Dr. John Smith",
        required: false,
      },
    ],
  },
  {
    id: "personnel",
    title: "Personnel Involved",
    questions: [
      {
        id: "extraction_performed_by",
        prompt: "Graft Extraction Performed By",
        type: "select",
        options: [
          { value: "doctor", label: "Doctor" },
          { value: "nurse", label: "Nurse" },
          { value: "technician", label: "Technician" },
          { value: "doctor_technician", label: "Doctor & Technician" },
          { value: "nurse_technician", label: "Nurse & Technician" },
          { value: "other", label: "Other" },
        ],
        required: false,
      },
      {
        id: "extraction_performed_by_other",
        prompt: "Extraction performed by (if Other)",
        type: "text",
        placeholder: "e.g. Robotic system operator",
        required: false,
        dependsOn: { questionId: "extraction_performed_by", value: "other" },
      },
      {
        id: "implantation_performed_by",
        prompt: "Graft Implantation Performed By",
        type: "select",
        options: [
          { value: "doctor", label: "Doctor" },
          { value: "nurse", label: "Nurse" },
          { value: "technician", label: "Technician" },
          { value: "doctor_technician", label: "Doctor & Technician" },
          { value: "nurse_technician", label: "Nurse & Technician" },
          { value: "other", label: "Other" },
        ],
        required: false,
      },
      {
        id: "implantation_performed_by_other",
        prompt: "Implantation performed by (if Other)",
        type: "text",
        placeholder: "e.g. DHI pen by technician",
        required: false,
        dependsOn: { questionId: "implantation_performed_by", value: "other" },
      },
    ],
  },
  {
    id: "cost",
    title: "Cost and Inclusions",
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
        type: "text",
        placeholder: "5000",
        help: "Enter the amount (numbers only, no currency symbols).",
        required: true,
      },
      {
        id: "cost_included",
        prompt: "What Was Included in This Cost?",
        type: "checkbox",
        options: [
          { value: "consultation", label: "Initial Consultation" },
          { value: "preop_tests", label: "Pre-Operative Tests" },
          { value: "procedure", label: "Hair Transplant Procedure" },
          { value: "medications", label: "Post-Operative Medications" },
          { value: "followup", label: "Follow-Up Appointments" },
          { value: "accommodation", label: "Accommodation" },
          { value: "transportation", label: "Transportation" },
          { value: "other", label: "Other" },
        ],
        required: false,
      },
      {
        id: "cost_included_other",
        prompt: "Other inclusions (please specify)",
        type: "text",
        required: false,
        dependsOn: { questionId: "cost_included", hasValue: "other" },
      },
    ],
  },
  {
    id: "clinic",
    title: "Clinic Experience",
    questions: [
      {
        id: "clinic_quality",
        prompt: "Clinic Quality",
        type: "rating",
        min: 1,
        max: 5,
        help: "1 = Poor, 5 = Excellent",
        required: true,
      },
      {
        id: "clinic_services",
        prompt: "Clinic Services Provided",
        type: "checkbox",
        options: [
          { value: "consultation", label: "Initial Consultation" },
          { value: "preop_instructions", label: "Pre-Op Instructions" },
          { value: "postop_followup", label: "Post-Op Follow-Up" },
          { value: "prp", label: "PRP (Platelet-Rich Plasma)" },
          { value: "exosomes", label: "Exosomes" },
          { value: "transportation", label: "Transportation" },
          { value: "accommodation", label: "Accommodation" },
          { value: "other", label: "Other" },
        ],
        required: false,
      },
      {
        id: "clinic_services_other",
        prompt: "Other clinic services (please specify)",
        type: "text",
        required: false,
        dependsOn: { questionId: "clinic_services", hasValue: "other" },
      },
      {
        id: "clinic_rating",
        prompt: "Personal Rating of Clinic",
        type: "rating",
        min: 1,
        max: 5,
        help: "1 = Very Dissatisfied, 5 = Very Satisfied",
        required: true,
      },
    ],
  },
  {
    id: "recovery",
    title: "Recovery and Medications",
    questions: [
      {
        id: "medications",
        prompt: "Post-Operative Medications Provided or Recommended",
        type: "checkbox",
        options: [
          { value: "painkillers", label: "Painkillers" },
          { value: "antibiotics", label: "Antibiotics" },
          { value: "anti_inflammatories", label: "Anti-Inflammatories" },
          { value: "hair_growth", label: "Hair Growth Supplements" },
          { value: "prp", label: "PRP (Platelet-Rich Plasma)" },
          { value: "exosomes", label: "Exosomes" },
          { value: "none", label: "None" },
          { value: "other", label: "Other" },
        ],
        required: false,
      },
      {
        id: "medications_other",
        prompt: "Other medications (please specify)",
        type: "text",
        required: false,
        dependsOn: { questionId: "medications", hasValue: "other" },
      },
      {
        id: "recovery_time",
        prompt: "Recovery Time",
        type: "select",
        options: [
          { value: "under_1_week", label: "Less than 1 week" },
          { value: "1_2_weeks", label: "1–2 weeks" },
          { value: "2_4_weeks", label: "2–4 weeks" },
          { value: "over_4_weeks", label: "More than 4 weeks" },
        ],
        required: true,
      },
      {
        id: "complications",
        prompt: "Complications (if any)",
        type: "yesno",
        required: true,
      },
      {
        id: "complications_details",
        prompt: "Complication details",
        type: "textarea",
        required: false,
        dependsOn: { questionId: "complications", value: "yes" },
      },
    ],
  },
  {
    id: "results",
    title: "Results and Feedback",
    questions: [
      {
        id: "results_satisfaction",
        prompt: "Results Satisfaction",
        type: "rating",
        min: 1,
        max: 5,
        help: "1 = Very Dissatisfied, 5 = Very Satisfied",
        required: true,
      },
      {
        id: "would_recommend",
        prompt: "Would You Recommend the Clinic?",
        type: "yesno",
        required: true,
      },
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
