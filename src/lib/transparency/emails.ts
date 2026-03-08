import { sendEmail } from "@/lib/email";

type ContributionEmailCommon = {
  to: string[];
  caseId: string;
  contributionUrl: string;
  clinicName?: string | null;
  doctorName?: string | null;
};

function safe(s?: string | null) {
  return String(s ?? "").trim();
}

function namesLine(args: { clinicName?: string | null; doctorName?: string | null }) {
  const clinic = safe(args.clinicName);
  const doctor = safe(args.doctorName);
  if (clinic && doctor) return `Clinic: ${clinic}<br/>Doctor: ${doctor}`;
  if (clinic) return `Clinic: ${clinic}`;
  if (doctor) return `Doctor: ${doctor}`;
  return "Clinic/Doctor details provided by patient";
}

function fairnessCopy() {
  return `
    <p>HairAudit is conducting a forensic review of a submitted patient case.</p>
    <p>
      To support a fair and complete representation of the surgical work, we are offering your clinic/surgeon
      an opportunity to contribute procedural documentation directly.
    </p>
    <p>
      Your contribution helps improve audit confidence, completeness, and transparency for all parties.
    </p>
  `;
}

export async function sendInitialContributionRequestEmail(input: ContributionEmailCommon) {
  if (!input.to.length) return false;
  return sendEmail({
    to: input.to,
    subject: "Request for clinical documentation to support a fair forensic review",
    html: `
      ${fairnessCopy()}
      <p><strong>Case ID:</strong> ${input.caseId}</p>
      <p>${namesLine(input)}</p>
      <p>
        <a href="${input.contributionUrl}">Secure contribution link</a>
      </p>
      <p>This link is intended only for authorized clinic/surgeon representatives.</p>
      <p>— HairAudit</p>
    `,
  });
}

export async function sendReminderContributionEmail(input: ContributionEmailCommon) {
  if (!input.to.length) return false;
  return sendEmail({
    to: input.to,
    subject: "Reminder: contribution opportunity for submitted patient case",
    html: `
      ${fairnessCopy()}
      <p><strong>Case ID:</strong> ${input.caseId}</p>
      <p>This is a reminder that your contribution window is still open.</p>
      <p><a href="${input.contributionUrl}">Secure contribution link</a></p>
      <p>— HairAudit</p>
    `,
  });
}

export async function sendFinalCourtesyContributionEmail(input: ContributionEmailCommon) {
  if (!input.to.length) return false;
  return sendEmail({
    to: input.to,
    subject: "Final invitation to contribute to this case review",
    html: `
      ${fairnessCopy()}
      <p><strong>Case ID:</strong> ${input.caseId}</p>
      <p>This is a final courtesy reminder before this contribution window closes.</p>
      <p><a href="${input.contributionUrl}">Secure contribution link</a></p>
      <p>— HairAudit</p>
    `,
  });
}
