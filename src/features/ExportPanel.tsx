import { useState } from "react";
import { Download, CheckCircle2 } from "lucide-react";
import { Drawer, Field, NumberInput } from "../components/ui";
import { useEditor } from "../domain/store";
import { figureChecks } from "../accessibility/checks";
import {
  download,
  filename,
  pixels,
  pngBlob,
  recipe,
  svgString,
} from "../exporting/export";
import { Figure } from "../plotting/Figure";
export function ExportPanel({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  const { project: p, edit } = useEditor();
  const [kind, setKind] = useState<"png" | "svg">("png"),
    [custom, setCustom] = useState(""),
    [busy, setBusy] = useState(false),
    [message, setMessage] = useState("");
  if (!p) return null;
  const c = p.config,
    checks = figureChecks(p),
    blocked = checks.some((c) => c.level === "error");
  const name = filename(
    custom ||
      `${p.name}_${p.technique}_${new Date().toISOString().slice(0, 10)}`,
  );
  const exportFigure = async () => {
    setBusy(true);
    setMessage("");
    try {
      await document.fonts.ready;
      const element = document.querySelector(
        "#export-render svg",
      ) as SVGSVGElement | null;
      if (!element)
        throw new Error(
          "The figure has not finished rendering. Close and reopen Export.",
        );
      const svg = svgString(element, p);
      download(
        kind === "svg"
          ? new Blob([svg], { type: "image/svg+xml" })
          : await pngBlob(svg, p),
        `${name}.${kind}`,
      );
      setMessage(`${kind.toUpperCase()} downloaded.`);
    } catch (e) {
      setMessage((e as Error).message);
    } finally {
      setBusy(false);
    }
  };
  return (
    <Drawer
      open={open}
      onClose={onClose}
      title="Export it ready."
      description="A final check, then your figure is yours."
    >
      <div className="export-preview">
        <Figure project={p} />
      </div>
      <div className="segmented">
        <button
          className={kind === "png" ? "active" : ""}
          onClick={() => setKind("png")}
        >
          PNG image
        </button>
        <button
          className={kind === "svg" ? "active" : ""}
          onClick={() => setKind("svg")}
        >
          Editable SVG
        </button>
      </div>
      <Field label="File name">
        <input
          value={custom}
          placeholder={name}
          onChange={(e) => setCustom(e.target.value)}
        />
      </Field>
      <div className="two-cols">
        <Field label="Width (mm)">
          <NumberInput
            value={c.width}
            min={30}
            max={600}
            onChange={(v) =>
              edit((p) => {
                p.config.width = v;
              })
            }
          />
        </Field>
        <Field label="Height (mm)">
          <NumberInput
            value={c.height}
            min={30}
            max={600}
            onChange={(v) =>
              edit((p) => {
                p.config.height = v;
              })
            }
          />
        </Field>
      </div>
      {kind === "png" ? (
        <>
          <Field label="Resolution">
            <select
              value={c.dpi}
              onChange={(e) =>
                edit((p) => {
                  p.config.dpi = Number(e.target.value) as 300 | 600 | 1200;
                })
              }
            >
              <option value={300}>300 DPI · standard</option>
              <option value={600}>600 DPI · fine detail</option>
              <option value={1200}>1200 DPI · maximum detail</option>
            </select>
          </Field>
          <div className="export-dimensions">
            <strong>
              {pixels(c.width, c.dpi).toLocaleString()} ×{" "}
              {pixels(c.height, c.dpi).toLocaleString()} px
            </strong>
            <small>
              {c.width} × {c.height} mm at {c.dpi} DPI
            </small>
          </div>
          <p className="inline-note">
            DPI describes resolution at the chosen physical size. This PNG
            includes that resolution in its metadata.
          </p>
        </>
      ) : (
        <p className="notice">
          SVG is especially suitable for vector line plots and can be edited in
          compatible vector software. Text remains text; use the same font in
          your vector editor.
        </p>
      )}
      <section className="export-checks">
        <h3>
          <CheckCircle2 size={17} /> Figure check
        </h3>
        {checks.map((check, i) => (
          <div key={i} className={`check ${check.level}`}>
            <span className="check-dot" />
            {check.text}
          </div>
        ))}
        <small>
          Heuristic checks are suggestions; visually inspect the exported
          figure.
        </small>
      </section>
      <div className="export-summary">
        <span>Colour</span>
        <strong>Original figure colours (RGB)</strong>
        <span>Preset</span>
        <strong>{c.preset}</strong>
        <span>Processing</span>
        <strong>
          {p.transformations.filter((t) => t.enabled).length} explicit steps
        </strong>
      </div>
      <small>
        Greyscale and colour-vision simulations are preview-only. Choose the
        Monochrome palette to export a monochrome figure.
      </small>
      <button
        className="primary full"
        disabled={blocked || busy}
        onClick={() => void exportFigure()}
      >
        <Download size={17} />
        {busy ? "Preparing your figure…" : `Download ${kind.toUpperCase()}`}
      </button>
      {message && (
        <p role="status" className="notice">
          {message}
        </p>
      )}
      <hr />
      <h3>Keep the recipe.</h3>
      <p className="inline-note">
        This recipe stores figure settings and processing steps. To fully
        recreate the figure, reopen it with the original source datasets.
      </p>
      <button
        className="full"
        onClick={() =>
          download(
            new Blob([JSON.stringify(recipe(p), null, 2)], {
              type: "application/json",
            }),
            `${name}_recipe.json`,
          )
        }
      >
        <Download size={15} /> Download JSON recipe
      </button>
      <details>
        <summary>Editable figure notes</summary>
        <textarea
          rows={5}
          value={
            c.notes ||
            p.transformations
              .filter((t) => t.enabled)
              .map((t) => t.description)
              .join("\n")
          }
          onChange={(e) =>
            edit((p) => {
              p.config.notes = e.target.value;
            })
          }
        />
        <small>
          Check that these notes match your methods and manuscript requirements.
        </small>
        <button
          onClick={() =>
            download(
              new Blob(
                [
                  c.notes ||
                    p.transformations
                      .filter((t) => t.enabled)
                      .map((t) => t.description)
                      .join("\n"),
                ],
                { type: "text/plain" },
              ),
              `${name}_notes.txt`,
            )
          }
        >
          Download notes
        </button>
      </details>
      <div id="export-render" className="offscreen" aria-hidden="true">
        <Figure project={p} />
      </div>
    </Drawer>
  );
}
