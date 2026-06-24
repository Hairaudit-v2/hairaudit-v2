import type { PatientLongTermGuideContent, PatientLongTermGuideSection } from "@/lib/reports/patientLongTermGuide";

function GuideSection({ section }: { section: PatientLongTermGuideSection }) {
  return (
    <section
      className="rounded-2xl border border-white/10 bg-slate-900/40 p-5 sm:p-6"
      aria-labelledby={`guide-section-${section.id}`}
    >
      <div className="flex items-start gap-3">
        <span
          className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-amber-300 to-amber-500 text-xs font-bold text-slate-950"
          aria-hidden
        >
          {section.number}
        </span>
        <div className="min-w-0 flex-1">
          <h3 id={`guide-section-${section.id}`} className="text-base font-semibold text-white">
            {section.title}
          </h3>
          {section.purpose ? (
            <p className="mt-2 text-sm text-slate-400 leading-relaxed">{section.purpose}</p>
          ) : null}

          {section.paragraphs?.map((paragraph) => (
            <p key={paragraph.slice(0, 40)} className="mt-3 text-sm text-slate-300 leading-relaxed">
              {paragraph}
            </p>
          ))}

          {section.bullets?.length ? (
            <ul className="mt-3 space-y-2 text-sm text-slate-300">
              {section.bullets.map((item) => (
                <li key={item} className="flex gap-2 leading-relaxed">
                  <span className="text-amber-400/90 shrink-0" aria-hidden>
                    ·
                  </span>
                  {item}
                </li>
              ))}
            </ul>
          ) : null}

          {section.timeline?.length ? (
            <dl className="mt-4 space-y-3">
              {section.timeline.map((period) => (
                <div
                  key={period.label}
                  className="grid gap-1 border-t border-white/10 pt-3 first:border-t-0 first:pt-0 sm:grid-cols-[7.5rem_1fr] sm:gap-3"
                >
                  <dt className="text-sm font-medium text-amber-200/90">{period.label}</dt>
                  <dd className="text-sm text-slate-300 leading-relaxed">{period.description}</dd>
                </div>
              ))}
            </dl>
          ) : null}

          {section.safetyStatement ? (
            <p className="mt-4 rounded-xl border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-xs leading-relaxed text-amber-100/90">
              {section.safetyStatement}
            </p>
          ) : null}

          {section.closing ? (
            <p className="mt-4 border-t border-white/10 pt-4 text-sm italic text-slate-400 leading-relaxed">
              {section.closing}
            </p>
          ) : null}
        </div>
      </div>
    </section>
  );
}

export default function PatientLongTermGuideSections({ content }: { content: PatientLongTermGuideContent }) {
  return (
    <div className="space-y-4">
      {content.sections.map((section) => (
        <GuideSection key={section.id} section={section} />
      ))}
    </div>
  );
}
