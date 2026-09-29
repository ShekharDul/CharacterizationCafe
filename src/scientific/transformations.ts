import {
  type Point,
  type Project,
  type Transformation,
  rawPoints,
  uid,
} from "../domain/model";
export type Processed = { id: string; points: Point[]; warnings: string[] };
export function processProject(project: Project): Processed[] {
  const result = project.traces.map((t) => ({
    id: t.id,
    points: rawPoints(project, t),
    warnings: [] as string[],
  }));
  for (const op of project.transformations.filter((o) => o.enabled)) {
    const selected = result.filter((t) => op.traceIds.includes(t.id));
    const maximum = (points: Point[]) =>
      points.reduce((m, p) => (p.y === null ? m : Math.max(m, p.y)), -Infinity);
    const globalMax = selected.reduce(
      (m, t) => Math.max(m, maximum(t.points)),
      -Infinity,
    );
    selected.forEach((trace) => {
      const max =
        op.type === "globalNormalize" ? globalMax : maximum(trace.points);
      if (
        (op.type === "normalize" || op.type === "globalNormalize") &&
        (!Number.isFinite(max) || max <= 0)
      ) {
        trace.warnings.push(
          "Normalization skipped: a positive maximum is required. Raw/current values are retained.",
        );
        return;
      }
      if (op.type === "derivative") {
        const xs = trace.points.map((p) => p.x);
        const direction = Math.sign(xs[1] - xs[0]);
        if (
          xs.length < 3 ||
          !direction ||
          xs.some((x, i) => i > 0 && Math.sign(x - xs[i - 1]) !== direction)
        ) {
          trace.warnings.push(
            "Derivative skipped: at least three strictly monotonic X values are required.",
          );
          return;
        }
        const before = trace.points;
        trace.points = before.map((p, i) => {
          const a = before[Math.max(0, i - 1)],
            b = before[Math.min(before.length - 1, i + 1)];
          return {
            x: p.x,
            y:
              p.y === null || a.y === null || b.y === null
                ? null
                : (b.y - a.y) / (b.x - a.x),
          };
        });
      } else
        trace.points = trace.points.map((p) => ({
          ...p,
          y:
            p.y === null
              ? null
              : op.type === "normalize" || op.type === "globalNormalize"
                ? (p.y / max) * op.value
                : op.type === "offset"
                  ? p.y + op.value
                  : op.type === "flip"
                    ? -p.y
                    : p.y * op.value,
        }));
      if (trace.points.some((p) => p.y !== null && !Number.isFinite(p.y))) {
        trace.warnings.push(
          "Processing produced a non-finite value; revise the parameters.",
        );
        trace.points = trace.points.map((p) => ({
          ...p,
          y: p.y !== null && Number.isFinite(p.y) ? p.y : null,
        }));
      }
    });
  }
  return result;
}
export function operation(
  type: Transformation["type"],
  traceIds: string[],
  value = 1,
): Transformation {
  const description: Record<Transformation["type"], string> = {
    normalize: `Normalize each trace: y ÷ positive trace maximum × ${value}.`,
    globalNormalize: `Normalize together: y ÷ positive maximum of all selected traces × ${value}.`,
    scale: `Scale intensity: y × ${value}.`,
    offset: `Vertical offset: y + ${value}.`,
    flip: "Flip direction: y × −1.",
    derivative:
      "Numerical derivative: centred secant differences; one-sided endpoints; no smoothing. Differentiation can amplify noise.",
  };
  return {
    id: uid(),
    type,
    traceIds,
    enabled: true,
    value,
    method: type === "derivative" ? "centred-secant-v1" : "arithmetic-v1",
    description: description[type],
    createdAt: new Date().toISOString(),
  };
}
export function stackProject(project: Project, spacing: number): Project {
  const ids = project.traces.filter((t) => t.visible).map((t) => t.id);
  return {
    ...project,
    config: { ...project.config, layout: "stacked" },
    transformations: [
      ...project.transformations.filter(
        (t) => !(t.type === "offset" && t.method === "stack-v1"),
      ),
      ...ids.slice(1).map((id, i) => ({
        ...operation("offset", [id], spacing * (i + 1)),
        method: "stack-v1",
      })),
    ],
  };
}
