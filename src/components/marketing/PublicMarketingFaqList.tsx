type FaqItem = {
  question: string;
  answer: string;
};

type PublicMarketingFaqListProps = {
  faqs: FaqItem[];
};

export default function PublicMarketingFaqList({ faqs }: PublicMarketingFaqListProps) {
  return (
    <div className="space-y-4">
      {faqs.map(({ question, answer }) => (
        <article
          key={question}
          className="rounded-2xl border border-border/50 bg-card/70 p-5 shadow-fi-panel sm:p-6"
        >
          <h2 className="text-lg font-semibold text-foreground">{question}</h2>
          <p className="mt-3 text-sm leading-relaxed text-muted-foreground sm:text-base">{answer}</p>
        </article>
      ))}
    </div>
  );
}
