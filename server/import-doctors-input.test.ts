import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from "fs";
import { tmpdir } from "os";
import { join } from "path";
import ExcelJS from "exceljs";
import { afterEach, describe, expect, it } from "vitest";
import {
  computeSourceHash,
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
});
