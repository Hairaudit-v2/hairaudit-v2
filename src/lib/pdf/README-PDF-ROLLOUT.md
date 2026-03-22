# PDF generation: production rollout & tuning

Internal reference for operators. Auth, scoring, and report content are unchanged by these flags.

## Grep-friendly logs

| Prefix | When |
|--------|------|
| `[pdf-benchmark]` | One JSON line per successful Playwright PDF when `PDF_INSTRUMENTATION=true` **or** `PDF_BENCHMARK_MODE=true` |
| `[pdf-benchmark-detail]` | Extra ratios only when `PDF_BENCHMARK_MODE=true` |
| `[pdf-qpdf-readiness]` | **Once per process** after first PDF path touches qpdf probe |
| `[pdf-linearize]` | When qpdf runs successfully or throws (per request) |
| `[pdf-gen]` | Step logs when `PDF_INSTRUMENTATION=true` |
| `[pdf-print]` | Elite HTML route when `PDF_INSTRUMENTATION=true` |

## Environment (see `pdfEnvConfig.ts`)

| Variable | Role |
|----------|------|
| `PDF_INSTRUMENTATION` | Verbose `[pdf-gen]` / `[pdf-print]` + benchmark line |
| `PDF_BENCHMARK_MODE` | Adds `[pdf-benchmark-detail]` (no user-visible change) |
| `PDF_ENABLE_LINEARIZATION` | Run `qpdf --linearize` when binary exists |
| `PDF_QPDF_PATH` | qpdf executable (default `qpdf`) |
| `PDF_PRINT_IMAGE_MAX_EDGE` | Max long edge before downscale (320–2400, default 960) |
| `PDF_PRINT_JPEG_QUALITY` | Optional fixed JPEG quality; unset = adaptive |
| `PDF_MAX_IMAGES_PER_SECTION` | Cap images per category key (optional) |
| `PDF_PLAYWRIGHT_SCALE` | `page.pdf` scale (0.82–1, default 0.94) |
| `PDF_PRINT_IMAGE_OPTIMIZE` | `false` to skip Sharp/data-URL path |
| `PDF_DEBUG` | Footer/debug in pdfkit / legacy HTML |
| `PDF_RENDERER` | `playwright` (default) or `pdfkit` |

## Recommended settings

### Serverless (e.g. Vercel, no qpdf)

- `PDF_ENABLE_LINEARIZATION=false` (default)
- `PDF_INSTRUMENTATION=true` for a short validation window, then off in steady state
- `PDF_BENCHMARK_MODE=true` only during A/B measurement
- Keep defaults: `PDF_PRINT_IMAGE_MAX_EDGE=960`, `PDF_PLAYWRIGHT_SCALE=0.94`
- Rely on image pipeline + streaming download; qpdf probe logs once as unavailable

### Dedicated PDF worker / container (qpdf installed)

- Install `qpdf` on the image or mount binary; set `PDF_QPDF_PATH` if not on `PATH`
- `PDF_ENABLE_LINEARIZATION=true` after spot-checking logs (`linearized: true`, no regressions)
- Same image tuning envs as serverless; linearization may slightly change file size but improves incremental open in many viewers

## When to enable linearization

- Enable when the runtime **reliably** has qpdf and temp disk (`os.tmpdir()` writable)
- Skip on ephemeral lambdas without qpdf (no crash; readiness is cached and logged once)
- Validate with `[pdf-benchmark]` fields: `linearized`, `rawPdfBytes`, `finalPdfBytes`, `qpdfAvailable`

## Rollout path

1. Turn on `PDF_INSTRUMENTATION=true` in staging; run representative audits; grep `[pdf-benchmark]`.
2. Optionally `PDF_BENCHMARK_MODE=true` for a week to capture `detail` ratios.
3. Introduce qpdf on a **non-serverless** job runner if flicker remains; enable `PDF_ENABLE_LINEARIZATION=true` there only.
4. Reduce logging in production to cost/noise levels you accept.

## Tradeoffs

- **Linearization**: extra CPU and latency at end of generation; better first-page behavior for some clients
- **Instrumentation**: larger logs; no PII in benchmark line beyond `caseId` / `reportId` (UUIDs)
- **reportId** on print URL: optional query param from `buildPdfUrl` for log correlation only; token remains the security gate
