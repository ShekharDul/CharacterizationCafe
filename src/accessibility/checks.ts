import { color, extent } from "d3";
import { type Project, type Preview } from "../domain/model";
import { processProject } from "../scientific/transformations";
export function simulate(hex: string, mode: Preview): string {
  const c = color(hex)?.rgb();
  if (!c || mode === "normal") return hex;
  const matrix: Record<Exclude<Preview, "normal">, number[][]> = {
    greyscale: [
      [0.2126, 0.7152, 0.0722],
      [0.2126, 0.7152, 0.0722],
      [0.2126, 0.7152, 0.0722],
    ],
    deuteranopia: [
      [0.367, 0.861, -0.228],
      [0.28, 0.673, 0.047],
      [-0.012, 0.043, 0.969],
    ],
    protanopia: [
      [0.152, 1.053, -0.205],
      [0.115, 0.786, 0.099],
      [-0.004, -0.048, 1.052],
    ],
    tritanopia: [
      [1.256, -0.077, -0.179],
      [-0.078, 0.931, 0.148],
      [0.005, 0.691, 0.304],
    ],
  };
  const linear = [c.r, c.g, c.b].map((v) =>
    v / 255 <= 0.04045 ? v / 255 / 12.92 : ((v / 255 + 0.055) / 1.055) ** 2.4,
  );
  return `rgb(${matrix[mode]
    .map((row) => {
      const v = Math.max(
        0,
        Math.min(
          1,
          row.reduce((s, k, i) => s + k * linear[i], 0),
        ),
      );
      return Math.round(
        255 * (v <= 0.0031308 ? v * 12.92 : 1.055 * v ** (1 / 2.4) - 0.055),
      );
    })
    .join(",")})`;
}
export type Check = {
  level: "ready" | "suggestion" | "warning" | "error";
  text: string;
};
export function figureChecks(p: Project): Check[] {
  const checks: Check[] = [];
  const visible = p.traces.filter((t) => t.visible);
  const processed = processProject(p).filter((t) =>
    visible.some((v) => v.id === t.id),
  );
  if (
    !processed.some((t) =>
      t.points.some(
        (v) =>
          v.y !== null &&
          (!p.config.x.log || v.x > 0) &&
          (!p.config.y.log || v.y > 0),
      ),
    )
  )
    checks.push({
      level: "error",
      text: "No valid visible data. Check column mapping, visibility, and axis scales.",
    });
  if (
    !Number.isFinite(p.config.width) ||
    !Number.isFinite(p.config.height) ||
    p.config.width < 30 ||
    p.config.height < 30
  )
    checks.push({
      level: "error",
      text: "Figure width and height must be at least 30 mm.",
    });
  for (const axis of ["x", "y"] as const) {
    const a = p.config[axis];
    if (!a.label.trim())
      checks.push({
        level: "suggestion",
        text: `Add an ${axis.toUpperCase()}-axis label.`,
      });
    if (a.min !== null && a.max !== null && a.min >= a.max)
      checks.push({
        level: "error",
        text: `${axis.toUpperCase()}-axis minimum must be smaller than maximum.`,
      });
    if (
      a.log &&
      ((a.min !== null && a.min <= 0) || (a.max !== null && a.max <= 0))
    )
      checks.push({
        level: "error",
        text: `Logarithmic ${axis.toUpperCase()}-axis bounds must be positive.`,
      });
    if (
      a.log &&
      processed.some((t) =>
        t.points.some(
          (v) =>
            (axis === "x" ? v.x : v.y) !== null &&
            (axis === "x" ? v.x : v.y)! <= 0,
        ),
      )
    )
      checks.push({
        level: "warning",
        text: `Non-positive ${axis.toUpperCase()} values cannot be drawn on a logarithmic axis. They remain in your raw data.`,
      });
  }
  if (p.config.fontSize < 8)
    checks.push({
      level: "suggestion",
      text: "Increase text to at least 8 pt for readability at final print size.",
    });
  if (visible.some((t) => t.width < 0.6))
    checks.push({
      level: "suggestion",
      text: "Some lines may be too thin for print. Consider at least 0.6 pt.",
    });
  if (new Set(visible.map((t) => t.name)).size < visible.length)
    checks.push({
      level: "warning",
      text: "Some legend names are identical. Use distinct sample names.",
    });
  if (
    visible.some(
      (t) =>
        (t.xUnit && !p.config.x.label.includes(t.xUnit)) ||
        (t.yUnit && !p.config.y.label.includes(t.yUnit)),
    )
  )
    checks.push({
      level: "suggestion",
      text: "Mapped units are missing from an axis label. Confirm that the displayed units are correct.",
    });
  for (let i = 0; i < visible.length; i++)
    for (let j = i + 1; j < visible.length; j++) {
      const a = visible[i],
        b = visible[j];
      const l = (s: string) => {
        const c = color(simulate(s, "greyscale"))!.rgb();
        return c.r;
      };
      if (
        Math.abs(l(a.colour) - l(b.colour)) < 35 &&
        a.dash === b.dash &&
        a.marker === b.marker
      ) {
        checks.push({
          level: "suggestion",
          text: "Two series look similar in greyscale. Add line styles or markers.",
        });
        i = visible.length;
        break;
      }
    }
  if (
    p.config.legend !== "hidden" &&
    p.config.legend !== "outside" &&
    p.config.legend !== "direct" &&
    visible.length > 1
  )
    checks.push({
      level: "suggestion",
      text: "Check the legend against your traces. Outside placement avoids possible overlap.",
    });
  const all = processed.flatMap((t) => t.points.filter((v) => v.y !== null));
  if (all.length) {
    const xExtent = extent(all, (v) => v.x),
      yExtent = extent(all, (v) => v.y!);
    const xr = [p.config.x.min ?? xExtent[0]!, p.config.x.max ?? xExtent[1]!];
    const yr = [p.config.y.min ?? yExtent[0]!, p.config.y.max ?? yExtent[1]!];
    if (
      p.annotations.some(
        (a) => a.x < xr[0] || a.x > xr[1] || a.y < yr[0] || a.y > yr[1],
      )
    )
      checks.push({
        level: "warning",
        text: "An annotation anchor lies outside the displayed data range. Check its position.",
      });
  }
  processed.forEach((t) =>
    t.warnings.forEach((text) => checks.push({ level: "warning", text })),
  );
  return checks.length
    ? checks
    : [{ level: "ready", text: "Your figure is ready to export." }];
}
