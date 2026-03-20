# Spanish (es) UI terminology — HairAudit

Controlled glossary for **patient-facing** copy (intake, dashboards, report chrome). Use these choices consistently when adding or editing Spanish strings. English remains the canonical source for logic and fallbacks.

## Hair restoration — core terms

| Concept | Preferred Spanish | Notes |
|--------|-------------------|--------|
| Graft(s) | **injerto(s)** | Prefer over informal shortcuts; aligns with `reportGlossary.graftHandling` (“Manejo de injertos”). |
| Donor (area) | **zona donante**, **donante** | “Área donante” acceptable; avoid mixing with unrelated “donante” (organs). |
| Recipient (area) | **zona receptora**, **receptor** | Use for implant site / recipient scalp context. |
| Hairline | **línea frontal** | Primary term in intake and patient dashboard copy; aligns with marketing domain `domainHairline` (“Diseño de línea frontal”). |
| Crown | **coronilla** | Prefer over “corona” alone in surgical context. |
| Temples | **puntos temporales**, **sienes** | “Puntas temporales” for surgical design; “sienes” when naming anatomy simply. |
| Pre-operative / post-operative | **preoperatorio**, **postoperatorio** | Single word adjective form common in ES clinical copy. |
| Consultation | **consulta** | e.g. consulta preoperatoria. |
| Procedure / surgery | **procedimiento**, **cirugía**, **intervención** | Use **procedimiento** for neutral survey tone; **cirugía** when clearly surgical. |
| Shock loss | **caída reactiva**, **efluvio telógeno** | Patient line may pair both: cause + recognizable term in parentheses. |
| Extraction / implantation | **extracción**, **implantación** | Of **injertos**, not “del injerto” as a mass noun in isolation. |

## UI patterns

- **Uncertainty (enum “Not sure”)**: **No estoy seguro/a** — gender-inclusive, aligned across `reviewEnums` and advanced intake options. Avoid mixing with “Tengo dudas” for the same option value.
- **Placeholders**: Prefer **p. ej.,** (with comma) before examples; keep currency codes and brand names as in English where universal (USD, FUE).
- **Tone**: Neutral, second person (**usted**/**le**/**su**) for patient flows; avoid slang; internationally understandable Spanish over heavy regionalism.

## Report-adjacent UI

- **Informe** for HairAudit **report** (document), not “reporte” in product strings.
- **Auditoría** for the audit workflow; **evaluación comparativa** for benchmark framing where already used.
- **Puntuación** for numeric scores; **valoración** for ratings/satisfaction scales.

## Regeneration note

Patient intake field copy under `dashboard.patient.forms.intakeFields` is rebuilt from `_generated/intakeFields.flat.es.json` via `scripts/merge-intake-fields-into-bundles.mts`. After machine translation or bulk edits, **reconcile this glossary** before re-merging.

## Batch 14

Linguistic QA pass: polished `intakeFields.flat.es.json`, aligned `reviewEnums` “not sure” wording, and harmonized report-adjacent / intake strings (e.g. **línea frontal**, **injertos**, **preoperatorio** / **postoperatoria**).
