import { useRef, useState } from "react";
import {
  Upload,
  ArrowLeft,
  ArrowRight,
  Check,
  FileSpreadsheet,
  Plus,
  X,
} from "lucide-react";
import { Brand, Field } from "../components/ui";
import {
  type Technique,
  type SourceFile,
  type Layout,
  type Project,
  techniques,
  newTrace,
  uid,
} from "../domain/model";
import { templates, createProject } from "../scientific/techniques";
import { sampleSources } from "../scientific/samples";
import {
  parseFile,
  parseText,
  mappingReport,
  suggestColumns,
} from "../importing/parse";
import { stackProject, processProject } from "../scientific/transformations";
import { MiniPlot } from "./Welcome";
type Mapping = {
  source: SourceFile;
  x: number;
  ys: number[];
  name: string;
  xUnit: string;
  yUnit: string;
  accepted: boolean;
  include: boolean;
  header: boolean;
};
export function ImportWizard({
  initial,
  existing,
  onCancel,
  onFinish,
}: {
  initial?: Technique;
  existing?: Project;
  onCancel: () => void;
  onFinish: (p: Project) => void;
}) {
  const [step, setStep] = useState(initial || existing ? 2 : 1),
    [technique, setTechnique] = useState<Technique>(
      existing?.technique ?? initial ?? "XRD",
    ),
    [items, setItems] = useState<Mapping[]>([]),
    [layout, setLayout] = useState<Layout>("overlay"),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false),
    [drag, setDrag] = useState(false);
  const input = useRef<HTMLInputElement>(null);
  const append = (sources: SourceFile[]) =>
    setItems((prev) => [
      ...prev,
      ...sources.map((source) => ({
        ...suggestColumns(source),
        source,
        name:
          source.name.replace(/\.[^.]+$/, "") +
          (source.sheet ? ` · ${source.sheet}` : ""),
        xUnit: templates[technique].unit,
        yUnit: "",
        accepted: false,
        include: true,
        header: true,
      })),
    ]);
  const upload = async (files: FileList | null) => {
    if (!files) return;
    setBusy(true);
    setError("");
    try {
      for (const file of Array.from(files)) append(await parseFile(file));
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
      if (input.current) input.current.value = "";
    }
  };
  const update = (index: number, patch: Partial<Mapping>) =>
    setItems((prev) =>
      prev.map((item, i) =>
        i === index
          ? { ...item, ...patch, accepted: patch.accepted ?? false }
          : item,
      ),
    );
  const ready =
    items.some((i) => i.include) &&
    items.filter((i) => i.include).every((i) => i.accepted);
  const finish = () => {
    let p = existing ? structuredClone(existing) : createProject(technique);
    for (const item of items.filter((i) => i.include)) {
      p.sources.push(item.source);
      for (const y of item.ys)
        p.traces.push({
          ...newTrace(
            item.source,
            item.x,
            y,
            item.ys.length > 1
              ? `${item.name} · ${item.source.headers[y]}`
              : item.name,
            p.traces.length,
          ),
          xUnit: item.xUnit,
          yUnit: item.yUnit,
        });
    }
    if (!existing) {
      if (
        technique === "FTIR" &&
        items
          .filter((i) => i.include)
          .every(
            (i) =>
              i.source.synthetic &&
              i.source.headers[i.ys[0]] === "Transmittance (%)",
          )
      )
        p.config.y.label = "Transmittance (%)";
      p.config.layout = layout;
      if (layout === "single")
        p.traces.forEach((t, i) => (t.visible = i === 0));
      if (layout === "markers")
        p.traces.forEach((t) => {
          t.mode = "both";
          t.marker = "circle";
        });
      if (layout === "stacked") {
        const values = processProject(p).flatMap((t) =>
          t.points.flatMap((v) => (v.y === null ? [] : [v.y])),
        );
        const range = values.reduce(
          (a, v) => [Math.min(a[0], v), Math.max(a[1], v)],
          [Infinity, -Infinity],
        );
        p = stackProject(p, (range[1] - range[0]) * 0.8 || 1);
      }
    }
    p.updatedAt = new Date().toISOString();
    onFinish(p);
  };
  return (
    <div className="workflow">
      <header className="home-header">
        <Brand onClick={onCancel} />
        <button className="text-button" onClick={onCancel}>
          <X size={17} /> Close
        </button>
      </header>
      <main className="workflow-main">
        <div className="stepper">
          {["Technique", "Data & mapping", "Layout"].map((s, i) => (
            <div
              key={s}
              className={
                step === i + 1 ? "active" : step > i + 1 ? "complete" : ""
              }
            >
              <span>{step > i + 1 ? <Check size={14} /> : i + 1}</span>
              {s}
            </div>
          ))}
        </div>
        {step === 1 && (
          <>
            <div className="eyebrow">Start with your experiment</div>
            <h1>What are you working on?</h1>
            <p className="lead">
              Technique templates set labels and conventions. They never change
              your data.
            </p>
            <div className="select-techniques">
              {techniques.map((t) => (
                <button
                  key={t}
                  className={`technique-card ${t === technique ? "selected" : ""}`}
                  onClick={() => setTechnique(t)}
                >
                  <MiniPlot technique={t} />
                  <strong>{t}</strong>
                  <p>{templates[t].description}</p>
                </button>
              ))}
            </div>
          </>
        )}
        {step === 2 && (
          <>
            <div className="eyebrow">
              {technique} / Your data, your decisions
            </div>
            <h1>Drop in your data.</h1>
            <p className="lead">
              A quick check of your columns makes a good figure start right.
            </p>
            <div
              className={`dropzone ${drag ? "dragging" : ""}`}
              onDragOver={(e) => {
                e.preventDefault();
                setDrag(true);
              }}
              onDragLeave={() => setDrag(false)}
              onDrop={(e) => {
                e.preventDefault();
                setDrag(false);
                void upload(e.dataTransfer.files);
              }}
            >
              <Upload size={28} />
              <strong>
                {busy ? "Reading your files…" : "Drag your files here"}
              </strong>
              <p>
                CSV, TSV, TXT, or Excel · multiple files welcome · up to 25 MB
                each
              </p>
              <div className="button-row">
                <button
                  className="primary"
                  disabled={busy}
                  onClick={() => input.current?.click()}
                >
                  Browse files
                </button>
                <button
                  disabled={busy}
                  onClick={() => append(sampleSources(technique))}
                >
                  Use {technique} sample data
                </button>
                {technique === "FTIR" && (
                  <button
                    disabled={busy}
                    onClick={() =>
                      append(sampleSources("FTIR", "transmittance"))
                    }
                  >
                    Use transmittance sample
                  </button>
                )}
              </div>
              <input
                ref={input}
                type="file"
                accept=".csv,.tsv,.txt,.xlsx"
                multiple
                hidden
                onChange={(e) => void upload(e.target.files)}
              />
            </div>
            {error && (
              <div className="notice error" role="alert">
                {error}
              </div>
            )}
            {items.map((item, i) => {
              const report = mappingReport(item.source, item.x, item.ys);
              return (
                <section className="import-card" key={item.source.id}>
                  <div className="import-heading">
                    <FileSpreadsheet size={20} />
                    <div>
                      <strong>
                        {item.source.name}
                        {item.source.sheet ? ` / ${item.source.sheet}` : ""}
                      </strong>
                      <small>
                        {(item.source.size / 1024).toFixed(1)} KB ·{" "}
                        {item.source.rows.length.toLocaleString()} rows ·{" "}
                        {item.source.delimiter === "\t"
                          ? "Tab"
                          : item.source.delimiter === " "
                            ? "Space"
                            : item.source.delimiter === "Excel worksheet"
                              ? "Excel worksheet"
                              : `Delimiter “${item.source.delimiter}”`}
                        {item.source.synthetic ? " · Synthetic sample" : ""}
                      </small>
                    </div>
                    <label className="check-label">
                      <input
                        type="checkbox"
                        checked={item.include}
                        onChange={(e) =>
                          update(i, { include: e.target.checked })
                        }
                      />{" "}
                      Include
                    </label>
                    <button
                      className="icon-button"
                      aria-label={`Remove ${item.source.name}`}
                      onClick={() =>
                        setItems((prev) => prev.filter((_, j) => j !== i))
                      }
                    >
                      <X size={16} />
                    </button>
                  </div>
                  {item.include && (
                    <>
                      <div className="mapping-grid">
                        <Field label="Sample name">
                          <input
                            value={item.name}
                            onChange={(e) =>
                              update(i, { name: e.target.value })
                            }
                          />
                        </Field>
                        <Field label="X-axis column">
                          <select
                            value={item.x}
                            onChange={(e) =>
                              update(i, {
                                x: Number(e.target.value),
                                ys: item.ys.filter(
                                  (y) => y !== Number(e.target.value),
                                ),
                              })
                            }
                          >
                            {item.source.headers.map((h, j) => (
                              <option key={j} value={j}>
                                {h}
                              </option>
                            ))}
                          </select>
                        </Field>
                        <Field label="X units">
                          <input
                            value={item.xUnit}
                            onChange={(e) =>
                              update(i, { xUnit: e.target.value })
                            }
                          />
                        </Field>
                        <Field label="Y units">
                          <input
                            placeholder="As recorded"
                            value={item.yUnit}
                            onChange={(e) =>
                              update(i, { yUnit: e.target.value })
                            }
                          />
                        </Field>
                      </div>
                      <fieldset className="y-columns">
                        <legend>Y-axis columns · select one or more</legend>
                        {item.source.headers.map((h, j) => (
                          <label key={j} className="check-label">
                            <input
                              type="checkbox"
                              disabled={j === item.x}
                              checked={item.ys.includes(j)}
                              onChange={(e) =>
                                update(i, {
                                  ys: e.target.checked
                                    ? [...item.ys, j]
                                    : item.ys.filter((y) => y !== j),
                                })
                              }
                            />
                            {h}
                          </label>
                        ))}
                      </fieldset>
                      {item.source.encoding === "text" &&
                        !item.source.synthetic && (
                          <div className="button-row">
                            <label className="check-label">
                              <input
                                type="checkbox"
                                checked={item.header}
                                onChange={(e) => {
                                  try {
                                    const source = {
                                      ...parseText(
                                        item.source.content,
                                        item.source.name,
                                        e.target.checked,
                                        item.source.delimiter,
                                      ),
                                      id: item.source.id,
                                    };
                                    update(i, {
                                      source,
                                      header: e.target.checked,
                                      ...suggestColumns(source),
                                    });
                                  } catch (e) {
                                    setError((e as Error).message);
                                  }
                                }}
                              />{" "}
                              First row contains headers
                            </label>
                            <Field label="Delimiter">
                              <select
                                value={item.source.delimiter}
                                onChange={(e) => {
                                  try {
                                    const source = {
                                      ...parseText(
                                        item.source.content,
                                        item.source.name,
                                        item.header,
                                        e.target.value,
                                      ),
                                      id: uid(),
                                    };
                                    update(i, {
                                      source,
                                      ...suggestColumns(source),
                                    });
                                  } catch (e) {
                                    setError((e as Error).message);
                                  }
                                }}
                              >
                                <option value=",">Comma</option>
                                <option value=";">Semicolon</option>
                                <option value={"\t"}>Tab</option>
                                <option value=" ">Space</option>
                                <option value="|">Pipe</option>
                              </select>
                            </Field>
                          </div>
                        )}
                      <div className="data-table-wrap">
                        <table>
                          <thead>
                            <tr>
                              {item.source.headers.map((h, j) => (
                                <th key={j}>{h}</th>
                              ))}
                            </tr>
                          </thead>
                          <tbody>
                            {item.source.rows.slice(0, 5).map((row, j) => (
                              <tr key={j}>
                                {item.source.headers.map((_, k) => (
                                  <td key={k}>{row[k] ?? "—"}</td>
                                ))}
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                      {item.source.warnings.map((w, j) => (
                        <p className="notice" key={j}>
                          {w}
                        </p>
                      ))}
                      {(report.invalidX > 0 || report.missingY > 0) && (
                        <p className="notice">
                          {report.invalidX} rows have invalid/missing X values
                          and cannot be plotted. {report.missingY} rows have
                          missing/non-numeric Y values and will appear as gaps.
                          Original values are preserved. Confirm only if this is
                          expected.
                        </p>
                      )}
                      <div className="mapping-footer">
                        <span>
                          {item.accepted
                            ? "Mapping confirmed."
                            : `Suggested columns only — please check and confirm.`}
                        </span>
                        <button
                          className={
                            item.accepted ? "success-button" : "primary small"
                          }
                          disabled={
                            !item.ys.length ||
                            report.valid.some((n) => n < 2) ||
                            !item.name.trim()
                          }
                          onClick={() => update(i, { accepted: true })}
                        >
                          <Check size={15} />
                          {item.accepted ? "Confirmed" : "Confirm mapping"}
                        </button>
                      </div>
                    </>
                  )}
                </section>
              );
            })}
            {items.length > 0 && (
              <button
                className="text-button"
                onClick={() => input.current?.click()}
              >
                <Plus size={16} /> Add another dataset
              </button>
            )}
          </>
        )}
        {step === 3 && (
          <>
            <div className="eyebrow">A good starting point</div>
            <h1>Pick a layout.</h1>
            <p className="lead">
              You can change styles, spacing, and trace visibility in the
              editor.
            </p>
            <div className="layout-grid">
              {(["single", "overlay", "stacked", "markers"] as const).map(
                (l) => (
                  <button
                    className={`layout-card ${layout === l ? "selected" : ""}`}
                    onClick={() => setLayout(l)}
                    key={l}
                  >
                    <svg viewBox="0 0 160 90" aria-hidden="true">
                      {Array.from(
                        { length: l === "single" ? 1 : 3 },
                        (_, i) => (
                          <path
                            key={i}
                            d="M10 70Q30 70 40 30T70 56Q90 69 100 36T150 65"
                            transform={`translate(0,${l === "stacked" ? -i * 17 : -i * 5})`}
                            fill="none"
                            stroke={["#356786", "#b47d50", "#557e66"][i]}
                            strokeWidth="2"
                            strokeDasharray={
                              l === "markers" ? "2 4" : undefined
                            }
                          />
                        ),
                      )}
                    </svg>
                    <strong>
                      {
                        {
                          single: "Single trace",
                          overlay: "Overlay",
                          stacked: "Stack traces",
                          markers: "Lines + markers",
                        }[l]
                      }
                    </strong>
                    <p>
                      {l === "stacked"
                        ? "Adds a visible, reversible vertical offset."
                        : l === "single"
                          ? "Starts with the first trace visible."
                          : "Compare your samples in one figure."}
                    </p>
                    {l === "overlay" && (
                      <span className="tag">Recommended</span>
                    )}
                  </button>
                ),
              )}
            </div>
          </>
        )}
        <div className="workflow-footer">
          <button
            className="text-button"
            onClick={() =>
              step === 1 || existing ? onCancel() : setStep(step - 1)
            }
          >
            <ArrowLeft size={16} /> Back
          </button>
          <button
            className="primary"
            disabled={step === 2 && (!ready || busy)}
            onClick={() =>
              step === 3 || (existing && step === 2)
                ? finish()
                : setStep(step + 1)
            }
          >
            {step === 3
              ? "Start editing"
              : existing
                ? "Add to figure"
                : "Continue"}
            <ArrowRight size={17} />
          </button>
        </div>
      </main>
    </div>
  );
}
