import { drizzle } from "drizzle-orm/mysql2";
import mysql from "mysql2/promise";
import { doctors, doctorEmbeddings, hospitals, departments } from "../drizzle/schema.js";
import { eq } from "drizzle-orm";
import axios from "axios";

// Database connection
const connection = await mysql.createConnection(process.env.DATABASE_URL);
const db = drizzle(connection);

// LLM API configuration
const LLM_API_URL = process.env.BUILT_IN_FORGE_API_URL;
const LLM_API_KEY = process.env.BUILT_IN_FORGE_API_KEY;

async function generateEmbedding(text) {
  try {
    const response = await axios.post(
      `${LLM_API_URL}/v1/embeddings`,
      {
        input: text,
        model: "text-embedding-3-small"
      },
      {
        headers: {
          "Authorization": `Bearer ${LLM_API_KEY}`,
          "Content-Type": "application/json"
        }
      }
    );
    
    return response.data.data[0].embedding;
  } catch (error) {
    console.error("Error generating embedding:", error.response?.data || error.message);
    throw error;
  }
}

function buildDoctorText(doctor, hospital, department) {
  // Build comprehensive text for embedding
  const parts = [];
  
  parts.push(`医院：${hospital.name}`);
  parts.push(`科室：${department.name}`);
  parts.push(`医生：${doctor.name}`);
  
  if (doctor.title) {
    parts.push(`职称：${doctor.title}`);
  }
  
  if (doctor.specialty) {
    parts.push(`专业方向：${doctor.specialty}`);
  }
  
  if (doctor.expertise) {
    parts.push(`专业擅长：${doctor.expertise}`);
  }
  
  return parts.join("\n");
}

async function vectorizeDoctors() {
  console.log("Starting doctor vectorization...");
  
  // Get all doctors with hospital and department info
  const allDoctors = await db
    .select({
      doctor: doctors,
      hospital: hospitals,
      department: departments
    })
    .from(doctors)
    .innerJoin(hospitals, eq(doctors.hospitalId, hospitals.id))
    .innerJoin(departments, eq(doctors.departmentId, departments.id));
  
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
      
      if (existing.length > 0) {
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
      
      // Store embedding
      await db.insert(doctorEmbeddings).values({
        doctorId: doctor.id,
        embedding: JSON.stringify(embedding),
        content: content
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
  
  await connection.end();
}

// Run vectorization
vectorizeDoctors().catch(console.error);
