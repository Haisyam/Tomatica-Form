import { createClient } from "@libsql/client";
import fs from "fs";
import path from "path";
import dotenv from "dotenv";

dotenv.config({ path: ".env.local" });

const url = process.env.TURSO_DATABASE_URL;
const authToken = process.env.TURSO_AUTH_TOKEN;

if (!url) {
  console.error("Missing TURSO_DATABASE_URL in .env.local");
  process.exit(1);
}

const client = createClient({ url, authToken });

async function init() {
  console.log("Creating tables on Turso DB...");

  // 1. Samples table
  await client.execute(`
    CREATE TABLE IF NOT EXISTS samples (
      id TEXT PRIMARY KEY,
      part TEXT NOT NULL,
      location TEXT NOT NULL,
      disease TEXT NOT NULL,
      disease_label TEXT NOT NULL,
      filename TEXT NOT NULL,
      image_url TEXT NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );
  `);

  // 2. Validators table
  await client.execute(`
    CREATE TABLE IF NOT EXISTS validators (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      title TEXT,
      region TEXT,
      institution TEXT,
      experience TEXT,
      role TEXT NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );
  `);

  // 3. Likert responses table
  await client.execute(`
    CREATE TABLE IF NOT EXISTS likert_responses (
      id TEXT PRIMARY KEY,
      validator_id TEXT NOT NULL,
      question_no INTEGER NOT NULL,
      score TEXT NOT NULL,
      section_id TEXT NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (validator_id) REFERENCES validators(id)
    );
  `);

  // 4. Section notes table
  await client.execute(`
    CREATE TABLE IF NOT EXISTS section_notes (
      id TEXT PRIMARY KEY,
      validator_id TEXT NOT NULL,
      section_id TEXT NOT NULL,
      notes TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (validator_id) REFERENCES validators(id)
    );
  `);

  // 5. Sample validations / image corrections table
  await client.execute(`
    CREATE TABLE IF NOT EXISTS sample_validations (
      id TEXT PRIMARY KEY,
      validator_id TEXT NOT NULL,
      sample_id TEXT NOT NULL,
      is_mismatch INTEGER DEFAULT 1,
      expert_diagnosis TEXT,
      symptom_notes TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (validator_id) REFERENCES validators(id),
      FOREIGN KEY (sample_id) REFERENCES samples(id)
    );
  `);

  // 6. Final recommendations table
  await client.execute(`
    CREATE TABLE IF NOT EXISTS final_recommendations (
      id TEXT PRIMARY KEY,
      validator_id TEXT NOT NULL,
      decision TEXT NOT NULL,
      general_notes TEXT,
      submitted_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (validator_id) REFERENCES validators(id)
    );
  `);

  console.log("Tables created successfully!");

  // Seed samples table
  const samplesFile = path.resolve("src/data/remote_samples.json");
  if (fs.existsSync(samplesFile)) {
    const samples = JSON.parse(fs.readFileSync(samplesFile, "utf-8"));
    console.log(`Checking existing samples in Turso (total to seed: ${samples.length})...`);
    
    const countRes = await client.execute("SELECT COUNT(*) as count FROM samples;");
    const existingCount = countRes.rows[0].count;
    console.log(`Current samples count in Turso: ${existingCount}`);

    if (existingCount < samples.length) {
      console.log("Seeding samples into Turso in batches of 100...");
      const batchSize = 100;
      for (let i = 0; i < samples.length; i += batchSize) {
        const batch = samples.slice(i, i + batchSize);
        const statements = batch.map(s => ({
          sql: `INSERT OR REPLACE INTO samples (id, part, location, disease, disease_label, filename, image_url)
                VALUES (?, ?, ?, ?, ?, ?, ?);`,
          args: [s.id, s.part, s.location, s.disease, s.disease_label, s.filename, s.image_url]
        }));
        await client.batch(statements, "write");
        process.stdout.write(`Seeded ${Math.min(i + batchSize, samples.length)} / ${samples.length}\r`);
      }
      console.log("\nAll samples seeded successfully into Turso DB!");
    } else {
      console.log("Samples already up to date in Turso DB.");
    }
  }
}

init().catch(console.error);
