/**
 * Section-level protocol groups for "Use saved protocol" UX.
 * Each group is a subset of clinicDefaultFields / doctorDefaultFields.
 * UI-only; no schema or field ID changes.
 */

export const AUDIT_PROTOCOL_GROUPS = [
  {
    id: "extraction",
    label: "Extraction protocol",
    fieldIds: [
      "extraction_method",
      "extraction_devices_used",
      "primary_extraction_device",
      "extraction_technique",
      "extraction_operator",
      "punch_sizes_used",
      "primary_punch_size",
      "punch_types_used",
      "primary_punch_type",
      "punch_manufacturers_used",
      "punch_motion",
      "motor_speed_rpm",
    ],
  },
  {
    id: "graft_handling",
    label: "Graft handling / storage",
    fieldIds: [
      "holding_solutions_used",
      "primary_holding_solution",
      "temperature_controlled_storage",
      "grafts_kept_hydrated",
      "sorting_performed",
      "holding_solution_notes",
    ],
  },
  {
    id: "recipient_site",
    label: "Recipient site protocol",
    fieldIds: [
      "recipient_sites_created_by",
      "site_creation_method",
      "slit_orientation",
      "site_instrument_sizes_used",
      "dense_packing_attempted",
    ],
  },
  {
    id: "implantation",
    label: "Implantation protocol",
    fieldIds: [
      "implantation_method",
      "implantation_devices_used",
      "primary_implantation_device",
      "implanted_by",
      "singles_reserved_for_hairline",
      "implantation_device_notes",
      "intraoperative_adjuncts_used",
      "intraop_prp_used",
      "intraop_exosomes_used",
      "exosome_type",
      "partial_transection_used",
      "intraop_adjunct_notes",
    ],
  },
  {
    id: "postop",
    label: "Post-op protocol",
    fieldIds: [
      "postoperative_treatments_included",
      "postoperative_treatments_recommended",
      "finasteride_recommended",
      "minoxidil_recommended",
      "follow_up_plan_documented",
      "donor_recovery_protocol_included",
      "postoperative_protocol_notes",
    ],
  },
] as const;

export type AuditProtocolGroupId = (typeof AUDIT_PROTOCOL_GROUPS)[number]["id"];
