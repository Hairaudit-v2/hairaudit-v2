import { HA_HOME } from "@/config/platform-links";

type FAQItem = {
  question: string;
  answer: string;
};

type MedicalProcedureFaqSchemaProps = {
  pageName: string;
  pageDescription: string;
  faqs: FAQItem[];
};

export default function MedicalProcedureFaqSchema({
  pageName,
  pageDescription,
  faqs,
}: MedicalProcedureFaqSchemaProps) {
  const medicalProcedureSchema = {
    "@context": "https://schema.org",
    "@type": "MedicalProcedure",
    name: pageName,
    description: pageDescription,
    procedureType: "Hair transplant forensic review",
    howPerformed:
      "Independent review of photos and surgery evidence with AI-assisted analysis and clinical reviewer validation.",
    recognizingAuthority: {
      "@type": "Organization",
      name: "HairAudit",
      url: HA_HOME,
    },
  };

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(medicalProcedureSchema) }}
      />
      {faqs.length > 0 ? (
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify({
              "@context": "https://schema.org",
              "@type": "FAQPage",
              mainEntity: faqs.map((faq) => ({
                "@type": "Question",
                name: faq.question,
                acceptedAnswer: {
                  "@type": "Answer",
                  text: faq.answer,
                },
              })),
            }),
          }}
        />
      ) : null}
    </>
  );
}
