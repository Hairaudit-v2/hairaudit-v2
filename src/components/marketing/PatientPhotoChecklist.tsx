import { cn } from "@/lib/utils";

const PHOTO_ITEMS = [
  "Front hairline",
  "Left side",
  "Right side",
  "Top / crown",
  "Donor area",
  "Right after surgery (if you have it)",
  "Graft count or clinic papers (if you have them)",
] as const;

type PatientPhotoChecklistProps = {
  className?: string;
  id?: string;
  title?: string;
  intro?: string;
  /** `ink` matches dark public pages; `fi` matches HairAuditFiMarketingShell tokens. */
  surface?: "ink" | "fi";
};

/**
 * Simple photo checklist for ESL-friendly patient copy on marketing surfaces.
 */
export default function PatientPhotoChecklist({
  className,
  id = "patient-photo-checklist",
  title = "What you will need (photos)",
  intro = "You do not need perfect photos. Add what you have now. You can add more later.",
  surface = "ink",
}: PatientPhotoChecklistProps) {
  const shell =
    surface === "fi"
      ? "rounded-2xl border border-border/50 bg-card/70 p-6 shadow-fi-panel"
      : "rounded-2xl border border-white/10 bg-white/5 p-6 backdrop-blur-sm";

  const heading = surface === "fi" ? "text-lg font-semibold text-foreground" : "text-lg font-semibold text-white";

  const introClass =
    surface === "fi" ? "mt-2 text-sm text-muted-foreground leading-relaxed" : "mt-2 text-sm text-slate-400 leading-relaxed";

  const itemShell =
    surface === "fi"
      ? "rounded-xl border border-border/50 bg-background/60 px-4 py-2.5 text-sm text-foreground leading-snug"
      : "rounded-xl border border-white/10 bg-slate-900/60 px-4 py-2.5 text-sm text-slate-200 leading-snug";

  return (
    <section id={id} aria-labelledby={`${id}-heading`} className={cn(shell, className)}>
      <h2 id={`${id}-heading`} className={heading}>
        {title}
      </h2>
      {intro ? <p className={introClass}>{intro}</p> : null}
      <ul className="mt-4 grid gap-2.5 sm:grid-cols-2">
        {PHOTO_ITEMS.map((item) => (
          <li key={item} className={itemShell}>
            {item}
          </li>
        ))}
      </ul>
    </section>
  );
}
