import { mkdtempSync, mkdirSync, rmSync, symlinkSync, writeFileSync } from "fs";
import { tmpdir } from "os";
import { join } from "path";
import ExcelJS from "exceljs";
import { afterEach, describe, expect, it } from "vitest";
import {
  assertWorkbookFileCount,
  assertWorkbookLimits,
  assertXlsxInputFile,
  computeSourceHash,
  EXCEL_IMPORT_LIMITS,
  getAllXlsxFiles,
  getColumnMapping,
  loadDeptUrlMap,
  normalizeValue,
  parseDepartmentFromFileName,
  parseHospitalFromPath,
} from "../scripts/import-doctors-input.mjs";

const temporaryDirectories: string[] = [];

function createTemporaryDirectory() {
  const directory = mkdtempSync(join(tmpdir(), "medibridge-import-doctors-"));
  temporaryDirectories.push(directory);
  return directory;
}

afterEach(() => {
  for (const directory of temporaryDirectories.splice(0)) {
    rmSync(directory, { recursive: true, force: true });
  }
});

describe("doctor import input helpers", () => {
  it("normalizes source values before computing stable hashes", () => {
    expect(normalizeValue("  value  ")).toBe("value");
    expect(normalizeValue("   ")).toBeNull();
    expect(normalizeValue(undefined)).toBeNull();
    expect(computeSourceHash({ name: " Doctor " })).toBe(
      computeSourceHash({ name: "Doctor" })
    );
  });

  it("parses both current and legacy department filenames", () => {
    expect(parseDepartmentFromFileName("骨科_医生详细信息_20260812.xlsx")).toBe(
      "骨科"
    );
    expect(parseDepartmentFromFileName("中山医院_消化内科_医生信息.xlsx")).toBe(
      "消化内科"
    );
    expect(parseDepartmentFromFileName("unrelated.xlsx")).toBe("");
  });

  it("derives hospital folders and recursively lists eligible workbooks", () => {
    const root = createTemporaryDirectory();
    const hospitalDirectory = join(root, "中山医院");
    mkdirSync(hospitalDirectory);
    writeFileSync(join(hospitalDirectory, "消化内科.xlsx"), "fixture");
    writeFileSync(join(hospitalDirectory, "~$temporary.xlsx"), "fixture");
    writeFileSync(join(hospitalDirectory, "notes.txt"), "fixture");

    expect(
      parseHospitalFromPath(root, join(hospitalDirectory, "消化内科.xlsx"))
    ).toBe("中山医院");
    expect(getAllXlsxFiles(root)).toEqual([
      join(hospitalDirectory, "消化内科.xlsx"),
    ]);
  });

  it("finds the workbook header and maps known doctor columns", () => {
    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet("骨科");
    worksheet.getRow(1).values = ["导出说明"];
    worksheet.getRow(2).values = ["医生姓名", "所属医院", "挂号科室"];

    expect(getColumnMapping(worksheet)).toEqual({
      headerRowNum: 2,
      mapping: expect.objectContaining({
        name: 0,
        hospital: 1,
        department: 2,
      }),
    });
  });

  it("loads only complete department URL index entries", () => {
    const root = createTemporaryDirectory();
    const indexPath = join(root, "departments.json");
    writeFileSync(
      indexPath,
      JSON.stringify([
        {
          hospital: "中山医院",
          department: "消化内科",
          url: "https://example.test/departments/1",
        },
        { hospital: "中山医院", department: "骨科" },
      ])
    );

    expect(loadDeptUrlMap(indexPath)).toEqual(
      new Map([["中山医院||消化内科", "https://example.test/departments/1"]])
    );
  });

  it("accepts a real XLSX file inside the trusted root", async () => {
    const root = createTemporaryDirectory();
    const workbookPath = join(root, "doctors.xlsx");
    const workbook = new ExcelJS.Workbook();
    workbook.addWorksheet("doctors").addRow(["name"]);
    await workbook.xlsx.writeFile(workbookPath);

    expect(() => assertXlsxInputFile(workbookPath, root)).not.toThrow();
  });

  it("rejects disguised, oversized, linked, and out-of-root workbook inputs", () => {
    const root = createTemporaryDirectory();
    const outsideRoot = createTemporaryDirectory();
    const wrongExtensionPath = join(root, "workbook.zip");
    const emptyPath = join(root, "empty.xlsx");
    const genericZipPath = join(root, "generic-zip.xlsx");
    const disguisedPath = join(root, "disguised.xlsx");
    const oversizedPath = join(root, "oversized.xlsx");
    const outsidePath = join(outsideRoot, "outside.xlsx");
    const linkedPath = join(root, "linked.xlsx");
    writeFileSync(wrongExtensionPath, Buffer.from([0x50, 0x4b, 0x03, 0x04]));
    writeFileSync(emptyPath, "");
    writeFileSync(genericZipPath, Buffer.from([0x50, 0x4b, 0x03, 0x04]));
    writeFileSync(disguisedPath, "not-an-xlsx");
    writeFileSync(
      oversizedPath,
      Buffer.alloc(EXCEL_IMPORT_LIMITS.maxFileBytes + 1)
    );
    writeFileSync(outsidePath, Buffer.from([0x50, 0x4b, 0x03, 0x04]));
    symlinkSync(outsidePath, linkedPath);

    expect(() => assertXlsxInputFile(wrongExtensionPath, root)).toThrow(
      ".xlsx file extension"
    );
    expect(() => assertXlsxInputFile(emptyPath, root)).toThrow(
      "Workbook file size"
    );
    expect(() => assertXlsxInputFile(genericZipPath, root)).toThrow(
      "not a valid XLSX package"
    );
    expect(() => assertXlsxInputFile(disguisedPath, root)).toThrow(
      "not a valid XLSX package"
    );
    expect(() => assertXlsxInputFile(oversizedPath, root)).toThrow(
      "Workbook file size"
    );
    expect(() => assertXlsxInputFile(linkedPath, root)).toThrow(
      "regular file, not a link"
    );
    expect(() => assertXlsxInputFile(outsidePath, root)).toThrow(
      "trusted root"
    );
  });

  it("enforces workbook, sheet, and row count limits", () => {
    expect(() =>
      assertWorkbookFileCount(
        Array.from(
          { length: EXCEL_IMPORT_LIMITS.maxWorkbookFiles + 1 },
          (_, index) => `workbook-${index}.xlsx`
        )
      )
    ).toThrow("Workbook file limit exceeded");

    const tooManySheets = new ExcelJS.Workbook();
    for (let index = 0; index <= EXCEL_IMPORT_LIMITS.maxSheets; index++) {
      tooManySheets.addWorksheet(`sheet-${index}`);
    }
    expect(() => assertWorkbookLimits(tooManySheets)).toThrow(
      "Workbook sheet limit exceeded"
    );

    const tooManyRows = new ExcelJS.Workbook();
    tooManyRows
      .addWorksheet("rows")
      .getCell(`A${EXCEL_IMPORT_LIMITS.maxRowsPerSheet + 1}`).value = "doctor";
    expect(() => assertWorkbookLimits(tooManyRows)).toThrow(
      "Worksheet row limit exceeded"
    );

    const tooManyTotalRows = new ExcelJS.Workbook();
    for (const [name, rowCount] of [
      ["one", 20_000],
      ["two", 20_000],
      ["three", 10_001],
    ]) {
      tooManyTotalRows.addWorksheet(name).getCell(`A${rowCount}`).value = name;
    }
    expect(() => assertWorkbookLimits(tooManyTotalRows)).toThrow(
      "Workbook row limit exceeded"
    );
  });
});
