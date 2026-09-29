import { z } from "zod";

export const APP_VERSION = "0.1.0";
export const techniques = [
  "XRD",
  "Raman",
  "FTIR",
  "UV–Vis",
  "NMR",
  "TGA",
  "DSC",
] as const;
export type Technique = (typeof techniques)[number];
export type Preview =
  | "normal"
  | "greyscale"
  | "deuteranopia"
  | "protanopia"
  | "tritanopia";
export type Point = { x: number; y: number | null };
export type Layout = "single" | "overlay" | "stacked" | "markers";
export const palettes: Record<string, string[]> = {
  "Colour-blind safe": [
    "#0072B2",
    "#D55E00",
    "#009E73",
    "#CC79A7",
    "#E69F00",
    "#56B4E9",
    "#222222",
  ],
  "High contrast": ["#163B70", "#AC340C", "#006045", "#8D2D88", "#685700"],
  Monochrome: ["#202020", "#555555", "#858585", "#383838"],
  "Soft scientific": ["#3E647D", "#AF5944", "#56816A", "#806789"],
  "Sequential blue": ["#08306B", "#2171B5", "#4292C6", "#6BAED6"],
  "Viridis-like": ["#440154", "#3B528B", "#21918C", "#5EC962", "#B5DE2B"],
  "Blue–orange": ["#2166AC", "#4393C3", "#B35806", "#E08214"],
};
const finite = z.number().finite();
export const sourceSchema = z.object({
  id: z.string(),
  name: z.string(),
  size: z.number(),
  content: z.string(),
  encoding: z.enum(["text", "base64"]),
  sheet: z.string().optional(),
  delimiter: z.string(),
  headers: z.array(z.string()),
  rows: z.array(z.array(z.string())),
  warnings: z.array(z.string()),
  synthetic: z.boolean(),
});
export type SourceFile = z.infer<typeof sourceSchema>;
const traceSchema = z.object({
  id: z.string(),
  sourceId: z.string(),
  name: z.string(),
  xColumn: z.number().int().nonnegative(),
  yColumn: z.number().int().nonnegative(),
  xUnit: z.string(),
  yUnit: z.string(),
  visible: z.boolean(),
  colour: z.string().regex(/^#[0-9a-f]{6}$/i),
  width: finite.min(0.1).max(10),
  dash: z.enum(["solid", "dash", "dot", "dashdot"]),
  marker: z.enum(["none", "circle", "square", "triangle", "diamond", "cross"]),
  opacity: finite.min(0).max(1),
  mode: z.enum(["line", "markers", "both"]),
});
export type Trace = z.infer<typeof traceSchema>;
const transformationSchema = z.object({
  id: z.string(),
  type: z.enum([
    "normalize",
    "globalNormalize",
    "scale",
    "offset",
    "flip",
    "derivative",
  ]),
  traceIds: z.array(z.string()),
  enabled: z.boolean(),
  value: finite,
  method: z.string(),
  description: z.string(),
  createdAt: z.string(),
});
export type Transformation = z.infer<typeof transformationSchema>;
const annotationSchema = z.object({
  id: z.string(),
  type: z.enum(["text", "peak", "region", "vline", "hline", "arrow", "stick"]),
  text: z.string(),
  x: finite,
  y: finite,
  x2: finite,
  colour: z.string(),
});
export type Annotation = z.infer<typeof annotationSchema>;
const axisSchema = z.object({
  label: z.string(),
  reverse: z.boolean(),
  log: z.boolean(),
  min: finite.nullable(),
  max: finite.nullable(),
});
export const configSchema = z.object({
  title: z.string(),
  subtitle: z.string(),
  notes: z.string(),
  width: finite.positive().max(600),
  height: finite.positive().max(600),
  dpi: z.union([z.literal(300), z.literal(600), z.literal(1200)]),
  x: axisSchema,
  y: axisSchema,
  font: z.enum(["Arial", "Georgia", "Verdana"]),
  fontSize: finite.min(5).max(30),
  lineWeight: finite.min(0.2).max(4),
  grid: z.boolean(),
  frame: z.enum(["axes", "box", "none"]),
  legend: z.enum([
    "top-right",
    "top-left",
    "bottom-right",
    "outside",
    "hidden",
    "direct",
  ]),
  palette: z.string(),
  layout: z.enum(["single", "overlay", "stacked", "markers"]),
  preset: z.string(),
  margin: finite.min(0).max(40),
  tickCount: finite.min(2).max(15),
  decimals: z.number().int().min(0).max(6).nullable(),
  background: z.string(),
  transparent: z.boolean(),
  convention: z.enum(["Endotherm up", "Endotherm down"]),
});
export type ChartConfig = z.infer<typeof configSchema>;
export const projectSchema = z.object({
  schemaVersion: z.literal(1),
  id: z.string(),
  name: z.string(),
  technique: z.enum(techniques),
  createdAt: z.string(),
  updatedAt: z.string(),
  sources: z.array(sourceSchema),
  traces: z.array(traceSchema),
  transformations: z.array(transformationSchema),
  annotations: z.array(annotationSchema),
  config: configSchema,
});
export type Project = z.infer<typeof projectSchema>;
export const uid = () => crypto.randomUUID();
export const clone = <T>(value: T): T => structuredClone(value);

export function numeric(value: string | undefined): number | null {
  if (value === undefined || !value.trim()) return null;
  // Decimal commas require an explicit import choice. Never strip punctuation or units.
  const s = value.trim();
  if (!/^[+-]?(?:\d+\.?\d*|\.\d+)(?:[eE][+-]?\d+)?$/.test(s)) return null;
  const n = Number(s);
  return Number.isFinite(n) ? n : null;
}
export function rawPoints(project: Project, trace: Trace): Point[] {
  const source = project.sources.find((s) => s.id === trace.sourceId);
  if (!source) return [];
  return source.rows.flatMap((row) => {
    const x = numeric(row[trace.xColumn]);
    return x === null ? [] : [{ x, y: numeric(row[trace.yColumn]) }];
  });
}
export function newTrace(
  source: SourceFile,
  xColumn: number,
  yColumn: number,
  name: string,
  index: number,
): Trace {
  return {
    id: uid(),
    sourceId: source.id,
    name,
    xColumn,
    yColumn,
    xUnit: "",
    yUnit: "",
    visible: true,
    colour: palettes["Colour-blind safe"][index % 7],
    width: 1.3,
    dash: (["solid", "dash", "dot", "dashdot"] as const)[
      Math.floor(index / 7) % 4
    ],
    marker: "none",
    opacity: 1,
    mode: "line",
  };
}
