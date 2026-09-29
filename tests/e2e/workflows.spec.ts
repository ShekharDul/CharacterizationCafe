import { test, expect, type Page } from "@playwright/test";
import * as XLSX from "xlsx";
import { readFile } from "node:fs/promises";

async function sample(page: Page, technique: string) {
  await page.goto("/");
  if (technique === "XRD") {
    await page.getByRole("button", { name: "Try sample data" }).click();
    return;
  }
  await page
    .getByRole("button", {
      name: new RegExp(`^${technique.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")} `),
    })
    .first()
    .click();
  await page
    .getByRole("button", { name: `Use ${technique} sample data` })
    .click();
  while (
    await page
      .getByRole("button", { name: "Confirm mapping", exact: true })
      .count()
  )
    await page
      .getByRole("button", { name: "Confirm mapping", exact: true })
      .first()
      .click();
  await page.getByRole("button", { name: "Continue", exact: true }).click();
  await page.getByRole("button", { name: "Start editing" }).click();
}
async function exportSvg(page: Page) {
  await page.getByRole("button", { name: "Export", exact: true }).click();
  await page.getByRole("button", { name: "Editable SVG", exact: true }).click();
  const waiting = page.waitForEvent("download");
  await page.getByRole("button", { name: "Download SVG", exact: true }).click();
  const download = await waiting;
  expect(download.suggestedFilename()).toMatch(/\.svg$/);
  const svg = await readFile((await download.path())!, "utf8");
  expect(svg).toContain("<text");
  expect(svg).toContain("<path");
  expect(svg).not.toContain("data-editor-only");
  await page.getByRole("button", { name: "Close panel" }).click();
  return svg;
}
async function reopen(page: Page, name: string) {
  await expect(page.getByText("Saved", { exact: true })).toBeVisible();
  await page.reload();
  await page.getByRole("button", { name: /^Projects/ }).click();
  await page
    .getByRole("button", { name: new RegExp(name) })
    .first()
    .click();
  await expect(page.getByRole("textbox", { name: "Project name" })).toHaveValue(
    name,
  );
}
test("welcome, XRD transforms, SVG, 600 DPI PNG, recipe and reopen", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.goto("/");
  await expect(
    page.getByRole("heading", { name: /Good research/ }),
  ).toBeVisible();
  await page.screenshot({ path: ".qa/home.png", fullPage: true });
  await sample(page, "XRD");
  await page
    .getByRole("textbox", { name: "Project name" })
    .fill("XRD verified");
  await page.getByRole("tab", { name: "Transformations" }).click();
  await page.getByRole("button", { name: "Apply transformation" }).click();
  await page.getByRole("button", { name: "Stack traces by 1" }).click();
  await page.getByLabel("Annotation text", { exact: true }).fill("(101)");
  await page
    .getByRole("button", { name: "Add annotation", exact: true })
    .click();
  await page.screenshot({ path: ".qa/editor.png", fullPage: true });
  const svg = await exportSvg(page);
  expect(svg).toContain("(101)");
  await page.getByRole("button", { name: "Export", exact: true }).click();
  await page.getByRole("button", { name: "PNG image", exact: true }).click();
  await page.getByLabel("Resolution", { exact: true }).selectOption("600");
  const waiting = page.waitForEvent("download");
  await page.getByRole("button", { name: "Download PNG", exact: true }).click();
  const download = await waiting;
  const bytes = await readFile((await download.path())!);
  await download.saveAs(".qa/figure-export.png");
  expect(bytes.readUInt32BE(16)).toBe(2835);
  expect(bytes.readUInt32BE(20)).toBe(2008);
  const pos = bytes.indexOf("pHYs");
  expect(pos).toBeGreaterThan(0);
  expect(bytes.readUInt32BE(pos + 4)).toBe(23622);
  const recipeWait = page.waitForEvent("download");
  await page.getByRole("button", { name: "Download JSON recipe" }).click();
  const data = JSON.parse(
    await readFile((await (await recipeWait).path())!, "utf8"),
  );
  expect(data).not.toHaveProperty("sources");
  expect(data.transformations).toHaveLength(3);
  await page.getByRole("button", { name: "Close panel" }).click();
  await reopen(page, "XRD verified");
  await page.getByRole("tab", { name: "Transformations" }).click();
  await expect(page.locator(".transformation-card")).toHaveCount(3);
  await expect(page.locator(".artboard svg")).toContainText("(101)");
  expect(errors).toEqual([]);
});
for (const technique of ["Raman", "FTIR", "UV–Vis", "NMR", "TGA", "DSC"])
  test(`${technique} sample, annotation, export and reopen`, async ({
    page,
  }) => {
    await sample(page, technique);
    const name = `${technique} verified`;
    await page.getByRole("textbox", { name: "Project name" }).fill(name);
    if (technique === "FTIR" || technique === "NMR")
      await expect(page.getByLabel("Reverse X", { exact: true })).toBeChecked();
    if (technique === "Raman") {
      await page.getByRole("tab", { name: "Transformations" }).click();
      await page.getByRole("button", { name: "Stack traces by 1" }).click();
      await page.getByLabel("Vision preview").selectOption("greyscale");
    }
    if (technique === "FTIR")
      await page
        .getByLabel("Annotation type", { exact: true })
        .selectOption("region");
    if (technique === "NMR")
      await page
        .getByLabel("Annotation type", { exact: true })
        .selectOption("text");
    if (technique === "TGA") {
      await page.getByRole("tab", { name: "Transformations" }).click();
      await page
        .getByText("Optional derivative trace", { exact: true })
        .click();
      await page
        .getByRole("button", { name: "Confirm & create derivative" })
        .click();
      await expect(
        page.getByLabel("Y-axis label", { exact: true }),
      ).toHaveValue(/Derivative/);
    }
    if (technique === "DSC") {
      await page
        .getByRole("button", { name: "Flip heat-flow values…" })
        .click();
      await page.getByRole("button", { name: "Apply y × −1" }).click();
      await expect(
        page.getByLabel("Declared display convention", { exact: true }),
      ).toHaveValue("Endotherm down");
    }
    await page
      .getByLabel("Annotation text", { exact: true })
      .fill(`${technique} label`);
    await page
      .getByRole("button", { name: "Add annotation", exact: true })
      .click();
    const svg = await exportSvg(page);
    expect(svg).toContain(`${technique} label`);
    await reopen(page, name);
    await expect(page.locator(".artboard svg")).toContainText(
      `${technique} label`,
    );
  });
test("imports CSV, TSV, TXT, and XLSX with explicit mapping", async ({
  page,
}) => {
  await page.goto("/");
  await page
    .getByRole("button", { name: "Create a figure", exact: true })
    .click();
  await page.getByRole("button", { name: "Continue", exact: true }).click();
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(
    workbook,
    XLSX.utils.aoa_to_sheet([
      ["angle", "intensity"],
      [10, 1],
      [20, 3],
      [30, 2],
    ]),
    "Scan",
  );
  const buffer = XLSX.write(workbook, { type: "buffer", bookType: "xlsx" });
  await page.locator("input[type=file]").setInputFiles([
    {
      name: "pattern.csv",
      mimeType: "text/csv",
      buffer: Buffer.from("angle,intensity\n10,2\n20,8\n30,3"),
    },
    {
      name: "pattern.tsv",
      mimeType: "text/tab-separated-values",
      buffer: Buffer.from("angle\tintensity\n10\t3\n20\t7\n30\t4"),
    },
    {
      name: "pattern.txt",
      mimeType: "text/plain",
      buffer: Buffer.from("angle;intensity\n10;1\n20;9\n30;5"),
    },
    {
      name: "pattern.xlsx",
      mimeType:
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      buffer,
    },
  ]);
  await expect(page.locator(".import-card")).toHaveCount(4);
  await expect(
    page.getByRole("button", { name: "Continue", exact: true }),
  ).toBeDisabled();
  while (
    await page
      .getByRole("button", { name: "Confirm mapping", exact: true })
      .count()
  )
    await page
      .getByRole("button", { name: "Confirm mapping", exact: true })
      .first()
      .click();
  await page.getByRole("button", { name: "Continue", exact: true }).click();
  await page.getByRole("button", { name: "Start editing" }).click();
  await expect(page.locator(".dataset-row")).toHaveCount(4);
  await exportSvg(page);
});
test("mobile welcome has no horizontal overflow", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/");
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);
  await page.getByRole("button", { name: "Try sample data" }).click();
  await expect(page.locator(".mobile-notice")).toBeVisible();
  await page.screenshot({ path: ".qa/mobile.png", fullPage: true });
});
