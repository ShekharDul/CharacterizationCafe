import { useState } from "react";
import { Plus, RotateCcw, Trash2 } from "lucide-react";
import { Field, NumberInput, Toggle } from "../components/ui";
import { useEditor } from "../domain/store";
import {
  type Annotation,
  type ChartConfig,
  palettes,
  uid,
} from "../domain/model";
import { createProject, templates, presets } from "../scientific/techniques";
import {
  operation,
  processProject,
  stackProject,
} from "../scientific/transformations";
import { bounds } from "../plotting/Figure";

export function Properties() {
  const { project: p, edit, selected } = useEditor();
  const [annotationType, setAnnotationType] =
      useState<Annotation["type"]>("peak"),
    [annotationText, setAnnotationText] = useState(""),
    [spacing, setSpacing] = useState(0.2),
    [flipConfirm, setFlipConfirm] = useState(false);
  if (!p) return null;
  const c = p.config,
    t = p.traces.find((t) => t.id === selected) ?? p.traces[0];
  const config = <K extends keyof ChartConfig>(key: K, value: ChartConfig[K]) =>
    edit((p) => {
      p.config[key] = value;
    });
  const processed = processProject(p);
  const pts = processed.flatMap((t) => t.points);
  const xb = bounds(pts.map((v) => v.x)),
    yb = bounds(pts.flatMap((v) => (v.y === null ? [] : [v.y])));
  const addAnnotation = () =>
    edit((p) => {
      p.annotations.push({
        id: uid(),
        type: annotationType,
        text: annotationText || templates[p.technique].annotation,
        x: (xb[0] + xb[1]) / 2,
        y: yb[0] + (yb[1] - yb[0]) * 0.8,
        x2: xb[0] + (xb[1] - xb[0]) * 0.65,
        colour: "#525b63",
      });
    });
  return (
    <aside className="properties">
      <div className="panel-heading">
        <span>Make it yours</span>
        <span className="muted">Properties</span>
      </div>
      <details open>
        <summary>Figure</summary>
        <div className="control-section">
          <Field label="Title">
            <input
              id="property-title"
              placeholder="Add a figure title"
              value={c.title}
              onChange={(e) => config("title", e.target.value)}
            />
          </Field>
          <Field label="Subtitle">
            <input
              value={c.subtitle}
              placeholder="Optional"
              onChange={(e) => config("subtitle", e.target.value)}
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
                    p.config.preset = "Custom dimensions";
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
                    p.config.preset = "Custom dimensions";
                  })
                }
              />
            </Field>
          </div>
          <small>Physical size controls the final print dimensions.</small>
          <Field label="Figure notes">
            <textarea
              rows={2}
              value={c.notes}
              placeholder="Notes for your future self"
              onChange={(e) => config("notes", e.target.value)}
            />
          </Field>
          <button
            className="text-button compact"
            onClick={() =>
              edit((p) => {
                const defaults = createProject(p.technique).config;
                p.config.width = defaults.width;
                p.config.height = defaults.height;
              })
            }
          >
            <RotateCcw size={12} /> Reset dimensions
          </button>
        </div>
      </details>
      <details open>
        <summary>Axes</summary>
        <div className="control-section">
          {(["x", "y"] as const).map((axis) => (
            <div key={axis} className="axis-group">
              <Field label={`${axis.toUpperCase()}-axis label`}>
                <input
                  id={`property-${axis}`}
                  value={c[axis].label}
                  onChange={(e) =>
                    config(axis, { ...c[axis], label: e.target.value })
                  }
                />
              </Field>
              {axis === "y" && (
                <Field
                  label="Label preset"
                  hint="Label only. Numerical values stay unchanged."
                >
                  <select
                    value={
                      templates[p.technique].labels.includes(c.y.label)
                        ? c.y.label
                        : ""
                    }
                    onChange={(e) =>
                      config("y", { ...c.y, label: e.target.value })
                    }
                  >
                    <option value="" disabled>
                      Custom label
                    </option>
                    {templates[p.technique].labels.map((l) => (
                      <option key={l}>{l}</option>
                    ))}
                  </select>
                </Field>
              )}
              <div className="two-cols">
                <label className="check-label">
                  <input
                    type="checkbox"
                    checked={c[axis].reverse}
                    onChange={(e) =>
                      config(axis, { ...c[axis], reverse: e.target.checked })
                    }
                  />{" "}
                  Reverse {axis.toUpperCase()}
                </label>
                <label className="check-label">
                  <input
                    type="checkbox"
                    checked={c[axis].log}
                    onChange={(e) =>
                      config(axis, {
                        ...c[axis],
                        log: e.target.checked,
                        min: null,
                        max: null,
                      })
                    }
                  />{" "}
                  Log scale
                </label>
              </div>
              <details className="nested">
                <summary>Displayed range</summary>
                <div className="two-cols">
                  {(["min", "max"] as const).map((edge) => (
                    <Field label={`${axis.toUpperCase()} ${edge}`} key={edge}>
                      <input
                        type="number"
                        placeholder="Auto"
                        value={c[axis][edge] ?? ""}
                        onChange={(e) =>
                          config(axis, {
                            ...c[axis],
                            [edge]:
                              e.target.value === ""
                                ? null
                                : Number(e.target.value),
                          })
                        }
                      />
                    </Field>
                  ))}
                </div>
                <small>
                  Hides values outside the frame; never removes data.
                </small>
              </details>
            </div>
          ))}
          <Toggle
            label="Light gridlines"
            checked={c.grid}
            onChange={(v) => config("grid", v)}
          />
          <button
            className="text-button compact"
            onClick={() =>
              edit((p) => {
                const d = createProject(p.technique);
                p.config.x = d.config.x;
                p.config.y = d.config.y;
              })
            }
          >
            <RotateCcw size={12} /> Reset axes
          </button>
        </div>
      </details>
      {p.technique === "DSC" && (
        <details open>
          <summary>Heat-flow convention</summary>
          <div className="control-section">
            <Field
              label="Declared display convention"
              hint="Choose the convention your uploaded values already use. This label does not flip values."
            >
              <select
                value={c.convention}
                onChange={(e) =>
                  config(
                    "convention",
                    e.target.value as ChartConfig["convention"],
                  )
                }
              >
                <option>Endotherm up</option>
                <option>Endotherm down</option>
              </select>
            </Field>
            <button onClick={() => setFlipConfirm(!flipConfirm)}>
              Flip heat-flow values…
            </button>
            {flipConfirm && (
              <div className="notice">
                This multiplies all heat-flow values by −1 and switches the
                declared convention. Original values are preserved.
                <button
                  className="primary small"
                  onClick={() => {
                    edit((p) => {
                      p.transformations.push(
                        operation(
                          "flip",
                          p.traces.map((t) => t.id),
                        ),
                      );
                      p.config.convention =
                        p.config.convention === "Endotherm up"
                          ? "Endotherm down"
                          : "Endotherm up";
                    });
                    setFlipConfirm(false);
                  }}
                >
                  Apply y × −1
                </button>
              </div>
            )}
          </div>
        </details>
      )}
      {p.technique === "TGA" && (
        <p className="inline-note">
          Mass labels describe your uploaded data. Converting mass % to mg
          requires initial sample mass; use preconverted source data in this
          version.
        </p>
      )}
      <details open>
        <summary>Series {t && <span>{t.name}</span>}</summary>
        <div className="control-section">
          {t ? (
            <>
              <Field label="Sample name">
                <input
                  value={t.name}
                  onChange={(e) =>
                    edit((p) => {
                      p.traces.find((s) => s.id === t.id)!.name =
                        e.target.value;
                    })
                  }
                />
              </Field>
              <div className="two-cols">
                <Field label="Line colour">
                  <input
                    type="color"
                    value={t.colour}
                    onChange={(e) =>
                      edit((p) => {
                        p.traces.find((s) => s.id === t.id)!.colour =
                          e.target.value;
                      })
                    }
                  />
                </Field>
                <Field label="Width (pt)">
                  <NumberInput
                    value={t.width}
                    min={0.1}
                    max={10}
                    step={0.1}
                    onChange={(v) =>
                      edit((p) => {
                        p.traces.find((s) => s.id === t.id)!.width = v;
                      })
                    }
                  />
                </Field>
                <Field label="Line style">
                  <select
                    value={t.dash}
                    onChange={(e) =>
                      edit((p) => {
                        p.traces.find((s) => s.id === t.id)!.dash = e.target
                          .value as typeof t.dash;
                      })
                    }
                  >
                    <option value="solid">Solid</option>
                    <option value="dash">Dashed</option>
                    <option value="dot">Dotted</option>
                    <option value="dashdot">Dash-dot</option>
                  </select>
                </Field>
                <Field label="Marker">
                  <select
                    value={t.marker}
                    onChange={(e) =>
                      edit((p) => {
                        p.traces.find((s) => s.id === t.id)!.marker = e.target
                          .value as typeof t.marker;
                      })
                    }
                  >
                    {[
                      "none",
                      "circle",
                      "square",
                      "triangle",
                      "diamond",
                      "cross",
                    ].map((v) => (
                      <option key={v}>{v}</option>
                    ))}
                  </select>
                </Field>
              </div>
              <Field label="Draw mode">
                <select
                  value={t.mode}
                  onChange={(e) =>
                    edit((p) => {
                      p.traces.find((s) => s.id === t.id)!.mode = e.target
                        .value as typeof t.mode;
                    })
                  }
                >
                  <option value="line">Line</option>
                  <option value="markers">Markers</option>
                  <option value="both">Line + markers</option>
                </select>
              </Field>
              <Field label="Opacity">
                <input
                  type="range"
                  min="0.1"
                  max="1"
                  step="0.05"
                  value={t.opacity}
                  onChange={(e) =>
                    edit((p) => {
                      p.traces.find((s) => s.id === t.id)!.opacity = Number(
                        e.target.value,
                      );
                    })
                  }
                />
              </Field>
            </>
          ) : (
            <p>Add a dataset to style your traces.</p>
          )}
        </div>
      </details>
      <details>
        <summary>Style & typography</summary>
        <div className="control-section">
          <Field label="Palette">
            <select
              value={c.palette}
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
          <div className="two-cols">
            <Field label="Font">
              <select
                value={c.font}
                onChange={(e) =>
                  config("font", e.target.value as ChartConfig["font"])
                }
              >
                {["Arial", "Georgia", "Verdana"].map((v) => (
                  <option key={v}>{v}</option>
                ))}
              </select>
            </Field>
            <Field label="Size (pt)">
              <NumberInput
                value={c.fontSize}
                min={5}
                max={30}
                onChange={(v) => config("fontSize", v)}
              />
            </Field>
          </div>
          <Field label="Legend">
            <select
              value={c.legend}
              onChange={(e) =>
                config("legend", e.target.value as ChartConfig["legend"])
              }
            >
              {[
                "top-right",
                "top-left",
                "bottom-right",
                "outside",
                "hidden",
                "direct",
              ].map((v) => (
                <option key={v}>{v}</option>
              ))}
            </select>
          </Field>
          <Field label="Plot frame">
            <select
              value={c.frame}
              onChange={(e) =>
                config("frame", e.target.value as ChartConfig["frame"])
              }
            >
              <option value="axes">Bottom + left axes</option>
              <option value="box">Full box</option>
              <option value="none">None</option>
            </select>
          </Field>
          <Field label="Background">
            <input
              type="color"
              value={c.background}
              onChange={(e) => config("background", e.target.value)}
            />
          </Field>
        </div>
      </details>
      <details open>
        <summary>Annotations</summary>
        <div className="control-section">
          <Field label="Annotation type">
            <select
              value={annotationType}
              onChange={(e) =>
                setAnnotationType(e.target.value as Annotation["type"])
              }
            >
              <option value="peak">Peak / transition label</option>
              <option value="text">Text / multiplet label</option>
              <option value="region">Highlighted / integration region</option>
              <option value="vline">Vertical guide line</option>
              <option value="hline">Horizontal guide line</option>
              <option value="arrow">Arrow</option>
              {p.technique === "XRD" && (
                <option value="stick">Reference stick</option>
              )}
            </select>
          </Field>
          <Field label="Annotation text">
            <input
              value={annotationText}
              placeholder={templates[p.technique].annotation}
              onChange={(e) => setAnnotationText(e.target.value)}
            />
          </Field>
          <button onClick={addAnnotation}>
            <Plus size={14} /> Add annotation
          </button>
          <small>
            Drag labels on the figure or enter exact coordinates below. No peaks
            are assigned automatically.
          </small>
          {p.annotations.map((a) => (
            <div className="annotation-row" key={a.id}>
              <input
                aria-label="Edit annotation text"
                value={a.text}
                onChange={(e) =>
                  edit((p) => {
                    p.annotations.find((v) => v.id === a.id)!.text =
                      e.target.value;
                  })
                }
              />
              <div className="two-cols">
                <Field label="X position">
                  <NumberInput
                    value={a.x}
                    step={0.1}
                    onChange={(v) =>
                      edit((p) => {
                        p.annotations.find((n) => n.id === a.id)!.x = v;
                      })
                    }
                  />
                </Field>
                <Field
                  label={a.type === "region" ? "Region end X" : "Y position"}
                >
                  <NumberInput
                    value={a.type === "region" ? a.x2 : a.y}
                    step={0.1}
                    onChange={(v) =>
                      edit((p) => {
                        p.annotations.find((n) => n.id === a.id)![
                          a.type === "region" ? "x2" : "y"
                        ] = v;
                      })
                    }
                  />
                </Field>
              </div>
              <button
                className="text-button compact"
                onClick={() =>
                  edit((p) => {
                    p.annotations = p.annotations.filter((n) => n.id !== a.id);
                  })
                }
              >
                <Trash2 size={12} /> Remove
              </button>
            </div>
          ))}
        </div>
      </details>
      <details>
        <summary>Layout</summary>
        <div className="control-section">
          <Field label="Layout">
            <select
              value={c.layout}
              onChange={(e) => {
                const v = e.target.value as ChartConfig["layout"];
                edit((p) => {
                  p.config.layout = v;
                  if (v === "stacked")
                    Object.assign(p, stackProject(p, spacing));
                  else
                    p.transformations = p.transformations.filter(
                      (t) => t.method !== "stack-v1",
                    );
                  p.traces.forEach((t, i) => {
                    t.visible = v === "single" ? i === 0 : true;
                    t.mode = v === "markers" ? "both" : "line";
                    t.marker = v === "markers" ? "circle" : "none";
                  });
                });
              }}
            >
              <option value="single">Single trace</option>
              <option value="overlay">Overlay</option>
              <option value="stacked">Stack traces</option>
              <option value="markers">Lines + markers</option>
            </select>
          </Field>
          <Field label="Stack spacing (current Y units)">
            <NumberInput value={spacing} step={0.1} onChange={setSpacing} />
          </Field>
          <button
            onClick={() =>
              edit((p) => {
                Object.assign(p, stackProject(p, spacing));
              })
            }
          >
            Stack your traces
          </button>
          <button
            className="text-button"
            onClick={() =>
              edit((p) => {
                p.config.margin = 0;
                p.config.legend = "outside";
              })
            }
          >
            Tidy margins & legend
          </button>
        </div>
      </details>
      <details>
        <summary>Output preset</summary>
        <div className="control-section">
          <Field label="Preset">
            <select
              value={c.preset}
              onChange={(e) => {
                const preset = presets.find((v) => v.name === e.target.value);
                edit((p) => {
                  p.config.preset = e.target.value;
                  if (preset) {
                    p.config.width = preset.width;
                    p.config.height = preset.height;
                    p.config.fontSize = preset.fontSize;
                  }
                });
              }}
            >
              {presets.map((v) => (
                <option key={v.name}>{v.name}</option>
              ))}
              <option>Custom dimensions</option>
            </select>
          </Field>
          <p className="inline-note">
            Presets help format your figure. Always check the current artwork
            requirements of your target journal before submission.
          </p>
        </div>
      </details>
      <details>
        <summary>Advanced</summary>
        <div className="control-section">
          <Field label="Additional padding">
            <NumberInput
              value={c.margin}
              min={0}
              max={40}
              onChange={(v) => config("margin", v)}
            />
          </Field>
          <Field label="Tick density">
            <NumberInput
              value={c.tickCount}
              min={2}
              max={15}
              onChange={(v) => config("tickCount", v)}
            />
          </Field>
          <Field label="Decimal places">
            <select
              value={c.decimals ?? "auto"}
              onChange={(e) =>
                config(
                  "decimals",
                  e.target.value === "auto" ? null : Number(e.target.value),
                )
              }
            >
              <option value="auto">Automatic</option>
              {[0, 1, 2, 3, 4, 5, 6].map((v) => (
                <option key={v}>{v}</option>
              ))}
            </select>
          </Field>
          <Field label="Axis weight (pt)">
            <NumberInput
              value={c.lineWeight}
              min={0.2}
              max={4}
              step={0.1}
              onChange={(v) => config("lineWeight", v)}
            />
          </Field>
          <Toggle
            label="Transparent background"
            checked={c.transparent}
            onChange={(v) => config("transparent", v)}
          />
        </div>
      </details>
    </aside>
  );
}
