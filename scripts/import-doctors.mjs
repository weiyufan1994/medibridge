import { drizzle } from "drizzle-orm/node-postgres";
import { readdirSync, statSync, existsSync, readFileSync } from "fs";
import { join, dirname, basename, relative, sep } from "path";
import { fileURLToPath } from "url";
import ExcelJS from "exceljs";
import { hospitals, departments, doctors } from "../drizzle/schema.ts";
import { eq, and } from "drizzle-orm";
import "../server/_core/loadEnv.ts";
import { createHash } from "crypto";
import { Pool } from "pg";

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

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});
await pool.query("SET TIME ZONE 'UTC'");
const db = drizzle(pool);

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
  department: ["科室", "department", "所属科室", "挂号科室", "科室名称"],
  name: ["姓名", "name", "医生姓名", "专家姓名", "大夫", "医师", "专家"],
  title: ["职称", "title", "职务", "医生职称"],
  specialty: ["专业方向", "specialty", "专长", "擅长领域", "擅长"],
  experience: ["经验", "experience", "从业经验", "临床经验", "治疗经验"],
  description: ["简介", "description", "医生简介", "个人简介"],
  imageUrl: ["头像", "image", "imageUrl", "头像地址", "照片", "photo", "图片"],
  expertise: ["专业擅长", "expertise", "疾病", "擅长疾病"],
  satisfactionRate: ["主观疗效", "疗效满意度", "satisfaction", "疗效"],
  attitudeScore: ["态度满意度", "态度", "attitude", "服务态度"],
  recommendationScore: ["病友推荐度", "推荐度", "recommendation"],
  onlineConsultation: ["在线问诊", "online", "问诊"],
  appointmentAvailable: ["预约挂号", "appointment", "挂号"],
  sourceDoctorId: ["doctor id", "doctor_id", "doctorid", "医生id", "doctorid", "医生id"],
  profileUrl: [
    "url",
    "主页链接",
    "医生介绍页url",
    "介绍页url",
    "简介页url",
    "好大夫链接",
    "医生主页",
    "网站",
  ],
  totalPatients: ["总患者", "总患者数"],
  totalArticles: ["总文章"],
  totalVisits: ["总访问", "总浏览"],
  scrapedDate: ["抓取日期", "抓取时间"],
  scrapedStatus: ["抓取状态"],
  dataSource: ["数据来源"],
  education: ["教育经历"],
  socialRole: ["社会任职"],
  researchAchievements: ["科研成果"],
  honors: ["获奖荣誉"],
  followUpPatients: ["诊后报到患者", "诊后报到"],
  followUpFeedback: ["诊后评价", "术后评价"],
  gender: ["性别"],
  sequenceNumber: ["序号", "序列号"],
};

function findColumnIndex(headerRow, fieldMappings) {
  const normalize = (value) =>
    String(value || "")
      .toLowerCase()
      .replace(/[\s_]+/g, "")
      .replace(/[:：]/g, "");

  for (let i = 0; i < fieldMappings.length; i++) {
    const searchTerm = normalize(fieldMappings[i]);
    for (let colIdx = 0; colIdx < headerRow.length; colIdx++) {
      const headerVal = normalize(headerRow[colIdx]);
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

function parseHospitalFromPath(hospitalsDir, filePath) {
  const rel = relative(hospitalsDir, filePath);
  const parts = rel.split(sep).filter(Boolean);
  return parts.length >= 2 ? parts[0].trim() : null;
}

function parseDepartmentFromFileName(fileName) {
  const base = fileName.replace(/\.xlsx$/i, "").trim();
  if (!base) return "";

  const newStyle = base.match(/^(.*)_医生详细信息(?:_\d{8})?$/);
  if (newStyle?.[1]) {
    return newStyle[1].trim();
  }

  const legacyStyle = base.match(/^(.*)_医生信息(?:_\d{8})?$/);
  if (!legacyStyle?.[1]) return "";

  const normalized = legacyStyle[1].trim();
  const parts = normalized.split("_").map((x) => x.trim()).filter(Boolean);
  return parts.length > 1 ? parts[parts.length - 1] : normalized;
}

function loadDeptUrlMap(jsonPath) {
  const map = new Map();
  if (!existsSync(jsonPath)) {
    console.warn(`Department index not found: ${jsonPath}`);
    return map;
  }

  const raw = readFileSync(jsonPath, "utf-8");
  const arr = JSON.parse(raw);
  if (!Array.isArray(arr)) {
    console.warn(`Department index is not an array: ${jsonPath}`);
    return map;
  }

  for (const x of arr) {
    if (!x?.hospital || !x?.department || !x?.url) continue;
    map.set(`${x.hospital}||${x.department}`, x.url);
  }
  return map;
}

async function importDoctors() {
  console.log("Starting doctor data import...");

  const hospitalsDir = join(__dirname, "../data/hospitals");
  const deptIndexPath = join(__dirname, "../data/departments/all_departments.json");
  const deptUrlMap = loadDeptUrlMap(deptIndexPath);
  const xlsxFiles = getAllXlsxFiles(hospitalsDir);

  console.log("Loaded department urls:", deptUrlMap.size);

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
    const hospitalFromFolder = parseHospitalFromPath(hospitalsDir, filePath);
    const departmentFromFile = parseDepartmentFromFileName(fileName);

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
        const sheetDepartment = worksheet.name?.trim() || "";

        worksheet.eachRow((row, rowNumber) => {
          if (rowNumber <= headerRowNum) return;

          const getCellValue = (field) => {
            const idx = mapping[field];
            if (idx === undefined || idx < 0) return "";
            const cell = row.getCell(idx + 1);
            return cell.value?.toString() || "";
          };

          const rowData = {
            hospital: hospitalFromFolder || getCellValue("hospital") || "",
            department:
              getCellValue("department") || sheetDepartment || departmentFromFile || "",
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
            sourceDoctorId: getCellValue("sourceDoctorId"),
            profileUrl: getCellValue("profileUrl"),
            totalPatients: getCellValue("totalPatients"),
            totalArticles: getCellValue("totalArticles"),
            totalVisits: getCellValue("totalVisits"),
            scrapedDate: getCellValue("scrapedDate"),
            scrapedStatus: getCellValue("scrapedStatus"),
            dataSource: getCellValue("dataSource"),
            education: getCellValue("education"),
            socialRole: getCellValue("socialRole"),
            researchAchievements: getCellValue("researchAchievements"),
            honors: getCellValue("honors"),
            followUpPatients: getCellValue("followUpPatients"),
            followUpFeedback: getCellValue("followUpFeedback"),
            gender: getCellValue("gender"),
            sequenceNumber: getCellValue("sequenceNumber"),
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
        let hospitalName = row.hospital || hospitalFromFolder || fileName.split(".")[0];

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
          const result = await db
            .insert(hospitals)
            .values({
              name: hospitalInfo.name,
              nameEn: hospitalInfo.nameEn,
              city: "上海",
              level: "三级甲等",
              sourceHash: hospitalSourceHash,
              translationStatus: "pending",
            })
            .returning({ id: hospitals.id });

          hospitalId = Number(result[0]?.id);
          totalHospitals++;
        }

        const deptGroups = {};
        for (const doc of doctorsList) {
          const deptName = doc.department || departmentFromFile || "未分类";
          if (!deptGroups[deptName]) {
            deptGroups[deptName] = [];
          }
          deptGroups[deptName].push(doc);
        }

        for (const [deptName, deptDoctors] of Object.entries(deptGroups)) {
          const deptUrl = deptUrlMap.get(`${hospitalInfo.name}||${deptName}`) || null;

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

            if (!existingDept[0].url && deptUrl) {
              await db.update(departments).set({ url: deptUrl }).where(eq(departments.id, deptId));
            }

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
            const result = await db
              .insert(departments)
              .values({
                hospitalId,
                name: deptName,
                url: deptUrl,
                sourceHash: departmentSourceHash,
                translationStatus: "pending",
              })
              .returning({ id: departments.id });

            deptId = Number(result[0]?.id);
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
              sourceDoctorId: normalizeValue(doc.sourceDoctorId),
              haodafUrl: normalizeValue(doc.profileUrl),
              websiteUrl: normalizeValue(doc.profileUrl),
              totalPatients: normalizeValue(doc.totalPatients),
              totalArticles: normalizeValue(doc.totalArticles),
              totalVisits: normalizeValue(doc.totalVisits),
              scrapedDate: normalizeValue(doc.scrapedDate),
              scrapedStatus: normalizeValue(doc.scrapedStatus),
              dataSource: normalizeValue(doc.dataSource),
              educationExperience: normalizeValue(doc.education),
              socialRole: normalizeValue(doc.socialRole),
              researchAchievements: normalizeValue(doc.researchAchievements),
              honors: normalizeValue(doc.honors),
              followUpPatients: normalizeValue(doc.followUpPatients),
              followUpFeedback: normalizeValue(doc.followUpFeedback),
              gender: normalizeValue(doc.gender),
              sequenceNumber: normalizeValue(doc.sequenceNumber),
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
              recommendationScore: doctorValues.recommendationScore,
              sourceDoctorId: doctorValues.sourceDoctorId,
              haodafUrl: doctorValues.haodafUrl,
              websiteUrl: doctorValues.websiteUrl,
              totalPatients: doctorValues.totalPatients,
              totalArticles: doctorValues.totalArticles,
              totalVisits: doctorValues.totalVisits,
              scrapedDate: doctorValues.scrapedDate,
              scrapedStatus: doctorValues.scrapedStatus,
              dataSource: doctorValues.dataSource,
              educationExperience: doctorValues.educationExperience,
              socialRole: doctorValues.socialRole,
              researchAchievements: doctorValues.researchAchievements,
              honors: doctorValues.honors,
              followUpPatients: doctorValues.followUpPatients,
              followUpFeedback: doctorValues.followUpFeedback,
              gender: doctorValues.gender,
              sequenceNumber: doctorValues.sequenceNumber,
            });

            await db
              .insert(doctors)
              .values({
                ...doctorValues,
                sourceHash,
                translationStatus: "pending",
              })
              .onConflictDoUpdate({
                target: [
                  doctors.hospitalId,
                  doctors.departmentId,
                  doctors.name,
                ],
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

  await pool.end();
}

importDoctors().catch(console.error);
