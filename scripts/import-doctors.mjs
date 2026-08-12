import { drizzle } from "drizzle-orm/node-postgres";
import { join, dirname, basename } from "path";
import { fileURLToPath } from "url";
import { hospitals, departments, doctors } from "../drizzle/schema.ts";
import { eq, and } from "drizzle-orm";
import "../server/_core/loadEnv.ts";
import { Pool } from "pg";
import {
  assertWorkbookFileCount,
  assertWorkbookLimits,
  assertXlsxInputFile,
  computeSourceHash,
  getAllXlsxFiles,
  getColumnMapping,
  hospitalMapping,
  loadDeptUrlMap,
  normalizeValue,
  parseDepartmentFromFileName,
  parseHospitalFromPath,
} from "./import-doctors-input.mjs";
import { readWorkbook } from "./xlsx-workbook-reader.mjs";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const hospitalsDir = join(__dirname, "../data/hospitals");
const xlsxFiles = getAllXlsxFiles(hospitalsDir);
assertWorkbookFileCount(xlsxFiles);

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});
await pool.query("SET TIME ZONE 'UTC'");
const db = drizzle(pool);

async function importDoctors() {
  console.log("Starting doctor data import...");

  const deptIndexPath = join(
    __dirname,
    "../data/departments/all_departments.json"
  );
  const deptUrlMap = loadDeptUrlMap(deptIndexPath);

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
      assertXlsxInputFile(filePath, hospitalsDir);
      const workbook = await readWorkbook(filePath);
      assertWorkbookLimits(workbook);

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

          const getCellValue = field => {
            const idx = mapping[field];
            if (idx === undefined || idx < 0) return "";
            const cell = row.getCell(idx + 1);
            return cell.value?.toString() || "";
          };

          const rowData = {
            hospital: hospitalFromFolder || getCellValue("hospital") || "",
            department:
              getCellValue("department") ||
              sheetDepartment ||
              departmentFromFile ||
              "",
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
        let hospitalName =
          row.hospital || hospitalFromFolder || fileName.split(".")[0];

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

      for (const [hospitalName, doctorsList] of Object.entries(
        hospitalGroups
      )) {
        const hospitalInfo = hospitalMapping[hospitalName] || {
          name: hospitalName,
          nameEn: null,
        };

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
          const deptUrl =
            deptUrlMap.get(`${hospitalInfo.name}||${deptName}`) || null;

          const departmentSourceHash = computeSourceHash({
            name: deptName,
            description: null,
          });

          const existingDept = await db
            .select()
            .from(departments)
            .where(
              and(
                eq(departments.hospitalId, hospitalId),
                eq(departments.name, deptName)
              )
            )
            .limit(1);

          let deptId;

          if (existingDept.length > 0) {
            deptId = existingDept[0].id;

            if (!existingDept[0].url && deptUrl) {
              await db
                .update(departments)
                .set({ url: deptUrl })
                .where(eq(departments.id, deptId));
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
