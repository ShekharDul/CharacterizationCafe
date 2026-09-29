# CharacterizationCafe

Publication-ready figures from raw research data. A browser-local scientific plotting workspace for XRD, Raman, FTIR, UV–Vis, NMR, TGA, and DSC.

## Run locally

Use Node.js 22.12+ or 24 LTS and npm. In PowerShell:

```powershell
cd "C:\Characterization Project"
npm.cmd ci
npm.cmd run dev
```

Open the local URL printed by Vite, normally http://127.0.0.1:5173. Keep this origin and browser consistent: saved projects belong to that browser origin.

```powershell
npm.cmd test          # Scientific/data/persistence tests
npm.cmd run build    # Strict TypeScript check and production build
npm.cmd run test:e2e # Browser workflows (Microsoft Edge installed)
```

The browser suite defaults to installed Microsoft Edge on Windows. For another platform, change `channel` in `playwright.config.ts` to an installed supported browser, or install Playwright Chromium and remove the channel setting. E2E test data uses isolated browser contexts and does not touch your personal saved projects.

The application needs no API key, server, authentication, or cloud account. Once its assets load, import, plotting, and export run in the browser. No research data is uploaded. External dependencies are downloaded only during development installation.

## First figure

1. Choose a technique, or try the XRD sample directly.
2. Upload CSV, TSV, TXT, or XLSX files. Select worksheets, inspect previews, and confirm each mapping.
3. Pick a layout. Stacking adds explicit offset steps; single trace hides the other traces without deleting them.
4. Edit axes, labels, colours, line styles, typography, annotations, and physical dimensions.
5. Use **Transformations** to normalize, scale, or offset values. Toggle **Preview original values** for comparison.
6. Export an editable SVG, a PNG at 300/600/1200 DPI, and a JSON recipe.
7. Return to **Projects** to resume the complete saved figure, including its source data.

## Architecture

- React + TypeScript + Vite; authored CSS design tokens and reusable accessible controls. Radix handles drawers and destructive-action confirmation.
- D3 scales, ticks, paths, and colour utilities drive an SVG figure renderer. The same React figure component renders the artboard and export surface. SVG keeps text and paths editable and avoids canvas-only plot rasterization.
- Zustand owns undo/redo and editor state. The domain model uses Zod to validate saved projects and recipes.
- Papa Parse reads delimited text; SheetJS reads XLSX worksheets and is loaded on demand.
- IndexedDB through `idb` stores projects behind a repository abstraction. Schema version 1 is explicit; unsupported versions fail validation rather than silently changing interpretation.
- PNG export rasterizes the SVG at the selected physical size and adds a standard PNG `pHYs` resolution chunk. SVG export includes processing metadata. Preview simulations never alter exports.

```text
src/
  domain/          Models, runtime validation, editor history
  scientific/      Technique templates, samples, processing functions
  importing/       Parsing, numeric validation, mapping reports
  plotting/        Shared SVG renderer and axis bounds
  accessibility/   Palette simulations and preflight checks
  exporting/       SVG/PNG/recipe construction and downloads
  persistence/     IndexedDB repository
  components/      Shared controls, brand, drawers, confirmations
  features/        Welcome, creation workflow, editor, properties, export
tests/
  science.test.ts  Numerical correctness, parsing, storage, export metadata
  e2e/             Technique workflows, file formats, downloads, reopening
```

## Scientific integrity and processing

Original text or XLSX bytes are stored with each source, along with the parsed table. Download the original file from **View raw data**. Derived plotting values are computed separately; source arrays are not modified.

Each transformation records its ID, type, target trace IDs, enabled state, numerical parameter, timestamp, versioned method name, and plain-language explanation. Processing runs in list order. Global normalization uses the explicitly selected trace group, including a selected trace later hidden from view. It never silently changes group membership when visibility changes.

- Individual normalization: `y / positive_trace_maximum * target`.
- Global normalization: `y / positive_selected_group_maximum * target`.
- Scale: `y * factor`.
- Offset: `y + offset`.
- DSC sign inversion: `y * -1`, only after explicit confirmation.
- Optional TGA derivative: centred secant differences at interior points, one-sided endpoint differences, no smoothing. Strictly monotonic X values and at least three points are required. Missing values remain gaps. Numerical differentiation can amplify noise.

Zero/nonpositive maxima are not normalized: a warning explains that current values were retained. Non-finite processing results become gaps with warnings. Log axes cannot display nonpositive points; this is disclosed, and those source points remain intact. Display limits only frame the figure.

Column suggestions require confirmation. Numeric parsing accepts finite decimal/scientific notation and refuses ambiguous decimal commas, units embedded in cells, or missing values. Invalid X rows cannot be positioned; invalid Y values are displayed as gaps. The mapping report makes this explicit before confirmation. No smoothing, interpolation, sorting, outlier removal, or scientific interpretation is performed silently.

Changing an axis label never converts values. TGA mass percent-to-mg conversion requires initial mass and is not included; import values already expressed in the desired units. FTIR and NMR axis reversal changes display direction only. The DSC convention selector declares the uploaded data's convention; the separate flip action changes values and records the operation.

## Local saving and reproducibility

Projects save the complete source data, column mappings, annotation coordinates, appearance, figure dimensions, and processing history. Writes are serialized so older asynchronous saves cannot overwrite newer edits. The Saved indicator appears only after a successful IndexedDB write.

Recipes intentionally exclude source values. They contain the app/schema version, technique, source filenames and worksheet names, mappings, styles, settings, annotations, and processing parameters. To reapply one, import the matching sources, then choose **Data → Figure actions → Apply saved recipe**. Source names must match uniquely and mappings must yield valid data. The user remains responsible for supplying the same original source contents; names alone do not verify content identity.

Browser storage is not a backup: clearing site data, changing browser/origin, or using another device does not transfer projects. Keep original source files and exported recipes separately.

## Output and accessibility

Generic presets set sizes and typography only. No named-journal compliance is claimed. Always check current artwork requirements.

Colour-blind-safe, high-contrast, monochrome, sequential, diverging, and custom per-series colours are available. Line styles, markers, and direct labels provide additional differentiation. Greyscale and approximate full-severity protanopia/deuteranopia/tritanopia simulations are editor previews; they are not a certification or a replacement for human inspection. The colour matrices approximate the Machado et al. model. Choose Monochrome as the actual palette if the exported figure should be monochrome.

Figure checks are advisory for readability, legend naming, possible legend overlap, line thickness, units, colour distinguishability, and annotation anchors. Technical failures such as no drawable data or invalid axis bounds block export. Inspect the actual exported file for label collisions and clipping.

## Extending the app

**Technique:** add its identifier to `domain/model.ts`, defaults and labels to `scientific/techniques.ts`, deterministic sample data to `scientific/samples.ts`, and a thumbnail in `features/Welcome.tsx`. Add scientific and browser regression coverage. Shared editor controls work from the template.

**Output preset:** add a record to the `presets` array in `scientific/techniques.ts`. Named journal presets should only be introduced with maintained source URLs, review dates, and verified requirements; generic presets make no journal-specific promise.

**Processing operation:** extend the validated transformation union, implement a pure function in `scientific/transformations.ts`, provide an explicit control and explanation, and test reversibility, missing/invalid values, and operation order. Never mutate source data.

**Storage:** implement the same repository methods for a future storage provider. Add explicit schema migration tests before changing persisted records. Cloud synchronization requires a separate product decision.

## MVP limits

- Single-panel figures; multi-panel composition is deferred.
- No baseline correction, smoothing, automated peak identification/fitting, phase analysis, integration calculations, or unit conversions.
- Files up to 25 MB. Very large datasets with dense markers may be slow; every point is retained, with no hidden downsampling. TXT supports explicit delimiters, not all proprietary instrument exports.
- XLSX uses the first row as headers and reads cached formula values; it does not recalculate Excel formulas. Empty/unusable worksheets are not imported.
- Dimensions are edited in millimetres. PNG export is capped at 48 megapixels / 16,000 pixels per edge to avoid exhausting browser memory.
- Fonts are referenced by name rather than embedded. The vector editor must have the chosen font for matching text metrics.
- The editor uses simple anchor-based label placement. Full text/legend collision detection is not implemented; visual inspection remains necessary.
- Reusable styles are shared through JSON recipes; a separate template library is deferred.
- Projects are local to this browser. No authentication, cloud sync, collaboration, analytics, or remote scientific databases.

Git commits and pushes are performed by the project owner.
