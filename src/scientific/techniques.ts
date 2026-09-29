import { type Technique, type Project, uid } from "../domain/model";
export const templates: Record<
  Technique,
  {
    description: string;
    x: string;
    y: string;
    reverse: boolean;
    unit: string;
    labels: string[];
    annotation: string;
  }
> = {
  XRD: {
    description: "Diffraction patterns, clearly compared.",
    x: "2θ (°)",
    y: "Intensity (a.u.)",
    reverse: false,
    unit: "°",
    labels: ["Intensity (a.u.)", "Intensity (counts)"],
    annotation: "(101)",
  },
  Raman: {
    description: "Give every spectrum room to speak.",
    x: "Raman shift (cm⁻¹)",
    y: "Intensity (a.u.)",
    reverse: false,
    unit: "cm⁻¹",
    labels: ["Intensity (a.u.)", "Intensity (counts)"],
    annotation: "G band",
  },
  FTIR: {
    description: "From functional groups to clear figures.",
    x: "Wavenumber (cm⁻¹)",
    y: "Absorbance (a.u.)",
    reverse: true,
    unit: "cm⁻¹",
    labels: ["Absorbance (a.u.)", "Transmittance (%)"],
    annotation: "O–H region",
  },
  "UV–Vis": {
    description: "Bring absorption and optical scans into focus.",
    x: "Wavelength (nm)",
    y: "Absorbance (a.u.)",
    reverse: false,
    unit: "nm",
    labels: ["Absorbance (a.u.)", "Transmittance (%)", "Reflectance (%)"],
    annotation: "λmax",
  },
  NMR: {
    description: "Chemical shifts with familiar conventions.",
    x: "Chemical shift, δ (ppm)",
    y: "Intensity (a.u.)",
    reverse: true,
    unit: "ppm",
    labels: ["Intensity (a.u.)"],
    annotation: "δ 7.2 (m)",
  },
  TGA: {
    description: "A clear view of mass and temperature.",
    x: "Temperature (°C)",
    y: "Mass remaining (%)",
    reverse: false,
    unit: "°C",
    labels: [
      "Mass remaining (%)",
      "Mass loss (%)",
      "Mass (mg)",
      "Derivative mass (%/°C)",
    ],
    annotation: "Mass-loss region",
  },
  DSC: {
    description: "Thermal curves, thoughtfully presented.",
    x: "Temperature (°C)",
    y: "Heat flow (W/g)",
    reverse: false,
    unit: "°C",
    labels: ["Heat flow (W/g)", "Heat flow (mW)", "Heat flow (mW/mg)"],
    annotation: "Tm",
  },
};
export const presets = [
  { name: "Standard manuscript figure", width: 120, height: 85, fontSize: 9 },
  { name: "Single-column figure", width: 85, height: 65, fontSize: 8 },
  { name: "Double-column figure", width: 180, height: 110, fontSize: 10 },
  { name: "Thesis/presentation figure", width: 220, height: 140, fontSize: 14 },
];
export function createProject(technique: Technique): Project {
  const t = templates[technique];
  const now = new Date().toISOString();
  return {
    schemaVersion: 1,
    id: uid(),
    name: `Untitled ${technique} figure`,
    technique,
    createdAt: now,
    updatedAt: now,
    sources: [],
    traces: [],
    transformations: [],
    annotations: [],
    config: {
      title: "",
      subtitle: "",
      notes: "",
      width: 120,
      height: 85,
      dpi: 300,
      x: { label: t.x, reverse: t.reverse, log: false, min: null, max: null },
      y: { label: t.y, reverse: false, log: false, min: null, max: null },
      font: "Arial",
      fontSize: 9,
      lineWeight: 0.7,
      grid: false,
      frame: "axes",
      legend: "top-right",
      palette: "Colour-blind safe",
      layout: "overlay",
      preset: "Standard manuscript figure",
      margin: 0,
      tickCount: 6,
      decimals: null,
      background: "#ffffff",
      transparent: false,
      convention: "Endotherm up",
    },
  };
}
