import { type Project, APP_VERSION } from "../domain/model";
export function filename(name: string) {
  return (
    name
      .replace(/[<>:"/\\|?*\u0000-\u001f]/g, "-")
      .replace(/[. ]+$/, "")
      .slice(0, 100) || "figure"
  );
}
export function pixels(mm: number, dpi: number) {
  return Math.round((mm / 25.4) * dpi);
}
export function recipe(project: Project) {
  return {
    format: "characterization-cafe-recipe",
    schemaVersion: 1,
    appVersion: APP_VERSION,
    notice:
      "This recipe stores figure settings and processing steps. To fully recreate the figure, reopen it with the original source datasets.",
    technique: project.technique,
    name: project.name,
    createdAt: project.createdAt,
    updatedAt: project.updatedAt,
    datasets: project.traces.map((t) => ({
      ...t,
      sourceFileName: project.sources.find((s) => s.id === t.sourceId)?.name,
      sheet: project.sources.find((s) => s.id === t.sourceId)?.sheet,
    })),
    config: project.config,
    transformations: project.transformations,
    annotations: project.annotations,
  };
}
export function download(blob: Blob, name: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  document.body.append(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 10000);
}
export function svgString(element: SVGSVGElement, project: Project) {
  const svg = element.cloneNode(true) as SVGSVGElement;
  svg.querySelectorAll("[data-editor-only]").forEach((n) => n.remove());
  svg
    .querySelectorAll("[tabindex]")
    .forEach((n) => n.removeAttribute("tabindex"));
  svg.setAttribute("width", `${project.config.width}mm`);
  svg.setAttribute("height", `${project.config.height}mm`);
  const metadata = document.createElementNS(
    "http://www.w3.org/2000/svg",
    "metadata",
  );
  metadata.textContent = JSON.stringify({
    application: "CharacterizationCafe",
    version: APP_VERSION,
    transformations: project.transformations.filter((t) => t.enabled),
  });
  svg.prepend(metadata);
  return new XMLSerializer().serializeToString(svg);
}
function crc32(bytes: Uint8Array) {
  let crc = 0xffffffff;
  for (const byte of bytes) {
    crc ^= byte;
    for (let j = 0; j < 8; j++) crc = (crc >>> 1) ^ (crc & 1 ? 0xedb88320 : 0);
  }
  return (crc ^ 0xffffffff) >>> 0;
}
export function withDpi(png: Uint8Array, dpi: number): Uint8Array {
  const chunk = new Uint8Array(21),
    view = new DataView(chunk.buffer);
  view.setUint32(0, 9);
  chunk.set([112, 72, 89, 115], 4);
  const ppm = Math.round(dpi / 0.0254);
  view.setUint32(8, ppm);
  view.setUint32(12, ppm);
  chunk[16] = 1;
  view.setUint32(17, crc32(chunk.subarray(4, 17)));
  const parts: Uint8Array[] = [png.slice(0, 33), chunk];
  let offset = 33;
  while (offset < png.length) {
    const len =
      new DataView(png.buffer, png.byteOffset + offset, 4).getUint32(0) + 12;
    const type = String.fromCharCode(...png.slice(offset + 4, offset + 8));
    if (type !== "pHYs") parts.push(png.slice(offset, offset + len));
    offset += len;
  }
  const out = new Uint8Array(parts.reduce((n, p) => n + p.length, 0));
  let pos = 0;
  parts.forEach((p) => {
    out.set(p, pos);
    pos += p.length;
  });
  return out;
}
export async function pngBlob(svg: string, project: Project) {
  const width = pixels(project.config.width, project.config.dpi),
    height = pixels(project.config.height, project.config.dpi);
  if (width * height > 48_000_000 || width > 16000 || height > 16000)
    throw new Error(
      "This PNG exceeds the safe browser export size. Reduce the dimensions or DPI, or export SVG.",
    );
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  if (!ctx)
    throw new Error(
      "Your browser could not create the image. Try a smaller export.",
    );
  const url = URL.createObjectURL(
    new Blob([svg], { type: "image/svg+xml;charset=utf-8" }),
  );
  try {
    const image = new Image();
    image.src = url;
    await image.decode();
    ctx.drawImage(image, 0, 0, width, height);
    const blob = await new Promise<Blob>((resolve, reject) =>
      canvas.toBlob(
        (b) =>
          b
            ? resolve(b)
            : reject(new Error("The PNG render failed. Try a lower DPI.")),
        "image/png",
      ),
    );
    const data = withDpi(
      new Uint8Array(await blob.arrayBuffer()),
      project.config.dpi,
    );
    return new Blob([data.buffer as ArrayBuffer], { type: "image/png" });
  } finally {
    URL.revokeObjectURL(url);
    canvas.width = 0;
    canvas.height = 0;
  }
}
