type FaqItem = {
  question: string;
  answer: string;
};

type FaqPageSchemaProps = {
  faqs: FaqItem[];
};

/**
 * FAQPage JSON-LD from the page's FAQ content.
 */
export default function FaqPageSchema({ faqs }: FaqPageSchemaProps) {
  if (faqs.length === 0) return null;

  const schema = {
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
  };

  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(schema) }}
    />
  );
}
