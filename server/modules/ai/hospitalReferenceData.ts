import fs from "node:fs";
import path from "node:path";

export const TRIAGE_HOSPITAL_REFERENCE_YEAR = 2022;
export const TRIAGE_HOSPITAL_REFERENCE_DIRECTORY = path.resolve(
  process.cwd(),
  "data/triage_hospital_reference_2022"
);
export const SPECIALTY_REPUTATION_FILENAME =
  "fudan_specialty_reputation_2022_all.csv";
export const GENERAL_GRADE_FILENAME = "fudan_national_general_grade_2022.csv";
export const STEM_FILENAME = "hospital_science_stem_top100_2022.csv";

export type SpecialtyReferenceSeedRow = {
  specialtyName: string;
  hospitalName: string;
  specialtyRank: number | null;
  specialtyScore: number | null;
};

export type GeneralReferenceSeedRow = {
  hospitalName: string;
  generalRankOrder: number | null;
  generalGrade: string | null;
};

export type StemReferenceSeedRow = {
  hospitalName: string;
  stemRank: number | null;
};

function parseCsvLine(line: string) {
  const values: string[] = [];
  let current = "";
  let inQuotes = false;

  for (let index = 0; index < line.length; index += 1) {
    const char = line[index];

    if (char === '"') {
      if (inQuotes && line[index + 1] === '"') {
        current += '"';
        index += 1;
      } else {
        inQuotes = !inQuotes;
      }
      continue;
    }

    if (char === "," && !inQuotes) {
      values.push(current);
      current = "";
      continue;
    }

    current += char;
  }

  values.push(current);
  return values.map(value => value.trim());
}

function readCsvRecords(filename: string) {
  const filePath = path.join(TRIAGE_HOSPITAL_REFERENCE_DIRECTORY, filename);
  const raw = fs.readFileSync(filePath, "utf8");
  const lines = raw
    .split(/\r?\n/)
    .map(line => line.trim())
    .filter(Boolean);

  if (lines.length === 0) {
    return [];
  }

  const headers = parseCsvLine(lines[0]);
  return lines.slice(1).map(line => {
    const values = parseCsvLine(line);
    return headers.reduce<Record<string, string>>((record, header, index) => {
      record[header] = values[index] ?? "";
      return record;
    }, {});
  });
}

function parseRank(value: string) {
  const numeric = Number(value);
  return Number.isFinite(numeric) && numeric > 0 ? numeric : null;
}

function parseScore(value: string) {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : null;
}

export function normalizeHospitalReferenceText(value: string) {
  return value
    .trim()
    .replace(/[（(][^()（）]*[)）]/g, "")
    .replace(/[·•・]/g, "")
    .replace(/\s+/g, "")
    .replace(/[，,、]/g, "")
    .toLowerCase();
}

export function loadHospitalReferenceSeedData() {
  const specialtyRows: SpecialtyReferenceSeedRow[] = [];
  for (const row of readCsvRecords(SPECIALTY_REPUTATION_FILENAME)) {
    const specialtyName = row["专科名称"]?.trim() ?? "";
    const hospitalName = row["医院名称"]?.trim() ?? "";
    if (!specialtyName || !hospitalName) {
      continue;
    }

    specialtyRows.push({
      specialtyName,
      hospitalName,
      specialtyRank: parseRank(row["专科排名"] ?? ""),
      specialtyScore: parseScore(row["声誉得分"] ?? ""),
    });
  }

  const generalRows: GeneralReferenceSeedRow[] = [];
  for (const row of readCsvRecords(GENERAL_GRADE_FILENAME)) {
    const hospitalName = row["医院名称"]?.trim() ?? "";
    if (!hospitalName) {
      continue;
    }

    generalRows.push({
      hospitalName,
      generalRankOrder: parseRank(row["序号"] ?? ""),
      generalGrade: row["综合等级"]?.trim() || null,
    });
  }

  const stemRows: StemReferenceSeedRow[] = [];
  for (const row of readCsvRecords(STEM_FILENAME)) {
    const hospitalName = row["医院名称"]?.trim() ?? "";
    if (!hospitalName) {
      continue;
    }

    stemRows.push({
      hospitalName,
      stemRank: parseRank(row["排名"] ?? ""),
    });
  }

  return {
    specialtyRows,
    generalRows,
    stemRows,
  };
}
