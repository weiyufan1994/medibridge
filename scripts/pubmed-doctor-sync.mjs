import fs from "fs/promises";
import path from "path";
import mysql from "mysql2/promise";
import { drizzle } from "drizzle-orm/mysql2";
import { doctors, departments } from "../drizzle/schema.js";
import { eq } from "drizzle-orm";

const OUTPUT = path.resolve("data/pubmed-doctor-map.json");
const DRY_RUN = process.env.DRY_RUN !== "false";
const FETCH_LIMIT = Number(process.env.PUBMED_FETCH_LIMIT || 50);

async function fetchPubMed(query) {
  const encoded = encodeURIComponent(query);
  const searchUrl = `https://eutils.ncbi.nlm.nih.gov/entrez/eutils/esearch.fcgi?db=pubmed&retmode=json&retmax=3&term=${encoded}`;
  const searchRes = await fetch(searchUrl);
  const searchData = await searchRes.json();
  const ids = searchData?.esearchresult?.idlist || [];
  if (ids.length === 0) return [];

  const summaryUrl = `https://eutils.ncbi.nlm.nih.gov/entrez/eutils/esummary.fcgi?db=pubmed&retmode=json&id=${ids.join(",")}`;
  const summaryRes = await fetch(summaryUrl);
  const summaryData = await summaryRes.json();

  return ids.map(id => {
    const item = summaryData?.result?.[id] || {};
    return {
      pmid: id,
      title: item.title || "",
      pubdate: item.pubdate || "",
      source: item.source || "",
    };
  });
}

async function main() {
  if (!process.env.DATABASE_URL) {
    throw new Error("DATABASE_URL is required");
  }

  const connection = await mysql.createConnection(process.env.DATABASE_URL);
  const db = drizzle(connection);

  const rows = await db
    .select({ doctor: doctors, department: departments })
    .from(doctors)
    .innerJoin(departments, eq(doctors.departmentId, departments.id))
    .limit(FETCH_LIMIT);

  const output = [];

  for (const row of rows) {
    const { doctor, department } = row;
    const query = `${doctor.name} ${department.name} China`;

    const publications = DRY_RUN ? [] : await fetchPubMed(query);

    output.push({
      doctorId: doctor.id,
      doctorName: doctor.name,
      department: department.name,
      query,
      publications,
    });
  }

  await fs.mkdir(path.dirname(OUTPUT), { recursive: true });
  await fs.writeFile(
    OUTPUT,
    JSON.stringify(
      {
        generatedAt: new Date().toISOString(),
        dryRun: DRY_RUN,
        records: output,
      },
      null,
      2
    )
  );

  console.log(`Wrote ${output.length} doctor records to ${OUTPUT}`);
  await connection.end();
}

main().catch(err => {
  console.error(err);
  process.exitCode = 1;
});
