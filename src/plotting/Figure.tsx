import { useId, useMemo, useRef, useState } from "react";
import { extent, line, scaleLinear, scaleLog, format } from "d3";
import {
  type Project,
  type Preview,
  type Point,
  type Annotation,
} from "../domain/model";
import { processProject } from "../scientific/transformations";
import { simulate } from "../accessibility/checks";

export const dashArray = {
  solid: "",
  dash: "7 4",
  dot: "1.5 3",
  dashdot: "7 3 1.5 3",
};
export function bounds(values: number[], log = false): [number, number] {
  const [a, b] = extent(
    values.filter((v) => Number.isFinite(v) && (!log || v > 0)),
  );
  if (a === undefined || b === undefined) return log ? [1, 10] : [0, 1];
  if (a === b) return log ? [a / 2, a * 2] : [a - 1, b + 1];
  return [a, b];
}
export function Figure({
  project,
  preview = "normal",
  raw = false,
  onSelect,
  onAnnotation,
  onLabel,
  onLegend,
}: {
  project: Project;
  preview?: Preview;
  raw?: boolean;
  onSelect?: (id: string) => void;
  onAnnotation?: (id: string, x: number, y: number) => void;
  onLabel?: (label: "title" | "x" | "y") => void;
  onLegend?: (position: Project["config"]["legend"]) => void;
}) {
  const clipId = useId().replace(/:/g, "");
  const svg = useRef<SVGSVGElement>(null);
  const [drag, setDrag] = useState<{ id: string; x: number; y: number } | null>(
    null,
  );
  const p = project,
    c = p.config;
  const W = c.width * 4,
    H = c.height * 4,
    pt = (4 * 25.4) / 72,
    F = c.fontSize * pt;
  const margin = {
    left: Math.max(53, F * 4.3) + c.margin,
    top: (c.subtitle ? F * 4.5 : c.title ? F * 3.2 : F * 1.5) + c.margin,
    right: (c.legend === "outside" ? W * 0.23 : 24) + c.margin,
    bottom: F * 3.5 + c.margin,
  };
  const innerW = Math.max(20, W - margin.left - margin.right),
    innerH = Math.max(20, H - margin.top - margin.bottom);
  const traces = useMemo(
    () =>
      processProject(raw ? { ...p, transformations: [] } : p).filter(
        (t) => p.traces.find((s) => s.id === t.id)?.visible,
      ),
    [p, raw],
  );
  const points = traces.flatMap((t) => t.points);
  let xd = bounds(
      points.map((v) => v.x),
      c.x.log,
    ),
    yd = bounds(
      points.flatMap((v) => (v.y === null ? [] : [v.y])),
      c.y.log,
    );
  if (!c.y.log) {
    const pad = (yd[1] - yd[0]) * 0.07;
    yd = [yd[0] - pad, yd[1] + pad];
  }
  xd = [c.x.min ?? xd[0], c.x.max ?? xd[1]];
  yd = [c.y.min ?? yd[0], c.y.max ?? yd[1]];
  const safe = (d: [number, number], log: boolean): [number, number] =>
    d[0] >= d[1] || (log && d[0] <= 0) ? (log ? [1, 10] : [0, 1]) : d;
  const x = (c.x.log ? scaleLog() : scaleLinear())
    .domain(safe(xd, c.x.log))
    .range(c.x.reverse ? [innerW, 0] : [0, innerW]);
  const y = (c.y.log ? scaleLog() : scaleLinear())
    .domain(safe(yd, c.y.log))
    .range(c.y.reverse ? [0, innerH] : [innerH, 0]);
  const valid = (d: Point) =>
    d.y !== null &&
    Number.isFinite(d.y) &&
    (!c.x.log || d.x > 0) &&
    (!c.y.log || d.y! > 0);
  const path = line<Point>()
    .defined(valid)
    .x((d) => x(d.x))
    .y((d) => y(d.y!));
  const tickFormat = (n: number) =>
    c.decimals !== null
      ? n.toFixed(c.decimals)
      : Math.abs(n) >= 10000
        ? format(".2~s")(n)
        : format("~g")(Number(n.toPrecision(5)));
  const coords = (e: React.PointerEvent) => {
    const rect = svg.current!.getBoundingClientRect();
    return {
      x: ((e.clientX - rect.left) * W) / rect.width - margin.left,
      y: ((e.clientY - rect.top) * H) / rect.height - margin.top,
    };
  };
  const down = (e: React.PointerEvent, id: string) => {
    if (!onAnnotation && !onLegend) return;
    e.currentTarget.setPointerCapture(e.pointerId);
    const pos = coords(e);
    setDrag({ id, ...pos });
  };
  const up = () => {
    if (drag) {
      if (drag.id === "legend")
        onLegend?.(
          drag.x < innerW / 2
            ? "top-left"
            : drag.y > innerH / 2
              ? "bottom-right"
              : "top-right",
        );
      else onAnnotation?.(drag.id, x.invert(drag.x), y.invert(drag.y));
      setDrag(null);
    }
  };
  const annotation = (a: Annotation) => {
    const ax = drag?.id === a.id ? drag.x : x(a.x),
      ay = drag?.id === a.id ? drag.y : y(a.y);
    const col = simulate(a.colour, preview);
    return (
      <g
        key={a.id}
        tabIndex={onAnnotation ? 0 : undefined}
        role={onAnnotation ? "button" : undefined}
        aria-label={`Annotation ${a.text || a.type}`}
        style={{ cursor: onAnnotation ? "move" : undefined }}
        onPointerDown={(e) => down(e, a.id)}
        onKeyDown={(e) => {
          if (!onAnnotation) return;
          const delta = (xd[1] - xd[0]) * 0.01,
            dy = (yd[1] - yd[0]) * 0.01;
          if (
            ["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown"].includes(e.key)
          ) {
            e.preventDefault();
            onAnnotation(
              a.id,
              a.x +
                (e.key === "ArrowLeft"
                  ? -delta
                  : e.key === "ArrowRight"
                    ? delta
                    : 0),
              a.y +
                (e.key === "ArrowUp" ? dy : e.key === "ArrowDown" ? -dy : 0),
            );
          }
        }}
      >
        {a.type === "region" && (
          <rect
            x={Math.min(ax, x(a.x2))}
            y={0}
            width={Math.abs(x(a.x2) - ax)}
            height={innerH}
            fill={col}
            opacity={0.12}
          />
        )}
        {(a.type === "vline" || a.type === "stick") && (
          <line
            x1={ax}
            x2={ax}
            y1={a.type === "stick" ? innerH - 18 : 0}
            y2={innerH}
            stroke={col}
            strokeWidth={1.5}
            strokeDasharray={a.type === "vline" ? "4 3" : undefined}
          />
        )}
        {a.type === "hline" && (
          <line
            x1={0}
            x2={innerW}
            y1={ay}
            y2={ay}
            stroke={col}
            strokeDasharray="4 3"
          />
        )}
        {(a.type === "peak" || a.type === "arrow") && (
          <>
            <line x1={ax} y1={ay - 24} x2={ax} y2={ay - 4} stroke={col} />
            <path
              d={`M${ax - 3},${ay - 9}L${ax},${ay - 4}L${ax + 3},${ay - 9}`}
              fill="none"
              stroke={col}
            />
          </>
        )}
        <text
          x={ax}
          y={
            a.type === "region"
              ? F + 4
              : a.type === "stick"
                ? innerH - 24
                : a.type === "peak" || a.type === "arrow"
                  ? ay - 29
                  : ay
          }
          fill={col}
          textAnchor="middle"
          fontSize={F * 0.9}
        >
          {a.text}
        </text>
        {onAnnotation && (
          <rect
            data-editor-only="true"
            x={ax - 16}
            y={ay - 25}
            width={32}
            height={30}
            fill="transparent"
          />
        )}
      </g>
    );
  };
  const visible = p.traces.filter((t) => t.visible);
  const legendW = Math.max(
    75,
    ...visible.map((t) => t.name.length * F * 0.53 + 36),
  );
  const lx =
      drag?.id === "legend"
        ? drag.x
        : c.legend === "outside"
          ? innerW + 12
          : c.legend === "top-left"
            ? 10
            : Math.max(0, innerW - legendW - 8),
    ly =
      drag?.id === "legend"
        ? drag.y
        : c.legend === "bottom-right"
          ? innerH - visible.length * F * 1.6 - 10
          : 10;
  return (
    <svg
      ref={svg}
      data-figure-svg="true"
      xmlns="http://www.w3.org/2000/svg"
      viewBox={`0 0 ${W} ${H}`}
      width={`${c.width}mm`}
      height={`${c.height}mm`}
      role="img"
      aria-label={`${p.technique} figure: ${c.title || p.name}`}
      style={{
        fontFamily: c.font,
        fontSize: F,
        background: c.transparent ? "transparent" : c.background,
        touchAction: "none",
      }}
      onPointerMove={(e) => {
        if (drag) setDrag({ ...drag, ...coords(e) });
      }}
      onPointerUp={up}
      onPointerCancel={() => setDrag(null)}
    >
      <title>{c.title || p.name}</title>
      <desc>{`${c.x.label} versus ${c.y.label}. ${visible.map((t) => t.name).join(", ")}. ${p.transformations.filter((t) => t.enabled).length} explicit processing steps.`}</desc>
      {!c.transparent && <rect width={W} height={H} fill={c.background} />}
      <defs>
        <clipPath id={clipId}>
          <rect width={innerW} height={innerH} />
        </clipPath>
      </defs>
      <text
        x={margin.left + innerW / 2}
        y={F * 1.5}
        textAnchor="middle"
        fontWeight="600"
        fontSize={F * 1.15}
        fill="#202c30"
        onClick={() => onLabel?.("title")}
        style={{ cursor: onLabel ? "pointer" : undefined }}
      >
        {c.title}
      </text>
      {c.subtitle && (
        <text
          x={margin.left + innerW / 2}
          y={F * 2.65}
          textAnchor="middle"
          fontSize={F * 0.85}
          fill="#53636a"
        >
          {c.subtitle}
        </text>
      )}
      <g transform={`translate(${margin.left},${margin.top})`}>
        {p.technique === "DSC" && (
          <text x={0} y={-6} fontSize={F * 0.75} fill="#53636a">
            {c.convention === "Endotherm up"
              ? "↑ Endotherm up"
              : "↓ Endotherm down"}
          </text>
        )}
        {x.ticks(c.tickCount).map((t) => (
          <g key={t} transform={`translate(${x(t)},0)`}>
            {c.grid && <line y2={innerH} stroke="#e6e9eb" strokeWidth={0.6} />}
            <line
              y1={innerH}
              y2={innerH + 4}
              stroke="#333"
              strokeWidth={c.lineWeight * pt}
            />
            <text y={innerH + F + 6} textAnchor="middle" fill="#333">
              {tickFormat(t)}
            </text>
          </g>
        ))}
        {y.ticks(c.tickCount).map((t) => (
          <g key={t} transform={`translate(0,${y(t)})`}>
            {c.grid && <line x2={innerW} stroke="#e6e9eb" strokeWidth={0.6} />}
            <line x1={-4} stroke="#333" strokeWidth={c.lineWeight * pt} />
            <text x={-8} dy=".32em" textAnchor="end" fill="#333">
              {tickFormat(t)}
            </text>
          </g>
        ))}
        {c.frame !== "none" && (
          <path
            d={
              c.frame === "box"
                ? `M0,0H${innerW}V${innerH}H0Z`
                : `M0,0V${innerH}H${innerW}`
            }
            stroke="#333"
            strokeWidth={c.lineWeight * pt}
            fill="none"
          />
        )}
        <g clipPath={`url(#${clipId})`}>
          {p.annotations.filter((a) => a.type === "region").map(annotation)}
          {traces.map((data) => {
            const t = p.traces.find((t) => t.id === data.id)!;
            const col = simulate(t.colour, preview);
            return (
              <g
                key={t.id}
                opacity={t.opacity}
                onClick={() => onSelect?.(t.id)}
                style={{ cursor: onSelect ? "pointer" : undefined }}
              >
                <title>{t.name}</title>
                {t.mode !== "markers" && (
                  <path
                    d={path(data.points) ?? ""}
                    fill="none"
                    stroke={col}
                    strokeWidth={t.width * pt}
                    strokeDasharray={dashArray[t.dash]}
                    strokeLinejoin="round"
                    strokeLinecap="round"
                  />
                )}
                {(t.marker !== "none" || t.mode !== "line") &&
                  data.points.filter(valid).map((v, i) => {
                    const cx = x(v.x),
                      cy = y(v.y!),
                      r = 2.6;
                    return (
                      <g key={i} fill={col} stroke={col}>
                        {t.marker === "square" ? (
                          <rect
                            x={cx - r}
                            y={cy - r}
                            width={r * 2}
                            height={r * 2}
                          />
                        ) : t.marker === "triangle" ? (
                          <path
                            d={`M${cx},${cy - r}l${r},${r * 2}h${-r * 2}Z`}
                          />
                        ) : t.marker === "diamond" ? (
                          <path
                            d={`M${cx},${cy - r}l${r},${r}l${-r},${r}l${-r},${-r}Z`}
                          />
                        ) : t.marker === "cross" ? (
                          <path
                            d={`M${cx - r},${cy}h${2 * r}M${cx},${cy - r}v${2 * r}`}
                            fill="none"
                          />
                        ) : (
                          <circle cx={cx} cy={cy} r={r} />
                        )}
                      </g>
                    );
                  })}
              </g>
            );
          })}
          {p.annotations.filter((a) => a.type !== "region").map(annotation)}
        </g>
        {c.legend === "direct" &&
          traces.map((data) => {
            const t = p.traces.find((t) => t.id === data.id)!;
            const last = data.points.filter(valid).at(-1);
            return last ? (
              <text
                key={t.id}
                x={Math.max(0, Math.min(innerW, x(last.x))) - 5}
                y={Math.max(F, Math.min(innerH, y(last.y!))) - 5}
                textAnchor="end"
                fill={simulate(t.colour, preview)}
                fontSize={F * 0.85}
              >
                {t.name}
              </text>
            ) : null;
          })}
        {c.legend !== "hidden" && c.legend !== "direct" && (
          <g
            transform={`translate(${lx},${ly})`}
            onPointerDown={(e) => down(e, "legend")}
            style={{ cursor: onLegend ? "move" : undefined }}
          >
            <rect
              x={-5}
              y={-5}
              width={legendW + 10}
              height={visible.length * F * 1.6 + 8}
              fill={c.background}
              opacity={0.92}
            />
            {visible.map((t, i) => (
              <g key={t.id} transform={`translate(0,${i * F * 1.6})`}>
                <line
                  x2={24}
                  y1={F * 0.45}
                  y2={F * 0.45}
                  stroke={simulate(t.colour, preview)}
                  strokeWidth={t.width * pt}
                  strokeDasharray={dashArray[t.dash]}
                />
                <text x={32} y={F * 0.75} fontSize={F * 0.85} fill="#333">
                  {t.name}
                </text>
              </g>
            ))}
          </g>
        )}
        <text
          x={innerW / 2}
          y={innerH + F * 2.8}
          textAnchor="middle"
          fill="#222"
          onClick={() => onLabel?.("x")}
          style={{ cursor: onLabel ? "pointer" : undefined }}
        >
          {c.x.label}
        </text>
        <text
          transform={`translate(${-margin.left + F * 1.1},${innerH / 2}) rotate(-90)`}
          textAnchor="middle"
          fill="#222"
          onClick={() => onLabel?.("y")}
          style={{ cursor: onLabel ? "pointer" : undefined }}
        >
          {c.y.label}
        </text>
      </g>
    </svg>
  );
}
