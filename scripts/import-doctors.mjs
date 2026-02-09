import { drizzle } from "drizzle-orm/mysql2";
import mysql from "mysql2/promise";
import { readdirSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";
import ExcelJS from "exceljs";
import { hospitals, departments, doctors } from "../drizzle/schema.js";
import { eq, and } from "drizzle-orm";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Database connection
const connection = await mysql.createConnection(process.env.DATABASE_URL);
const db = drizzle(connection);

// Hospital data mapping
const hospitalMapping = {
  "复旦大学附属华山医院": { name: "复旦大学附属华山医院", nameEn: "Huashan Hospital Affiliated to Fudan University" },
  "复旦大学附属中山医院": { name: "复旦大学附属中山医院", nameEn: "Zhongshan Hospital Affiliated to Fudan University" },
  "上海交通大学医学院附属瑞金医院": { name: "上海交通大学医学院附属瑞金医院", nameEn: "Ruijin Hospital Affiliated to Shanghai Jiao Tong University" },
  "复旦大学附属肿瘤医院": { name: "复旦大学附属肿瘤医院", nameEn: "Fudan University Shanghai Cancer Center" },
  "上海市第六人民医院": { name: "上海市第六人民医院", nameEn: "Shanghai Sixth People's Hospital" },
  "上海市第九人民医院": { name: "上海市第九人民医院", nameEn: "Shanghai Ninth People's Hospital" },
};

// Column name mappings (handle variations)
const columnMappings = {
  hospital: ["医院", "hospital"],
  department: ["科室", "department"],
  name: ["姓名", "name", "医生姓名"],
  title: ["职称", "title"],
  specialty: ["专业方向", "specialty", "专长"],
  expertise: ["专业擅长", "expertise", "擅长"],
  satisfactionRate: ["主观疗效", "疗效满意度", "satisfaction"],
  attitudeScore: ["态度满意度", "态度", "attitude"],
  recommendationScore: ["病友推荐度", "推荐度", "recommendation"],
  onlineConsultation: ["在线问诊", "online"],
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
  // Try to find header row (usually row 1 or 2)
  let headerRow = [];
  let headerRowNum = 1;
  
  for (let rowNum = 1; rowNum <= 3; rowNum++) {
    const row = worksheet.getRow(rowNum);
    const values = [];
    row.eachCell((cell, colNumber) => {
      values[colNumber - 1] = cell.value;
    });
    
    // Check if this looks like a header row
    const hasExpectedHeaders = values.some(v => 
      String(v || "").includes("姓名") || 
      String(v || "").includes("医院") ||
      String(v || "").includes("科室")
    );
    
    if (hasExpectedHeaders) {
      headerRow = values;
      headerRowNum = rowNum;
      break;
    }
  }
  
  if (headerRow.length === 0) {
    console.warn("  Warning: Could not find header row, using default mapping");
    return null;
  }
  
  const mapping = {};
  for (const [field, variations] of Object.entries(columnMappings)) {
    const idx = findColumnIndex(headerRow, variations);
    if (idx >= 0) {
      mapping[field] = idx;
    }
  }
  
  return { mapping, headerRowNum };
}

async function importDoctors() {
  console.log("Starting doctor data import...");

  const hospitalsDir = "/home/ubuntu/medibridge/医院";
  const hospitalFolders = readdirSync(hospitalsDir);

  let totalDoctors = 0;
  let totalDepartments = 0;
  let totalHospitals = 0;

  for (const folder of hospitalFolders) {
    const folderPath = join(hospitalsDir, folder);
    const files = readdirSync(folderPath).filter(f => f.endsWith(".xlsx"));

    if (files.length === 0) continue;

    console.log(`\nProcessing hospital folder: ${folder}`);

    for (const file of files) {
      const filePath = join(folderPath, file);
      console.log(`  Reading file: ${file}`);

      try {
        const workbook = new ExcelJS.Workbook();
        await workbook.xlsx.readFile(filePath);
        const worksheet = workbook.worksheets[0];

        const columnInfo = getColumnMapping(worksheet);
        if (!columnInfo) {
          console.log(`  Skipping file (no valid headers found)`);
          continue;
        }

        const { mapping, headerRowNum } = columnInfo;
        
        // Process data rows
        const rows = [];
        worksheet.eachRow((row, rowNumber) => {
          if (rowNumber <= headerRowNum) return; // Skip header rows

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
            expertise: getCellValue("expertise"),
            satisfactionRate: getCellValue("satisfactionRate"),
            attitudeScore: getCellValue("attitudeScore"),
            recommendationScore: getCellValue("recommendationScore"),
            onlineConsultation: getCellValue("onlineConsultation"),
            appointmentAvailable: getCellValue("appointmentAvailable"),
          };

          // Validate required fields
          if (rowData.name && rowData.name.length > 0) {
            rows.push(rowData);
          }
        });

        console.log(`  Found ${rows.length} doctors`);

        // Group by hospital
        const hospitalGroups = {};
        for (const row of rows) {
          // Use hospital from data or infer from folder name
          let hospitalName = row.hospital || folder;
          
          // Try to match with known hospitals
          for (const knownName of Object.keys(hospitalMapping)) {
            if (hospitalName.includes(knownName) || knownName.includes(hospitalName) ||
                folder.includes(knownName) || knownName.includes(folder)) {
              hospitalName = knownName;
              break;
            }
          }
          
          if (!hospitalGroups[hospitalName]) {
            hospitalGroups[hospitalName] = [];
          }
          hospitalGroups[hospitalName].push(row);
        }

        // Insert data
        for (const [hospitalName, doctorsList] of Object.entries(hospitalGroups)) {
          const hospitalInfo = hospitalMapping[hospitalName] || { name: hospitalName, nameEn: null };
          
          // Check if hospital exists
          const existingHospital = await db.select().from(hospitals).where(eq(hospitals.name, hospitalInfo.name)).limit(1);
          let hospitalId;
          
          if (existingHospital.length > 0) {
            hospitalId = existingHospital[0].id;
          } else {
            const result = await db.insert(hospitals).values({
              name: hospitalInfo.name,
              nameEn: hospitalInfo.nameEn,
              city: '上海',
              level: '三级甲等'
            });
            hospitalId = Number(result[0].insertId);
            totalHospitals++;
          }

          // Group by department
          const deptGroups = {};
          for (const doc of doctorsList) {
            const deptName = doc.department || "未分类";
            if (!deptGroups[deptName]) {
              deptGroups[deptName] = [];
            }
            deptGroups[deptName].push(doc);
          }

          // Insert departments and doctors
          for (const [deptName, deptDoctors] of Object.entries(deptGroups)) {
            // Check if department exists
            const existingDept = await db.select().from(departments)
              .where(and(
                eq(departments.hospitalId, hospitalId),
                eq(departments.name, deptName)
              ))
              .limit(1);
            
            let deptId;
            if (existingDept.length > 0) {
              deptId = existingDept[0].id;
            } else {
              const result = await db.insert(departments).values({
                hospitalId: hospitalId,
                name: deptName
              });
              deptId = Number(result[0].insertId);
              totalDepartments++;
            }

            // Insert doctors
            for (const doc of deptDoctors) {
              const recScore = parseFloat(doc.recommendationScore) || null;
              
              await db.insert(doctors).values({
                hospitalId: hospitalId,
                departmentId: deptId,
                name: doc.name,
                title: doc.title || null,
                specialty: doc.specialty || null,
                expertise: doc.expertise || null,
                satisfactionRate: doc.satisfactionRate || null,
                attitudeScore: doc.attitudeScore || null,
                recommendationScore: recScore,
                onlineConsultation: doc.onlineConsultation || null,
                appointmentAvailable: doc.appointmentAvailable || null
              });

              totalDoctors++;
            }
          }
        }
      } catch (error) {
        console.error(`  Error processing file ${file}:`, error.message);
        continue;
      }
    }
  }

  console.log("\n=== Import Summary ===");
  console.log(`Total hospitals: ${totalHospitals}`);
  console.log(`Total departments: ${totalDepartments}`);
  console.log(`Total doctors: ${totalDoctors}`);
  console.log("Import completed successfully!");
  
  await connection.end();
}

// Run import
importDoctors().catch(console.error);
