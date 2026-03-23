import { drizzle } from "drizzle-orm/node-postgres";
import { doctors, doctorEmbeddings, hospitals, departments } from "../drizzle/schema.ts";
import { eq } from "drizzle-orm";
import axios from "axios";
import "../server/_core/loadEnv.ts";
import { Pool } from "pg";
import {
  DOCTOR_EMBEDDING_DIMENSIONS,
  isFiniteEmbedding,
} from "../server/modules/doctors/embedding.ts";
import { deriveDoctorSpecialtyTags } from "../server/modules/doctors/taxonomy.ts";

// Database connection
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});
await pool.query("SET TIME ZONE 'UTC'");
const db = drizzle(pool);

// LLM API configuration
const LLM_API_URL =
  process.env.LLM_API_URL ||
  process.env.BUILT_IN_FORGE_API_URL ||
  process.env.FORGE_API_URL ||
  process.env.OPENAI_BASE_URL ||
  "";
const LLM_API_KEY =
  process.env.LLM_API_KEY ||
  process.env.BUILT_IN_FORGE_API_KEY ||
  process.env.FORGE_API_KEY ||
  process.env.OPENAI_API_KEY ||
  "";
const EMBEDDING_MODEL =
  process.env.LLM_EMBEDDING_MODEL ||
  process.env.EMBEDDING_MODEL ||
  "text-embedding-3-small";
const argv = process.argv.slice(2);
const refreshExisting = argv.includes("--refresh-existing");
const doctorIdFlagIndex = argv.indexOf("--doctor-id");
const targetDoctorId =
  doctorIdFlagIndex >= 0 && argv[doctorIdFlagIndex + 1]
    ? Number(argv[doctorIdFlagIndex + 1])
    : null;

function assertVectorizeConfig() {
  if (!process.env.DATABASE_URL) {
    throw new Error("DATABASE_URL is required for vectorization");
  }
  if (!LLM_API_URL) {
    throw new Error(
      "Embedding API URL is missing. Set BUILT_IN_FORGE_API_URL or FORGE_API_URL or OPENAI_BASE_URL"
    );
  }
  if (!LLM_API_KEY) {
    throw new Error(
      "Embedding API key is missing. Set BUILT_IN_FORGE_API_KEY or FORGE_API_KEY or OPENAI_API_KEY"
    );
  }
  if (doctorIdFlagIndex >= 0 && !Number.isInteger(targetDoctorId)) {
    throw new Error("--doctor-id requires a valid integer");
  }
}

async function generateEmbedding(text) {
  try {
    const response = await axios.post(
      `${LLM_API_URL.replace(/\/$/, "")}/v1/embeddings`,
      {
        input: text,
        model: EMBEDDING_MODEL
      },
      {
        headers: {
          "Authorization": `Bearer ${LLM_API_KEY}`,
          "Content-Type": "application/json"
        }
      }
    );
    
    const embedding = response.data.data[0].embedding;
    if (!isFiniteEmbedding(embedding)) {
      throw new Error(
        `Expected ${DOCTOR_EMBEDDING_DIMENSIONS}-dimensional embedding but received ${
          Array.isArray(embedding) ? embedding.length : "invalid"
        }`
      );
    }

    return embedding;
  } catch (error) {
    console.error("Error generating embedding:", error.response?.data || error.message);
    throw error;
  }
}

function buildDoctorText(doctor, hospital, department) {
  const parts = [];
  const specialtyTags = deriveDoctorSpecialtyTags({
    departmentName: department.name,
    departmentNameEn: department.nameEn,
    specialty: doctor.specialty,
    specialtyEn: doctor.specialtyEn,
    expertise: doctor.expertise,
    expertiseEn: doctor.expertiseEn,
  });

  const addLine = (label, value) => {
    if (typeof value === "string" && value.trim().length > 0) {
      parts.push(`${label}: ${value.trim()}`);
    }
  };

  addLine("Hospital (ZH)", hospital.name);
  addLine("Hospital (EN)", hospital.nameEn);
  addLine("Department (ZH)", department.name);
  addLine("Department (EN)", department.nameEn);
  addLine("Doctor (ZH)", doctor.name);
  addLine("Doctor (EN)", doctor.nameEn);
  addLine("Title (ZH)", doctor.title);
  addLine("Title (EN)", doctor.titleEn);
  addLine("Specialty (ZH)", doctor.specialty);
  addLine("Specialty (EN)", doctor.specialtyEn);
  addLine("Expertise (ZH)", doctor.expertise);
  addLine("Expertise (EN)", doctor.expertiseEn);
  addLine("Tags", specialtyTags.join(", "));

  return parts.join("\n");
}

async function vectorizeDoctors() {
  assertVectorizeConfig();
  console.log("Starting doctor vectorization...");
  console.log(`Embedding model: ${EMBEDDING_MODEL}`);
  console.log(JSON.stringify({ refreshExisting, targetDoctorId }));
  
  let query = db
    .select({
      doctor: doctors,
      hospital: hospitals,
      department: departments
    })
    .from(doctors)
    .innerJoin(hospitals, eq(doctors.hospitalId, hospitals.id))
    .innerJoin(departments, eq(doctors.departmentId, departments.id));

  if (Number.isInteger(targetDoctorId)) {
    query = query.where(eq(doctors.id, targetDoctorId));
  }

  const allDoctors = await query;
  
  console.log(`Found ${allDoctors.length} doctors to vectorize`);
  
  let processed = 0;
  let skipped = 0;
  let errors = 0;
  
  for (const row of allDoctors) {
    const { doctor, hospital, department } = row;
    
    try {
      // Check if embedding already exists
      const existing = await db
        .select()
        .from(doctorEmbeddings)
        .where(eq(doctorEmbeddings.doctorId, doctor.id))
        .limit(1);
      
      if (existing.length > 0 && !refreshExisting) {
        skipped++;
        if (skipped % 100 === 0) {
          console.log(`  Skipped ${skipped} existing embeddings...`);
        }
        continue;
      }
      
      // Build text for embedding
      const content = buildDoctorText(doctor, hospital, department);
      
      // Generate embedding
      const embedding = await generateEmbedding(content);
      
      await db
        .insert(doctorEmbeddings)
        .values({
          doctorId: doctor.id,
          embeddingVector: embedding,
          embeddingModel: EMBEDDING_MODEL,
          embeddingDimensions: DOCTOR_EMBEDDING_DIMENSIONS,
          content,
        })
        .onConflictDoUpdate({
          target: doctorEmbeddings.doctorId,
          set: {
            embeddingVector: embedding,
            embeddingModel: EMBEDDING_MODEL,
            embeddingDimensions: DOCTOR_EMBEDDING_DIMENSIONS,
            content,
            updatedAt: new Date(),
          },
        });
      
      processed++;
      
      if (processed % 10 === 0) {
        console.log(`  Processed ${processed}/${allDoctors.length - skipped} doctors...`);
      }
      
      // Rate limiting: small delay between requests
      await new Promise(resolve => setTimeout(resolve, 100));
      
    } catch (error) {
      console.error(`  Error processing doctor ${doctor.id} (${doctor.name}):`, error.message);
      errors++;
    }
  }
  
  console.log("\n=== Vectorization Summary ===");
  console.log(`Total doctors: ${allDoctors.length}`);
  console.log(`Processed: ${processed}`);
  console.log(`Skipped (already exists): ${skipped}`);
  console.log(`Errors: ${errors}`);
  console.log("Vectorization completed!");
  
  await pool.end();
}

// Run vectorization
vectorizeDoctors().catch(console.error);
