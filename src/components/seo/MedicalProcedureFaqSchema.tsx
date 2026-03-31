import { getBaseUrl } from "@/lib/seo/baseUrl";

type FAQItem = {
  question: string;
  answer: string;
};

type MedicalProcedureFaqSchemaProps = {
  pageName: string;
  pageDescription: string;
  faqs: FAQItem[];
};

/**
 * Service (audit offering) plus optional FAQPage — avoids MedicalProcedure, which implies clinical treatment.
 */
export default function MedicalProcedureFaqSchema({
  pageName,
  pageDescription,
  faqs,
}: MedicalProcedureFaqSchemaProps) {
  const baseUrl = getBaseUrl();
  const serviceSchema = {
    "@context": "https://schema.org",
    "@type": "Service",
    name: pageName,
    description: pageDescription,
    serviceType: "Independent hair transplant forensic audit",
    provider: {
      "@type": "Organization",
      name: "HairAudit",
      url: baseUrl,
    },
  };

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(serviceSchema) }}
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
