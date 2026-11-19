import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const {
      validator,
      likertEvaluation,
      sampleImageValidation,
      finalRecommendation,
    } = body;

    if (!validator || !validator.nama) {
      return NextResponse.json({ error: "Data validator tidak lengkap" }, { status: 400 });
    }

    const validatorId = `${validator.role || "unknown"}_${Date.now()}`;

    // 1. Insert Validator
    await db.execute({
      sql: `INSERT OR REPLACE INTO validators (id, name, title, region, institution, experience, role)
            VALUES (?, ?, ?, ?, ?, ?, ?);`,
      args: [
        validatorId,
        validator.nama,
        validator.jabatan || "",
        validator.wilayah || "",
        validator.instansi || "",
        validator.pengalaman || "",
        validator.role || "sukabumi",
      ],
    });

    // 2. Insert Likert Responses
    const likertStatements = [];
    if (likertEvaluation && likertEvaluation.answers) {
      for (const [qNo, score] of Object.entries(likertEvaluation.answers)) {
        likertStatements.push({
          sql: `INSERT INTO likert_responses (id, validator_id, question_no, score, section_id)
                VALUES (?, ?, ?, ?, ?);`,
          args: [
            `${validatorId}_q${qNo}`,
            validatorId,
            parseInt(qNo, 10),
            String(score),
            qNo <= "6" ? "section_c" : qNo <= "13" ? "section_d" : qNo <= "19" ? "section_e" : "section_f",
          ],
        });
      }
    }

    // 3. Insert Section Notes
    if (likertEvaluation && likertEvaluation.sectionNotes) {
      for (const [secId, notes] of Object.entries(likertEvaluation.sectionNotes)) {
        if (notes) {
          likertStatements.push({
            sql: `INSERT INTO section_notes (id, validator_id, section_id, notes)
                  VALUES (?, ?, ?, ?);`,
            args: [`${validatorId}_${secId}`, validatorId, secId, String(notes)],
          });
        }
      }
    }

    // 4. Insert Sample Validations / Corrections
    if (sampleImageValidation) {
      for (const [sampleId, corr] of Object.entries<any>(sampleImageValidation)) {
        if (corr && corr.isCorrected) {
          likertStatements.push({
            sql: `INSERT INTO sample_validations (id, validator_id, sample_id, is_mismatch, expert_diagnosis, symptom_notes)
                  VALUES (?, ?, ?, ?, ?, ?);`,
            args: [
              `${validatorId}_${sampleId}`,
              validatorId,
              sampleId,
              1,
              corr.correctDisease || "",
              corr.notes || "",
            ],
          });
        }
      }
    }

    // 5. Insert Final Recommendation
    if (finalRecommendation) {
      likertStatements.push({
        sql: `INSERT INTO final_recommendations (id, validator_id, decision, general_notes)
              VALUES (?, ?, ?, ?);`,
        args: [
          `${validatorId}_rec`,
          validatorId,
          finalRecommendation.decision || "layak",
          finalRecommendation.comments || "",
        ],
      });
    }

    if (likertStatements.length > 0) {
      await db.batch(likertStatements, "write");
    }

    return NextResponse.json({
      success: true,
      validatorId,
      message: "Data kuesioner dan validasi sampel berhasil disimpan",
    });
  } catch (error: any) {
    console.error("Error saving validation:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const validatorId = searchParams.get("validatorId");

    if (!validatorId) {
      return NextResponse.json({ error: "Parameter validatorId dibutuhkan" }, { status: 400 });
    }

    // 1. Data Validator
    const valRes = await db.execute({
      sql: `SELECT * FROM validators WHERE id = ?;`,
      args: [validatorId],
    });
    if (valRes.rows.length === 0) {
      return NextResponse.json({ error: "Validator tidak ditemukan" }, { status: 404 });
    }
    const valRow: any = valRes.rows[0];

    // 2. Jawaban Likert
    const likertRes = await db.execute({
      sql: `SELECT question_no, score, section_id FROM likert_responses WHERE validator_id = ? ORDER BY question_no ASC;`,
      args: [validatorId],
    });
    const answers: Record<number, string> = {};
    for (const row of likertRes.rows as any[]) {
      answers[Number(row.question_no)] = String(row.score);
    }

    // 3. Catatan per Bagian
    const notesRes = await db.execute({
      sql: `SELECT section_id, notes FROM section_notes WHERE validator_id = ?;`,
      args: [validatorId],
    });
    const sectionNotes: Record<string, string> = {};
    for (const row of notesRes.rows as any[]) {
      sectionNotes[String(row.section_id)] = String(row.notes);
    }

    // 4. Koreksi Sampel & Status Sensor
    const corrRes = await db.execute({
      sql: `SELECT sample_id, is_mismatch, expert_diagnosis, symptom_notes FROM sample_validations WHERE validator_id = ?;`,
      args: [validatorId],
    });
    const corrections: Record<string, any> = {};
    const sensorReviews: Record<string, any> = {
      samarang_garut: { status: "memadai", notes: "" },
      gunungmanik_majalengka: { status: "memadai", notes: "" },
      sangiang_majalengka: { status: "memadai", notes: "" },
    };

    for (const row of corrRes.rows as any[]) {
      const sId = String(row.sample_id);
      if (sId === "samarang_garut" || sId === "gunungmanik_majalengka" || sId === "sangiang_majalengka") {
        sensorReviews[sId] = {
          status: row.expert_diagnosis === "Memadai" ? "memadai" : "perlu_cek",
          notes: String(row.symptom_notes || ""),
        };
      } else {
        corrections[sId] = {
          isCorrected: Boolean(row.is_mismatch),
          correctDisease: String(row.expert_diagnosis || ""),
          notes: String(row.symptom_notes || ""),
        };
      }
    }

    // 5. Rekomendasi Akhir
    const recRes = await db.execute({
      sql: `SELECT decision, general_notes FROM final_recommendations WHERE validator_id = ?;`,
      args: [validatorId],
    });
    const recRow: any = recRes.rows[0];

    return NextResponse.json({
      validator: {
        id: valRow.id,
        nama: valRow.name,
        jabatan: valRow.title,
        wilayah: valRow.region,
        instansi: valRow.institution,
        pengalaman: valRow.experience,
        role: valRow.role,
      },
      likertAnswers: answers,
      likertNotes: sectionNotes,
      corrections,
      sensorReviews,
      finalRecommendation: {
        decision: recRow?.decision ? String(recRow.decision) : "layak",
        comments: recRow?.general_notes ? String(recRow.general_notes) : "",
      },
    });
  } catch (error: any) {
    console.error("Error fetching validator detail:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const session = req.cookies.get("tomatica_admin_session")?.value;
    if (session !== "authenticated") {
      return NextResponse.json(
        { error: "Akses ditolak: Hanya admin yang berhak menghapus data." },
        { status: 401 }
      );
    }

    const { searchParams } = new URL(req.url);
    const validatorId = searchParams.get("validatorId");
    const correctionId = searchParams.get("correctionId");
    const resetAll = searchParams.get("resetAll");

    // Case 1: Reset Semua Data Responden (Hanya data uji coba, katalog master samples tetap aman)
    if (resetAll === "true") {
      await db.batch(
        [
          `DELETE FROM likert_responses;`,
          `DELETE FROM section_notes;`,
          `DELETE FROM sample_validations;`,
          `DELETE FROM final_recommendations;`,
          `DELETE FROM validators;`,
        ],
        "write"
      );
      return NextResponse.json({
        success: true,
        message: "Seluruh data kuesioner dan validasi responden berhasil direset.",
      });
    }

    // Case 2: Hapus Koreksi Citra Tertentu
    if (correctionId) {
      await db.execute({
        sql: `DELETE FROM sample_validations WHERE id = ?;`,
        args: [correctionId],
      });
      return NextResponse.json({
        success: true,
        message: "Data koreksi citra berhasil dihapus.",
      });
    }

    // Case 3: Hapus Data Validator Tertentu (Cascade)
    if (validatorId) {
      await db.batch(
        [
          { sql: `DELETE FROM likert_responses WHERE validator_id = ?;`, args: [validatorId] },
          { sql: `DELETE FROM section_notes WHERE validator_id = ?;`, args: [validatorId] },
          { sql: `DELETE FROM sample_validations WHERE validator_id = ?;`, args: [validatorId] },
          { sql: `DELETE FROM final_recommendations WHERE validator_id = ?;`, args: [validatorId] },
          { sql: `DELETE FROM validators WHERE id = ?;`, args: [validatorId] },
        ],
        "write"
      );
      return NextResponse.json({
        success: true,
        message: "Data validator dan seluruh penilaiannya berhasil dihapus.",
      });
    }

    return NextResponse.json(
      { error: "Parameter validatorId, correctionId, atau resetAll diperlukan." },
      { status: 400 }
    );
  } catch (error: any) {
    console.error("Error deleting validation data:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
