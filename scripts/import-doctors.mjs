import { drizzle } from "drizzle-orm/mysql2";
import mysql from "mysql2/promise";
import { readdirSync, statSync } from "fs";
import { join, dirname, basename } from "path";
import { fileURLToPath } from "url";
import ExcelJS from "exceljs";
import { hospitals, departments, doctors } from "../drizzle/schema.ts";
import { eq, and } from "drizzle-orm";
import "dotenv/config";
import { createHash } from "crypto";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const normalizeValue = (value) => {
  if (value === undefined || value === null) return null;
  if (typeof value === "string") {
    const trimmed = value.trim();
    return trimmed.length > 0 ? trimmed : null;
  }
  return value;
};

const computeSourceHash = (payload) => {
  const normalized = Object.fromEntries(
    Object.entries(payload).map(([key, val]) => [key, normalizeValue(val)])
  );
  return createHash("sha256").update(JSON.stringify(normalized)).digest("hex");
};

const connection = await mysql.createConnection(process.env.DATABASE_URL);
const db = drizzle(connection);

const hospitalMapping = {
  "复旦大学附属华山医院": { name: "复旦大学附属华山医院", nameEn: "Huashan Hospital Affiliated to Fudan University" },
  "复旦大学附属中山医院": { name: "复旦大学附属中山医院", nameEn: "Zhongshan Hospital Affiliated to Fudan University" },
  "上海交通大学医学院附属瑞金医院": { name: "上海交通大学医学院附属瑞金医院", nameEn: "Ruijin Hospital Affiliated to Shanghai Jiao Tong University" },
  "复旦大学附属肿瘤医院": { name: "复旦大学附属肿瘤医院", nameEn: "Fudan University Shanghai Cancer Center" },
  "上海市第六人民医院": { name: "上海市第六人民医院", nameEn: "Shanghai Sixth People's Hospital" },
  "上海市第九人民医院": { name: "上海市第九人民医院", nameEn: "Shanghai Ninth People's Hospital" },
};

const columnMappings = {
  hospital: ["医院", "hospital", "所属医院", "机构"],
  department: ["科室", "department", "所属科室", "挂号科室"],
  name: ["姓名", "name", "医生姓名", "专家姓名", "大夫", "医师", "专家"],
  title: ["职称", "title", "职务", "医生职称"],
  specialty: ["专业方向", "specialty", "专长", "擅长领域", "擅长"],
  experience: ["经验", "experience", "从业经验", "临床经验"],
  description: ["简介", "description", "医生简介", "个人简介"],
  imageUrl: ["头像", "image", "imageUrl", "头像地址", "照片", "photo", "图片"],
  expertise: ["专业擅长", "expertise", "疾病", "擅长疾病"],
  satisfactionRate: ["主观疗效", "疗效满意度", "satisfaction", "疗效"],
  attitudeScore: ["态度满意度", "态度", "attitude", "服务态度"],
  recommendationScore: ["病友推荐度", "推荐度", "recommendation"],
  onlineConsultation: ["在线问诊", "online", "问诊"],
  appointmentAvailable: ["预约挂号", "appointment", "挂号"],
};

function findColumnIndex(headerRow, fieldMappings) {
  for (let i = 0; i < fieldMappings.length; i++) {
    const searchTerm = fieldMappings[i].toLowerCase();
    for (let colIdx = 0; colIdx < headerRow.length; colIdx++) {
      const headerVal = String(headerRow[colIdx] || "").toLowerCase().trim();
      if (headerVal === searchTerm || headerVal.includes(searchTerm)) {
        return colIdx;
      }
    }
  }
  return -1;
}

function getColumnMapping(worksheet) {
  let headerRow = [];
  let headerRowNum = -1;

  for (let rowNum = 1; rowNum <= 10; rowNum++) {
    const row = worksheet.getRow(rowNum);
    const values = [];
    row.eachCell((cell, colNumber) => {
      values[colNumber - 1] = cell.value;
    });

    const hasExpectedHeaders = values.some((v) => {
      const str = String(v || "").trim();
      return str.includes("姓名") || str.includes("医院") || str.includes("科室") || str.includes("专家");
    });

    if (hasExpectedHeaders) {
      headerRow = values;
      headerRowNum = rowNum;
      break;
    }
  }

  if (headerRowNum === -1) {
    return null;
  }

  const mapping = {};
  for (const [field, aliases] of Object.entries(columnMappings)) {
    mapping[field] = findColumnIndex(headerRow, aliases);
  }

  if (mapping.name === -1) {
    return null;
  }

  return { mapping, headerRowNum };
}

function getAllXlsxFiles(dirPath, arrayOfFiles = []) {
  let files;

  try {
    files = readdirSync(dirPath);
  } catch (err) {
    console.warn(`Could not read directory ${dirPath}:`, err.message);
    return arrayOfFiles;
  }

  for (const file of files) {
    const fullPath = join(dirPath, file);
    let stats;

    try {
      stats = statSync(fullPath);
    } catch {
      continue;
    }

    if (stats.isDirectory()) {
      getAllXlsxFiles(fullPath, arrayOfFiles);
      continue;
    }

    if (file.endsWith(".xlsx") && !file.startsWith("~$")) {
      arrayOfFiles.push(fullPath);
    }
  }

  return arrayOfFiles;
}

async function importDoctors() {
  console.log("Starting doctor data import...");

  const hospitalsDir = join(__dirname, "../data/hospitals");
  const xlsxFiles = getAllXlsxFiles(hospitalsDir);

  if (xlsxFiles.length === 0) {
    console.log(`\n❌ 没有在 ${hospitalsDir} 找到任何 .xlsx 文件！`);
    await connection.end();
    return;
  }

  let totalDoctors = 0;
  let totalDepartments = 0;
  let totalHospitals = 0;

  for (const filePath of xlsxFiles) {
    const fileName = basename(filePath);
    console.log(`\nProcessing file: ${fileName}`);

    try {
      const workbook = new ExcelJS.Workbook();
      await workbook.xlsx.readFile(filePath);

      const rows = [];
      let fileDoctorsCount = 0;

      for (const worksheet of workbook.worksheets) {
        const columnInfo = getColumnMapping(worksheet);
        if (!columnInfo) {
          continue;
        }

        const { mapping, headerRowNum } = columnInfo;

        worksheet.eachRow((row, rowNumber) => {
          if (rowNumber <= headerRowNum) return;

          const getCellValue = (field) => {
            const idx = mapping[field];
            if (idx === undefined || idx < 0) return "";
            const cell = row.getCell(idx + 1);
            return cell.value?.toString() || "";
          };

          const rowData = {
            hospital: getCellValue("hospital"),
            department: getCellValue("department"),
            name: getCellValue("name"),
            title: getCellValue("title"),
            specialty: getCellValue("specialty"),
            experience: getCellValue("experience"),
            description: getCellValue("description"),
            imageUrl: getCellValue("imageUrl"),
            expertise: getCellValue("expertise"),
            satisfactionRate: getCellValue("satisfactionRate"),
            attitudeScore: getCellValue("attitudeScore"),
            recommendationScore: getCellValue("recommendationScore"),
            onlineConsultation: getCellValue("onlineConsultation"),
            appointmentAvailable: getCellValue("appointmentAvailable"),
          };

          if (rowData.name && rowData.name.length > 0) {
            rows.push(rowData);
            fileDoctorsCount++;
          }
        });
      }

      console.log(`  Found ${fileDoctorsCount} doctors across all sheets`);
      if (fileDoctorsCount === 0) continue;

      const hospitalGroups = {};
      for (const row of rows) {
        let hospitalName = row.hospital || fileName.split(".")[0];

        for (const knownName of Object.keys(hospitalMapping)) {
          if (
            hospitalName.includes(knownName) ||
            knownName.includes(hospitalName) ||
            fileName.includes(knownName) ||
            knownName.includes(fileName)
          ) {
            hospitalName = knownName;
            break;
          }
        }

        if (!hospitalGroups[hospitalName]) {
          hospitalGroups[hospitalName] = [];
        }
        hospitalGroups[hospitalName].push(row);
      }

      for (const [hospitalName, doctorsList] of Object.entries(hospitalGroups)) {
        const hospitalInfo = hospitalMapping[hospitalName] || { name: hospitalName, nameEn: null };

        const hospitalSourceHash = computeSourceHash({
          name: hospitalInfo.name,
          city: "上海",
          level: "三级甲等",
          address: null,
          description: null,
        });

        const existingHospital = await db
          .select()
          .from(hospitals)
          .where(eq(hospitals.name, hospitalInfo.name))
          .limit(1);

        let hospitalId;

        if (existingHospital.length > 0) {
          hospitalId = existingHospital[0].id;
          if (existingHospital[0].sourceHash !== hospitalSourceHash) {
            await db
              .update(hospitals)
              .set({
                sourceHash: hospitalSourceHash,
                translationStatus: "pending",
                translatedAt: null,
                lastTranslationError: null,
              })
              .where(eq(hospitals.id, hospitalId));
          }
        } else {
          const result = await db.insert(hospitals).values({
            name: hospitalInfo.name,
            nameEn: hospitalInfo.nameEn,
            city: "上海",
            level: "三级甲等",
            sourceHash: hospitalSourceHash,
            translationStatus: "pending",
          });

          hospitalId = Number(result[0].insertId);
          totalHospitals++;
        }

        const deptGroups = {};
        for (const doc of doctorsList) {
          const deptName = doc.department || "未分类";
          if (!deptGroups[deptName]) {
            deptGroups[deptName] = [];
          }
          deptGroups[deptName].push(doc);
        }

        for (const [deptName, deptDoctors] of Object.entries(deptGroups)) {
          const departmentSourceHash = computeSourceHash({
            name: deptName,
            description: null,
          });

          const existingDept = await db
            .select()
            .from(departments)
            .where(and(eq(departments.hospitalId, hospitalId), eq(departments.name, deptName)))
            .limit(1);

          let deptId;

          if (existingDept.length > 0) {
            deptId = existingDept[0].id;
            if (existingDept[0].sourceHash !== departmentSourceHash) {
              await db
                .update(departments)
                .set({
                  sourceHash: departmentSourceHash,
                  translationStatus: "pending",
                  translatedAt: null,
                  lastTranslationError: null,
                })
                .where(eq(departments.id, deptId));
            }
          } else {
            const result = await db.insert(departments).values({
              hospitalId,
              name: deptName,
              sourceHash: departmentSourceHash,
              translationStatus: "pending",
            });

            deptId = Number(result[0].insertId);
            totalDepartments++;
          }

          for (const doc of deptDoctors) {
            const recScore = parseFloat(doc.recommendationScore) || null;
            const doctorValues = {
              hospitalId,
              departmentId: deptId,
              name: normalizeValue(doc.name),
              title: normalizeValue(doc.title),
              specialty: normalizeValue(doc.specialty),
              experience: normalizeValue(doc.experience),
              description: normalizeValue(doc.description),
              imageUrl: normalizeValue(doc.imageUrl),
              expertise: normalizeValue(doc.expertise),
              satisfactionRate: normalizeValue(doc.satisfactionRate),
              attitudeScore: normalizeValue(doc.attitudeScore),
              recommendationScore: recScore,
              onlineConsultation: normalizeValue(doc.onlineConsultation),
              appointmentAvailable: normalizeValue(doc.appointmentAvailable),
            };

            const sourceHash = computeSourceHash({
              name: doctorValues.name,
              title: doctorValues.title,
              specialty: doctorValues.specialty,
              experience: doctorValues.experience,
              description: doctorValues.description,
              imageUrl: doctorValues.imageUrl,
              expertise: doctorValues.expertise,
              onlineConsultation: doctorValues.onlineConsultation,
              appointmentAvailable: doctorValues.appointmentAvailable,
              satisfactionRate: doctorValues.satisfactionRate,
              attitudeScore: doctorValues.attitudeScore,
            });

            await db
              .insert(doctors)
              .values({
                ...doctorValues,
                sourceHash,
                translationStatus: "pending",
              })
              .onDuplicateKeyUpdate({
                set: {
                  title: doctorValues.title,
                  specialty: doctorValues.specialty,
                  experience: doctorValues.experience,
                  description: doctorValues.description,
                  imageUrl: doctorValues.imageUrl,
                  sourceHash,
                  translationStatus: "pending",
                  translatedAt: null,
                  lastTranslationError: null,
                  updatedAt: new Date(),
                },
              });

            totalDoctors++;
          }
        }
      }
    } catch (error) {
      console.error(`  Error processing file ${fileName}:`, error.message);
      continue;
    }
  }

  console.log("\n=== Import Summary ===");
  console.log(`Total hospitals: ${totalHospitals}`);
  console.log(`Total departments: ${totalDepartments}`);
  console.log(`Total doctors: ${totalDoctors}`);
  console.log("Import completed successfully!");

  await connection.end();
}

importDoctors().catch(console.error);
