import { useEffect, useRef, useState } from "react";
import {
  ArrowDown,
  ArrowUp,
  Check,
  ChevronLeft,
  Copy,
  Database,
  Download,
  Eye,
  EyeOff,
  FileJson,
  Layers,
  Plus,
  Redo2,
  RotateCcw,
  ShieldCheck,
  SlidersHorizontal,
  Trash2,
  Undo2,
  ZoomIn,
  ZoomOut,
  Maximize,
  PanelLeftClose,
} from "lucide-react";
import { Brand, Drawer, Field, NumberInput } from "../components/ui";
import {
  type Preview,
  type Project,
  type Transformation,
  palettes,
  uid,
  newTrace,
  configSchema,
  projectSchema,
} from "../domain/model";
import { useEditor } from "../domain/store";
import { Properties } from "./Properties";
import { Figure, bounds } from "../plotting/Figure";
import {
  operation,
  processProject,
  stackProject,
} from "../scientific/transformations";
import { createProject } from "../scientific/techniques";
import { figureChecks } from "../accessibility/checks";
import { ExportPanel } from "./ExportPanel";
import { download, filename, recipe } from "../exporting/export";
import { mappingReport } from "../importing/parse";

export function Editor({
  onHome,
  onAdd,
  onDuplicate,
  saveStatus,
}: {
  onHome: () => void;
  onAdd: () => void;
  onDuplicate: (p: Project) => void;
  saveStatus: string;
}) {
  const {
    project: p,
    edit,
    undo,
    redo,
    past,
    future,
    selected,
    select,
    preview,
    setPreview,
  } = useEditor();
  const [tab, setTab] = useState("data"),
    [exportOpen, setExportOpen] = useState(false),
    [rawOpen, setRawOpen] = useState(false),
    [checksOpen, setChecksOpen] = useState(false),
    [showOriginal, setShowOriginal] = useState(false),
    [op, setOp] = useState<Transformation["type"]>("normalize"),
    [amount, setAmount] = useState(1),
    [scope, setScope] = useState("all"),
    [opMessage, setOpMessage] = useState(""),
    [sourceId, setSourceId] = useState(""),
    [leftOpen, setLeftOpen] = useState(true),
    [mappingOpen, setMappingOpen] = useState(false),
    [mx, setMx] = useState(0),
    [my, setMy] = useState(1),
    [mappingAck, setMappingAck] = useState(false);
  const recipeInput = useRef<HTMLInputElement>(null),
    [recipeMessage, setRecipeMessage] = useState("");
  useEffect(() => {
    const listener = (e: KeyboardEvent) => {
      if (
        (e.ctrlKey || e.metaKey) &&
        e.key.toLowerCase() === "z" &&
        !(
          e.target instanceof HTMLInputElement ||
          e.target instanceof HTMLTextAreaElement
        )
      ) {
        e.preventDefault();
        if (e.shiftKey) redo();
        else undo();
      }
    };
    window.addEventListener("keydown", listener);
    return () => window.removeEventListener("keydown", listener);
  }, [undo, redo]);
  if (!p) return null;
  const config = p.config,
    trace = p.traces.find((t) => t.id === selected) ?? p.traces[0],
    checks = figureChecks(p),
    problems = checks.filter((c) => c.level !== "ready");
  const activeSource = p.sources.find((s) => s.id === sourceId) ?? p.sources[0];
  const mappingSource = p.sources.find((s) => s.id === trace?.sourceId);
  const remapReport = mappingSource
    ? mappingReport(mappingSource, mx, [my])
    : null;
  const range = (factor: number) =>
    edit((p) => {
      const points = processProject(p)
        .filter((t) => p.traces.find((v) => v.id === t.id)?.visible)
        .flatMap((t) => t.points);
      const b = bounds(
        points.map((v) => v.x),
        p.config.x.log,
      );
      const lo = p.config.x.min ?? b[0],
        hi = p.config.x.max ?? b[1];
      if (p.config.x.log) {
        const mid = (Math.log(lo) + Math.log(hi)) / 2,
          half = ((Math.log(hi) - Math.log(lo)) * factor) / 2;
        p.config.x.min = Math.exp(mid - half);
        p.config.x.max = Math.exp(mid + half);
      } else {
        const mid = (lo + hi) / 2,
          half = ((hi - lo) * factor) / 2;
        p.config.x.min = mid - half;
        p.config.x.max = mid + half;
      }
    });
  const pan = (direction: number) =>
    edit((p) => {
      const points = processProject(p).flatMap((t) => t.points);
      const b = bounds(
        points.map((v) => v.x),
        p.config.x.log,
      );
      const lo = p.config.x.min ?? b[0],
        hi = p.config.x.max ?? b[1];
      if (p.config.x.log) {
        const shift = (hi / lo) ** (0.15 * direction);
        p.config.x.min = lo * shift;
        p.config.x.max = hi * shift;
      } else {
        const shift = (hi - lo) * 0.15 * direction;
        p.config.x.min = lo + shift;
        p.config.x.max = hi + shift;
      }
    });
  const apply = () => {
    const ids =
      scope === "all"
        ? p.traces.filter((t) => t.visible).map((t) => t.id)
        : trace
          ? [trace.id]
          : [];
    if (!ids.length) {
      setOpMessage("Select a visible dataset first.");
      return;
    }
    edit((p) => p.transformations.push(operation(op, ids, amount)));
    setOpMessage("Applied. Original data is preserved.");
  };
  const changeOrder = (id: string, direction: number) =>
    edit((p) => {
      const i = p.traces.findIndex((t) => t.id === id),
        j = i + direction;
      if (j < 0 || j >= p.traces.length) return;
      [p.traces[i], p.traces[j]] = [p.traces[j], p.traces[i]];
    });
  const importRecipe = async (file: File) => {
    try {
      const data = JSON.parse(await file.text());
      if (
        data.format !== "characterization-cafe-recipe" ||
        data.schemaVersion !== 1
      )
        throw new Error("Choose a CharacterizationCafe version 1 recipe.");
      if (data.technique !== p.technique)
        throw new Error(
          "This recipe uses a different technique. Open the matching technique first.",
        );
      const checked = configSchema.parse(data.config);
      const maps = new Map<string, string>();
      const sourceMaps = new Map<string, string>();
      for (const dataset of data.datasets) {
        const sources = p.sources.filter(
          (s) => s.name === dataset.sourceFileName && s.sheet === dataset.sheet,
        );
        if (sources.length !== 1)
          throw new Error(
            `Upload exactly one matching source for ${dataset.sourceFileName} before applying this recipe.`,
          );
        const source = sources[0];
        const report = mappingReport(source, dataset.xColumn, [
          dataset.yColumn,
        ]);
        if (report.valid[0] < 2)
          throw new Error(
            `The column mapping for ${dataset.name} does not match the source.`,
          );
        maps.set(dataset.id, uid());
        sourceMaps.set(dataset.sourceId, source.id);
      }
      const candidate: Project = {
        ...p,
        config: checked,
        traces: data.datasets.map((d: Record<string, unknown>) => ({
          ...d,
          id: maps.get(d.id as string),
          sourceId: sourceMaps.get(d.sourceId as string),
        })),
        transformations: data.transformations.map((o: Transformation) => ({
          ...o,
          id: uid(),
          traceIds: o.traceIds.map((id) => maps.get(id) || id),
        })),
        annotations: data.annotations,
      };
      const validated = projectSchema.parse(candidate);
      edit((p) => Object.assign(p, validated));
      setRecipeMessage(
        "Recipe applied to matching source files. Review the figure before export.",
      );
    } catch (e) {
      setRecipeMessage(`Could not apply recipe: ${(e as Error).message}`);
    }
  };
  return (
    <div className="editor-shell">
      <header className="editor-header">
        <Brand onClick={onHome} />
        <span className="header-divider" />
        <div className="project-title">
          <input
            aria-label="Project name"
            value={p.name}
            onChange={(e) =>
              edit((p) => {
                p.name = e.target.value;
              })
            }
          />
          <span
            className={
              saveStatus.startsWith("Save failed")
                ? "save-error"
                : "save-status"
            }
          >
            {saveStatus === "Saved" ? <Check size={12} /> : null}
            {saveStatus}
          </span>
        </div>
        <div className="history-buttons">
          <button
            className="icon-button"
            title="Undo (Ctrl+Z)"
            aria-label="Undo"
            disabled={!past.length}
            onClick={undo}
          >
            <Undo2 size={18} />
          </button>
          <button
            className="icon-button"
            title="Redo (Ctrl+Shift+Z)"
            aria-label="Redo"
            disabled={!future.length}
            onClick={redo}
          >
            <Redo2 size={18} />
          </button>
        </div>
        <select
          className="preview-select"
          aria-label="Vision preview"
          value={preview}
          onChange={(e) => setPreview(e.target.value as Preview)}
        >
          <option value="normal">Preview: original</option>
          <option value="greyscale">Greyscale</option>
          <option value="deuteranopia">Deuteranopia</option>
          <option value="protanopia">Protanopia</option>
          <option value="tritanopia">Tritanopia</option>
        </select>
        <button className="primary small" onClick={() => setExportOpen(true)}>
          <Download size={16} /> Export
        </button>
      </header>
      <div className="mobile-notice">
        Detailed figure editing works best on a larger screen.
      </div>
      <div className={`editor-body ${leftOpen ? "" : "left-collapsed"}`}>
        <aside className="context-panel">
          <div
            className="context-tabs"
            role="tablist"
            aria-label="Figure context"
          >
            {[
              ["data", Database],
              ["layers", Layers],
              ["changes", SlidersHorizontal],
              ["access", Eye],
            ].map(([name, Icon]) => {
              const C = Icon as typeof Database;
              return (
                <button
                  key={name as string}
                  role="tab"
                  aria-selected={tab === name}
                  className={tab === name ? "active" : ""}
                  aria-label={
                    {
                      data: "Data",
                      layers: "Layers",
                      changes: "Transformations",
                      access: "Accessibility",
                    }[name as string]
                  }
                  onClick={() => setTab(name as string)}
                >
                  <C size={17} />
                </button>
              );
            })}
          </div>
          {tab === "data" && (
            <div className="context-content">
              <div className="eyebrow">Your experiment</div>
              <h3>
                Datasets <span className="count">{p.traces.length}</span>
              </h3>
              <p className="inline-note">
                Select a trace to edit its appearance.
              </p>
              <div className="dataset-list">
                {p.traces.map((t) => (
                  <div
                    className={`dataset-row ${selected === t.id ? "selected" : ""}`}
                    key={t.id}
                  >
                    <button
                      className="icon-button"
                      aria-label={`${t.visible ? "Hide" : "Show"} ${t.name}`}
                      onClick={() =>
                        edit((p) => {
                          p.traces.find((s) => s.id === t.id)!.visible =
                            !t.visible;
                        })
                      }
                    >
                      {t.visible ? <Eye size={14} /> : <EyeOff size={14} />}
                    </button>
                    <button
                      className="dataset-select"
                      onClick={() => select(t.id)}
                    >
                      <span
                        className="line-swatch"
                        style={{ background: t.colour }}
                      />
                      <span>{t.name}</span>
                    </button>
                  </div>
                ))}
              </div>
              <button className="full dashed" onClick={onAdd}>
                <Plus size={15} /> Add dataset
              </button>
              <button className="text-button" onClick={() => setRawOpen(true)}>
                <Database size={14} /> View raw data
              </button>
              <button
                className="text-button"
                disabled={!trace}
                onClick={() => {
                  setMx(trace.xColumn);
                  setMy(trace.yColumn);
                  setMappingAck(false);
                  setMappingOpen(true);
                }}
              >
                Edit column mapping
              </button>
              <div className="local-note">
                <ShieldCheck size={19} />
                <strong>Raw data preserved</strong>
                <p>
                  Your original files stay intact. Every processing step is
                  visible and reversible.
                </p>
              </div>
              <details>
                <summary>Figure actions</summary>
                <div className="control-section">
                  <button onClick={() => onDuplicate(p)}>
                    <Copy size={14} /> Duplicate figure
                  </button>
                  <button
                    onClick={() =>
                      download(
                        new Blob([JSON.stringify(recipe(p), null, 2)], {
                          type: "application/json",
                        }),
                        `${filename(p.name)}_recipe.json`,
                      )
                    }
                  >
                    <FileJson size={14} /> Download plot recipe
                  </button>
                  <button onClick={() => recipeInput.current?.click()}>
                    Apply saved recipe
                  </button>
                  <input
                    ref={recipeInput}
                    type="file"
                    accept=".json"
                    hidden
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (file) void importRecipe(file);
                      e.target.value = "";
                    }}
                  />
                  {recipeMessage && <p className="notice">{recipeMessage}</p>}
                  <button
                    onClick={() =>
                      edit((p) => {
                        const fresh = createProject(p.technique).config;
                        p.config = {
                          ...fresh,
                          title: p.config.title,
                          subtitle: p.config.subtitle,
                          notes: p.config.notes,
                          x: p.config.x,
                          y: p.config.y,
                        };
                        p.traces = p.traces.map((t, i) => ({
                          ...t,
                          colour: palettes["Colour-blind safe"][i % 7],
                          width: 1.3,
                          dash: "solid",
                          marker: "none",
                          mode: "line",
                          opacity: 1,
                        }));
                      })
                    }
                  >
                    <RotateCcw size={14} /> Reset all styling
                  </button>
                </div>
              </details>
            </div>
          )}
          {tab === "layers" && (
            <div className="context-content">
              <div className="eyebrow">Figure structure</div>
              <h3>Layers</h3>
              <p className="inline-note">
                Drag traces to reorder, or use the arrow buttons.
              </p>
              {p.traces.map((t, i) => (
                <div
                  className="layer-item"
                  key={t.id}
                  draggable
                  onDragStart={(e) =>
                    e.dataTransfer.setData("text/plain", t.id)
                  }
                  onDragOver={(e) => e.preventDefault()}
                  onDrop={(e) => {
                    e.preventDefault();
                    const id = e.dataTransfer.getData("text/plain");
                    edit((p) => {
                      const from = p.traces.findIndex((t) => t.id === id),
                        to = p.traces.findIndex((v) => v.id === t.id);
                      if (from >= 0 && to >= 0) {
                        const [moved] = p.traces.splice(from, 1);
                        p.traces.splice(to, 0, moved);
                      }
                    });
                  }}
                >
                  <button className="text-button" onClick={() => select(t.id)}>
                    {t.name}
                  </button>
                  <div className="button-row">
                    <button
                      className="icon-button"
                      aria-label={`Move ${t.name} up`}
                      disabled={i === 0}
                      onClick={() => changeOrder(t.id, -1)}
                    >
                      <ArrowUp size={13} />
                    </button>
                    <button
                      className="icon-button"
                      aria-label={`Move ${t.name} down`}
                      disabled={i === p.traces.length - 1}
                      onClick={() => changeOrder(t.id, 1)}
                    >
                      <ArrowDown size={13} />
                    </button>
                    <button
                      className="icon-button"
                      aria-label={`Duplicate ${t.name}`}
                      onClick={() =>
                        edit((p) => {
                          const copy = {
                            ...t,
                            id: uid(),
                            name: `${t.name} copy`,
                          };
                          p.traces.push(copy);
                          p.transformations
                            .filter((o) => o.traceIds.includes(t.id))
                            .forEach((o) => o.traceIds.push(copy.id));
                        })
                      }
                    >
                      <Copy size={13} />
                    </button>
                    <button
                      className="icon-button"
                      aria-label={`Remove ${t.name}`}
                      onClick={() =>
                        edit((p) => {
                          p.traces = p.traces.filter((v) => v.id !== t.id);
                          p.transformations = p.transformations
                            .map((o) => ({
                              ...o,
                              traceIds: o.traceIds.filter((id) => id !== t.id),
                            }))
                            .filter((o) => o.traceIds.length);
                        })
                      }
                    >
                      <Trash2 size={13} />
                    </button>
                  </div>
                </div>
              ))}
              <h4>Annotations</h4>
              {p.annotations.length ? (
                p.annotations.map((a) => (
                  <div className="layer-item" key={a.id}>
                    <span>{a.text || a.type}</span>
                    <button
                      className="icon-button"
                      aria-label={`Remove ${a.text}`}
                      onClick={() =>
                        edit((p) => {
                          p.annotations = p.annotations.filter(
                            (v) => v.id !== a.id,
                          );
                        })
                      }
                    >
                      <Trash2 size={13} />
                    </button>
                  </div>
                ))
              ) : (
                <p className="inline-note">
                  Add a label or region from the properties panel.
                </p>
              )}
            </div>
          )}
          {tab === "changes" && (
            <div className="context-content">
              <div className="eyebrow">See every change</div>
              <h3>Transformations</h3>
              <p className="inline-note">
                Applied in the order shown. Original values are never
                overwritten.
              </p>
              <label className="check-label">
                <input
                  type="checkbox"
                  checked={showOriginal}
                  onChange={(e) => setShowOriginal(e.target.checked)}
                />{" "}
                Preview original values
              </label>
              {!p.transformations.length && (
                <div className="empty-inline">No transformations applied.</div>
              )}
              {p.transformations.map((o, i) => (
                <div className="transformation-card" key={o.id}>
                  <div>
                    <label className="check-label">
                      <input
                        type="checkbox"
                        checked={o.enabled}
                        onChange={(e) =>
                          edit((p) => {
                            p.transformations.find(
                              (v) => v.id === o.id,
                            )!.enabled = e.target.checked;
                          })
                        }
                      />
                      <strong>
                        {i + 1}.{" "}
                        {o.type === "globalNormalize"
                          ? "Global normalization"
                          : o.type}
                      </strong>
                    </label>
                    <button
                      className="icon-button"
                      aria-label={`Remove ${o.type}`}
                      onClick={() =>
                        edit((p) => {
                          p.transformations = p.transformations.filter(
                            (v) => v.id !== o.id,
                          );
                        })
                      }
                    >
                      <Trash2 size={13} />
                    </button>
                  </div>
                  <p>{o.description}</p>
                  <small>
                    {o.traceIds
                      .map((id) => p.traces.find((t) => t.id === id)?.name)
                      .join(", ")}
                  </small>
                  {!["flip", "derivative"].includes(o.type) && (
                    <Field label="Parameter">
                      <NumberInput
                        value={o.value}
                        step={0.1}
                        onChange={(v) =>
                          edit((p) => {
                            const target = p.transformations.find(
                              (t) => t.id === o.id,
                            )!;
                            const updated = operation(o.type, o.traceIds, v);
                            target.value = v;
                            target.description = updated.description;
                          })
                        }
                      />
                    </Field>
                  )}
                </div>
              ))}
              <hr />
              <Field label="Add transformation">
                <select
                  value={op}
                  onChange={(e) =>
                    setOp(e.target.value as Transformation["type"])
                  }
                >
                  <option value="normalize">Normalize each maximum</option>
                  <option value="globalNormalize">
                    Normalize to global maximum
                  </option>
                  <option value="scale">Multiply by a scale factor</option>
                  <option value="offset">Add a vertical offset</option>
                </select>
              </Field>
              <Field label="Apply to">
                <select
                  value={scope}
                  onChange={(e) => setScope(e.target.value)}
                >
                  <option value="all">All visible traces</option>
                  <option value="selected">Selected trace</option>
                </select>
              </Field>
              <Field
                label={
                  op === "offset"
                    ? "Offset in current Y units"
                    : op === "scale"
                      ? "Scale factor"
                      : "Target maximum"
                }
              >
                <NumberInput value={amount} step={0.1} onChange={setAmount} />
              </Field>
              <p className="formula">{operation(op, [], amount).description}</p>
              <button className="primary full" onClick={apply}>
                <Plus size={15} /> Apply transformation
              </button>
              <button
                className="full"
                onClick={() =>
                  edit((p) => {
                    Object.assign(p, stackProject(p, amount));
                  })
                }
              >
                Stack traces by {amount}
              </button>
              {p.technique === "TGA" && (
                <details>
                  <summary>Optional derivative trace</summary>
                  <p className="notice">
                    Calculates centred secant differences, with one-sided
                    endpoints and no smoothing. Numerical differentiation can
                    amplify noise. A separate trace is created; assign the
                    derivative units and hide the mass trace if their scales
                    differ.
                  </p>
                  <button
                    disabled={!trace}
                    onClick={() => {
                      edit((p) => {
                        const source = p.sources.find(
                          (s) => s.id === trace.sourceId,
                        )!;
                        const derivative = {
                          ...newTrace(
                            source,
                            trace.xColumn,
                            trace.yColumn,
                            `${trace.name} derivative`,
                            p.traces.length,
                          ),
                          yUnit:
                            trace.yUnit && trace.xUnit
                              ? `${trace.yUnit}/${trace.xUnit}`
                              : "",
                          xUnit: trace.xUnit,
                        };
                        p.traces.push(derivative);
                        // Keep the original processing scope, especially the
                        // shared denominator of global normalization.
                        p.transformations
                          .filter((o) => o.traceIds.includes(trace.id))
                          .forEach((o) => o.traceIds.push(derivative.id));
                        p.transformations.push(
                          operation("derivative", [derivative.id]),
                        );
                        p.traces.forEach(
                          (t) => (t.visible = t.id === derivative.id),
                        );
                        p.config.y = {
                          ...p.config.y,
                          min: null,
                          max: null,
                          label: `Derivative of ${p.config.y.label} per ${trace.xUnit || "X unit"}`,
                        };
                      });
                    }}
                  >
                    Confirm & create derivative
                  </button>
                </details>
              )}
              {opMessage && (
                <p className="notice" role="status">
                  {opMessage}
                </p>
              )}
            </div>
          )}
          {tab === "access" && (
            <div className="context-content">
              <div className="eyebrow">Make it clear</div>
              <h3>Accessibility</h3>
              <p className="inline-note">
                Colour is only one way to distinguish your samples.
              </p>
              <Field label="Colour palette">
                <select
                  value={config.palette}
                  onChange={(e) =>
                    edit((p) => {
                      p.config.palette = e.target.value;
                      p.traces.forEach((t, i) => {
                        t.colour =
                          palettes[e.target.value][
                            i % palettes[e.target.value].length
                          ];
                      });
                    })
                  }
                >
                  {Object.keys(palettes).map((v) => (
                    <option key={v}>{v}</option>
                  ))}
                </select>
              </Field>
              <div className="palette-swatches">
                {(palettes[config.palette] ?? []).map((col) => (
                  <span key={col} style={{ background: col }} />
                ))}
              </div>
              <Field label="Vision simulation">
                <select
                  value={preview}
                  onChange={(e) => setPreview(e.target.value as Preview)}
                >
                  {[
                    "normal",
                    "greyscale",
                    "deuteranopia",
                    "protanopia",
                    "tritanopia",
                  ].map((v) => (
                    <option key={v}>{v}</option>
                  ))}
                </select>
              </Field>
              <small>
                Approximate full-severity simulations using published colour
                matrices. Preview only; exports retain the chosen palette.
              </small>
              <button
                className="full"
                onClick={() =>
                  edit((p) => {
                    p.traces.forEach((t, i) => {
                      t.dash = (["solid", "dash", "dot", "dashdot"] as const)[
                        i % 4
                      ];
                      if (i >= 4)
                        t.marker = (
                          [
                            "circle",
                            "square",
                            "triangle",
                            "diamond",
                            "cross",
                          ] as const
                        )[Math.floor(i / 4) % 5];
                    });
                  })
                }
              >
                Improve distinguishability
              </button>
              <button
                className="full"
                onClick={() =>
                  edit((p) => {
                    p.config.legend = "direct";
                  })
                }
              >
                Use direct labels
              </button>
              {checks
                .filter((c) => /greyscale|line|text|label/i.test(c.text))
                .map((c, i) => (
                  <p key={i} className="notice">
                    {c.text}
                  </p>
                ))}
            </div>
          )}
        </aside>
        <main className="canvas-area">
          <div className="canvas-toolbar">
            <div className="button-row">
              <button
                className="icon-button"
                aria-label="Toggle data panel"
                onClick={() => setLeftOpen(!leftOpen)}
              >
                <PanelLeftClose size={17} />
              </button>
              <span className="technique-badge">{p.technique}</span>
              <span className="muted">
                {config.layout === "stacked"
                  ? "Stacked comparison"
                  : "Figure workspace"}
              </span>
            </div>
            <button
              className="text-button compact"
              onClick={() => setChecksOpen(true)}
            >
              <span
                className={`status-dot ${checks.some((c) => c.level === "error") ? "error-dot" : ""}`}
              />
              {problems.length
                ? `${problems.length} suggestions / warnings`
                : "Ready to export"}
            </button>
          </div>
          <div className="canvas-scroll">
            <div className="artboard-dimensions">
              {config.width} × {config.height} mm <span>· {config.preset}</span>
            </div>
            <div
              className="artboard"
              style={{ aspectRatio: `${config.width}/${config.height}` }}
            >
              <Figure
                project={p}
                preview={preview}
                raw={showOriginal}
                onSelect={select}
                onLabel={(label) => {
                  const input = document.getElementById(`property-${label}`);
                  input?.closest("details")?.setAttribute("open", "");
                  input?.focus();
                }}
                onAnnotation={(id, x, y) =>
                  edit((p) => {
                    const a = p.annotations.find((a) => a.id === id);
                    if (a) {
                      a.x = Number(x.toPrecision(7));
                      a.y = Number(y.toPrecision(7));
                    }
                  })
                }
                onLegend={(position) =>
                  edit((p) => {
                    p.config.legend = position;
                  })
                }
              />
            </div>
            <div className="canvas-caption">
              <span>
                {p.sources.some((s) => s.synthetic)
                  ? "Synthetic sample data"
                  : "Your source data, thoughtfully presented"}
              </span>
              <span>
                {p.technique === "DSC"
                  ? config.convention
                  : showOriginal
                    ? "Original values preview"
                    : preview === "normal"
                      ? "Click a trace to style it. Drag a label to position it."
                      : `${preview} preview · exports use original colours`}
              </span>
            </div>
            <div className="plot-controls">
              <button
                className="icon-button"
                title="Pan left"
                aria-label="Pan left"
                onClick={() => pan(-1)}
              >
                <ChevronLeft size={16} />
              </button>
              <button
                className="icon-button"
                title="Zoom in"
                aria-label="Zoom in"
                onClick={() => range(0.75)}
              >
                <ZoomIn size={17} />
              </button>
              <button
                className="icon-button"
                title="Zoom out"
                aria-label="Zoom out"
                onClick={() => range(1.35)}
              >
                <ZoomOut size={17} />
              </button>
              <button
                className="text-button compact"
                onClick={() =>
                  edit((p) => {
                    p.config.x.min = null;
                    p.config.x.max = null;
                    p.config.y.min = null;
                    p.config.y.max = null;
                  })
                }
              >
                <Maximize size={15} /> Fit to data
              </button>
              <button
                className="icon-button"
                title="Pan right"
                aria-label="Pan right"
                onClick={() => pan(1)}
              >
                <ChevronLeft
                  size={16}
                  style={{ transform: "rotate(180deg)" }}
                />
              </button>
            </div>
          </div>
        </main>
        <Properties />
      </div>
      <footer className="editor-status">
        <span>
          <ShieldCheck size={13} /> Raw data preserved
        </span>
        <span>
          {p.technique} <i /> {p.traces.length} traces <i />{" "}
          {p.sources.reduce((n, s) => n + s.rows.length, 0).toLocaleString()}{" "}
          source rows
        </span>
        <span>
          {config.width} × {config.height} mm <i /> PNG {config.dpi} DPI <i />{" "}
          Stored in this browser
        </span>
      </footer>
      <ExportPanel open={exportOpen} onClose={() => setExportOpen(false)} />
      <Drawer
        open={checksOpen}
        onClose={() => setChecksOpen(false)}
        title="Figure check"
        description="Constructive checks before your figure leaves the workspace."
      >
        {checks.map((c, i) => (
          <p key={i} className={`notice ${c.level === "error" ? "error" : ""}`}>
            <strong>{c.level}: </strong>
            {c.text}
          </p>
        ))}
        <p className="inline-note">
          Legend overlap and text bounds require visual inspection. Stylistic
          suggestions never prevent export.
        </p>
      </Drawer>
      <Drawer
        open={rawOpen}
        onClose={() => setRawOpen(false)}
        wide
        title="Original data"
        description="These values are preserved exactly as imported; transformations affect the plotted copy."
      >
        <Field label="Source file">
          <select
            value={activeSource?.id ?? ""}
            onChange={(e) => setSourceId(e.target.value)}
          >
            {p.sources.map((s) => (
              <option value={s.id} key={s.id}>
                {s.name}
                {s.sheet ? ` · ${s.sheet}` : ""}
              </option>
            ))}
          </select>
        </Field>
        {activeSource && (
          <>
            <button
              onClick={() => {
                if (activeSource.encoding === "text")
                  download(
                    new Blob([activeSource.content], { type: "text/plain" }),
                    activeSource.name,
                  );
                else {
                  const bytes = Uint8Array.from(
                    atob(activeSource.content),
                    (c) => c.charCodeAt(0),
                  );
                  download(new Blob([bytes]), activeSource.name);
                }
              }}
            >
              <Download size={14} /> Download original file
            </button>
            <p className="inline-note">
              Showing the first {Math.min(200, activeSource.rows.length)} of{" "}
              {activeSource.rows.length.toLocaleString()} rows. Download the
              source for the complete data.
            </p>
            <div className="data-table-wrap">
              <table>
                <thead>
                  <tr>
                    {activeSource.headers.map((h, i) => (
                      <th key={i}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {activeSource.rows.slice(0, 200).map((r, i) => (
                    <tr key={i}>
                      {r.map((v, j) => (
                        <td key={j}>{v}</td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}
      </Drawer>
      <Drawer
        open={mappingOpen}
        onClose={() => setMappingOpen(false)}
        title="Edit column mapping"
        description="Choose the source columns for the selected trace. Original files remain unchanged."
      >
        {trace && mappingSource && (
          <>
            <strong>{trace.name}</strong>
            <Field label="X column">
              <select
                value={mx}
                onChange={(e) => {
                  setMx(Number(e.target.value));
                  setMappingAck(false);
                }}
              >
                {mappingSource.headers.map((h, i) => (
                  <option value={i} key={i}>
                    {h}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Y column">
              <select
                value={my}
                onChange={(e) => {
                  setMy(Number(e.target.value));
                  setMappingAck(false);
                }}
              >
                {mappingSource.headers.map((h, i) => (
                  <option value={i} key={i}>
                    {h}
                  </option>
                ))}
              </select>
            </Field>
            <p className="notice">
              {remapReport?.invalidX} invalid X rows cannot be plotted;{" "}
              {remapReport?.missingY} missing Y rows become gaps. Existing
              transformations will apply to the newly selected columns; review
              their parameters.
            </p>
            <label className="check-label">
              <input
                type="checkbox"
                checked={mappingAck}
                onChange={(e) => setMappingAck(e.target.checked)}
              />{" "}
              I checked these column mappings.
            </label>
            <button
              className="primary"
              disabled={
                !mappingAck ||
                mx === my ||
                !remapReport?.valid[0] ||
                remapReport.valid[0] < 2
              }
              onClick={() => {
                edit((p) => {
                  const t = p.traces.find((v) => v.id === trace.id)!;
                  t.xColumn = mx;
                  t.yColumn = my;
                });
                setMappingOpen(false);
              }}
            >
              Apply mapping
            </button>
          </>
        )}
      </Drawer>
    </div>
  );
}
