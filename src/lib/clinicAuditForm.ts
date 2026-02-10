// Clinic Audit Form schema — clinic performance, facilities, pricing (15–20 min)

export type ClinicAuditAnswers = Record<string, string | number | string[] | boolean | null>;

export const CLINIC_AUDIT_SECTIONS = [
  {
    id: "clinic_info",
    title: "Clinic Information",
    questions: [
      { id: "clinic_name", prompt: "Clinic Name", type: "text", placeholder: "ABC Hair Clinic", required: true },
      { id: "clinic_location", prompt: "Clinic Location(s)", type: "text", placeholder: "Istanbul, Turkey; Dubai, UAE", required: true },
      { id: "phone", prompt: "Phone Number", type: "text", placeholder: "+90 123 456 7890", required: false },
      { id: "email", prompt: "Email Address", type: "text", placeholder: "info@abchairclinic.com", required: false },
      { id: "website", prompt: "Website", type: "text", placeholder: "www.abchairclinic.com", required: false },
      { id: "years_operation", prompt: "Years in Operation", type: "number", required: true },
    ],
  },
  {
    id: "facilities",
    title: "Clinic Facilities",
    questions: [
      { id: "operating_rooms", prompt: "Number of Operating Rooms", type: "number", required: true },
      { id: "recovery_areas", prompt: "Recovery Areas", type: "text", placeholder: "3 private recovery rooms", required: false },
      { id: "waiting_rooms", prompt: "Waiting Rooms", type: "text", placeholder: "2 waiting areas with refreshments", required: false },
      { id: "sterilization", prompt: "Sterilization and Hygiene Protocols", type: "text", placeholder: "Autoclave sterilization, daily deep cleaning", required: false },
      {
        id: "emergency_equipment",
        prompt: "Emergency Equipment",
        type: "checkbox",
        options: [
          { value: "defibrillator", label: "Defibrillator" },
          { value: "oxygen", label: "Oxygen Supply" },
          { value: "emergency_meds", label: "Emergency Medications" },
          { value: "backup_power", label: "Backup Power Supply" },
          { value: "other", label: "Other" },
        ],
        required: false,
      },
    ],
  },
  {
    id: "staff",
    title: "Staff Qualifications",
    questions: [
      { id: "num_surgeons", prompt: "Number of Surgeons", type: "number", required: true },
      { id: "avg_experience", prompt: "Average Years of Experience for Surgeons", type: "number", required: false },
      { id: "num_nurses_techs", prompt: "Number of Nurses/Technicians", type: "number", required: false },
      { id: "staff_training", prompt: "Staff Training Programs", type: "text", placeholder: "Quarterly training on new techniques", required: false },
      { id: "staff_certifications", prompt: "Certifications of Key Staff", type: "text", placeholder: "All surgeons are ISHRS-certified", required: false },
    ],
  },
  {
    id: "statistics",
    title: "Procedure Statistics",
    questions: [
      { id: "procedures_annually", prompt: "Total Hair Transplant Procedures Performed Annually", type: "number", required: true },
      { id: "success_rate", prompt: "Success Rate (%)", type: "number", required: false },
      { id: "patient_satisfaction", prompt: "Patient Satisfaction Score", type: "rating", min: 1, max: 5, required: false },
      { id: "complication_rate", prompt: "Complication Rate (%)", type: "number", required: false },
    ],
  },
  {
    id: "pricing",
    title: "Pricing Structure",
    questions: [
      { id: "cost_range", prompt: "Typical Cost Range for Hair Transplant Procedures", type: "text", placeholder: "$3,000 - $7,000", required: true },
      {
        id: "cost_included",
        prompt: "What Is Typically Included in the Cost?",
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
    ],
  },
  {
    id: "quality",
    title: "Quality Assurance",
    questions: [
      { id: "quality_control", prompt: "Quality Control Measures", type: "text", placeholder: "Regular audits, patient follow-up surveys", required: false },
      { id: "equipment_maintenance", prompt: "Equipment Maintenance Schedule", type: "text", placeholder: "Monthly calibration of tools", required: false },
      { id: "safety_protocols", prompt: "Patient Safety Protocols", type: "text", placeholder: "Pre-operative health screenings", required: false },
      { id: "certifications", prompt: "Certifications and Accreditations", type: "text", placeholder: "ISO 9001:2015, JCI Accreditation", required: false },
    ],
  },
  {
    id: "services",
    title: "Patient Services",
    questions: [
      {
        id: "preop_services",
        prompt: "Pre-Operative Services",
        type: "checkbox",
        options: [
          { value: "consult_inperson", label: "Initial Consultation (In-Person)" },
          { value: "consult_virtual", label: "Initial Consultation (Virtual)" },
          { value: "health_screening", label: "Pre-Operative Health Screening" },
          { value: "treatment_planning", label: "Personalized Treatment Planning" },
          { value: "other", label: "Other" },
        ],
        required: false,
      },
      {
        id: "postop_services",
        prompt: "Post-Operative Services",
        type: "checkbox",
        options: [
          { value: "followup", label: "Follow-Up Appointments" },
          { value: "medications", label: "Post-Operative Medications" },
          { value: "care_instructions", label: "Hair Care Instructions" },
          { value: "helpline", label: "24/7 Helpline" },
          { value: "other", label: "Other" },
        ],
        required: false,
      },
      {
        id: "additional_services",
        prompt: "Additional Services",
        type: "checkbox",
        options: [
          { value: "accommodation", label: "Accommodation Arrangements" },
          { value: "transportation", label: "Transportation Services" },
          { value: "translation", label: "Translation Services" },
          { value: "financing", label: "Financing Options" },
          { value: "other", label: "Other" },
        ],
        required: false,
      },
    ],
  },
  {
    id: "technology",
    title: "Technology and Equipment",
    questions: [
      {
        id: "techniques_offered",
        prompt: "Hair Transplant Techniques Offered",
        type: "checkbox",
        options: [
          { value: "fue", label: "FUE" },
          { value: "fut", label: "FUT" },
          { value: "dhi", label: "DHI" },
          { value: "robotic", label: "Robotic" },
          { value: "other", label: "Other" },
        ],
        required: false,
      },
      { id: "advanced_tech", prompt: "Advanced Technologies Used", type: "text", placeholder: "ARTAS Robotic System, Choi Implanter Pens", required: false },
      { id: "graft_preservation", prompt: "Graft Preservation Methods", type: "text", placeholder: "Hypothermosol solution at 4°C", required: false },
    ],
  },
  {
    id: "testimonials",
    title: "Patient Testimonials and Reviews (Optional)",
    questions: [
      { id: "testimonials", prompt: "Patient Testimonials", type: "textarea", required: false },
      { id: "reviews_link", prompt: "Link to Online Reviews", type: "text", placeholder: "www.reviewsite.com/abchairclinic", required: false },
    ],
  },
];
