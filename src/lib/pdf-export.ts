import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

interface PdfExportParams {
  validator: {
    nama: string;
    jabatan: string;
    wilayah: string;
    instansi: string;
    pengalaman: string;
    role: string;
    roleLabel?: string;
  };
  sections: Array<{
    id: string;
    name: string;
    title: string;
    items: Array<{ no: number; text: string }>;
  }>;
  likertAnswers: Record<number, string>;
  likertNotes: Record<string, string>;
  corrections: Record<string, { isCorrected: boolean; correctDisease: string; notes: string }>;
  sensorReviews: Record<string, { status: "memadai" | "perlu_cek"; notes: string }>;
  finalRecommendation: {
    decision: string;
    comments: string;
  };
}

function drawVectorCheckmark(
  doc: jsPDF,
  cx: number,
  cy: number,
  size: number = 1.3,
  color: [number, number, number] = [0, 0, 0]
) {
  doc.saveGraphicsState();
  doc.setDrawColor(color[0], color[1], color[2]);
  doc.setLineWidth(0.5);
  doc.line(cx - size, cy + 0.1, cx - size * 0.25, cy + size * 1.05);
  doc.line(cx - size * 0.25, cy + size * 1.05, cx + size * 1.25, cy - size * 1.1);
  doc.restoreGraphicsState();
}

export function generateValidationPdf(params: PdfExportParams): jsPDF {
  const {
    validator,
    sections,
    likertAnswers,
    likertNotes,
    corrections,
    sensorReviews,
    finalRecommendation,
  } = params;

  const doc = new jsPDF({
    orientation: "portrait",
    unit: "mm",
    format: "a4",
  });

  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const margin = 15;
  const contentWidth = pageWidth - margin * 2;

  const todayStr = new Intl.DateTimeFormat("id-ID", {
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(new Date());

  // Helper untuk subtitle peran
  let subtitleRole = "Penilaian Praktisi POPT di Wilayah Kabupaten Sukabumi";
  if (validator.role === "fitopatologi") {
    subtitleRole = "Penilaian Pakar Fitopatologi & Proteksi Tanaman";
  } else if (validator.role === "agroklimat") {
    subtitleRole = "Penilaian Pakar Agroklimatologi & Dinamika Sensor Mikroklimat";
  }

  // 1. KOP SURAT / HEADER RESMI (Hitam Monokrom)
  doc.setTextColor(0, 0, 0);
  doc.setFont("times", "bold");
  doc.setFontSize(13);
  doc.text("KUESIONER EXPERT JUDGMENT", pageWidth / 2, 18, { align: "center" });

  doc.setFontSize(11);
  doc.text(
    "UJI VALIDASI CROSS-ZONE MODEL PREDIKTIF PENYAKIT TANAMAN TOMAT",
    pageWidth / 2,
    24,
    { align: "center" }
  );

  doc.setFont("times", "italic");
  doc.setFontSize(9.5);
  doc.text(subtitleRole, pageWidth / 2, 29, { align: "center" });

  // Double border line separator (standar dokumen formal / Word)
  doc.setDrawColor(0, 0, 0);
  doc.setLineWidth(0.8);
  doc.line(margin, 32, pageWidth - margin, 32);
  doc.setLineWidth(0.25);
  doc.line(margin, 33, pageWidth - margin, 33);

  let currentY = 37;

  // 2. BAGIAN A: IDENTITAS DAN KEPAKARAN VALIDATOR
  autoTable(doc, {
    startY: currentY,
    head: [
      [
        {
          content: "A. IDENTITAS DAN KEPAKARAN VALIDATOR",
          colSpan: 2,
          styles: { fontStyle: "bold", fillColor: [240, 240, 240], textColor: [0, 0, 0] },
        },
      ],
    ],
    body: [
      ["Nama Lengkap & Gelar", `: ${validator.nama || "-"}`],
      ["Jabatan / Profesi", `: ${validator.jabatan || "-"}`],
      ["Wilayah Tugas / Laboratorium", `: ${validator.wilayah || "-"}`],
      ["Instansi / Unit Kerja", `: ${validator.instansi || "-"}`],
      ["Lama Pengalaman di Bidang Terkait", `: ${validator.pengalaman || "-"}`],
      ["Waktu / Tanggal Penilaian", `: ${todayStr}`],
    ],
    theme: "grid",
    styles: {
      font: "times",
      fontSize: 9.5,
      cellPadding: 2,
      lineColor: [200, 200, 200],
      lineWidth: 0.15,
      textColor: [0, 0, 0],
    },
    columnStyles: {
      0: { cellWidth: 55, fontStyle: "bold" },
      1: { cellWidth: contentWidth - 55 },
    },
    margin: { left: margin, right: margin },
  });

  currentY = (doc as any).lastAutoTable.finalY + 5;

  // 3. BAGIAN B: PETUNJUK SKALA SKOR
  autoTable(doc, {
    startY: currentY,
    head: [
      [
        {
          content: "B. PETUNJUK DAN SKALA PENILAIAN (LIKERT 1–5 & TD)",
          colSpan: 2,
          styles: { fontStyle: "bold", fillColor: [240, 240, 240], textColor: [0, 0, 0] },
        },
      ],
    ],
    body: [
      [
        {
          content:
            "Skala Skor: 1 = Sangat Tidak Setuju | 2 = Kurang Setuju | 3 = Cukup / Ragu | 4 = Setuju | 5 = Sangat Setuju | TD = Tidak Tahu / Belum Relevan.",
          colSpan: 2,
        },
      ],
      [
        { content: "", styles: { halign: "center", cellWidth: 14 } },
        { content: "Tanda centang checklist pada kolom skor menunjukkan butir penilaian yang dipilih oleh validator." },
      ],
    ],
    theme: "grid",
    styles: {
      font: "times",
      fontSize: 9,
      cellPadding: 2,
      lineColor: [200, 200, 200],
      lineWidth: 0.15,
      textColor: [0, 0, 0],
    },
    didDrawCell: (data) => {
      if (data.section === "body" && data.row.index === 1 && data.column.index === 0) {
        const cx = data.cell.x + data.cell.width / 2;
        const cy = data.cell.y + data.cell.height / 2;
        doc.setFont("times", "bold");
        doc.setFontSize(10);
        doc.setTextColor(0, 0, 0);
        doc.text("[", cx - 3.8, cy + 1, { align: "center" });
        drawVectorCheckmark(doc, cx, cy - 0.2, 1.25, [0, 0, 0]);
        doc.text("]", cx + 3.8, cy + 1, { align: "center" });
      }
    },
    margin: { left: margin, right: margin },
  });

  currentY = (doc as any).lastAutoTable.finalY + 6;

  // 4. BAGIAN C S.D. F: TABEL KUESIONER LIKERT
  sections.forEach((sec) => {
    // Cek sisa halaman sebelum membuat tabel bagian baru
    if (currentY > pageHeight - 45) {
      doc.addPage();
      currentY = 20;
    }

    const tableRows = sec.items.map((q) => {
      const ans = likertAnswers[q.no] || "";
      return [
        q.no.toString(),
        q.text,
        ans === "1" ? "4" : "",
        ans === "2" ? "4" : "",
        ans === "3" ? "4" : "",
        ans === "4" ? "4" : "",
        ans === "5" ? "4" : "",
        ans === "TD" ? "4" : "",
      ];
    });

    // Jika ada catatan bagian, tambahkan baris keterangan di akhir tabel
    const sectionNote = likertNotes[sec.id]?.trim();
    if (sectionNote) {
      tableRows.push([
        "",
        `Catatan/Saran Lapang: "${sectionNote}"`,
        "",
        "",
        "",
        "",
        "",
        "",
      ]);
    }

    autoTable(doc, {
      startY: currentY,
      head: [
        [
          {
            content: sec.title.toUpperCase(),
            colSpan: 8,
            styles: {
              fillColor: [240, 240, 240],
              textColor: [0, 0, 0],
              fontStyle: "bold",
              fontSize: 9.5,
            },
          },
        ],
        ["No", "Pernyataan Evaluasi", "1", "2", "3", "4", "5", "TD"],
      ],
      body: tableRows,
      theme: "grid",
      styles: {
        font: "times",
        fontSize: 8.5,
        cellPadding: 1.8,
        lineColor: [200, 200, 200],
        lineWidth: 0.15,
        textColor: [0, 0, 0],
        valign: "middle",
      },
      headStyles: {
        font: "times",
        fontStyle: "bold",
        fontSize: 9,
        fillColor: [245, 245, 245],
        textColor: [0, 0, 0],
        halign: "center",
      },
      columnStyles: {
        0: { cellWidth: 8, halign: "center", fontStyle: "bold" },
        1: { cellWidth: contentWidth - (8 + 8 * 5 + 10) },
        2: { cellWidth: 8, halign: "center" },
        3: { cellWidth: 8, halign: "center" },
        4: { cellWidth: 8, halign: "center" },
        5: { cellWidth: 8, halign: "center" },
        6: { cellWidth: 8, halign: "center" },
        7: { cellWidth: 10, halign: "center" },
      },
      margin: { left: margin, right: margin },
      didParseCell: (data) => {
        if (data.section === "body" && data.column.index >= 2 && data.cell.raw === "4") {
          data.cell.text = [""];
        }
        // Baris catatan diformat miring
        if (data.row.index === tableRows.length - 1 && sectionNote) {
          if (data.column.index === 1) {
            data.cell.styles.fontStyle = "italic";
            data.cell.styles.textColor = [0, 0, 0];
          }
        }
      },
      didDrawCell: (data) => {
        if (data.section === "body" && data.column.index >= 2 && data.cell.raw === "4") {
          const cx = data.cell.x + data.cell.width / 2;
          const cy = data.cell.y + data.cell.height / 2;
          drawVectorCheckmark(doc, cx, cy, 1.3, [0, 0, 0]);
        }
      },
    });

    currentY = (doc as any).lastAutoTable.finalY + 5;
  });

  // 5. BAGIAN G: RINGKASAN EVALUASI CITRA & DATA SENSOR
  if (currentY > pageHeight - 55) {
    doc.addPage();
    currentY = 20;
  }

  const correctedItems = Object.entries(corrections).filter(([_, c]) => c.isCorrected);
  const sensorEntries = Object.entries(sensorReviews);

  const isAgroklimat = validator.role === "agroklimat";
  const datasetRows: any[] = [];

  if (isAgroklimat) {
    const sensorSummary = sensorEntries
      .map(([loc, rev]) => {
        const locLabel =
          loc === "samarang_garut"
            ? "Stasiun Samarang (Garut)"
            : loc === "gunungmanik_majalengka"
            ? "Stasiun Gunungmanik (Majalengka)"
            : "Stasiun Sangiang (Majalengka)";
        const st = rev.status === "memadai" ? "Wajar / Memadai" : "Perlu Pemeriksaan";
        return `• ${locLabel}: ${st}${rev.notes ? ` — Catatan: "${rev.notes}"` : ""}`;
      })
      .join("\n");

    datasetRows.push(["Status Rekaman Sensor", sensorSummary]);
  } else {
    datasetRows.push([
      "Dataset Citra Tomat",
      `Total 2.853 citra ditinjau (Daun & Buah). Jumlah sampel dikoreksi/diberi catatan: ${correctedItems.length} sampel.`,
    ]);

    if (correctedItems.length > 0) {
      const listSummary = correctedItems
        .slice(0, 15)
        .map(
          ([id, c], idx) =>
            `${idx + 1}. [${id}] Catatan Koreksi Ahli: ${c.notes || c.correctDisease || "Ditandai tidak sesuai"}`
        )
        .join("\n");
      datasetRows.push(["Rincian Sampel Dikoreksi", listSummary]);
    } else {
      datasetRows.push(["Rincian Sampel Dikoreksi", "Semua sampel citra yang ditinjau dinyatakan telah sesuai."]);
    }
  }

  const sectionGTitle = isAgroklimat
    ? "G. RINGKASAN VALIDASI REKAMAN SENSOR MIKROKLIMAT"
    : "G. RINGKASAN VALIDASI SAMPEL CITRA PENYAKIT";

  autoTable(doc, {
    startY: currentY,
    head: [
      [
        {
          content: sectionGTitle,
          colSpan: 2,
          styles: { fontStyle: "bold", fillColor: [240, 240, 240], textColor: [0, 0, 0] },
        },
      ],
    ],
    body: datasetRows,
    theme: "grid",
    styles: {
      font: "times",
      fontSize: 8.5,
      cellPadding: 2,
      lineColor: [200, 200, 200],
      lineWidth: 0.15,
      textColor: [0, 0, 0],
    },
    columnStyles: {
      0: { cellWidth: 50, fontStyle: "bold" },
      1: { cellWidth: contentWidth - 50 },
    },
    margin: { left: margin, right: margin },
  });

  currentY = (doc as any).lastAutoTable.finalY + 6;

  // 6. BAGIAN H: REKAPITULASI DAN REKOMENDASI AKHIR
  if (currentY > pageHeight - 65) {
    doc.addPage();
    currentY = 20;
  }

  // Hitung rata-rata skor
  let totalScore = 0;
  let scoredCount = 0;
  let tdCount = 0;

  for (let i = 1; i <= 25; i++) {
    const val = likertAnswers[i];
    if (val === "TD") {
      tdCount++;
    } else if (val) {
      const n = parseInt(val, 10);
      if (!isNaN(n)) {
        totalScore += n;
        scoredCount++;
      }
    }
  }

  const avgScore = scoredCount > 0 ? (totalScore / scoredCount).toFixed(2) : "0.00";

  const recOptions = [
    { key: "layak", label: "Layak Digunakan di Lapangan (Model dan data sesuai kondisi nyata lapang)" },
    { key: "layak_revisi", label: "Layak dengan Catatan Perbaikan (Perlu penyesuaian minor sampel/gejala)" },
    { key: "perlu_perbaikan", label: "Perlu Perbaikan dan Penilaian Ulang (Model belum siap diujikan lapang)" },
  ];

  const recommendationBody: any[] = [
    [
      { content: "Ringkasan Skor Kuantitatif", styles: { fontStyle: "bold" } },
      {
        content: `Total Butir: 25 | Diberi Skor (1-5): ${scoredCount} butir | Tidak Dinilai (TD): ${tdCount} butir\nTotal Nilai: ${totalScore} | Skor Rata-rata: ${avgScore} dari 5.00`,
        colSpan: 2,
      },
    ],
  ];

  recOptions.forEach((opt, idx) => {
    const isChosen = finalRecommendation.decision === opt.key;
    const row: any[] = [];
    if (idx === 0) {
      row.push({ content: "Keputusan Rekomendasi", rowSpan: 3, styles: { fontStyle: "bold" } });
    }
    row.push({
      content: isChosen ? "4" : "",
      styles: {
        font: isChosen ? "ZapfDingbats" : "times",
        fontSize: 11,
        halign: "center",
        textColor: [0, 0, 0],
        cellWidth: 10,
      },
    });
    row.push({
      content: opt.label,
      styles: { fontStyle: isChosen ? "bold" : "normal" },
    });
    recommendationBody.push(row);
  });

  recommendationBody.push([
    { content: "Catatan / Saran Tambahan", styles: { fontStyle: "bold" } },
    { content: finalRecommendation.comments?.trim() || "Tidak ada catatan tambahan.", colSpan: 2 },
  ]);

  autoTable(doc, {
    startY: currentY,
    head: [
      [
        {
          content: "H. REKAPITULASI DAN KEPUTUSAN REKOMENDASI VALIDATOR",
          colSpan: 3,
          styles: { fontStyle: "bold", fillColor: [240, 240, 240], textColor: [0, 0, 0] },
        },
      ],
    ],
    body: recommendationBody,
    theme: "grid",
    styles: {
      font: "times",
      fontSize: 9,
      cellPadding: 2.2,
      lineColor: [200, 200, 200],
      lineWidth: 0.15,
      textColor: [0, 0, 0],
    },
    columnStyles: {
      0: { cellWidth: 50 },
      1: { cellWidth: 10 },
      2: { cellWidth: contentWidth - 50 - 10 },
    },
    didParseCell: (data) => {
      if (data.section === "body" && data.row.index >= 1 && data.row.index <= 3 && data.column.index === 1) {
        data.cell.text = [""];
      }
    },
    didDrawCell: (data) => {
      if (data.section === "body" && data.row.index >= 1 && data.row.index <= 3 && data.column.index === 1) {
        const cx = data.cell.x + data.cell.width / 2;
        const cy = data.cell.y + data.cell.height / 2;
        doc.saveGraphicsState();
        doc.setDrawColor(0, 0, 0);
        doc.setLineWidth(0.35);
        doc.rect(cx - 2.6, cy - 2.6, 5.2, 5.2);
        const rawVal = typeof data.cell.raw === "object" ? (data.cell.raw as any)?.content : data.cell.raw;
        if (rawVal === "4") {
          drawVectorCheckmark(doc, cx, cy - 0.2, 1.3, [0, 0, 0]);
        }
        doc.restoreGraphicsState();
      }
    },
    margin: { left: margin, right: margin },
  });

  currentY = (doc as any).lastAutoTable.finalY + 10;

  // 7. KOLOM TANDA TANGAN (TTD RESMI) DI KANAN BAWAH
  if (currentY > pageHeight - 50) {
    doc.addPage();
    currentY = 25;
  }

  const sigWidth = 75;
  const sigX = pageWidth - margin - sigWidth;

  // Lokasi wilayah tanda tangan
  let sigLocation = "Sukabumi";
  if (validator.wilayah && validator.wilayah.toLowerCase().includes("lengkong")) {
    sigLocation = "Sukabumi";
  } else if (validator.wilayah && validator.wilayah.toLowerCase().includes("garut")) {
    sigLocation = "Garut";
  } else if (validator.wilayah && validator.wilayah.toLowerCase().includes("majalengka")) {
    sigLocation = "Majalengka";
  } else if (validator.role === "fitopatologi" || validator.role === "agroklimat") {
    sigLocation = "Jawa Barat";
  }

  doc.setTextColor(0, 0, 0);
  doc.setFont("times", "normal");
  doc.setFontSize(10);
  doc.text(`${sigLocation}, ${todayStr}`, sigX + sigWidth / 2, currentY, { align: "center" });
  doc.text("Validator / Ahli Penilai,", sigX + sigWidth / 2, currentY + 5, { align: "center" });

  // Ruang kosong untuk tanda tangan basah (tinggi ~22 mm)
  currentY += 28;

  // Garis bawah tanda tangan
  doc.setDrawColor(0, 0, 0);
  doc.setLineWidth(0.3);
  doc.line(sigX + 5, currentY, sigX + sigWidth - 5, currentY);

  // Nama terang validator (ahli) di bawah garis
  doc.setFont("times", "bold");
  doc.setFontSize(10);
  doc.text(`( ${validator.nama || "________________________"} )`, sigX + sigWidth / 2, currentY + 5, {
    align: "center",
  });

  // Jabatan / Profesi validator
  doc.setFont("times", "normal");
  doc.setFontSize(8.5);
  doc.text(validator.jabatan || "", sigX + sigWidth / 2, currentY + 9, {
    align: "center",
  });

  // 8. NOMOR HALAMAN DI FOOTER (Hitam Monokrom)
  const totalPages = (doc.internal as any).getNumberOfPages();
  for (let i = 1; i <= totalPages; i++) {
    doc.setPage(i);
    doc.setFont("times", "italic");
    doc.setFontSize(8);
    doc.setTextColor(0, 0, 0);
    doc.text(
      `Dokumen Hasil Penilaian Validasi Cross-Zone Model Tomatica • Halaman ${i} dari ${totalPages}`,
      pageWidth / 2,
      pageHeight - 8,
      { align: "center" }
    );
  }

  return doc;
}

export function downloadValidationPdf(params: PdfExportParams, filename?: string) {
  const doc = generateValidationPdf(params);
  const cleanName = (params.validator.nama || "Validator")
    .replace(/[^a-zA-Z0-9]/g, "_")
    .slice(0, 30);
  const dateStr = new Date().toISOString().slice(0, 10);
  const finalFilename = filename || `Hasil_Validasi_Kuesioner_${cleanName}_${dateStr}.pdf`;
  doc.save(finalFilename);
}
