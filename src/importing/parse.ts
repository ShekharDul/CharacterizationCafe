import Papa from "papaparse";
import { type SourceFile, uid, numeric } from "../domain/model";
export function parseText(
  content: string,
  name: string,
  header = true,
  delimiter = "",
): SourceFile {
  const result = Papa.parse<string[]>(content.replace(/^\uFEFF/, ""), {
    skipEmptyLines: false,
    delimiter,
    delimitersToGuess: [",", "\t", ";", "|"],
  });
  const all = result.data;
  while (all.length && all[all.length - 1].every((c) => !c.trim())) all.pop();
  if (!all.length)
    throw new Error(
      "This file contains no rows. Choose a file containing numeric X and Y columns.",
    );
  const width = all.reduce((max, row) => Math.max(max, row.length), 0);
  if (width < 2)
    throw new Error(
      "At least two columns are needed. Choose the delimiter manually or export a CSV/TSV file from your instrument software.",
    );
  const headers = Array.from({ length: width }, (_, i) =>
    header ? all[0][i]?.trim() || `Column ${i + 1}` : `Column ${i + 1}`,
  );
  const rows = header ? all.slice(1) : all;
  const warnings = result.errors
    .filter((e) => e.code !== "UndetectableDelimiter")
    .map((e) => `Row ${(e.row ?? 0) + 1}: ${e.message}`);
  const ragged = rows.filter((r) => r.length !== width).length;
  if (ragged)
    warnings.push(
      `${ragged} rows have a different column count. Review the source and mapping; values have not been repaired.`,
    );
  return {
    id: uid(),
    name,
    size: new TextEncoder().encode(content).length,
    content,
    encoding: "text",
    delimiter: result.meta.delimiter || delimiter,
    headers,
    rows,
    warnings,
    synthetic: false,
  };
}
export async function parseFile(file: File): Promise<SourceFile[]> {
  if (file.size > 25 * 1024 * 1024)
    throw new Error(
      `${file.name} exceeds the 25 MB import limit. Split it into smaller files.`,
    );
  if (/\.xlsx$/i.test(file.name)) {
    const XLSX = await import("xlsx");
    const buffer = await file.arrayBuffer();
    const book = XLSX.read(buffer, { type: "array" });
    const bytes = new Uint8Array(buffer);
    let binary = "";
    for (let i = 0; i < bytes.length; i += 8192)
      binary += String.fromCharCode(...bytes.subarray(i, i + 8192));
    const content = btoa(binary);
    const sources = book.SheetNames.map((sheet) => {
      const rows = XLSX.utils
        .sheet_to_json<
          unknown[]
        >(book.Sheets[sheet], { header: 1, raw: true, defval: "" })
        .map((r) => r.map((v) => String(v)));
      const headers = rows.shift() ?? [];
      return {
        id: uid(),
        name: file.name,
        size: file.size,
        content,
        encoding: "base64" as const,
        sheet,
        delimiter: "Excel worksheet",
        headers,
        rows,
        warnings: [
          "Excel imports use stored cell values. Formulas are not recalculated. Select the worksheet(s) to import.",
        ],
        synthetic: false,
      };
    }).filter((s) => s.headers.length >= 2 && s.rows.length);
    if (!sources.length)
      throw new Error("No worksheet contains two columns and data rows.");
    return sources;
  }
  if (!/\.(csv|txt|tsv)$/i.test(file.name))
    throw new Error("Choose a CSV, TSV, TXT, or XLSX file.");
  const content = await file.text();
  return [
    parseText(content, file.name, true, /\.tsv$/i.test(file.name) ? "\t" : ""),
  ];
}
export function suggestColumns(source: SourceFile): {
  x: number;
  ys: number[];
} {
  const numericCols = source.headers
    .map((_, i) => ({
      i,
      count: source.rows.slice(0, 100).filter((r) => numeric(r[i]) !== null)
        .length,
    }))
    .filter((c) => c.count > 0);
  return {
    x: numericCols[0]?.i ?? 0,
    ys: numericCols.slice(1, 2).map((c) => c.i),
  };
}
export function mappingReport(source: SourceFile, x: number, ys: number[]) {
  const invalidX = source.rows.filter((r) => numeric(r[x]) === null).length;
  const missingY = source.rows.filter((r) =>
    ys.some((y) => numeric(r[y]) === null),
  ).length;
  const valid = ys.map(
    (y) =>
      source.rows.filter(
        (r) => numeric(r[x]) !== null && numeric(r[y]) !== null,
      ).length,
  );
  return { invalidX, missingY, valid };
}
