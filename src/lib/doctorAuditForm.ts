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
      { id: "hair_loss_pattern", prompt: "Hair Loss Pattern", type: "select", options: [{ value: "norwood", label: "Norwood Scale" }, { value: "ludwig", label: "Ludwig Scale" }, { value: "diffuse", label: "Diffuse Thinning" }, { value: "other", label: "Other" }], required: true },
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
      { id: "consultation_fee", prompt: "Consultation Fee", type: "text", required: false },
      { id: "procedure_fee", prompt: "Procedure Fee", type: "text", required: false },
      { id: "anesthesia_fee", prompt: "Anesthesia Fee", type: "text", required: false },
      { id: "facility_fee", prompt: "Facility Fee", type: "text", required: false },
      { id: "postop_care_fee", prompt: "Post-Operative Care", type: "text", required: false },
      { id: "medications_fee", prompt: "Medications", type: "text", required: false },
      { id: "other_cost", prompt: "Other (please specify)", type: "text", required: false },
    ],
  },
  {
    id: "graft_preservation",
    title: "Graft Preservation and Advanced Techniques (Optional)",
    questions: [
      { id: "preservation_technique", prompt: "Graft Preservation Technique", type: "text", placeholder: "Stored in chilled saline solution at 4°C", required: false },
      { id: "time_out_of_body", prompt: "Time Grafts Were Out of Body (hours)", type: "number", required: false },
      { id: "anesthesia_technique", prompt: "Anesthesia Technique", type: "text", placeholder: "Local anesthesia with lidocaine", required: false },
      { id: "sterilization", prompt: "Sterilization Procedures", type: "text", placeholder: "Autoclave sterilization", required: false },
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
          { value: "anti_inflammatories", label: "Anti-Inflammatories" },
          { value: "hair_growth", label: "Hair Growth Supplements" },
          { value: "none", label: "None" },
          { value: "other", label: "Other" },
        ],
        required: false,
      },
      { id: "postop_instructions", prompt: "Post-Operative Care Instructions Provided", type: "textarea", placeholder: "Avoid strenuous activity for 2 weeks", required: false },
      { id: "followup_schedule", prompt: "Follow-Up Schedule", type: "text", placeholder: "1-week and 3-month follow-up", required: false },
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
