"use client";

import React, { useState, useEffect, useMemo } from "react";
import Image from "next/image";
import {
  User,
  ClipboardList,
  Leaf,
  CheckCircle2,
  AlertTriangle,
  ZoomIn,
  Send,
  Download,
  RotateCcw,
  ChevronLeft,
  ChevronRight,
  Cloud,
  FileText,
  Wifi,
  WifiOff,
  ExternalLink,
  Thermometer,
  Droplets,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogTitle, DialogDescription } from "@/components/ui/dialog";

import QUESTIONNAIRES_RAW from "@/data/questionnaires.json";
import SENSOR_SUMMARY from "@/data/sensor_summary.json";
import { downloadValidationPdf } from "@/lib/pdf-export";

const INITIAL_VALIDATOR = {
  nama: "",
  jabatan: "",
  wilayah: "",
  instansi: "",
  pengalaman: "",
  role: "sukabumi",
  roleLabel: "POPT Sukabumi",
};

const DISEASE_OPTIONS = [
  "Bacterial Spot (Bercak Bakteri)",
  "Early Blight (Bercak Kering)",
  "Late Blight (Hawar Daun)",
  "Septoria Leaf Spot (Bercak Septoria)",
  "Mosaic Virus (Virus Mosaik)",
  "Blossom End Rot (Busuk Pantat Buah)",
  "Catface (Cacat Buah)",
  "Pest Damage (Serangan Hama)",
  "Healthy (Tanaman Sehat)",
  "Gejala Meragukan / Perlu Cek Lab",
];

const RECOMMENDATION_OPTIONS: Record<string, { val: string; label: string; desc: string }[]> = {
  sukabumi: [
    { val: "layak", label: "Layak Digunakan di Lapangan", desc: "Model dan data sudah sesuai dengan kondisi nyata pertanaman tomat." },
    { val: "layak_revisi", label: "Layak dengan Catatan Perbaikan", desc: "Perlu sedikit perbaikan pada beberapa contoh gejala atau foto." },
    { val: "perlu_perbaikan", label: "Belum Siap / Perlu Penilaian Ulang", desc: "Model masih belum mewakili kondisi lapangan di Sukabumi." },
  ],
  fitopatologi: [
    { val: "layak", label: "Layak untuk Validasi Fitopatologi", desc: "Taksonomi, definisi patogen, dan bukti diagnosis banding sudah tepat." },
    { val: "layak_revisi", label: "Layak dengan Revisi Label/Protokol", desc: "Perlu penyesuaian batasan kelas penyakit dan sampel ambigu." },
    { val: "perlu_perbaikan", label: "Perlu Pemeriksaan Sampel Ulang", desc: "Karakteristik visual atau label referensi belum valid secara biologis." },
  ],
  agroklimat: [
    { val: "layak", label: "Layak untuk Uji Agroklimat", desc: "Variabel iklim mikro dan rekaman sensor IoT sudah mewakili zona target." },
    { val: "layak_revisi", label: "Layak dengan Penyesuaian Sensor", desc: "Perlu filter nilai ekstrim atau penyesuaian interval data sensor." },
    { val: "perlu_perbaikan", label: "Perlu Perbaikan Data Sensor", desc: "Data belum cukup mewakili dinamika mikroklimat tanaman tomat." },
  ],
};

const DRAFT_KEY = "tomatica_expert_form_draft_v2";

export default function MobileFormApp() {
  const [isMounted, setIsMounted] = useState(false);
  const [activeTab, setActiveTab] = useState<"profile" | "likert" | "dataset" | "recap">("profile");
  const [activeLikertSection, setActiveLikertSection] = useState("section_c");

  // Profile State
  const [validatorRole, setValidatorRole] = useState("sukabumi");
  const [validatorData, setValidatorData] = useState(INITIAL_VALIDATOR);

  // Dynamic Likert Questions
  const currentLikertSections = useMemo(() => {
    return (QUESTIONNAIRES_RAW as any)[validatorRole] || (QUESTIONNAIRES_RAW as any).sukabumi;
  }, [validatorRole]);

  // Likert Answers & Notes
  const [likertAnswers, setLikertAnswers] = useState<Record<number, string>>({});
  const [likertNotes, setLikertNotes] = useState<Record<string, string>>({});

  // Sub-tab in Tab 3 (Dataset & Sensors)
  const [datasetSubTab, setDatasetSubTab] = useState<"images" | "sensors">("images");

  // Dataset Samples & Filters
  const [samples, setSamples] = useState<any[]>([]);
  const [isLoadingSamples, setIsLoadingSamples] = useState(false);
  const [filterPart, setFilterPart] = useState("all");
  const [filterDisease, setFilterDisease] = useState("all");
  const [filterOnlyCorrected, setFilterOnlyCorrected] = useState(false);
  const [samplePage, setSamplePage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalSamplesCount, setTotalSamplesCount] = useState(2888);

  // Corrections State
  const [corrections, setCorrections] = useState<
    Record<string, { isCorrected: boolean; correctDisease: string; notes: string }>
  >({});

  // Sensor Reviews State
  const [sensorReviews, setSensorReviews] = useState<
    Record<string, { status: "memadai" | "perlu_cek"; notes: string }>
  >({
    samarang_garut: { status: "memadai", notes: "" },
    gunungmanik_majalengka: { status: "memadai", notes: "" },
    sangiang_majalengka: { status: "memadai", notes: "" },
  });

  // Modal Inspection & Comment for Single Image
  const [inspectSample, setInspectSample] = useState<any | null>(null);

  // Final Recommendation State
  const [finalDecision, setFinalDecision] = useState("layak");
  const [finalNotes, setFinalNotes] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitSuccess, setSubmitSuccess] = useState(false);
  const [showSuccessModal, setShowSuccessModal] = useState(false);
  const [submittedValidatorName, setSubmittedValidatorName] = useState("");

  // Status Auto-save
  const [isOnline, setIsOnline] = useState(true);
  const [lastSaved, setLastSaved] = useState<string | null>(null);
  const [draftRestored, setDraftRestored] = useState(false);

  // 1. Mount & Online Listener
  useEffect(() => {
    setIsMounted(true);
    setIsOnline(navigator.onLine);
    const setOnline = () => setIsOnline(true);
    const setOffline = () => setIsOnline(false);
    window.addEventListener("online", setOnline);
    window.addEventListener("offline", setOffline);
    return () => {
      window.removeEventListener("online", setOnline);
      window.removeEventListener("offline", setOffline);
    };
  }, []);

  // 2. Restore Draft from LocalStorage
  useEffect(() => {
    try {
      const saved = localStorage.getItem(DRAFT_KEY);
      if (saved) {
        const p = JSON.parse(saved);
        if (p.validatorRole) setValidatorRole(p.validatorRole);
        if (p.validatorData) {
          // Bersihkan jika draf lokal lama masih menyimpan nama dummy preset
          const isOldDummy =
            p.validatorData.nama === "Egi Surya Kelana, S.P." ||
            p.validatorData.nama === "Prof. Dr. Drs. Muhammad Yasin, M.P." ||
            p.validatorData.nama === "Prof. Dr. Ir. Yayan Apriyana, M.Sc., DAT";
          if (isOldDummy) {
            p.validatorData.nama = "";
            p.validatorData.jabatan = "";
            p.validatorData.wilayah = "";
            p.validatorData.instansi = "";
            p.validatorData.pengalaman = "";
          }
          setValidatorData(p.validatorData);
        }
        if (p.likertAnswers) setLikertAnswers(p.likertAnswers);
        if (p.likertNotes) setLikertNotes(p.likertNotes);
        if (p.corrections) setCorrections(p.corrections);
        if (p.sensorReviews) setSensorReviews(p.sensorReviews);
        if (p.finalDecision) setFinalDecision(p.finalDecision);
        if (p.finalNotes) setFinalNotes(p.finalNotes);
        if (p.activeLikertSection) setActiveLikertSection(p.activeLikertSection);
        if (p.savedAt) setLastSaved(p.savedAt);
        setDraftRestored(true);
      }
    } catch (e) {
      console.error("Gagal memulihkan draf:", e);
    }
  }, []);

  // 3. Auto-save Draft
  useEffect(() => {
    if (
      Object.keys(likertAnswers).length > 0 ||
      Object.keys(corrections).length > 0 ||
      Object.keys(sensorReviews).length > 0 ||
      finalNotes
    ) {
      const timeStr = new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
      const draft = {
        validatorRole,
        validatorData,
        likertAnswers,
        likertNotes,
        corrections,
        sensorReviews,
        finalDecision,
        finalNotes,
        activeLikertSection,
        savedAt: timeStr,
      };
      try {
        localStorage.setItem(DRAFT_KEY, JSON.stringify(draft));
        setLastSaved(timeStr);
      } catch (e) {
        console.error("Gagal menyimpan draf:", e);
      }
    }
  }, [
    validatorRole,
    validatorData,
    likertAnswers,
    likertNotes,
    corrections,
    sensorReviews,
    finalDecision,
    finalNotes,
    activeLikertSection,
  ]);

  const handleResetDraft = () => {
    if (confirm("Hapus draf dan isi form dari awal?")) {
      try {
        localStorage.removeItem(DRAFT_KEY);
      } catch (e) {}
      setValidatorData({
        ...INITIAL_VALIDATOR,
        role: validatorRole,
        roleLabel:
          validatorRole === "fitopatologi"
            ? "Pakar Fitopatologi"
            : validatorRole === "agroklimat"
            ? "Pakar Agroklimat"
            : "POPT Sukabumi",
      });
      setLikertAnswers({});
      setLikertNotes({});
      setCorrections({});
      setSensorReviews({
        samarang_garut: { status: "memadai", notes: "" },
        gunungmanik_majalengka: { status: "memadai", notes: "" },
        sangiang_majalengka: { status: "memadai", notes: "" },
      });
      setFinalDecision("layak");
      setFinalNotes("");
      setLastSaved(null);
      setDraftRestored(false);
    }
  };

  const handleRoleChange = (role: string) => {
    setValidatorRole(role);
    setValidatorData((prev) => ({
      ...prev,
      role,
      roleLabel:
        role === "fitopatologi"
          ? "Pakar Fitopatologi"
          : role === "agroklimat"
          ? "Pakar Agroklimat"
          : "POPT Sukabumi",
    }));
    setActiveLikertSection("section_c");
  };

  // Load Samples (18 per page = 6 neat rows of 3 columns)
  // Hanya di-load jika bukan pakar agroklimat (pakar agroklimat hanya memeriksa sensor)
  useEffect(() => {
    async function loadSamples() {
      if (validatorRole === "agroklimat") return;
      setIsLoadingSamples(true);
      try {
        const params = new URLSearchParams({
          part: filterPart,
          disease: filterDisease,
          location: "all",
          page: samplePage.toString(),
          limit: "18",
        });
        const res = await fetch(`/api/samples?${params}`);
        const data = await res.json();
        if (data.samples) {
          setSamples(data.samples);
          setTotalPages(data.totalPages || 1);
          setTotalSamplesCount(data.total || 2853);
        }
      } catch (e) {
        console.error("Error loading samples:", e);
      } finally {
        setIsLoadingSamples(false);
      }
    }
    if (activeTab === "dataset" && validatorRole !== "agroklimat") {
      loadSamples();
    }
  }, [filterPart, filterDisease, samplePage, activeTab, validatorRole]);

  const handleScoreChange = (qNo: number, score: string) => {
    setLikertAnswers((prev) => ({ ...prev, [qNo]: score }));
  };

  const handleSectionNoteChange = (secId: string, note: string) => {
    setLikertNotes((prev) => ({ ...prev, [secId]: note }));
  };

  const handleToggleCorrection = (sampleId: string, defaultDisease: string) => {
    setCorrections((prev) => {
      const existing = prev[sampleId];
      if (existing && existing.isCorrected) {
        const copy = { ...prev };
        delete copy[sampleId];
        return copy;
      } else {
        return {
          ...prev,
          [sampleId]: {
            isCorrected: true,
            correctDisease: existing?.correctDisease || defaultDisease,
            notes: existing?.notes || "",
          },
        };
      }
    });
  };

  const handleUpdateCorrectionDetail = (sampleId: string, disease: string, notes: string) => {
    setCorrections((prev) => ({
      ...prev,
      [sampleId]: {
        isCorrected: true,
        correctDisease: disease,
        notes: notes,
      },
    }));
  };

  const handleUpdateSensorReview = (sensorId: string, status: "memadai" | "perlu_cek", notes: string) => {
    setSensorReviews((prev) => ({
      ...prev,
      [sensorId]: { status, notes },
    }));
  };

  const likertStats = useMemo(() => {
    let filledTotal = 0;
    for (let i = 1; i <= 25; i++) {
      if (likertAnswers[i]) filledTotal++;
    }
    return { filledTotal, pct: Math.round((filledTotal / 25) * 100) };
  }, [likertAnswers]);

  const correctedCount = useMemo(() => {
    return Object.values(corrections).filter((c) => c.isCorrected).length;
  }, [corrections]);

  // List filter kategori penyakit dinamis
  const DISEASE_FILTER_LIST = useMemo(() => {
    if (filterPart === "leaf") {
      return [
        { val: "all", label: "Semua Kategori (Penyakit Daun)" },
        { val: "bacterial_spot", label: "Bacterial Spot (Bercak Bakteri)" },
        { val: "early_blight", label: "Early Blight (Bercak Kering)" },
        { val: "late_blight", label: "Late Blight (Hawar Daun)" },
        { val: "septoria_leaf_spot", label: "Septoria (Bercak Daun)" },
        { val: "mosaic_virus", label: "Mosaic Virus (Mosaik)" },
        { val: "healthy", label: "Sehat (Healthy)" },
      ];
    }
    if (filterPart === "fruit") {
      return [
        { val: "all", label: "Semua Kategori (Penyakit Buah)" },
        { val: "bacterial_spot", label: "Bacterial Spot (Bercak Bakteri)" },
        { val: "blossom_end_rot", label: "Blossom End Rot (Busuk Pantat)" },
        { val: "catface", label: "Catface (Cacat Buah)" },
        { val: "pest_damage", label: "Pest Damage (Hama)" },
        { val: "healthy", label: "Sehat (Healthy)" },
      ];
    }
    return [
      { val: "all", label: "Semua Kategori Penyakit" },
      { val: "bacterial_spot", label: "Bacterial Spot (Bercak Bakteri)" },
      { val: "early_blight", label: "Early Blight (Bercak Kering)" },
      { val: "late_blight", label: "Late Blight (Hawar Daun)" },
      { val: "septoria_leaf_spot", label: "Septoria (Bercak Daun)" },
      { val: "mosaic_virus", label: "Mosaic Virus (Mosaik)" },
      { val: "blossom_end_rot", label: "Blossom End Rot (Busuk Pantat)" },
      { val: "catface", label: "Catface (Cacat Buah)" },
      { val: "pest_damage", label: "Pest Damage (Hama)" },
      { val: "healthy", label: "Sehat (Healthy)" },
    ];
  }, [filterPart]);

  // Submit Validation
  const handleSubmitValidation = async () => {
    if (!validatorData.nama) {
      alert("Mohon isi nama Anda di Langkah 1 (Profil).");
      setActiveTab("profile");
      return;
    }

    if (likertStats.filledTotal < 25) {
      alert(
        `Kuesioner belum lengkap! Seluruh 25 butir kuesioner wajib diisi.\n\nAnda baru mengisi ${likertStats.filledTotal} dari 25 pertanyaan. Sistem akan mengarahkan Anda ke pertanyaan yang belum dijawab.`
      );
      // Temukan bagian kuesioner pertama yang belum selesai dan arahkan langsung
      for (const sec of currentLikertSections) {
        const hasUnanswered = sec.items.some((q: any) => !likertAnswers[q.no]);
        if (hasUnanswered) {
          setActiveLikertSection(sec.id);
          break;
        }
      }
      setActiveTab("likert");
      window.scrollTo({ top: 0, behavior: "smooth" });
      return;
    }

    setIsSubmitting(true);
    try {
      let sampleValidationPayload: any = {};
      if (validatorRole === "agroklimat") {
        sampleValidationPayload = {
          samarang_garut: {
            isCorrected: true,
            correctDisease: sensorReviews.samarang_garut?.status === "memadai" ? "Memadai" : "Perlu Cek",
            notes: sensorReviews.samarang_garut?.notes || "",
          },
          gunungmanik_majalengka: {
            isCorrected: true,
            correctDisease: sensorReviews.gunungmanik_majalengka?.status === "memadai" ? "Memadai" : "Perlu Cek",
            notes: sensorReviews.gunungmanik_majalengka?.notes || "",
          },
          sangiang_majalengka: {
            isCorrected: true,
            correctDisease: sensorReviews.sangiang_majalengka?.status === "memadai" ? "Memadai" : "Perlu Cek",
            notes: sensorReviews.sangiang_majalengka?.notes || "",
          },
        };
      } else {
        // POPT Sukabumi dan Ahli Penyakit Tanaman hanya mereview sampel foto daun/buah
        sampleValidationPayload = { ...corrections };
      }

      const payload = {
        validator: {
          ...validatorData,
          role: validatorRole,
        },
        likertEvaluation: {
          answers: likertAnswers,
          sectionNotes: likertNotes,
        },
        sampleImageValidation: sampleValidationPayload,
        finalRecommendation: {
          decision: finalDecision,
          comments: finalNotes,
        },
      };

      const res = await fetch("/api/validations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const result = await res.json();
      if (res.ok) {
        const submittedName = validatorData.nama || "Validator";
        setSubmittedValidatorName(submittedName);
        setSubmitSuccess(true);

        // 1. Bersihkan draf lokal dari localStorage
        try {
          localStorage.removeItem(DRAFT_KEY);
          setLastSaved(null);
          setDraftRestored(false);
        } catch (e) {}

        // 2. Reset seluruh data form menjadi kosong kembali (fresh state)
        setValidatorData({
          ...INITIAL_VALIDATOR,
          role: validatorRole,
          roleLabel:
            validatorRole === "fitopatologi"
              ? "Pakar Fitopatologi"
              : validatorRole === "agroklimat"
              ? "Pakar Agroklimat"
              : "POPT Sukabumi",
        });
        setLikertAnswers({});
        setLikertNotes({});
        setCorrections({});
        setSensorReviews({
          samarang_garut: { status: "memadai", notes: "" },
          gunungmanik_majalengka: { status: "memadai", notes: "" },
          sangiang_majalengka: { status: "memadai", notes: "" },
        });
        setFinalDecision("layak");
        setFinalNotes("");
        setActiveLikertSection("section_c");

        // 3. Pindahkan navigasi ke Tab 1 (Profil) & scroll ke atas
        setActiveTab("profile");
        window.scrollTo({ top: 0, behavior: "smooth" });

        // 4. Tampilkan dialog alert sukses (tanpa otomatis download PDF)
        setShowSuccessModal(true);
      } else {
        alert("Gagal menyimpan: " + (result.error || "Terjadi kesalahan"));
      }
    } catch (e: any) {
      alert("Error: " + e.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDownloadPDF = () => {
    try {
      const isAgro = validatorRole === "agroklimat";
      downloadValidationPdf({
        validator: { ...validatorData, role: validatorRole },
        sections: currentLikertSections,
        likertAnswers,
        likertNotes,
        corrections: isAgro ? {} : corrections,
        sensorReviews: isAgro
          ? sensorReviews
          : {
              samarang_garut: { status: "memadai", notes: "" },
              gunungmanik_majalengka: { status: "memadai", notes: "" },
              sangiang_majalengka: { status: "memadai", notes: "" },
            },
        finalRecommendation: { decision: finalDecision, comments: finalNotes },
      });
    } catch (e) {
      alert("Gagal mengunduh PDF: " + e);
    }
  };

  const handleExportJSON = () => {
    const payload = {
      meta: { exportedAt: new Date().toISOString(), platform: "Tomatica Assessment" },
      validator: validatorData,
      likertAnswers,
      likertNotes,
      corrections,
      sensorReviews,
      finalRecommendation: { decision: finalDecision, comments: finalNotes },
    };
    const jsonStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(payload, null, 2));
    const dl = document.createElement("a");
    dl.setAttribute("href", jsonStr);
    dl.setAttribute("download", `penilaian_${validatorRole}_${new Date().toISOString().slice(0, 10)}.json`);
    document.body.appendChild(dl);
    dl.click();
    dl.remove();
  };

  if (!isMounted) {
    return (
      <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center p-4" suppressHydrationWarning>
        <div className="size-12 rounded-2xl bg-emerald-600 text-white flex items-center justify-center font-bold text-2xl shadow-md mb-3 animate-pulse" suppressHydrationWarning>
          🍅
        </div>
        <p className="text-xs font-semibold text-slate-500" suppressHydrationWarning>Memuat Form Tomatica...</p>
      </div>
    );
  }

  const isAgroklimat = validatorRole === "agroklimat";

  const TABS = [
    { id: "profile", label: "1. Profil", icon: User },
    {
      id: "dataset",
      label: isAgroklimat ? "2. Cek Sensor" : "2. Cek Foto",
      icon: isAgroklimat ? Thermometer : Leaf,
    },
    { id: "likert", label: "3. Kuesioner", icon: ClipboardList },
    { id: "recap", label: "4. Rekomendasi", icon: Send },
  ];

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col pb-12" suppressHydrationWarning>
      {/* APP BAR RINGKAS */}
      <header className="sticky top-0 z-40 bg-white/95 backdrop-blur-md border-b border-emerald-100 shadow-2xs px-4 py-2.5">
        <div className="max-w-3xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-2xl">🍅</span>
            <div>
              <h1 className="text-sm font-black text-emerald-950 leading-tight">Tomatica</h1>
              <p className="text-[10px] text-slate-500 font-medium">Penilaian Ahli & Praktisi</p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <select
              value={validatorRole}
              onChange={(e) => handleRoleChange(e.target.value)}
              className="text-xs font-bold bg-emerald-50 text-emerald-900 border border-emerald-200 rounded-xl px-2.5 py-1.5 focus:outline-none cursor-pointer"
            >
              <option value="sukabumi">POPT Sukabumi</option>
              <option value="fitopatologi">Ahli Penyakit Tanaman</option>
              <option value="agroklimat">Ahli Iklim / Sensor</option>
            </select>
          </div>
        </div>

        {/* PROGRES PENGISIAN */}
        <div className="max-w-3xl mx-auto mt-2">
          <div className="flex items-center justify-between text-[11px] font-semibold text-slate-600 mb-1">
            <div className="flex items-center gap-1.5">
              <span>Progres: <b>{likertStats.filledTotal} / 25</b> terjawab</span>
              {!isOnline && (
                <span className="text-[10px] text-amber-800 bg-amber-50 px-1.5 py-0.2 rounded font-bold">
                  (Offline)
                </span>
              )}
            </div>
            <span className="text-emerald-700 font-bold">{likertStats.pct}%</span>
          </div>
          <div className="h-1.5 w-full bg-slate-100 rounded-full overflow-hidden">
            <div
              className="h-full bg-emerald-600 transition-all duration-300 rounded-full"
              style={{ width: `${likertStats.pct}%` }}
            />
          </div>
        </div>

        {/* STEPPER TABS (4 TOMBOL MUDAH DITEKAN) */}
        <div className="max-w-3xl mx-auto mt-2.5">
          <nav className="grid grid-cols-4 gap-1 p-1 bg-slate-100 rounded-2xl">
            {TABS.map((tab) => {
              const Icon = tab.icon;
              const isActive = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  onClick={() => {
                    setActiveTab(tab.id as any);
                    window.scrollTo({ top: 0, behavior: "smooth" });
                  }}
                  className={`flex items-center justify-center gap-1 py-2 px-1 rounded-xl text-xs font-bold transition-all ${
                    isActive
                      ? "bg-white text-emerald-700 shadow-2xs border border-emerald-200"
                      : "text-slate-500 hover:text-slate-900"
                  }`}
                >
                  <Icon className={`size-3.5 shrink-0 ${isActive ? "text-emerald-600" : "text-slate-400"}`} />
                  <span className="truncate">{tab.label}</span>
                </button>
              );
            })}
          </nav>
        </div>
      </header>

      {/* KONTEN UTAMA */}
      <main className="max-w-3xl w-full mx-auto p-4 sm:p-5 space-y-4">
        {/* ================= TAB 1: PROFIL VALIDATOR ================= */}
        {activeTab === "profile" && (
          <div className="space-y-3.5 animate-in fade-in duration-150">
            {/* Kartu Sambutan Ringkas */}
            <div className="bg-emerald-600 text-white rounded-2xl p-4 shadow-2xs">
              <h2 className="text-sm sm:text-base font-bold">Form Penilaian Lapangan Tanaman Tomat</h2>
              <p className="text-emerald-100 text-xs mt-1 leading-relaxed">
                Silakan isi data diri dan asal instansi/wilayah Anda di bawah ini sebelum mulai mengisi kuesioner evaluasi.
              </p>
            </div>

            {draftRestored && (
              <div className="p-3 rounded-xl bg-emerald-50 border border-emerald-200 text-xs flex items-center justify-between text-emerald-900">
                <div className="flex items-center gap-1.5">
                  <CheckCircle2 className="size-4 text-emerald-600 shrink-0" />
                  <span>Jawaban Anda sebelumnya tersimpan otomatis.</span>
                </div>
                <button
                  onClick={handleResetDraft}
                  className="text-slate-500 hover:text-red-600 font-bold text-[11px] flex items-center gap-1"
                >
                  <RotateCcw className="size-3" />
                  Isi Ulang
                </button>
              </div>
            )}

            {/* Form Input Profil Ringkas */}
            <Card className="border-slate-200 rounded-2xl shadow-2xs bg-white">
              <CardHeader className="p-4 pb-2">
                <CardTitle className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                  <User className="size-4 text-emerald-600" />
                  Data Diri Validator
                </CardTitle>
              </CardHeader>
              <CardContent className="p-4 pt-1 space-y-3">
                <div className="space-y-1">
                  <Label className="text-xs text-slate-700 font-semibold">
                    Nama Lengkap & Gelar <span className="text-red-500">*</span>
                  </Label>
                  <Input
                    value={validatorData.nama}
                    onChange={(e) => setValidatorData({ ...validatorData, nama: e.target.value })}
                    placeholder="Masukkan nama lengkap dan gelar Anda"
                    className="text-xs h-9 bg-slate-50 focus:bg-white"
                  />
                </div>

                <div className="space-y-1">
                  <Label className="text-xs text-slate-700 font-semibold">Jabatan / Profesi</Label>
                  <Input
                    value={validatorData.jabatan}
                    onChange={(e) => setValidatorData({ ...validatorData, jabatan: e.target.value })}
                    placeholder="Contoh: Petugas POPT / Ahli Proteksi Tanaman / Peneliti / Dosen"
                    className="text-xs h-9 bg-slate-50 focus:bg-white"
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                  <div className="space-y-1">
                    <Label className="text-xs text-slate-700 font-semibold">Wilayah Tugas / Laboratorium</Label>
                    <Input
                      value={validatorData.wilayah}
                      onChange={(e) => setValidatorData({ ...validatorData, wilayah: e.target.value })}
                      placeholder="Contoh: Kec. Lengkong / Sukabumi"
                      className="text-xs h-9 bg-slate-50 focus:bg-white"
                    />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs text-slate-700 font-semibold">Instansi / Unit Kerja</Label>
                    <Input
                      value={validatorData.instansi}
                      onChange={(e) => setValidatorData({ ...validatorData, instansi: e.target.value })}
                      placeholder="Contoh: Dinas Pertanian Kab. Sukabumi"
                      className="text-xs h-9 bg-slate-50 focus:bg-white"
                    />
                  </div>
                </div>

                <div className="space-y-1">
                  <Label className="text-xs text-slate-700 font-semibold">Lama Pengalaman di Bidang Terkait</Label>
                  <Input
                    value={validatorData.pengalaman}
                    onChange={(e) => setValidatorData({ ...validatorData, pengalaman: e.target.value })}
                    placeholder="Contoh: 8 tahun"
                    className="text-xs h-9 bg-slate-50 focus:bg-white"
                  />
                </div>
              </CardContent>
              <CardFooter className="p-4 pt-0 border-t-0">
                <Button
                  onClick={() => {
                    setActiveTab("dataset");
                    window.scrollTo({ top: 0, behavior: "smooth" });
                  }}
                  className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs h-10 rounded-xl shadow-2xs flex items-center justify-center gap-1.5"
                >
                  <span>
                    {isAgroklimat
                      ? "Lanjut ke Cek Sensor (Langkah 2)"
                      : "Lanjut ke Cek Foto Citra (Langkah 2)"}
                  </span>
                  <ChevronRight className="size-4" />
                </Button>
              </CardFooter>
            </Card>
          </div>
        )}

        {/* ================= TAB 2: CEK FOTO CITRA & DATA SENSOR ================= */}
        {activeTab === "dataset" && (
          <div className="space-y-3.5 animate-in fade-in duration-150">
            {/* JIKA BUKAN PAKAR AGROKLIMAT: TAMPILKAN FOTO DAUN & BUAH SAJA (POPT SUKABUMI & FITOPATOLOGI) */}
            {!isAgroklimat && (
              <div className="space-y-3">
                {/* Petunjuk Singkat */}
                <div className="bg-emerald-50 border border-emerald-200 rounded-2xl p-3 text-xs text-emerald-950 flex items-center gap-2.5 shadow-2xs">
                  <div className="size-8 rounded-xl bg-emerald-100 text-emerald-700 flex items-center justify-center shrink-0">
                    <Leaf className="size-4 text-emerald-600" />
                  </div>
                  <div>
                    <p className="font-bold text-xs">Pemeriksaan Sampel Citra Daun & Buah ({totalSamplesCount} Foto)</p>
                    <p className="text-[11px] text-emerald-800">
                      Periksa contoh sampel citra penyakit. <b>Ketuk foto</b> untuk memperbesar & memberikan catatan koreksi jika ada label penyakit yang keliru sebelum mengisi kuesioner.
                    </p>
                  </div>
                </div>

                {/* FILTER TOOLBAR: BAGIAN & KATEGORI PENYAKIT */}
                <div className="bg-white p-3 rounded-2xl border border-slate-200 space-y-2.5 shadow-2xs">
                  {/* Baris 1: Filter Bagian (Daun / Buah) */}
                  <div className="flex gap-1.5 overflow-x-auto pb-0.5 scrollbar-none">
                    {[
                      { val: "all", label: "Semua Bagian" },
                      { val: "leaf", label: "🍃 Daun" },
                      { val: "fruit", label: "🍅 Buah" },
                    ].map((p) => (
                      <button
                        key={p.val}
                        onClick={() => {
                          setFilterPart(p.val);
                          setFilterDisease("all");
                          setSamplePage(1);
                        }}
                        className={`px-3 py-1.5 rounded-full text-xs font-bold whitespace-nowrap transition-all ${
                          filterPart === p.val
                            ? "bg-emerald-600 text-white shadow-2xs"
                            : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                        }`}
                      >
                        {p.label}
                      </button>
                    ))}
                  </div>

                  {/* Baris 2: Filter Kategori Penyakit (Select Dropdown) */}
                  <div className="flex items-center gap-2">
                    <label htmlFor="disease-filter-select" className="text-xs font-bold text-slate-700 shrink-0">
                      Penyakit:
                    </label>
                    <select
                      id="disease-filter-select"
                      value={filterDisease}
                      onChange={(e) => {
                        setFilterDisease(e.target.value);
                        setSamplePage(1);
                      }}
                      className="w-full text-xs font-bold bg-slate-50 border border-slate-200 text-slate-800 rounded-xl px-3 py-2 focus:outline-none focus:ring-2 focus:ring-emerald-500 cursor-pointer shadow-2xs"
                    >
                      {DISEASE_FILTER_LIST.map((d) => (
                        <option key={d.val} value={d.val}>
                          {d.label}
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* Baris 3: Toggle Tampilkan yang Dikoreksi & Info Halaman */}
                  <div className="flex items-center justify-between pt-1 border-t border-slate-100 text-xs">
                    <button
                      type="button"
                      onClick={() => setFilterOnlyCorrected(!filterOnlyCorrected)}
                      className={`px-2.5 py-1 rounded-lg border text-xs font-bold flex items-center gap-1.5 transition-all ${
                        filterOnlyCorrected
                          ? "bg-amber-100 text-amber-900 border-amber-300"
                          : "bg-slate-50 text-slate-600 border-slate-200"
                      }`}
                    >
                      <AlertTriangle className="size-3 text-amber-600" />
                      <span>Hanya yang Dikoreksi ({correctedCount})</span>
                    </button>
                    <span className="text-[11px] font-medium text-slate-500">
                      Hal {samplePage} dari {totalPages}
                    </span>
                  </div>
                </div>

                {/* 3-KOLOM GRID FOTO MOBILE */}
                {isLoadingSamples ? (
                  <div className="grid grid-cols-3 gap-2 sm:gap-2.5 min-h-[420px]">
                    {Array.from({ length: 18 }).map((_, idx) => (
                      <div
                        key={idx}
                        className="aspect-square rounded-2xl bg-slate-200/90 animate-pulse border border-slate-200 flex flex-col items-center justify-center gap-1 text-slate-400"
                      >
                        <span className="text-lg opacity-40">🍅</span>
                        <span className="text-[9px] font-semibold opacity-60">Memuat...</span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="grid grid-cols-3 gap-2 sm:gap-2.5 min-h-[420px]">
                    {samples
                      .filter((s) => !filterOnlyCorrected || corrections[s.id]?.isCorrected)
                      .map((s) => {
                        const corr = corrections[s.id];
                        const isMismatch = corr?.isCorrected;

                        return (
                          <div
                            key={s.id}
                            onClick={() => setInspectSample(s)}
                            className={`group relative aspect-square rounded-2xl overflow-hidden bg-slate-900 border cursor-pointer active:scale-95 transition-all shadow-2xs ${
                              isMismatch
                                ? "border-amber-500 ring-2 ring-amber-400"
                                : "border-slate-200 hover:border-emerald-400"
                            }`}
                          >
                            <Image
                              src={s.image_url}
                              alt={s.disease_label}
                              fill
                              sizes="(max-width: 640px) 33vw, 25vw"
                              className="object-cover group-hover:scale-105 transition-transform duration-200"
                              unoptimized
                            />

                            {/* Badge Koreksi / Komentar Ahli di Pojok Kanan Atas */}
                            {isMismatch ? (
                              <div className="absolute top-1 right-1 bg-amber-500 text-white rounded-md p-1 shadow-xs">
                                <AlertTriangle className="size-3" />
                              </div>
                            ) : (
                              <div className="absolute top-1 right-1 opacity-0 group-hover:opacity-100 transition-opacity bg-black/50 text-white rounded-md p-1">
                                <ZoomIn className="size-3" />
                              </div>
                            )}

                            {/* Overlay Nama Penyakit di Bawah Foto */}
                            <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/85 via-black/50 to-transparent p-1.5 pt-4 text-left">
                              <span className="text-[10px] text-white font-bold leading-tight block truncate drop-shadow-xs">
                                {s.disease_label}
                              </span>
                              <span className="text-[9px] text-slate-300 block truncate">
                                {s.part === "leaf" ? "🍃 Daun" : "🍅 Buah"}
                              </span>
                            </div>
                          </div>
                        );
                      })}
                  </div>
                )}

                {/* Navigasi Halaman */}
                <div className="flex items-center justify-between p-3 bg-white rounded-2xl border border-slate-200">
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={samplePage <= 1}
                    onClick={() => {
                      setSamplePage((p) => Math.max(1, p - 1));
                      window.scrollTo({ top: 300, behavior: "smooth" });
                    }}
                    className="text-xs h-8 px-3 rounded-xl font-bold flex items-center gap-1"
                  >
                    <ChevronLeft className="size-3.5" />
                    <span>Sebelumnya</span>
                  </Button>
                  <span className="text-xs font-bold text-slate-700">
                    {samplePage} / {totalPages}
                  </span>
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={samplePage >= totalPages}
                    onClick={() => {
                      setSamplePage((p) => p + 1);
                      window.scrollTo({ top: 300, behavior: "smooth" });
                    }}
                    className="text-xs h-8 px-3 rounded-xl font-bold flex items-center gap-1"
                  >
                    <span>Berikutnya</span>
                    <ChevronRight className="size-3.5" />
                  </Button>
                </div>
              </div>
            )}

            {/* JIKA PAKAR AGROKLIMAT: TAMPILKAN DATA SENSOR IKLIM SAJA */}
            {isAgroklimat && (
              <div className="space-y-3">
                <div className="bg-emerald-50 border border-emerald-200 rounded-2xl p-3 text-xs text-emerald-950 flex items-center gap-2.5 shadow-2xs">
                  <div className="size-8 rounded-xl bg-emerald-100 text-emerald-700 flex items-center justify-center shrink-0">
                    <Thermometer className="size-4 text-emerald-600" />
                  </div>
                  <div>
                    <p className="font-bold text-xs">Pemeriksaan Stasiun Sensor Mikroklimat IoT (3 Lokasi)</p>
                    <p className="text-[11px] text-emerald-800">
                      Periksa data suhu dan kelembapan di stasiun kebun berikut. Apakah angkanya wajar? Berikan penilaian mutu data sebelum mengisi kuesioner.
                    </p>
                  </div>
                </div>

                <div className="space-y-3">
                  {SENSOR_SUMMARY.map((station) => {
                    const review = sensorReviews[station.id] || { status: "memadai", notes: "" };
                    const isMemadai = review.status === "memadai";

                    return (
                      <Card key={station.id} className="border-slate-200 rounded-2xl shadow-2xs bg-white">
                        <CardHeader className="p-3.5 pb-2 border-b border-slate-100 flex flex-row items-center justify-between">
                          <CardTitle className="text-xs font-bold text-slate-900">{station.zone}</CardTitle>
                          <Badge className={`text-[10px] border-0 ${isMemadai ? "bg-emerald-100 text-emerald-800" : "bg-amber-100 text-amber-900"}`}>
                            {isMemadai ? "✓ Data Wajar" : "⚠ Perlu Cek"}
                          </Badge>
                        </CardHeader>
                        <CardContent className="p-3.5 space-y-2.5">
                          <div className="grid grid-cols-2 gap-2 text-xs">
                            <div className="p-2 rounded-xl bg-slate-50 border border-slate-100">
                              <span className="text-[10px] text-slate-500 font-semibold flex items-center gap-1">
                                <Thermometer className="size-3 text-red-500" />
                                Suhu Udara
                              </span>
                              <div className="font-bold text-slate-800 mt-0.5">{station.tempRange}</div>
                            </div>

                            <div className="p-2 rounded-xl bg-slate-50 border border-slate-100">
                              <span className="text-[10px] text-slate-500 font-semibold flex items-center gap-1">
                                <Droplets className="size-3 text-blue-500" />
                                Kelembapan (RH)
                              </span>
                              <div className="font-bold text-slate-800 mt-0.5">{station.rhRange}</div>
                            </div>
                          </div>

                          <div className="flex items-center justify-between text-xs pt-1">
                            <span className="text-[11px] text-slate-500">Total: {station.totalRecords.toLocaleString("id-ID")} rekaman</span>
                            <a
                              href={station.csvUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-emerald-700 font-bold flex items-center gap-1 text-[11px] underline"
                            >
                              <span>Lihat File Data</span>
                              <ExternalLink className="size-3" />
                            </a>
                          </div>

                          {/* Tombol Status Mutu */}
                          <div className="pt-2 border-t border-slate-100 space-y-2">
                            <Label className="text-xs font-semibold text-slate-700">Status Data:</Label>
                            <div className="grid grid-cols-2 gap-2">
                              <button
                                type="button"
                                onClick={() => handleUpdateSensorReview(station.id, "memadai", review.notes)}
                                className={`py-2 px-3 rounded-xl text-xs font-bold border transition-all ${
                                  isMemadai
                                    ? "bg-emerald-600 text-white border-emerald-700 shadow-xs"
                                    : "bg-slate-50 text-slate-600 border-slate-200"
                                }`}
                              >
                                ✓ Data Wajar
                              </button>

                              <button
                                type="button"
                                onClick={() => handleUpdateSensorReview(station.id, "perlu_cek", review.notes)}
                                className={`py-2 px-3 rounded-xl text-xs font-bold border transition-all ${
                                  !isMemadai
                                    ? "bg-amber-500 text-white border-amber-600 shadow-xs"
                                    : "bg-slate-50 text-slate-600 border-slate-200"
                                }`}
                              >
                                ⚠ Perlu Cek
                              </button>
                            </div>

                            <Textarea
                              placeholder="Catatan untuk sensor ini jika ada (opsional)..."
                              rows={2}
                              value={review.notes}
                              onChange={(e) => handleUpdateSensorReview(station.id, review.status, e.target.value)}
                              className="text-xs bg-slate-50 rounded-xl mt-1"
                            />
                          </div>
                        </CardContent>
                      </Card>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Tombol Navigasi Langkah 2 */}
            <div className="flex items-center gap-2 pt-2">
              <Button
                variant="outline"
                onClick={() => {
                  setActiveTab("profile");
                  window.scrollTo({ top: 0, behavior: "smooth" });
                }}
                className="flex-1 h-11 text-xs rounded-xl font-bold border-slate-200 flex items-center justify-center gap-1.5"
              >
                <ChevronLeft className="size-4" />
                <span>Kembali ke Profil</span>
              </Button>

              <Button
                onClick={() => {
                  setActiveTab("likert");
                  setActiveLikertSection("section_c");
                  window.scrollTo({ top: 0, behavior: "smooth" });
                }}
                className="flex-1 h-11 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded-xl shadow-2xs flex items-center justify-center gap-1.5"
              >
                <span>Lanjut ke Kuesioner (Langkah 3)</span>
                <ChevronRight className="size-4" />
              </Button>
            </div>
          </div>
        )}

        {/* ================= TAB 3: KUESIONER LIKERT ================= */}
        {activeTab === "likert" && (() => {
          const sectionIndex = currentLikertSections.findIndex((s: any) => s.id === activeLikertSection);
          const currentIdx = sectionIndex !== -1 ? sectionIndex : 0;
          const sec = currentLikertSections[currentIdx];

          const handleNextSection = () => {
            if (currentIdx < currentLikertSections.length - 1) {
              setActiveLikertSection(currentLikertSections[currentIdx + 1].id);
              window.scrollTo({ top: 0, behavior: "smooth" });
            } else {
              setActiveTab("recap");
              window.scrollTo({ top: 0, behavior: "smooth" });
            }
          };

          const handlePrevSection = () => {
            if (currentIdx > 0) {
              setActiveLikertSection(currentLikertSections[currentIdx - 1].id);
              window.scrollTo({ top: 0, behavior: "smooth" });
            } else {
              setActiveTab("dataset");
              window.scrollTo({ top: 0, behavior: "smooth" });
            }
          };

          return (
            <div className="space-y-3.5 animate-in fade-in duration-150">
              {/* Petunjuk Skala Nilai 1-5 & TD (Rapi & Sejajar) */}
              <div className="bg-emerald-50/70 border border-emerald-200 rounded-2xl p-3 shadow-2xs">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-[11px] font-bold text-emerald-950 flex items-center gap-1.5">
                    <span className="size-2 rounded-full bg-emerald-600 inline-block"></span>
                    Panduan Pilihan Nilai:
                  </span>
                  <span className="text-[10px] font-medium text-emerald-700">Skala 1 – 5 & TD</span>
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-1.5 text-xs">
                  <div className="flex items-center gap-2 p-1.5 rounded-xl bg-white/90 border border-emerald-100 shadow-2xs">
                    <span className="size-5 rounded-lg bg-slate-100 text-slate-700 font-black text-[11px] flex items-center justify-center shrink-0 border border-slate-200">
                      1
                    </span>
                    <span className="text-[11px] font-medium text-slate-700 truncate">Sangat Tidak Setuju</span>
                  </div>
                  <div className="flex items-center gap-2 p-1.5 rounded-xl bg-white/90 border border-emerald-100 shadow-2xs">
                    <span className="size-5 rounded-lg bg-slate-100 text-slate-700 font-black text-[11px] flex items-center justify-center shrink-0 border border-slate-200">
                      2
                    </span>
                    <span className="text-[11px] font-medium text-slate-700 truncate">Kurang Setuju</span>
                  </div>
                  <div className="flex items-center gap-2 p-1.5 rounded-xl bg-white/90 border border-emerald-100 shadow-2xs">
                    <span className="size-5 rounded-lg bg-slate-100 text-slate-700 font-black text-[11px] flex items-center justify-center shrink-0 border border-slate-200">
                      3
                    </span>
                    <span className="text-[11px] font-medium text-slate-700 truncate">Cukup / Ragu</span>
                  </div>
                  <div className="flex items-center gap-2 p-1.5 rounded-xl bg-white/90 border border-emerald-100 shadow-2xs">
                    <span className="size-5 rounded-lg bg-slate-100 text-slate-700 font-black text-[11px] flex items-center justify-center shrink-0 border border-slate-200">
                      4
                    </span>
                    <span className="text-[11px] font-medium text-slate-700 truncate">Setuju</span>
                  </div>
                  <div className="flex items-center gap-2 p-1.5 rounded-xl bg-emerald-100/70 border border-emerald-300 shadow-2xs">
                    <span className="size-5 rounded-lg bg-emerald-600 text-white font-black text-[11px] flex items-center justify-center shrink-0">
                      5
                    </span>
                    <span className="text-[11px] font-bold text-emerald-950 truncate">Sangat Setuju</span>
                  </div>
                  <div className="flex items-center gap-2 p-1.5 rounded-xl bg-amber-50 border border-amber-300 shadow-2xs">
                    <span className="px-1.5 h-5 rounded-lg bg-amber-500 text-white font-black text-[10px] flex items-center justify-center shrink-0">
                      TD
                    </span>
                    <span className="text-[11px] font-bold text-amber-950 truncate">Tidak Tahu / N/A</span>
                  </div>
                </div>
              </div>

              {/* Judul Bagian */}
              <div className="bg-white p-3.5 rounded-2xl border border-slate-200 shadow-2xs">
                <div className="flex items-center justify-between text-xs font-bold text-slate-800">
                  <span className="text-emerald-700 uppercase tracking-wide text-[10px]">
                    Langkah {currentIdx + 1} dari 4: {sec.name}
                  </span>
                  <span className="text-slate-400 text-[10px]">
                    Soal {sec.items[0].no} – {sec.items[sec.items.length - 1].no}
                  </span>
                </div>
                <h3 className="text-sm font-bold text-slate-900 mt-0.5 leading-snug">{sec.title}</h3>
              </div>

              {/* Daftar Soal */}
              <div className="space-y-2.5">
                {sec.items.map((q: any) => {
                  const selected = likertAnswers[q.no];
                  return (
                    <Card
                      key={q.no}
                      className={`border rounded-2xl shadow-2xs transition-all bg-white ${
                        selected ? "border-emerald-300 ring-1 ring-emerald-100" : "border-slate-200"
                      }`}
                    >
                      <CardContent className="p-3.5 space-y-2.5">
                        <div className="flex items-start gap-2.5">
                          <span className="shrink-0 size-6 rounded-lg bg-emerald-100 text-emerald-900 font-extrabold text-xs flex items-center justify-center">
                            {q.no}
                          </span>
                          <p className="text-xs text-slate-800 font-semibold leading-relaxed pt-0.5">{q.text}</p>
                        </div>

                        {/* 6 Tombol Nilai */}
                        <div className="grid grid-cols-6 gap-1.5 pt-0.5">
                          {["1", "2", "3", "4", "5", "TD"].map((val) => {
                            const isChosen = selected === val;
                            const isTD = val === "TD";
                            return (
                              <button
                                key={val}
                                type="button"
                                onClick={() => handleScoreChange(q.no, val)}
                                className={`py-2 rounded-xl text-xs font-black transition-all border ${
                                  isChosen
                                    ? isTD
                                      ? "bg-amber-500 border-amber-600 text-white shadow-xs"
                                      : "bg-emerald-600 border-emerald-700 text-white shadow-xs scale-102"
                                    : isTD
                                    ? "bg-amber-50 border-amber-200 text-amber-800 hover:bg-amber-100"
                                    : "bg-slate-50 border-slate-200 text-slate-700 hover:bg-emerald-50 hover:border-emerald-300"
                                }`}
                              >
                                {val}
                              </button>
                            );
                          })}
                        </div>
                      </CardContent>
                    </Card>
                  );
                })}
              </div>

              {/* Catatan Khusus */}
              <Card className="border-slate-200 bg-white rounded-2xl shadow-2xs">
                <CardContent className="p-3.5 space-y-1.5">
                  <Label className="text-xs font-semibold text-slate-700">
                    Saran atau catatan tambahan untuk {sec.name} (opsional):
                  </Label>
                  <Textarea
                    placeholder="Tulis saran lapang Anda jika ada..."
                    rows={2}
                    value={likertNotes[sec.id] || ""}
                    onChange={(e) => handleSectionNoteChange(sec.id, e.target.value)}
                    className="text-xs bg-slate-50 rounded-xl"
                  />
                </CardContent>
              </Card>

              {/* Navigasi Lanjut/Kembali */}
              <div className="flex items-center gap-2 pt-1">
                <Button
                  variant="outline"
                  onClick={handlePrevSection}
                  className="flex-1 h-11 text-xs rounded-xl font-bold border-slate-200 flex items-center justify-center gap-1.5"
                >
                  <ChevronLeft className="size-4" />
                  <span>Kembali</span>
                </Button>

                <Button
                  onClick={handleNextSection}
                  className="flex-1 h-11 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded-xl shadow-2xs flex items-center justify-center gap-1.5"
                >
                  <span>
                    {currentIdx < currentLikertSections.length - 1
                      ? `Lanjut ke ${currentLikertSections[currentIdx + 1].name}`
                      : "Lanjut ke Rekomendasi (Langkah 4)"}
                  </span>
                  <ChevronRight className="size-4" />
                </Button>
              </div>
            </div>
          );
        })()}

        {/* ================= TAB 4: REKOMENDASI VALIDATOR ================= */}
        {activeTab === "recap" && (
          <div className="space-y-3.5 animate-in fade-in duration-150">
            {likertStats.filledTotal < 25 && (
              <div className="p-3.5 rounded-2xl bg-amber-50 border border-amber-200 text-xs text-amber-950 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 shadow-2xs">
                <div className="flex items-center gap-2">
                  <AlertTriangle className="size-4 text-amber-600 shrink-0" />
                  <span>
                    <b>25 Pertanyaan Kuesioner Wajib Diisi:</b> Saat ini baru terisi <b>{likertStats.filledTotal} / 25</b> soal.
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    for (const sec of currentLikertSections) {
                      const hasUnanswered = sec.items.some((q: any) => !likertAnswers[q.no]);
                      if (hasUnanswered) {
                        setActiveLikertSection(sec.id);
                        break;
                      }
                    }
                    setActiveTab("likert");
                    window.scrollTo({ top: 0, behavior: "smooth" });
                  }}
                  className="text-emerald-800 font-bold hover:underline shrink-0 text-xs cursor-pointer"
                >
                  Lengkapi Soal Sekarang &rarr;
                </button>
              </div>
            )}

            <Card className="border-slate-200 rounded-2xl shadow-2xs bg-white">
              <CardHeader className="p-4 pb-2">
                <CardTitle className="text-sm font-bold text-slate-900 flex items-center gap-2">
                  <Send className="size-4 text-emerald-600" />
                  Keputusan & Rekomendasi Akhir
                </CardTitle>
              </CardHeader>
              <CardContent className="p-4 space-y-3.5 pt-1">
                <div className="space-y-2 text-xs">
                  {(RECOMMENDATION_OPTIONS[validatorRole] || RECOMMENDATION_OPTIONS.sukabumi).map((rec) => (
                    <label
                      key={rec.val}
                      className={`flex items-start gap-2.5 p-3 rounded-xl border cursor-pointer transition-all ${
                        finalDecision === rec.val
                          ? "border-emerald-500 bg-emerald-50"
                          : "border-slate-200 bg-white hover:bg-slate-50"
                      }`}
                    >
                      <input
                        type="radio"
                        name="finalDecision"
                        value={rec.val}
                        checked={finalDecision === rec.val}
                        onChange={(e) => setFinalDecision(e.target.value)}
                        className="mt-0.5 text-emerald-600 focus:ring-emerald-500"
                      />
                      <div>
                        <span className="font-bold text-slate-900 block">{rec.label}</span>
                        <span className="text-[11px] text-slate-500">{rec.desc}</span>
                      </div>
                    </label>
                  ))}
                </div>

                <div className="space-y-1.5 pt-1">
                  <Label className="text-xs font-semibold text-slate-700">
                    Saran atau pesan tambahan untuk peneliti (opsional):
                  </Label>
                  <Textarea
                    rows={3}
                    placeholder="Tuliskan masukan atau saran lapang Anda..."
                    value={finalNotes}
                    onChange={(e) => setFinalNotes(e.target.value)}
                    className="text-xs bg-slate-50 rounded-xl"
                  />
                </div>
              </CardContent>
              <CardFooter className="p-4 pt-0 border-t-0 flex flex-col gap-2">
                <div className="flex items-center gap-2 w-full">
                  <Button
                    variant="outline"
                    onClick={() => {
                      setActiveTab("likert");
                      window.scrollTo({ top: 0, behavior: "smooth" });
                    }}
                    className="flex-1 h-11 text-xs rounded-xl font-bold border-slate-200 flex items-center justify-center gap-1.5"
                  >
                    <ChevronLeft className="size-4" />
                    <span>Kembali ke Kuesioner</span>
                  </Button>

                  <Button
                    onClick={handleSubmitValidation}
                    disabled={isSubmitting}
                    className="flex-1 h-11 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded-xl shadow-2xs flex items-center justify-center gap-1.5"
                  >
                    {isSubmitting ? (
                      <span>Mengirim Jawaban...</span>
                    ) : (
                      <>
                        <span>Kirim Jawaban</span>
                        <Send className="size-3.5" />
                      </>
                    )}
                  </Button>
                </div>

                <div className="text-center pt-0.5">
                  <button
                    type="button"
                    onClick={handleDownloadPDF}
                    className="text-[11px] font-semibold text-emerald-700 hover:text-emerald-800 hover:underline inline-flex items-center gap-1 cursor-pointer"
                  >
                    <FileText className="size-3" />
                    <span>Pratinjau / Unduh Dokumen PDF Resmi</span>
                  </button>
                </div>
              </CardFooter>
            </Card>
          </div>
        )}
      </main>

      {/* MODAL PRATINJAU FOTO & FORM KOREKSI / KOMENTAR OPSI AHLI */}
      <Dialog open={!!inspectSample} onOpenChange={(open) => !open && setInspectSample(null)}>
        <DialogContent showCloseButton={false} className="max-w-md p-0 overflow-hidden rounded-3xl bg-white border-0 shadow-2xl max-h-[92vh] flex flex-col">
          {inspectSample && (() => {
            const corr = corrections[inspectSample.id];
            const isMismatch = corr?.isCorrected;

            return (
              <div className="flex flex-col h-full overflow-hidden">
                {/* Header Modal Pratinjau */}
                <div className="p-3.5 bg-slate-50 border-b border-slate-100 flex items-center justify-between shrink-0">
                  <div>
                    <div className="flex items-center gap-1.5">
                      <Badge className="bg-emerald-100 text-emerald-900 border-0 text-[10px] font-bold">
                        {inspectSample.part === "leaf" ? "🍃 Daun" : "🍅 Buah"}
                      </Badge>
                      <span className="text-[11px] text-slate-500 font-medium">{inspectSample.location}</span>
                    </div>
                    <DialogTitle className="text-sm font-extrabold text-slate-900 mt-0.5">
                      {inspectSample.disease_label}
                    </DialogTitle>
                    <DialogDescription className="text-[10px] text-slate-400">
                      Pratinjau detail foto dan form catatan koreksi ahli.
                    </DialogDescription>
                  </div>
                  <button
                    onClick={() => setInspectSample(null)}
                    className="size-7 rounded-full bg-slate-200 text-slate-600 hover:bg-slate-300 flex items-center justify-center text-xs font-bold transition"
                  >
                    <X className="size-4" />
                  </button>
                </div>

                {/* Konten Scrollable */}
                <div className="p-4 space-y-3.5 overflow-y-auto">
                  {/* Foto Pratinjau Besar */}
                  <div className="relative aspect-4/3 w-full rounded-2xl overflow-hidden bg-black shadow-inner flex items-center justify-center">
                    <Image
                      src={inspectSample.image_url}
                      alt={inspectSample.disease_label}
                      fill
                      className="object-contain"
                      unoptimized
                    />
                  </div>

                  {/* Form Koreksi & Komentar Ahli */}
                  <div
                    className={`p-3.5 rounded-2xl border transition-all ${
                      isMismatch ? "bg-amber-50/70 border-amber-300" : "bg-slate-50 border-slate-200"
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-slate-800">Apakah penyakit pada foto ini sesuai?</span>
                      {isMismatch && (
                        <Badge className="bg-amber-200 text-amber-900 border-0 text-[10px] font-bold">
                          Ditandai Keliru
                        </Badge>
                      )}
                    </div>

                    {/* Tombol Pilihan Sesuai vs Tidak Sesuai */}
                    <div className="grid grid-cols-2 gap-2 mt-2">
                      <button
                        type="button"
                        onClick={() => {
                          if (isMismatch) handleToggleCorrection(inspectSample.id, inspectSample.disease_label);
                        }}
                        className={`py-2 px-3 rounded-xl text-xs font-bold border transition-all ${
                          !isMismatch
                            ? "bg-emerald-600 text-white border-emerald-700 shadow-xs"
                            : "bg-white text-slate-600 border-slate-200 hover:bg-slate-100"
                        }`}
                      >
                        ✓ Sudah Sesuai
                      </button>

                      <button
                        type="button"
                        onClick={() => {
                          if (!isMismatch) handleToggleCorrection(inspectSample.id, inspectSample.disease_label);
                        }}
                        className={`py-2 px-3 rounded-xl text-xs font-bold border transition-all ${
                          isMismatch
                            ? "bg-amber-500 text-white border-amber-600 shadow-xs"
                            : "bg-white text-slate-600 border-slate-200 hover:bg-slate-100"
                        }`}
                      >
                        ⚠ Penyakit Keliru
                      </button>
                    </div>

                    {/* 1 Chatbox untuk Penyakit yang Seharusnya atau Catatan Lain */}
                    {isMismatch && (
                      <div className="space-y-1.5 pt-3 mt-3 border-t border-amber-200 animate-in fade-in duration-150">
                        <Label className="text-xs font-bold text-amber-950">
                          Penyakit yang Seharusnya / Catatan Ahli:
                        </Label>
                        <Textarea
                          rows={3}
                          placeholder="Tuliskan penyakit yang seharusnya menurut Anda atau catatan gejala lainnya..."
                          value={corr?.notes || ""}
                          onChange={(e) =>
                            handleUpdateCorrectionDetail(
                              inspectSample.id,
                              inspectSample.disease_label,
                              e.target.value
                            )
                          }
                          className="text-xs bg-white border-amber-300 rounded-xl focus:ring-amber-500 shadow-2xs"
                        />
                      </div>
                    )}
                  </div>
                </div>

                {/* Footer Modal: Tombol Tutup */}
                <div className="p-3 bg-slate-50 border-t border-slate-100 flex justify-end shrink-0">
                  <Button
                    onClick={() => setInspectSample(null)}
                    className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs h-10 rounded-xl shadow-xs"
                  >
                    Simpan & Tutup Pratinjau
                  </Button>
                </div>
              </div>
            );
          })()}
        </DialogContent>
      </Dialog>

      {/* MODAL ALERT SUKSES PENGIRIMAN */}
      <Dialog open={showSuccessModal} onOpenChange={setShowSuccessModal}>
        <DialogContent showCloseButton={false} className="max-w-md p-6 rounded-3xl bg-white border border-slate-200 shadow-2xl text-center">
          <div className="size-16 rounded-3xl bg-emerald-100 text-emerald-600 flex items-center justify-center mx-auto mb-3.5 shadow-md shadow-emerald-500/20">
            <CheckCircle2 className="size-9 text-emerald-600" />
          </div>
          <DialogTitle className="text-lg font-bold text-slate-900">
            Penilaian Berhasil Dikirim!
          </DialogTitle>
          <DialogDescription className="text-xs text-slate-600 mt-2 leading-relaxed">
            Terima kasih kepada <b>{submittedValidatorName || "Validator"}</b>. Seluruh data identitas, evaluasi 25 butir kuesioner, catatan sampel, dan rekomendasi Anda telah berhasil tersimpan dengan aman ke dalam sistem database.
          </DialogDescription>
          <div className="mt-5">
            <Button
              onClick={() => setShowSuccessModal(false)}
              className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs h-10 rounded-xl shadow-xs"
            >
              OK, Selesai
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
