import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

export async function GET(req: NextRequest) {
  try {
    // 1. Fetch Validators with their recommendations
    const validatorsRes = await db.execute(`
      SELECT 
        v.id, v.name, v.title, v.region, v.institution, v.experience, v.role, v.created_at,
        r.decision as final_decision, r.general_notes, r.submitted_at
      FROM validators v
      LEFT JOIN final_recommendations r ON v.id = r.validator_id
      ORDER BY v.created_at DESC;
    `);

    // 2. Fetch Likert score metrics
    const overallLikertRes = await db.execute(`
      SELECT 
        AVG(CAST(score AS FLOAT)) as overall_avg,
        COUNT(*) as total_answers,
        SUM(CASE WHEN score = 'TD' THEN 1 ELSE 0 END) as total_td,
        SUM(CASE WHEN score != 'TD' THEN 1 ELSE 0 END) as total_numeric
      FROM likert_responses;
    `);

    const sectionLikertRes = await db.execute(`
      SELECT 
        section_id,
        AVG(CAST(score AS FLOAT)) as avg_score,
        COUNT(*) as total_items,
        SUM(CASE WHEN score = 'TD' THEN 1 ELSE 0 END) as td_items
      FROM likert_responses
      GROUP BY section_id;
    `);

    // 3. Fetch all Image Corrections with sample metadata (HANYA citra foto penyakit: leaf & fruit)
    const correctionsRes = await db.execute(`
      SELECT 
        sv.id as correction_id,
        sv.sample_id,
        sv.is_mismatch,
        sv.expert_diagnosis,
        sv.symptom_notes,
        sv.created_at as corrected_at,
        s.image_url,
        s.part,
        s.location,
        s.disease_label as original_label,
        v.name as validator_name,
        v.role as validator_role
      FROM sample_validations sv
      JOIN samples s ON sv.sample_id = s.id
      LEFT JOIN validators v ON sv.validator_id = v.id
      WHERE s.part != 'sensor'
      ORDER BY sv.created_at DESC;
    `);

    // 3b. Fetch Evaluasi Sensor Mikroklimat secara terpisah
    const sensorReviewsRes = await db.execute(`
      SELECT 
        sv.id as review_id,
        sv.sample_id,
        sv.expert_diagnosis as status,
        sv.symptom_notes as notes,
        sv.created_at as reviewed_at,
        s.disease_label as station_name,
        s.location,
        s.filename,
        s.image_url as csv_url,
        v.name as validator_name,
        v.role as validator_role
      FROM sample_validations sv
      JOIN samples s ON sv.sample_id = s.id
      LEFT JOIN validators v ON sv.validator_id = v.id
      WHERE s.part = 'sensor'
      ORDER BY sv.created_at DESC;
    `);

    // 4. Fetch total dataset counts
    const samplesCountRes = await db.execute(`
      SELECT 
        COUNT(*) as total_samples,
        SUM(CASE WHEN part = 'leaf' THEN 1 ELSE 0 END) as leaf_count,
        SUM(CASE WHEN part = 'fruit' THEN 1 ELSE 0 END) as fruit_count
      FROM samples;
    `);

    // 5. Final Recommendations summary
    const recSummaryRes = await db.execute(`
      SELECT 
        decision, COUNT(*) as count 
      FROM final_recommendations 
      GROUP BY decision;
    `);

    return NextResponse.json({
      validators: validatorsRes.rows,
      likertStats: {
        overall: overallLikertRes.rows[0] || {},
        bySection: sectionLikertRes.rows || [],
      },
      corrections: correctionsRes.rows,
      sensorReviews: sensorReviewsRes.rows,
      samplesOverview: samplesCountRes.rows[0] || {},
      recommendationSummary: recSummaryRes.rows || [],
    });
  } catch (error: any) {
    console.error("Error in admin stats:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
