import { createHash } from "crypto";
import { existsSync, readFileSync, readdirSync, statSync } from "fs";
import { join, relative, sep } from "path";

export const hospitalMapping = {
  复旦大学附属华山医院: {
    name: "复旦大学附属华山医院",
    nameEn: "Huashan Hospital Affiliated to Fudan University",
  },
  复旦大学附属中山医院: {
    name: "复旦大学附属中山医院",
    nameEn: "Zhongshan Hospital Affiliated to Fudan University",
  },
  上海交通大学医学院附属瑞金医院: {
    name: "上海交通大学医学院附属瑞金医院",
    nameEn: "Ruijin Hospital Affiliated to Shanghai Jiao Tong University",
  },
  复旦大学附属肿瘤医院: {
    name: "复旦大学附属肿瘤医院",
    nameEn: "Fudan University Shanghai Cancer Center",
  },
  上海市第六人民医院: {
    name: "上海市第六人民医院",
    nameEn: "Shanghai Sixth People's Hospital",
  },
  上海市第九人民医院: {
    name: "上海市第九人民医院",
    nameEn: "Shanghai Ninth People's Hospital",
  },
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
  sourceDoctorId: [
    "doctor id",
    "doctor_id",
    "doctorid",
    "医生id",
    "doctorid",
    "医生id",
  ],
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

export const normalizeValue = value => {
  if (value === undefined || value === null) return null;
  if (typeof value === "string") {
    const trimmed = value.trim();
    return trimmed.length > 0 ? trimmed : null;
  }
  return value;
};

export const computeSourceHash = payload => {
  const normalized = Object.fromEntries(
    Object.entries(payload).map(([key, val]) => [key, normalizeValue(val)])
  );
  return createHash("sha256").update(JSON.stringify(normalized)).digest("hex");
};

function findColumnIndex(headerRow, fieldMappings) {
  const normalize = value =>
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

export function getColumnMapping(worksheet) {
  let headerRow = [];
  let headerRowNum = -1;

  for (let rowNum = 1; rowNum <= 10; rowNum++) {
    const row = worksheet.getRow(rowNum);
    const values = [];
    row.eachCell((cell, colNumber) => {
      values[colNumber - 1] = cell.value;
    });

    const hasExpectedHeaders = values.some(value => {
      const label = String(value || "").trim();
      return (
        label.includes("姓名") ||
        label.includes("医院") ||
        label.includes("科室") ||
        label.includes("专家")
      );
    });

    if (hasExpectedHeaders) {
      headerRow = values;
      headerRowNum = rowNum;
      break;
    }
  }

  if (headerRowNum === -1) return null;

  const mapping = {};
  for (const [field, aliases] of Object.entries(columnMappings)) {
    mapping[field] = findColumnIndex(headerRow, aliases);
  }

  return mapping.name === -1 ? null : { mapping, headerRowNum };
}

export function getAllXlsxFiles(dirPath, arrayOfFiles = []) {
  let files;

  try {
    files = readdirSync(dirPath);
  } catch (error) {
    console.warn(`Could not read directory ${dirPath}:`, error.message);
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
    } else if (file.endsWith(".xlsx") && !file.startsWith("~$")) {
      arrayOfFiles.push(fullPath);
    }
  }

  return arrayOfFiles;
}

export function parseHospitalFromPath(hospitalsDir, filePath) {
  const parts = relative(hospitalsDir, filePath).split(sep).filter(Boolean);
  return parts.length >= 2 ? parts[0].trim() : null;
}

export function parseDepartmentFromFileName(fileName) {
  const base = fileName.replace(/\.xlsx$/i, "").trim();
  if (!base) return "";

  const newStyle = base.match(/^(.*)_医生详细信息(?:_\d{8})?$/);
  if (newStyle?.[1]) return newStyle[1].trim();

  const legacyStyle = base.match(/^(.*)_医生信息(?:_\d{8})?$/);
  if (!legacyStyle?.[1]) return "";

  const normalized = legacyStyle[1].trim();
  const parts = normalized
    .split("_")
    .map(part => part.trim())
    .filter(Boolean);
  return parts.length > 1 ? parts[parts.length - 1] : normalized;
}

export function loadDeptUrlMap(jsonPath) {
  const map = new Map();
  if (!existsSync(jsonPath)) {
    console.warn(`Department index not found: ${jsonPath}`);
    return map;
  }

  const entries = JSON.parse(readFileSync(jsonPath, "utf-8"));
  if (!Array.isArray(entries)) {
    console.warn(`Department index is not an array: ${jsonPath}`);
    return map;
  }

  for (const entry of entries) {
    if (!entry?.hospital || !entry?.department || !entry?.url) continue;
    map.set(`${entry.hospital}||${entry.department}`, entry.url);
  }
  return map;
}
