import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const part = searchParams.get("part") || "all";
    const disease = searchParams.get("disease") || "all";
    const location = searchParams.get("location") || "all";
    const page = parseInt(searchParams.get("page") || "1", 10);
    const limit = parseInt(searchParams.get("limit") || "18", 10);
    const offset = (page - 1) * limit;

    let whereClauses: string[] = [];
    let args: (string | number)[] = [];

    if (part !== "all") {
      whereClauses.push("part = ?");
      args.push(part);
    } else {
      // Katalog foto citra daun & buah hanya memuat leaf dan fruit (mengecualikan rekaman data sensor CSV)
      whereClauses.push("part IN ('leaf', 'fruit')");
    }
    if (disease !== "all") {
      whereClauses.push("disease = ?");
      args.push(disease);
    }
    if (location !== "all") {
      whereClauses.push("location = ?");
      args.push(location);
    }

    const whereSql = whereClauses.length > 0 ? "WHERE " + whereClauses.join(" AND ") : "";

    // Count total matching
    const countQuery = `SELECT COUNT(*) as total FROM samples ${whereSql};`;
    const countRes = await db.execute({ sql: countQuery, args });
    const total = Number(countRes.rows[0].total);

    // Fetch paginated samples
    const query = `
      SELECT id, part, location, disease, disease_label, filename, image_url
      FROM samples
      ${whereSql}
      ORDER BY id ASC
      LIMIT ? OFFSET ?;
    `;
    const rowsRes = await db.execute({
      sql: query,
      args: [...args, limit, offset],
    });

    return NextResponse.json({
      samples: rowsRes.rows,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    });
  } catch (error: any) {
    console.error("Error fetching samples:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
