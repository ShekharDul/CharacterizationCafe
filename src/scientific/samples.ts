import {
  type Technique,
  type SourceFile,
  uid,
  newTrace,
} from "../domain/model";
import { createProject, templates } from "./techniques";
const gauss = (x: number, c: number, w: number, a: number) =>
  a * Math.exp(-0.5 * ((x - c) / w) ** 2);
export function sampleSources(
  technique: Technique,
  ftirMode: "absorbance" | "transmittance" = "absorbance",
): SourceFile[] {
  const count =
    technique === "TGA" || technique === "DSC" || technique === "NMR" ? 1 : 3;
  return Array.from({ length: count }, (_, j) => {
    const limits: Record<Technique, [number, number]> = {
      XRD: [10, 80],
      Raman: [100, 2000],
      FTIR: [400, 4000],
      "UV–Vis": [220, 800],
      NMR: [0, 10],
      TGA: [25, 800],
      DSC: [25, 300],
    };
    const [lo, hi] = limits[technique];
    const rows = Array.from({ length: 801 }, (_, i) => {
      const x = lo + ((hi - lo) * i) / 800;
      let y = 0;
      if (technique === "XRD")
        y =
          3 +
          Math.sin(x * 4 + j) * 0.55 +
          [25.3, 37.8, 48.1, 53.9, 62.7, 70.3].reduce(
            (s, c, k) =>
              s +
              gauss(
                x,
                c + j * 0.18,
                0.18 + k * 0.04,
                [95, 36, 52, 29, 24, 12][k] * (1 - j * 0.13),
              ),
            0,
          );
      if (technique === "Raman")
        y =
          10 +
          j * 3 +
          x * 0.012 +
          gauss(x, 460 + j * 6, 22, 70) +
          gauss(x, 810, 35, 35) +
          gauss(x, 1350 + j * 8, 42, 80) +
          gauss(x, 1580 - j * 5, 28, 110);
      if (technique === "FTIR")
        y =
          0.08 +
          gauss(x, 3400 - j * 40, 170, 0.55) +
          gauss(x, 2920, 50, 0.35) +
          gauss(x, 1710 + j * 8, 32, 0.85) +
          gauss(x, 1100, 60, 0.5) +
          gauss(x, 650, 28, 0.22);
      if (technique === "UV–Vis")
        y =
          0.02 +
          gauss(x, 310 + j * 25, 28, 0.6) +
          gauss(x, 485 + j * 28, 48, 1.15 - j * 0.15);
      if (technique === "NMR")
        y = [1.1, 1.18, 1.26, 3.5, 3.56, 3.62, 7.1, 7.16, 7.22, 7.28].reduce(
          (s, c, k) =>
            s +
            gauss(
              x,
              c,
              0.016,
              [0.6, 1, 0.6, 0.6, 0.9, 0.6, 0.4, 0.8, 0.8, 0.4][k],
            ),
          0,
        );
      if (technique === "TGA")
        y =
          100 -
          6 / (1 + Math.exp(-(x - 110) / 12)) -
          32 / (1 + Math.exp(-(x - 330) / 20)) -
          48 / (1 + Math.exp(-(x - 490) / 25));
      if (technique === "DSC")
        y =
          0.1 +
          x * 0.001 +
          gauss(x, 165, 9, 0.9) -
          gauss(x, 235, 13, 0.45) +
          0.14 / (1 + Math.exp(-(x - 80) / 3));
      if (technique === "FTIR" && ftirMode === "transmittance")
        y = 100 * 10 ** -y;
      return [x.toFixed(5), y.toFixed(6)];
    });
    const headers = [
      templates[technique].x,
      technique === "FTIR" && ftirMode === "transmittance"
        ? "Transmittance (%)"
        : templates[technique].y,
    ];
    const content = [headers.join(","), ...rows.map((r) => r.join(","))].join(
      "\n",
    );
    return {
      id: uid(),
      name: `synthetic-${technique.toLowerCase()}${technique === "FTIR" && ftirMode === "transmittance" ? "-transmittance" : ""}-${j + 1}.csv`,
      size: new TextEncoder().encode(content).length,
      content,
      encoding: "text",
      delimiter: ",",
      headers,
      rows,
      warnings: [],
      synthetic: true,
    };
  });
}
export function sampleProject(technique: Technique) {
  const p = createProject(technique);
  p.name = `${technique} · sample comparison`;
  p.sources = sampleSources(technique);
  p.traces = p.sources.map((s, i) => ({
    ...newTrace(s, 0, 1, ["Sample A", "Sample B", "Sample C"][i], i),
    xUnit: templates[technique].unit,
  }));
  return p;
}
