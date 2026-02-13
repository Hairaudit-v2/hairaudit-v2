// Doctor Audit Form schema — doctor/clinic personnel report (10–15 min)

export type DoctorAuditAnswers = Record<string, string | number | string[] | boolean | null>;

export const DOCTOR_AUDIT_SECTIONS = [
  {
    id: "doctor_info",
    title: "Doctor's Information",
    questions: [
      { id: "doctor_name", prompt: "Doctor's Name", type: "text", placeholder: "Dr. John Smith", required: true },
      { id: "practice_name", prompt: "Practice Name", type: "text", placeholder: "ABC Hair Clinic", required: true },
      { id: "practice_location", prompt: "Practice Location", type: "text", placeholder: "Istanbul, Turkey", required: true },
      { id: "medical_degree", prompt: "Medical Degree", type: "text", placeholder: "MD, Dermatology", required: true },
      { id: "specialized_training", prompt: "Specialized Training in Hair Transplantation", type: "text", placeholder: "Fellowship in Hair Restoration Surgery", required: false },
      { id: "years_experience", prompt: "Years of Experience in Hair Transplantation", type: "number", required: true },
      { id: "certifications", prompt: "Certifications/Memberships", type: "text", placeholder: "ISHRS", required: false },
    ],
  },
  {
    id: "patient_medical",
    title: "Patient Medical Information",
    questions: [
      { id: "patient_age", prompt: "Patient Age", type: "number", required: true },
      { id: "patient_gender", prompt: "Patient Gender", type: "select", options: [{ value: "male", label: "Male" }, { value: "female", label: "Female" }, { value: "other", label: "Other" }], required: true },
      { id: "hair_loss_pattern", prompt: "Hair Loss Pattern", type: "select", options: [{ value: "norwood_1_6", label: "Norwood Scale 1–6" }, { value: "ludwig_1_3", label: "Ludwig Scale 1–3" }, { value: "diffuse", label: "Diffuse Thinning" }, { value: "other", label: "Other" }], required: true },
      { id: "medical_history", prompt: "Relevant Medical History", type: "textarea", placeholder: "No known allergies, history of hypertension", required: false },
    ],
  },
  {
    id: "procedure_details",
    title: "Procedure Details",
    questions: [
      { id: "technique", prompt: "Type of Hair Transplant Technique", type: "select", options: [{ value: "fue", label: "FUE" }, { value: "fut", label: "FUT" }, { value: "dhi", label: "DHI" }, { value: "robotic", label: "Robotic" }, { value: "other", label: "Other" }], required: true },
      { id: "grafts_extracted", prompt: "Number of Grafts Extracted", type: "number", required: true },
      { id: "grafts_implanted", prompt: "Number of Grafts Implanted", type: "number", required: true },
      { id: "extraction_performed_by", prompt: "Graft Extraction Performed By", type: "text", placeholder: "Dr. John Smith", required: true },
      { id: "preparation_performed_by", prompt: "Graft Preparation Performed By", type: "text", placeholder: "Nurse Jane Doe", required: false },
      { id: "implantation_performed_by", prompt: "Graft Implantation Performed By", type: "text", placeholder: "Dr. John Smith and Technician Alex Brown", required: true },
      { id: "tools_equipment", prompt: "Tools and Equipment Used", type: "text", placeholder: "Manual punch for FUE", required: false },
      { id: "complications_during", prompt: "Complications During Procedure", type: "text", placeholder: "None", required: false },
    ],
  },
  {
    id: "cost",
    title: "Cost and Inclusions",
    questions: [
      { id: "total_cost", prompt: "Total Cost of the Procedure", type: "text", placeholder: "$5,000", required: true },
      {
        id: "cost_inclusions",
        prompt: "Check all inclusions",
        type: "checkbox",
        options: [
          { value: "consultation", label: "Consultation Fee" },
          { value: "prp", label: "PRP" },
          { value: "procedure", label: "Procedure Fee" },
          { value: "anesthesia", label: "Anesthesia Fee" },
          { value: "facility", label: "Facility Fee" },
          { value: "postop_care", label: "Post-Operative Care" },
          { value: "medications", label: "Medications" },
          { value: "other", label: "Other (please specify)" },
        ],
        required: false,
      },
      { id: "other_cost_specify", prompt: "Other cost (if selected above)", type: "text", required: false },
    ],
  },
  {
    id: "graft_preservation",
    title: "Graft Preservation and Advanced Techniques (Optional)",
    questions: [
      { id: "preservation_technique", prompt: "Graft Preservation Technique", type: "text", placeholder: "Stored in chilled saline solution at 4°C", required: false },
      { id: "time_out_of_body", prompt: "Time Grafts Were Out of Body (hours)", type: "number", required: false },
      {
        id: "anesthesia_technique",
        prompt: "Anesthesia Technique",
        type: "checkbox",
        options: [
          { value: "local", label: "Local" },
          { value: "general", label: "General" },
          { value: "needle_free", label: "Needle free" },
          { value: "other", label: "Other" },
        ],
        required: false,
      },
      {
        id: "sterilization",
        prompt: "Sterilization Procedures",
        type: "checkbox",
        options: [
          { value: "autoclave", label: "Autoclave sterilization" },
          { value: "chemical", label: "Chemical sterilization" },
          { value: "single_use", label: "Single-use disposable" },
          { value: "other", label: "Other" },
        ],
        required: false,
      },
      {
        id: "advanced_tech",
        prompt: "Use of Advanced Technologies",
        type: "checkbox",
        options: [
          { value: "robotic", label: "Robotic Assistance" },
          { value: "motorized", label: "Motorized Extraction" },
          { value: "advanced_implant", label: "Advanced Implantation Tools" },
          { value: "none", label: "None" },
          { value: "other", label: "Other" },
        ],
        required: false,
      },
    ],
  },
  {
    id: "postop",
    title: "Post-Operative Details",
    questions: [
      {
        id: "medications_prescribed",
        prompt: "Post-Operative Medications Prescribed",
        type: "checkbox",
        options: [
          { value: "painkillers", label: "Painkillers" },
          { value: "antibiotics", label: "Antibiotics" },
          { value: "finasteride", label: "Finasteride" },
          { value: "dutasteride", label: "Dutasteride" },
          { value: "saw_palmetto", label: "Saw Palmetto" },
          { value: "minoxidil", label: "Minoxidil" },
          { value: "none", label: "None" },
          { value: "other", label: "Other" },
        ],
        required: false,
      },
      {
        id: "postop_care_treatments",
        prompt: "Post-Operative Care Treatments Provided",
        type: "checkbox",
        options: [
          { value: "prp", label: "PRP" },
          { value: "head_wash", label: "Head wash" },
          { value: "exosomes", label: "Exosomes" },
          { value: "prf", label: "PRF" },
          { value: "microneedling", label: "Microneedling" },
          { value: "none", label: "None" },
          { value: "other", label: "Other" },
        ],
        required: false,
      },
      {
        id: "followup_schedule",
        prompt: "Follow-Up Schedule",
        type: "checkbox",
        options: [
          { value: "1_week", label: "1 week" },
          { value: "1_month", label: "1 month" },
          { value: "3_month", label: "3 month" },
          { value: "6_month", label: "6 month" },
          { value: "9_month", label: "9 month" },
          { value: "12_month", label: "12 month" },
          { value: "18_month", label: "18 month" },
        ],
        required: false,
      },
      { id: "postop_instructions", prompt: "Post-Operative Care Instructions Provided", type: "textarea", placeholder: "Avoid strenuous activity for 2 weeks", required: false },
    ],
  },
  {
    id: "assessment",
    title: "Doctor's Assessment",
    questions: [
      { id: "success_rating", prompt: "Success of the Procedure", type: "rating", min: 1, max: 5, help: "1–5 Stars", required: true },
      { id: "additional_comments", prompt: "Additional Comments", type: "textarea", required: false },
    ],
  },
];
