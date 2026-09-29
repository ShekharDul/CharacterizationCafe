import { describe, it, expect } from "vitest";
import {
  numeric,
  newTrace,
  rawPoints,
  techniques,
  projectSchema,
} from "../src/domain/model";
import { parseText, mappingReport } from "../src/importing/parse";
import { sampleProject } from "../src/scientific/samples";
import {
  operation,
  processProject,
  stackProject,
} from "../src/scientific/transformations";
import { pixels, recipe, filename, withDpi } from "../src/exporting/export";
import { figureChecks } from "../src/accessibility/checks";
import { createProject } from "../src/scientific/techniques";
import "fake-indexeddb/auto";
import { repository } from "../src/persistence/repository";

describe("scientific integrity", () => {
  it("keeps missing values and refuses ambiguous numeric formats", () => {
    expect(numeric("")).toBeNull();
    expect(numeric("1,25")).toBeNull();
    expect(numeric("12 mg")).toBeNull();
    expect(numeric("2.5e-3")).toBe(0.0025);
  });
  it("reports invalid mappings without repairing the source", () => {
    const s = parseText("x,y\n1,2\n2,\ninvalid,4\n4,5", "raw.csv");
    expect(mappingReport(s, 0, [1])).toEqual({
      invalidX: 1,
      missingY: 1,
      valid: [2],
    });
    expect(s.rows[2][0]).toBe("invalid");
  });
  it("detects tab/semicolon files and supports headerless input", () => {
    expect(parseText("x\ty\n1\t2", "test.tsv").delimiter).toBe("\t");
    expect(parseText("1;2\n3;4", "test.txt", false).rows).toEqual([
      ["1", "2"],
      ["3", "4"],
    ]);
  });
  it("normalizes and offsets in order, without mutating raw values", () => {
    const p = createProject("XRD");
    const s = parseText("x,y\n1,2\n2,4\n3,", "test.csv");
    p.sources = [s];
    p.traces = [newTrace(s, 0, 1, "Sample", 0)];
    const original = structuredClone(p.sources);
    p.transformations = [
      operation("normalize", [p.traces[0].id]),
      operation("offset", [p.traces[0].id], 0.2),
    ];
    expect(processProject(p)[0].points.map((v) => v.y)).toEqual([
      0.7,
      1.2,
      null,
    ]);
    expect(p.sources).toEqual(original);
    p.transformations.forEach((t) => (t.enabled = false));
    expect(processProject(p)[0].points).toEqual(rawPoints(p, p.traces[0]));
  });
  it("does not normalize against a zero or negative maximum", () => {
    const p = createProject("XRD"),
      s = parseText("x,y\n1,0\n2,-1", "zero.csv");
    p.sources = [s];
    p.traces = [newTrace(s, 0, 1, "Zero", 0)];
    p.transformations = [operation("normalize", [p.traces[0].id])];
    expect(processProject(p)[0].warnings).toHaveLength(1);
    expect(processProject(p)[0].points[1].y).toBe(-1);
  });
  it("global normalization shares a denominator even when a trace is hidden", () => {
    const p = createProject("XRD"),
      s = parseText("x,a,b\n1,2,10\n2,4,20", "test.csv");
    p.sources = [s];
    p.traces = [newTrace(s, 0, 1, "a", 0), newTrace(s, 0, 2, "b", 1)];
    p.traces[1].visible = false;
    p.transformations = [
      operation(
        "globalNormalize",
        p.traces.map((t) => t.id),
      ),
    ];
    expect(processProject(p)[0].points.map((v) => v.y)).toEqual([0.1, 0.2]);
  });
  it("replaces stack offsets rather than accumulating them", () => {
    const p = sampleProject("Raman");
    const once = stackProject(p, 1);
    const twice = stackProject(once, 2);
    expect(twice.transformations).toHaveLength(2);
    expect(twice.transformations.map((t) => t.value)).toEqual([2, 4]);
  });
  it("computes explicit derivatives on nonuniform X and rejects repeated X", () => {
    const p = createProject("TGA"),
      s = parseText("x,y\n0,1\n1,3\n3,7", "line.csv");
    p.sources = [s];
    p.traces = [newTrace(s, 0, 1, "a", 0)];
    p.transformations = [operation("derivative", [p.traces[0].id])];
    expect(processProject(p)[0].points.map((v) => v.y)).toEqual([2, 2, 2]);
    p.sources[0].rows[1][0] = "0";
    expect(processProject(p)[0].warnings[0]).toContain("strictly monotonic");
  });
  it("supports seven deterministic sample templates with conventional axes", () => {
    for (const t of techniques) {
      const a = sampleProject(t),
        b = sampleProject(t);
      expect(projectSchema.safeParse(a).success).toBe(true);
      expect(a.sources[0].rows).toEqual(b.sources[0].rows);
      expect(processProject(a)[0].points.length).toBe(801);
      expect(a.transformations).toHaveLength(0);
    }
    expect(sampleProject("FTIR").config.x.reverse).toBe(true);
    expect(sampleProject("NMR").config.x.reverse).toBe(true);
  });
  it("changing representation labels never changes numerical values", () => {
    const p = sampleProject("TGA");
    const original = processProject(p);
    p.config.y.label = "Mass loss (%)";
    expect(processProject(p)).toEqual(original);
  });
});
describe("export and saving", () => {
  it("calculates physical raster sizes and sanitizes file names", () => {
    expect(pixels(25.4, 600)).toBe(600);
    expect(pixels(120, 300)).toBe(1417);
    expect(filename("test:plot/a?")).toBe("test-plot-a-");
  });
  it("recipe includes settings and steps but no original values", () => {
    const p = stackProject(sampleProject("XRD"), 0.2);
    const r = recipe(p);
    expect(r.transformations).toHaveLength(2);
    expect(r).not.toHaveProperty("sources");
    expect(JSON.stringify(r)).not.toContain(
      p.sources[0].rows[20][0] + "," + p.sources[0].rows[20][1],
    );
    expect(r.datasets[0].sourceFileName).toBe(p.sources[0].name);
  });
  it("writes physical resolution into a PNG pHYs chunk", () => {
    const png = new Uint8Array(45);
    new DataView(png.buffer).setUint32(33, 0);
    png.set([73, 69, 78, 68], 37);
    const result = withDpi(png, 600);
    expect(String.fromCharCode(...result.slice(37, 41))).toBe("pHYs");
    expect(new DataView(result.buffer).getUint32(41)).toBe(23622);
    expect(result[49]).toBe(1);
  });
  it("persists complete raw data and processed figure state", async () => {
    const p = stackProject(sampleProject("DSC"), 1);
    p.config.title = "Thermal events";
    p.annotations.push({
      id: "a",
      type: "peak",
      text: "Tm",
      x: 165,
      y: 1,
      x2: 170,
      colour: "#222222",
    });
    await repository.save(p);
    const saved = (await repository.list()).find((v) => v.id === p.id);
    expect(saved).toEqual(p);
    await repository.remove(p.id);
    expect(
      (await repository.list()).find((v) => v.id === p.id),
    ).toBeUndefined();
  });
  it("only blocks technical failures", () => {
    const p = sampleProject("XRD");
    p.config.fontSize = 6;
    expect(figureChecks(p).some((c) => c.level === "error")).toBe(false);
    p.traces.forEach((t) => (t.visible = false));
    expect(figureChecks(p).some((c) => c.level === "error")).toBe(true);
  });
});
