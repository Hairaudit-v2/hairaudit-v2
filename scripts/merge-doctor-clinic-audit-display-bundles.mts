/**
 * Merges generated doctor/clinic case-audit display trees into en.json and es.json.
 * Run: pnpm exec tsx scripts/merge-doctor-clinic-audit-display-bundles.mts
 */
import { readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

const ROOT = fileURLToPath(new URL("..", import.meta.url));
const EN_BUNDLE = `${ROOT}/src/lib/i18n/translations/en.json`;
const ES_BUNDLE = `${ROOT}/src/lib/i18n/translations/es.json`;
const DOCTOR_EN = `${ROOT}/src/lib/i18n/translations/_generated/doctorCaseAudit.en.json`;
const DOCTOR_FLAT_ES = `${ROOT}/src/lib/i18n/translations/_generated/doctorCaseAudit.flat.es.json`;
const DOCTOR_OUT_ES = `${ROOT}/src/lib/i18n/translations/_generated/doctorCaseAudit.es.json`;
const CLINIC_EN = `${ROOT}/src/lib/i18n/translations/_generated/clinicCaseAudit.en.json`;
const CLINIC_FLAT_ES = `${ROOT}/src/lib/i18n/translations/_generated/clinicCaseAudit.flat.es.json`;
const CLINIC_OUT_ES = `${ROOT}/src/lib/i18n/translations/_generated/clinicCaseAudit.es.json`;

type Json = Record<string, unknown>;

function deepMergeOptions(target: Json, incoming: Json) {
  for (const [k, v] of Object.entries(incoming)) {
    if (k === "options" && v && typeof v === "object" && !Array.isArray(v)) {
      const prevOpt = target.options;
      if (prevOpt && typeof prevOpt === "object" && !Array.isArray(prevOpt)) {
        Object.assign(prevOpt as Json, v as Json);
      } else {
        target.options = { ...(v as Json) };
      }
      continue;
    }
    if (v && typeof v === "object" && !Array.isArray(v)) {
      const prev = target[k];
      if (prev && typeof prev === "object" && !Array.isArray(prev)) {
        deepMergeOptions(prev as Json, v as Json);
      } else {
        target[k] = { ...(v as Json) };
      }
      continue;
    }
    target[k] = v;
  }
}

function setNestedMerge(root: Json, parts: string[], leaf: Json) {
  let cur: Json = root;
  for (let i = 0; i < parts.length; i++) {
    const p = parts[i];
    const isLast = i === parts.length - 1;
    if (isLast) {
      const prev = cur[p];
      if (prev && typeof prev === "object" && !Array.isArray(prev)) {
        deepMergeOptions(prev as Json, leaf);
      } else {
        cur[p] = { ...leaf };
      }
    } else {
      if (!cur[p] || typeof cur[p] !== "object" || Array.isArray(cur[p])) cur[p] = {};
      cur = cur[p] as Json;
    }
  }
}

function unflatten(flat: Record<string, string>): Json {
  const out: Json = {};
  for (const [flatKey, value] of Object.entries(flat)) {
    const optSep = ".options.";
    const optIdx = flatKey.indexOf(optSep);
    if (optIdx !== -1) {
      const base = flatKey.slice(0, optIdx);
      const optKey = flatKey.slice(optIdx + optSep.length);
      setNestedMerge(out, base.split("."), { options: { [optKey]: value } });
      continue;
    }
    const lastDot = flatKey.lastIndexOf(".");
    if (lastDot <= 0) continue;
    const base = flatKey.slice(0, lastDot);
    const leafKey = flatKey.slice(lastDot + 1);
    setNestedMerge(out, base.split("."), { [leafKey]: value });
  }
  return out;
}

const sharedAuditFormsEn = {
  exceptionEntry: "Exception-based entry",
  useSavedDefaults: "Use saved defaults",
  copyFromPreviousCase: "Copy from previous case",
  onlyUpdateWhatChanged: "Only update what changed",
  saveCurrentAsDefaults: "Save current as defaults",
  useSavedProtocol: "Use saved protocol",
  useSavedDefault: "Use saved default",
  usingSavedDefaultPrefix: "Using saved default:",
  noSavedDefaultsFound: "No saved defaults found yet.",
  noMatchingDefaultFields: "No matching default fields available to prefill.",
  noDefaultableFields: "No defaultable fields available to prefill.",
  appliedSavedDefaults: "Applied saved defaults. Only edit what changed.",
  noSavedValuesForGroupPrefix: "No saved values for",
  appliedSavedGroupPrefix: "Applied saved",
  appliedSavedGroupSuffix: "You can override any field.",
  noPreviousCaseSnapshot: "No previous case snapshot found.",
  noEligiblePreviousCaseSnapshot: "No eligible previous case snapshot found.",
  previousCaseNoReusableFields: "Previous case snapshot does not include reusable fields.",
  unableReadPreviousCase: "Unable to read previous case snapshot.",
  addDefaultableFieldBeforeSaving: "Add at least one defaultable field before saving defaults.",
  savedCurrentAnswersAsDefaults: "Saved current answers as your defaults.",
  prefilledFromSavedDefaults: "Prefilled from saved defaults. Only edit what changed.",
  copiedReusableDataFromPreviousCase: "Copied reusable data from previous case. Only edit what changed.",
  inheritedFromOriginalSurgeryRecord: "Inherited from original surgery record",
  advancedSectionHint: "Add advanced data to improve confidence and benchmarking",
  uploadImagesNextStep: "Upload images in the next step.",
  reviewSummaryTitle: "Review Summary",
  reviewSummaryBody: "Review your answers before saving and continuing to photos.",
  reviewSummaryCta: "Review summary →",
  backToForm: "← Back to form",
  saveAnswers: "Save answers",
  continue: "Continue →",
  saving: "Saving…",
  addFollowupEvidenceTitle: "Add new follow-up evidence",
  addPhotosTitle: "Add your photos",
  selectPlaceholder: "— Select —",
  searchMultiPlaceholder: "Select options...",
  inheritedFieldMessage: "Inherited from original surgery record",
  protocolGroups: {
    extraction: "Extraction protocol",
    graft_handling: "Graft handling / storage",
    recipient_site: "Recipient site protocol",
    implantation: "Implantation protocol",
    postop: "Post-op protocol",
  },
} as const;

const sharedAuditFormsEs = {
  exceptionEntry: "Registro por excepción",
  useSavedDefaults: "Usar valores guardados",
  copyFromPreviousCase: "Copiar del caso anterior",
  onlyUpdateWhatChanged: "Actualizar solo lo que cambió",
  saveCurrentAsDefaults: "Guardar respuestas actuales como valores por defecto",
  useSavedProtocol: "Usar protocolo guardado",
  useSavedDefault: "Usar valor guardado",
  usingSavedDefaultPrefix: "Usando valor guardado:",
  noSavedDefaultsFound: "Aún no hay valores por defecto guardados.",
  noMatchingDefaultFields: "No hay campos compatibles para rellenar con valores guardados.",
  noDefaultableFields: "No hay campos aptos para rellenar con valores guardados.",
  appliedSavedDefaults: "Se aplicaron los valores guardados. Edite solo lo que cambió.",
  noSavedValuesForGroupPrefix: "No hay valores guardados para",
  appliedSavedGroupPrefix: "Se aplicó",
  appliedSavedGroupSuffix: "Puede sobrescribir cualquier campo.",
  noPreviousCaseSnapshot: "No se encontró ninguna captura del caso anterior.",
  noEligiblePreviousCaseSnapshot: "No hay ninguna captura previa reutilizable para este caso.",
  previousCaseNoReusableFields: "La captura del caso anterior no incluye campos reutilizables.",
  unableReadPreviousCase: "No se pudo leer la captura del caso anterior.",
  addDefaultableFieldBeforeSaving: "Añada al menos un campo con valores por defecto antes de guardar.",
  savedCurrentAnswersAsDefaults: "Se guardaron las respuestas actuales como valores por defecto.",
  prefilledFromSavedDefaults: "Rellenado con valores guardados. Edite solo lo que cambió.",
  copiedReusableDataFromPreviousCase: "Se copiaron datos reutilizables del caso anterior. Edite solo lo que cambió.",
  inheritedFromOriginalSurgeryRecord: "Heredado del registro quirúrgico original",
  advancedSectionHint: "Añada datos avanzados para mejorar la confianza y la capacidad de comparación",
  uploadImagesNextStep: "Suba las imágenes en el siguiente paso.",
  reviewSummaryTitle: "Resumen de revisión",
  reviewSummaryBody: "Revise sus respuestas antes de guardar y continuar a las fotos.",
  reviewSummaryCta: "Revisar resumen →",
  backToForm: "← Volver al formulario",
  saveAnswers: "Guardar respuestas",
  continue: "Continuar →",
  saving: "Guardando…",
  addFollowupEvidenceTitle: "Añadir nueva evidencia de seguimiento",
  addPhotosTitle: "Añadir sus fotos",
  selectPlaceholder: "— Seleccionar —",
  searchMultiPlaceholder: "Seleccionar opciones...",
  inheritedFieldMessage: "Heredado del registro quirúrgico original",
  protocolGroups: {
    extraction: "Protocolo de extracción",
    graft_handling: "Manejo / conservación de injertos",
    recipient_site: "Protocolo de zona receptora",
    implantation: "Protocolo de implantación",
    postop: "Protocolo postoperatorio",
  },
} as const;

const doctorCaseAuditPageEn = {
  backToCase: "Back to case",
  title: "Surgery Submission / Case Audit",
  description: "Target 6–8 minutes. Complete as the treating physician.",
  introHint: "Target 6–8 min. Prefer selects/checkboxes.",
  lockedMessage: "Case submitted. Answers are locked.",
  photosNavLabel: "→ Upload or view doctor images",
  photosNavDescription: "Pre-procedure, surgery, and post-procedure images.",
  primaryCtaLabel: "Add your photos →",
} as const;

const doctorCaseAuditPageEs = {
  backToCase: "Volver al caso",
  title: "Envío quirúrgico / auditoría del caso",
  description: "Objetivo: 6–8 minutos. Complételo como médico tratante.",
  introHint: "Objetivo: 6–8 minutos. Priorice selectores y casillas cuando corresponda.",
  lockedMessage: "Caso enviado. Las respuestas están bloqueadas.",
  photosNavLabel: "→ Subir o ver imágenes del médico",
  photosNavDescription: "Imágenes preoperatorias, intraoperatorias y postoperatorias.",
  primaryCtaLabel: "Añadir sus fotos →",
} as const;

const clinicCaseAuditPageEn = {
  backToCase: "Back to case",
  title: "Clinic Audit Form",
  description: "About 15–20 minutes. Clinic performance, facilities, and pricing.",
  introHint: "Clinic performance, facilities, staff, and pricing structure.",
  lockedMessage: "Case submitted. Answers are locked.",
  photosNavLabel: "→ Upload or view clinic images",
  photosNavTitle: "Visual Documentation (Optional)",
  photosNavDescription: "Clinic facilities, equipment, and procedure images.",
  primaryCtaLabel: "Add your photos →",
} as const;

const clinicCaseAuditPageEs = {
  backToCase: "Volver al caso",
  title: "Formulario de auditoría de clínica",
  description: "Aproximadamente 15–20 minutos. Rendimiento clínico, instalaciones y precios.",
  introHint: "Rendimiento clínico, instalaciones, personal y estructura de precios.",
  lockedMessage: "Caso enviado. Las respuestas están bloqueadas.",
  photosNavLabel: "→ Subir o ver imágenes de la clínica",
  photosNavTitle: "Documentación visual (opcional)",
  photosNavDescription: "Instalaciones, equipamiento e imágenes del procedimiento.",
  primaryCtaLabel: "Añadir sus fotos →",
} as const;

const clinicDoctorsManagerEn = {
  eyebrow: "Doctor Layer",
  title: "Clinic doctor roster",
  subtitle:
    "Build doctor-level attribution and permissions now to prepare for benchmarking and training insights later.",
  activeDoctorsPrefix: "Active doctors:",
  emptyTitle: "Add your doctors to strengthen profile trust, improve case attribution, and prepare for benchmarking.",
  emptyBody:
    "This doctor layer is structured for future doctor benchmarking, case assignment, public profiles, and training intelligence.",
  editTitle: "Edit doctor",
  addTitle: "Add doctor",
  yourRolePrefix: "Your role:",
  ownerOnly: "Only clinic owner/admin can add, edit, or archive doctors.",
  fullName: "Full name",
  professionalTitle: "Professional title / role",
  professionalTitlePlaceholder: "Lead Hair Transplant Surgeon",
  email: "Email",
  yearsExperience: "Years experience",
  yearsExperiencePlaceholder: "10",
  clinicRole: "Clinic role",
  clinicRoleDoctor: "Doctor",
  clinicRoleLead: "Lead doctor",
  clinicRoleManager: "Manager",
  clinicRoleAssistant: "Assistant",
  clinicRoleCoordinator: "Coordinator",
  clinicRoleAdmin: "Admin",
  clinicRoleOther: "Other",
  profileImage: "Profile image URL",
  shortBio: "Short bio",
  specialties: "Specialties (comma separated)",
  specialtiesPlaceholder: "FUE, donor management, repair cases",
  publicSummary: "Public summary",
  associatedBranches: "Associated branches (comma separated)",
  associatedBranchesPlaceholder: "Istanbul, London",
  canRespondAudits: "Can respond to audits",
  canSubmitCases: "Can submit cases",
  canViewInternalCases: "Can view internal cases",
  isActive: "Active",
  save: "Save doctor",
  cancel: "Cancel",
  searchPlaceholder: "Search doctors...",
  noResults: "No matching doctors.",
  requiredName: "Doctor full name is required.",
  saveFailed: "Unable to save doctor.",
  statusUpdateFailed: "Unable to update doctor status.",
  messageUpdated: "Doctor updated.",
  messageAdded: "Doctor added.",
  messageReactivated: "Doctor reactivated.",
  messageArchived: "Doctor archived/deactivated.",
  cardSpecialties: "Specialties",
  cardRole: "Role",
  cardPermissions: "Permissions",
  permissionRespond: "Respond to audits",
  permissionSubmit: "Submit cases",
  permissionViewInternal: "View internal cases",
  editAction: "Edit",
  archiveAction: "Archive",
  reactivateAction: "Reactivate",
  inactive: "Inactive",
  noBio: "No bio added yet.",
} as const;

const clinicDoctorsManagerEs = {
  eyebrow: "Capa de médicos",
  title: "Equipo médico de la clínica",
  subtitle:
    "Configure atribución y permisos a nivel médico para preparar futuras comparativas y módulos de formación.",
  activeDoctorsPrefix: "Médicos activos:",
  emptyTitle:
    "Añada sus médicos para reforzar la confianza del perfil, mejorar la atribución de casos y prepararse para comparativas.",
  emptyBody:
    "Esta capa médica está preparada para futuras comparativas por médico, asignación de casos, perfiles públicos e inteligencia de formación.",
  editTitle: "Editar médico",
  addTitle: "Añadir médico",
  yourRolePrefix: "Su rol:",
  ownerOnly: "Solo el propietario o administrador de la clínica puede añadir, editar o archivar médicos.",
  fullName: "Nombre completo",
  professionalTitle: "Cargo / título profesional",
  professionalTitlePlaceholder: "Cirujano principal de trasplante capilar",
  email: "Correo",
  yearsExperience: "Años de experiencia",
  yearsExperiencePlaceholder: "10",
  clinicRole: "Rol en la clínica",
  clinicRoleDoctor: "Médico",
  clinicRoleLead: "Médico principal",
  clinicRoleManager: "Gestor",
  clinicRoleAssistant: "Asistente",
  clinicRoleCoordinator: "Coordinador/a",
  clinicRoleAdmin: "Administrador/a",
  clinicRoleOther: "Otro",
  profileImage: "URL de la imagen de perfil",
  shortBio: "Biografía breve",
  specialties: "Especialidades (separadas por comas)",
  specialtiesPlaceholder: "FUE, manejo del donante, casos reparadores",
  publicSummary: "Resumen público",
  associatedBranches: "Sucursales asociadas (separadas por comas)",
  associatedBranchesPlaceholder: "Estambul, Londres",
  canRespondAudits: "Puede responder auditorías",
  canSubmitCases: "Puede enviar casos",
  canViewInternalCases: "Puede ver casos internos",
  isActive: "Activo",
  save: "Guardar médico",
  cancel: "Cancelar",
  searchPlaceholder: "Buscar médicos...",
  noResults: "No hay médicos que coincidan.",
  requiredName: "El nombre completo del médico es obligatorio.",
  saveFailed: "No se pudo guardar el médico.",
  statusUpdateFailed: "No se pudo actualizar el estado del médico.",
  messageUpdated: "Médico actualizado.",
  messageAdded: "Médico añadido.",
  messageReactivated: "Médico reactivado.",
  messageArchived: "Médico archivado / desactivado.",
  cardSpecialties: "Especialidades",
  cardRole: "Rol",
  cardPermissions: "Permisos",
  permissionRespond: "Responder auditorías",
  permissionSubmit: "Enviar casos",
  permissionViewInternal: "Ver casos internos",
  editAction: "Editar",
  archiveAction: "Archivar",
  reactivateAction: "Reactivar",
  inactive: "Inactivo",
  noBio: "Aún no se ha añadido una biografía.",
} as const;

const enBundle = JSON.parse(readFileSync(EN_BUNDLE, "utf8")) as Json;
const esBundle = JSON.parse(readFileSync(ES_BUNDLE, "utf8")) as Json;
const doctorEn = JSON.parse(readFileSync(DOCTOR_EN, "utf8")) as Json;
const doctorEs = unflatten(JSON.parse(readFileSync(DOCTOR_FLAT_ES, "utf8")) as Record<string, string>);
const clinicEn = JSON.parse(readFileSync(CLINIC_EN, "utf8")) as Json;
const clinicEs = unflatten(JSON.parse(readFileSync(CLINIC_FLAT_ES, "utf8")) as Record<string, string>);

writeFileSync(DOCTOR_OUT_ES, `${JSON.stringify(doctorEs, null, 2)}\n`, "utf8");
writeFileSync(CLINIC_OUT_ES, `${JSON.stringify(clinicEs, null, 2)}\n`, "utf8");

const enDashboard = enBundle.dashboard as Json;
const esDashboard = esBundle.dashboard as Json;

const enShared = enDashboard.shared as Json;
const esShared = esDashboard.shared as Json;
enShared.auditForms = sharedAuditFormsEn as unknown as Json;
esShared.auditForms = sharedAuditFormsEs as unknown as Json;

const enDoctorForms = ((enDashboard.doctor as Json).forms as Json);
const esDoctorForms = ((esDashboard.doctor as Json).forms as Json);
enDoctorForms.caseAudit = { page: doctorCaseAuditPageEn, ...(doctorEn as Json) };
esDoctorForms.caseAudit = { page: doctorCaseAuditPageEs, ...(doctorEs as Json) };

const enClinicForms = ((enDashboard.clinic as Json).forms as Json);
const esClinicForms = ((esDashboard.clinic as Json).forms as Json);
enClinicForms.caseAudit = { page: clinicCaseAuditPageEn, ...(clinicEn as Json) };
esClinicForms.caseAudit = { page: clinicCaseAuditPageEs, ...(clinicEs as Json) };
enClinicForms.doctorsManager = clinicDoctorsManagerEn as unknown as Json;
esClinicForms.doctorsManager = clinicDoctorsManagerEs as unknown as Json;

writeFileSync(EN_BUNDLE, `${JSON.stringify(enBundle, null, 2)}\n`, "utf8");
writeFileSync(ES_BUNDLE, `${JSON.stringify(esBundle, null, 2)}\n`, "utf8");

console.error("Merged doctor/clinic caseAudit display trees and shared audit form UI.");
