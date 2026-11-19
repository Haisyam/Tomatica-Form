import { createClient } from "@libsql/client";
import dotenv from "dotenv";

dotenv.config({ path: ".env.local" });

const client = createClient({
  url: process.env.TURSO_DATABASE_URL,
  authToken: process.env.TURSO_AUTH_TOKEN,
});

async function run() {
  const sensors = [
    {
      id: "samarang_garut",
      part: "sensor",
      location: "garut",
      disease: "microclimate",
      disease_label: "Rekaman Mikroklimat Samarang (Garut)",
      filename: "samarang_garut.csv",
      image_url: "https://tomatica.haisyam.dev/tomato-sensor-data/samarang_garut.csv",
    },
    {
      id: "gunungmanik_majalengka",
      part: "sensor",
      location: "majalengka",
      disease: "microclimate",
      disease_label: "Rekaman Mikroklimat Gunungmanik (Majalengka)",
      filename: "gunungmanik_majalengka.csv",
      image_url: "https://tomatica.haisyam.dev/tomato-sensor-data/gunungmanik_majalengka.csv",
    },
    {
      id: "sangiang_majalengka",
      part: "sensor",
      location: "majalengka",
      disease: "microclimate",
      disease_label: "Rekaman Mikroklimat Sangiang (Majalengka)",
      filename: "sangiang_majalengka.csv",
      image_url: "https://tomatica.haisyam.dev/tomato-sensor-data/sangiang_majalengka.csv",
    },
  ];

  for (const s of sensors) {
    await client.execute({
      sql: `INSERT OR REPLACE INTO samples (id, part, location, disease, disease_label, filename, image_url)
            VALUES (?, ?, ?, ?, ?, ?, ?);`,
      args: [s.id, s.part, s.location, s.disease, s.disease_label, s.filename, s.image_url],
    });
    console.log("Inserted sensor record into Turso:", s.id);
  }
  console.log("Done inserting sensor records!");
}

run().catch(console.error);
