"use client";

import React, { useState, useEffect } from "react";
import Image from "next/image";
import Link from "next/link";
import {
  Lock,
  LogOut,
  ArrowLeft,
  Users,
  CheckCircle2,
  AlertTriangle,
  FileSpreadsheet,
  Download,
  RefreshCw,
  BarChart3,
  Layers,
  ZoomIn,
  ShieldAlert,
  Search,
  SlidersHorizontal,
  FileText,
  Trash2,
  Archive,
} from "lucide-react";
import JSZip from "jszip";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";

import QUESTIONNAIRES_RAW from "@/data/questionnaires.json";
import { downloadValidationPdf, generateValidationPdf } from "@/lib/pdf-export";

export default function AdminPage() {
  const [isAuthenticated, setIsAuthenticated] = useState<boolean | null>(null);
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [loginError, setLoginError] = useState("");
  const [isLoggingIn, setIsLoggingIn] = useState(false);

  // Dashboard Data State
  const [statsData, setStatsData] = useState<any>(null);
  const [isLoadingStats, setIsLoadingStats] = useState(false);
  const [activeAdminTab, setActiveAdminTab] = useState<"overview" | "validators" | "corrections">("overview");

  // Search & Filter for corrections
  const [correctionSearch, setCorrectionSearch] = useState("");

  // Zoom Modal
  const [zoomModal, setZoomModal] = useState<{ open: boolean; imgUrl: string; title: string; meta: string }>({
    open: false,
    imgUrl: "",
    title: "",
    meta: "",
  });

  // PDF Download state
  const [downloadingPdfId, setDownloadingPdfId] = useState<string | null>(null);

  const handleDownloadValidatorPdf = async (val: any) => {
    setDownloadingPdfId(val.id);
    try {
      const res = await fetch(`/api/validations?validatorId=${val.id}`);
      if (!res.ok) {
        throw new Error("Gagal mengambil data kuesioner validator");
      }
      const data = await res.json();
      const role = data.validator.role || "sukabumi";
      const sections = (QUESTIONNAIRES_RAW as any)[role] || (QUESTIONNAIRES_RAW as any).sukabumi;

      downloadValidationPdf({
        validator: data.validator,
        sections,
        likertAnswers: data.likertAnswers || {},
        likertNotes: data.likertNotes || {},
        corrections: data.corrections || {},
        sensorReviews: data.sensorReviews || {
          samarang_garut: { status: "memadai", notes: "" },
          gunungmanik_majalengka: { status: "memadai", notes: "" },
          sangiang_majalengka: { status: "memadai", notes: "" },
        },
        finalRecommendation: data.finalRecommendation || { decision: "layak", comments: "" },
      });
    } catch (err: any) {
      alert("Error generate PDF: " + err.message);
    } finally {
      setDownloadingPdfId(null);
    }
  };

  // State & Handler Download Semua PDF (.zip)
  const [isDownloadingZip, setIsDownloadingZip] = useState(false);
  const [zipProgressText, setZipProgressText] = useState("");

  const handleDownloadAllZip = async () => {
    if (!statsData?.validators || statsData.validators.length === 0) {
      alert("Belum ada data validator untuk diunduh.");
      return;
    }

    setIsDownloadingZip(true);
    setZipProgressText("Menyiapkan ZIP...");

    try {
      const zip = new JSZip();
      const folder = zip.folder("Hasil_Kuesioner_Validator_Tomatica");

      const validators = statsData.validators;
      for (let i = 0; i < validators.length; i++) {
        const val = validators[i];
        setZipProgressText(`Menyusun PDF (${i + 1}/${validators.length})...`);

        const res = await fetch(`/api/validations?validatorId=${encodeURIComponent(val.id)}`);
        if (!res.ok) {
          console.warn(`Gagal mengambil data untuk validator: ${val.name}`);
          continue;
        }

        const data = await res.json();
        const role = data.validator.role || "sukabumi";
        const sections = (QUESTIONNAIRES_RAW as any)[role] || (QUESTIONNAIRES_RAW as any).sukabumi;

        const doc = generateValidationPdf({
          validator: data.validator,
          sections,
          likertAnswers: data.likertAnswers || {},
          likertNotes: data.likertNotes || {},
          corrections: data.corrections || {},
          sensorReviews: data.sensorReviews || {
            samarang_garut: { status: "memadai", notes: "" },
            gunungmanik_majalengka: { status: "memadai", notes: "" },
            sangiang_majalengka: { status: "memadai", notes: "" },
          },
          finalRecommendation: data.finalRecommendation || { decision: "layak", comments: "" },
        });

        const pdfArrayBuffer = doc.output("arraybuffer");
        const cleanName = (val.name || "Validator")
          .replace(/[^a-zA-Z0-9]/g, "_")
          .slice(0, 30);
        const roleLabel = (val.role || "ahli").toUpperCase();
        const numPrefix = String(i + 1).padStart(2, "0");
        const filename = `${numPrefix}_${cleanName}_${roleLabel}.pdf`;

        if (folder) {
          folder.file(filename, pdfArrayBuffer);
        } else {
          zip.file(filename, pdfArrayBuffer);
        }
      }

      setZipProgressText("Mengompresi ZIP...");
      const zipBlob = await zip.generateAsync({ type: "blob" });

      const dateStr = new Date().toISOString().slice(0, 10);
      const zipFilename = `Semua_Hasil_Validasi_Kuesioner_Tomatica_${dateStr}.zip`;

      const link = document.createElement("a");
      link.href = URL.createObjectURL(zipBlob);
      link.download = zipFilename;
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(link.href);
    } catch (err: any) {
      alert("Error membuat file ZIP: " + err.message);
    } finally {
      setIsDownloadingZip(false);
      setZipProgressText("");
    }
  };

  // Delete Modal state
  const [deleteModal, setDeleteModal] = useState<{
    open: boolean;
    type: "validator" | "correction" | "reset_all";
    id?: string;
    title?: string;
    subtitle?: string;
    isDeleting: boolean;
  }>({
    open: false,
    type: "validator",
    isDeleting: false,
  });

  const executeDelete = async () => {
    if (!deleteModal.open) return;
    setDeleteModal((prev) => ({ ...prev, isDeleting: true }));

    try {
      let url = "/api/validations";
      if (deleteModal.type === "validator" && deleteModal.id) {
        url += `?validatorId=${encodeURIComponent(deleteModal.id)}`;
      } else if (deleteModal.type === "correction" && deleteModal.id) {
        url += `?correctionId=${encodeURIComponent(deleteModal.id)}`;
      } else if (deleteModal.type === "reset_all") {
        url += "?resetAll=true";
      }

      const res = await fetch(url, { method: "DELETE" });
      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || "Gagal menghapus data");
      }

      setDeleteModal({ open: false, type: "validator", isDeleting: false });
      await fetchStats();
    } catch (err: any) {
      alert("Error hapus data: " + err.message);
      setDeleteModal((prev) => ({ ...prev, isDeleting: false }));
    }
  };

  // Check auth status on mount
  useEffect(() => {
    async function checkAuth() {
      try {
        const res = await fetch("/api/auth");
        const data = await res.json();
        setIsAuthenticated(data.authenticated);
        if (data.authenticated) {
          fetchStats();
        }
      } catch (e) {
        setIsAuthenticated(false);
      }
    }
    checkAuth();
  }, []);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoggingIn(true);
    setLoginError("");

    try {
      const res = await fetch("/api/auth", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, password }),
      });
      const data = await res.json();

      if (res.ok) {
        setIsAuthenticated(true);
        fetchStats();
      } else {
        setLoginError(data.error || "Login gagal");
      }
    } catch (err: any) {
      setLoginError("Terjadi kesalahan jaringan");
    } finally {
      setIsLoggingIn(false);
    }
  };

  const handleLogout = async () => {
    await fetch("/api/auth", { method: "DELETE" });
    setIsAuthenticated(false);
  };

  const fetchStats = async () => {
    setIsLoadingStats(true);
    try {
      const res = await fetch("/api/admin/stats");
      const data = await res.json();
      setStatsData(data);
    } catch (e) {
      console.error("Gagal memuat statistik admin:", e);
    } finally {
      setIsLoadingStats(false);
    }
  };

  const exportCSV = () => {
    if (!statsData || !statsData.corrections) return;
    const headers = ["ID Sampel", "Bagian", "Lokasi", "Label Peneliti", "Diagnosis Ahli", "Catatan Ahli", "Nama Validator"];
    const rows = statsData.corrections.map((c: any) => [
      c.sample_id,
      c.part,
      c.location,
      c.original_label,
      c.expert_diagnosis,
      `"${(c.symptom_notes || "").replace(/"/g, '""')}"`,
      c.validator_name || "-",
    ]);

    const csvContent = "data:text/csv;charset=utf-8," + [headers.join(","), ...rows.map((e: any) => e.join(","))].join("\n");
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `rekap_koreksi_tomatica_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    link.remove();
  };

  // 1. Loading State
  if (isAuthenticated === null) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
        <div className="size-8 border-2 border-emerald-600 border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }

  // 2. Login Form View
  if (!isAuthenticated) {
    return (
      <div className="min-h-screen bg-slate-50 flex flex-col justify-center items-center p-4">
        <div className="w-full max-w-sm space-y-4">
          <div className="text-center space-y-2">
            <div className="size-12 rounded-2xl bg-emerald-600 text-white flex items-center justify-center font-bold text-2xl mx-auto shadow-md shadow-emerald-600/30">
              🍅
            </div>
            <h1 className="text-xl font-bold text-slate-900 tracking-tight">Admin Tomatica</h1>
            <p className="text-xs text-slate-500">Dashboard Statistik & Rekapitulasi Expert Judgment</p>
          </div>

          <Card className="border-slate-200/90 shadow-sm rounded-2xl">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-bold text-slate-800 flex items-center gap-1.5">
                <Lock className="size-4 text-emerald-600" />
                Login Dashboard Admin
              </CardTitle>
              <CardDescription className="text-xs">
                Masukkan kredensial admin untuk mengakses statistik.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleLogin} className="space-y-3">
                {loginError && (
                  <div className="p-2.5 rounded-xl bg-red-50 border border-red-200 text-red-700 text-xs flex items-center gap-2">
                    <ShieldAlert className="size-4 shrink-0" />
                    <span>{loginError}</span>
                  </div>
                )}
                <div className="space-y-1">
                  <Label className="text-xs text-slate-600">Username</Label>
                  <Input
                    type="text"
                    required
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    placeholder="admin"
                    className="h-10 text-xs rounded-xl"
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs text-slate-600">Password</Label>
                  <Input
                    type="password"
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••"
                    className="h-10 text-xs rounded-xl"
                  />
                </div>
                <Button
                  type="submit"
                  disabled={isLoggingIn}
                  className="w-full h-10 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded-xl shadow-xs mt-2"
                >
                  {isLoggingIn ? "Memverifikasi..." : "Masuk ke Dashboard"}
                </Button>
              </form>
            </CardContent>
            <CardFooter className="pt-0 border-t border-slate-100 flex justify-between items-center text-[11px] text-slate-400">
              <span>Default: admin / tomatica2026</span>
              <Link href="/" className="text-emerald-700 font-semibold hover:underline flex items-center gap-1">
                <ArrowLeft className="size-3.5" />
                <span>Ke Form Validator</span>
              </Link>
            </CardFooter>
          </Card>
        </div>
      </div>
    );
  }

  // 3. Authenticated Admin Dashboard View
  const filteredCorrections = (statsData?.corrections || []).filter((c: any) => {
    if (!correctionSearch) return true;
    const term = correctionSearch.toLowerCase();
    return (
      c.sample_id.toLowerCase().includes(term) ||
      (c.original_label || "").toLowerCase().includes(term) ||
      (c.expert_diagnosis || "").toLowerCase().includes(term) ||
      (c.validator_name || "").toLowerCase().includes(term) ||
      (c.symptom_notes || "").toLowerCase().includes(term)
    );
  });

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col pb-safe">
      {/* Top Navbar */}
      <header className="sticky top-0 z-40 bg-white/95 backdrop-blur-md border-b border-emerald-100 shadow-xs px-4 py-3">
        <div className="max-w-5xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <Link
              href="/"
              className="size-8 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 flex items-center justify-center text-xs font-bold transition"
              title="Kembali ke Form Validator"
            >
              <ArrowLeft className="size-4" />
            </Link>
            <div>
              <div className="flex items-center gap-1.5">
                <span className="text-xs font-bold text-emerald-950">Tomatica Dashboard Admin</span>
                <Badge className="bg-emerald-100 text-emerald-800 border-emerald-200 text-[9px] px-1.5 py-0 font-bold">
                  Sistem Terpusat
                </Badge>
              </div>
              <p className="text-[10px] text-slate-500">Rekapitulasi Kuesioner & Validasi Citra Ahli</p>
            </div>
          </div>

          <div className="flex items-center gap-1.5">
            {statsData?.validators?.length > 0 && (
              <Button
                variant="outline"
                size="sm"
                onClick={() =>
                  setDeleteModal({
                    open: true,
                    type: "reset_all",
                    title: "Reset Seluruh Data Responden",
                    subtitle:
                      "PERINGATAN: Tindakan ini akan menghapus SEMUA data validator, seluruh respon 25 butir kuesioner, dan seluruh catatan koreksi citra (cocok untuk membersihkan data uji coba sebelum evaluasi pakar sesungguhnya). Katalog dataset master citra (2.853 foto) dan sensor tetap aman.",
                    isDeleting: false,
                  })
                }
                className="h-8 text-xs text-red-600 border-red-200 hover:bg-red-50 hover:border-red-300 rounded-xl gap-1 px-2.5"
                title="Hapus / Reset semua data responden uji coba"
              >
                <Trash2 className="size-3.5" />
                <span className="hidden sm:inline">Reset Uji Coba</span>
              </Button>
            )}
            <Button
              variant="outline"
              size="sm"
              onClick={fetchStats}
              disabled={isLoadingStats}
              className="h-8 text-xs rounded-xl gap-1 px-2.5"
            >
              <RefreshCw className={`size-3.5 ${isLoadingStats ? "animate-spin" : ""}`} />
              <span className="hidden sm:inline">Refresh</span>
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={handleLogout}
              className="h-8 text-xs text-red-600 hover:bg-red-50 hover:text-red-700 rounded-xl gap-1 px-2.5"
            >
              <LogOut className="size-3.5" />
              <span className="hidden sm:inline">Keluar</span>
            </Button>
          </div>
        </div>
      </header>

      {/* Main Dashboard Container */}
      <main className="flex-1 max-w-5xl w-full mx-auto p-4 space-y-4">
        {/* KPI Summary Cards */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          <Card className="rounded-2xl border-slate-200/90 bg-white p-3.5 shadow-xs">
            <div className="flex items-center justify-between text-slate-500">
              <span className="text-[11px] font-semibold uppercase">Total Validator</span>
              <Users className="size-4 text-emerald-600" />
            </div>
            <div className="text-2xl font-black text-slate-900 mt-1">
              {statsData?.validators?.length || 0}
            </div>
            <span className="text-[10px] text-slate-400">Ahli telah submit</span>
          </Card>

          <Card className="rounded-2xl border-slate-200/90 bg-white p-3.5 shadow-xs">
            <div className="flex items-center justify-between text-slate-500">
              <span className="text-[11px] font-semibold uppercase">Skor Likert Avg</span>
              <BarChart3 className="size-4 text-emerald-600" />
            </div>
            <div className="text-2xl font-black text-emerald-600 mt-1">
              {statsData?.likertStats?.overall?.overall_avg
                ? Number(statsData.likertStats.overall.overall_avg).toFixed(2)
                : "0.00"}
            </div>
            <span className="text-[10px] text-slate-400">
              Skor rata-rata dari 25 butir
            </span>
          </Card>

          <Card className="rounded-2xl border-slate-200/90 bg-white p-3.5 shadow-xs">
            <div className="flex items-center justify-between text-slate-500">
              <span className="text-[11px] font-semibold uppercase">Katalog Citra</span>
              <Layers className="size-4 text-emerald-600" />
            </div>
            <div className="text-2xl font-black text-slate-900 mt-1">
              {statsData?.samplesOverview?.total_samples || 0}
            </div>
            <span className="text-[10px] text-slate-400">
              {statsData?.samplesOverview?.leaf_count || 0} Daun • {statsData?.samplesOverview?.fruit_count || 0} Buah
            </span>
          </Card>

          <Card className="rounded-2xl border-slate-200/90 bg-white p-3.5 shadow-xs">
            <div className="flex items-center justify-between text-slate-500">
              <span className="text-[11px] font-semibold uppercase">Citra Dikoreksi</span>
              <AlertTriangle className="size-4 text-amber-500" />
            </div>
            <div className="text-2xl font-black text-amber-600 mt-1">
              {statsData?.corrections?.length || 0}
            </div>
            <span className="text-[10px] text-slate-400">Ditandai salah label</span>
          </Card>
        </div>

        {/* View Switcher Tabs */}
        <div className="flex gap-2 border-b border-slate-200 pb-2 overflow-x-auto scrollbar-none">
          <button
            onClick={() => setActiveAdminTab("overview")}
            className={`px-3.5 py-1.5 rounded-full text-xs font-bold transition ${
              activeAdminTab === "overview"
                ? "bg-emerald-600 text-white shadow-xs"
                : "bg-white text-slate-600 border border-slate-200 hover:bg-slate-50"
            }`}
          >
            📊 Ringkasan Metodologi
          </button>
          <button
            onClick={() => setActiveAdminTab("validators")}
            className={`px-3.5 py-1.5 rounded-full text-xs font-bold transition ${
              activeAdminTab === "validators"
                ? "bg-emerald-600 text-white shadow-xs"
                : "bg-white text-slate-600 border border-slate-200 hover:bg-slate-50"
            }`}
          >
            👤 Daftar Validator ({statsData?.validators?.length || 0})
          </button>
          <button
            onClick={() => setActiveAdminTab("corrections")}
            className={`px-3.5 py-1.5 rounded-full text-xs font-bold transition ${
              activeAdminTab === "corrections"
                ? "bg-emerald-600 text-white shadow-xs"
                : "bg-white text-slate-600 border border-slate-200 hover:bg-slate-50"
            }`}
          >
            ⚠️ Rekap Koreksi Citra ({statsData?.corrections?.length || 0})
          </button>
        </div>

        {/* ================= SUB-TAB 1: OVERVIEW ================= */}
        {activeAdminTab === "overview" && (
          <div className="space-y-4 animate-in fade-in duration-200">
            {/* Rekomendasi Cross-Zone Summary */}
            <Card className="rounded-2xl border-slate-200 shadow-xs">
              <CardHeader className="p-4 pb-2">
                <CardTitle className="text-xs font-bold text-slate-800 uppercase tracking-wider">
                  Hasil Rekomendasi Kelayakan Uji Cross-Zone
                </CardTitle>
                <CardDescription className="text-xs">
                  Keputusan akhir para ahli mengenai kesiapan model diuji di Sukabumi.
                </CardDescription>
              </CardHeader>
              <CardContent className="p-4 pt-1">
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div className="p-3.5 rounded-xl bg-emerald-50 border border-emerald-200">
                    <span className="text-xs font-bold text-emerald-900 block">Layak Cross-Zone</span>
                    <span className="text-2xl font-black text-emerald-700 mt-1 block">
                      {(statsData?.recommendationSummary || []).find((r: any) => r.decision === "layak")?.count || 0}
                    </span>
                    <span className="text-[10px] text-emerald-800/80">Disetujui penuh oleh ahli</span>
                  </div>

                  <div className="p-3.5 rounded-xl bg-amber-50 border border-amber-200">
                    <span className="text-xs font-bold text-amber-900 block">Layak dengan Revisi</span>
                    <span className="text-2xl font-black text-amber-700 mt-1 block">
                      {(statsData?.recommendationSummary || []).find((r: any) => r.decision === "layak_revisi")?.count || 0}
                    </span>
                    <span className="text-[10px] text-amber-800/80">Perlu perbaikan label tertentu</span>
                  </div>

                  <div className="p-3.5 rounded-xl bg-red-50 border border-red-200">
                    <span className="text-xs font-bold text-red-900 block">Perlu Perbaikan Ulang</span>
                    <span className="text-2xl font-black text-red-700 mt-1 block">
                      {(statsData?.recommendationSummary || []).find((r: any) => r.decision === "perlu_perbaikan")?.count || 0}
                    </span>
                    <span className="text-[10px] text-red-800/80">Bukti sampel belum memadai</span>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Skor Likert per Bagian (C, D, E, F) */}
            <Card className="rounded-2xl border-slate-200 shadow-xs">
              <CardHeader className="p-4 pb-2">
                <CardTitle className="text-xs font-bold text-slate-800 uppercase tracking-wider">
                  Rata-rata Skor per Dimensi Kuesioner
                </CardTitle>
              </CardHeader>
              <CardContent className="p-4 pt-1 space-y-3">
                {[
                  { id: "section_c", label: "Bagian C: Kesesuaian Rancangan Cross Zone (Butir 1–6)" },
                  { id: "section_d", label: "Bagian D: Kesesuaian Gejala & Definisi Penyakit (Butir 7–13)" },
                  { id: "section_e", label: "Bagian E: Kecukupan Bukti Citra & Sensor (Butir 14–19)" },
                  { id: "section_f", label: "Bagian F: Kelayakan Model & Penerapan Lapang (Butir 20–25)" },
                ].map((sec) => {
                  const item = (statsData?.likertStats?.bySection || []).find((s: any) => s.section_id === sec.id);
                  const avg = item ? Number(item.avg_score).toFixed(2) : "0.00";
                  const percent = item ? Math.min(100, Math.round((Number(item.avg_score) / 5) * 100)) : 0;
                  return (
                    <div key={sec.id} className="space-y-1">
                      <div className="flex justify-between text-xs font-semibold">
                        <span className="text-slate-700">{sec.label}</span>
                        <span className="text-emerald-700 font-bold">{avg} / 5.00</span>
                      </div>
                      <div className="h-2 w-full bg-slate-100 rounded-full overflow-hidden">
                        <div
                          className="h-full bg-emerald-600 rounded-full transition-all duration-300"
                          style={{ width: `${percent}%` }}
                        />
                      </div>
                    </div>
                  );
                })}
              </CardContent>
            </Card>
          </div>
        )}

        {/* ================= SUB-TAB 2: DAFTAR VALIDATOR ================= */}
        {activeAdminTab === "validators" && (
          <div className="space-y-3 animate-in fade-in duration-200">
            {/* Action Bar Header */}
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2.5 p-3.5 bg-white rounded-2xl border border-slate-200 shadow-2xs">
              <div>
                <span className="text-xs font-bold text-slate-800 block">Arsip Berkas Penilaian Validator</span>
                <p className="text-[11px] text-slate-500">
                  Total <b>{statsData?.validators?.length || 0}</b> ahli telah mengisi dan menandatangani kuesioner.
                </p>
              </div>

              {statsData?.validators && statsData.validators.length > 0 && (
                <Button
                  size="sm"
                  onClick={handleDownloadAllZip}
                  disabled={isDownloadingZip}
                  className="w-full sm:w-auto h-8 text-xs font-bold rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white shadow-xs gap-1.5"
                >
                  {isDownloadingZip ? (
                    <>
                      <RefreshCw className="size-3.5 animate-spin" />
                      <span>{zipProgressText || "Memproses..."}</span>
                    </>
                  ) : (
                    <>
                      <Archive className="size-3.5" />
                      <span>Download Semua PDF (.zip)</span>
                    </>
                  )}
                </Button>
              )}
            </div>

            {!statsData?.validators || statsData.validators.length === 0 ? (
              <div className="p-8 bg-white rounded-2xl border border-dashed border-slate-200 text-center text-xs text-slate-500">
                Belum ada data validator yang tersimpan di sistem database.
              </div>
            ) : (
              statsData.validators.map((val: any) => (
                <Card key={val.id} className="rounded-2xl border-slate-200 shadow-xs">
                  <CardContent className="p-4 space-y-2.5">
                    <div className="flex items-start justify-between">
                      <div>
                        <div className="flex items-center gap-1.5">
                          <span className="text-xs font-bold text-slate-900">{val.name}</span>
                          <Badge className="bg-emerald-100 text-emerald-800 border-0 text-[10px]">
                            {val.role?.toUpperCase()}
                          </Badge>
                        </div>
                        <p className="text-[11px] text-slate-500">{val.title} • {val.institution}</p>
                      </div>
                      <Badge
                        variant="outline"
                        className={`text-[10px] font-bold ${
                          val.final_decision === "layak"
                            ? "border-emerald-500 text-emerald-700 bg-emerald-50"
                            : val.final_decision === "layak_revisi"
                            ? "border-amber-500 text-amber-700 bg-amber-50"
                            : "border-slate-300 text-slate-600"
                        }`}
                      >
                        {val.final_decision ? val.final_decision.toUpperCase() : "SUBMITTED"}
                      </Badge>
                    </div>

                    <div className="text-[11px] text-slate-600 grid grid-cols-1 sm:grid-cols-2 gap-1 pt-1 border-t border-slate-100">
                      <div><strong>Wilayah:</strong> {val.region || "-"}</div>
                      <div><strong>Pengalaman:</strong> {val.experience || "-"}</div>
                    </div>

                    {val.general_notes && (
                      <div className="p-2.5 rounded-xl bg-slate-50 border border-slate-200/80 text-[11px] text-slate-700">
                        <span className="font-bold text-slate-900 block text-[10px] uppercase">Rekomendasi / Catatan Akhir:</span>
                        <p className="italic mt-0.5">"{val.general_notes}"</p>
                      </div>
                    )}

                    <div className="pt-2 border-t border-slate-100 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2">
                      <span className="text-[10px] text-slate-400">
                        Waktu Submit: {val.created_at ? new Date(val.created_at).toLocaleDateString("id-ID", { day: "numeric", month: "long", year: "numeric", hour: "2-digit", minute: "2-digit" }) : "-"}
                      </span>
                      <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
                        <Button
                          size="sm"
                          variant="outline"
                          disabled={downloadingPdfId === val.id}
                          onClick={() => handleDownloadValidatorPdf(val)}
                          className="h-8 text-xs rounded-xl font-bold border-emerald-300 text-emerald-800 bg-emerald-50/80 hover:bg-emerald-100 gap-1.5 shadow-2xs"
                        >
                          <FileText className="size-3.5 text-emerald-600" />
                          <span>{downloadingPdfId === val.id ? "Menyiapkan PDF..." : "Lihat & Unduh PDF Hasil"}</span>
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() =>
                            setDeleteModal({
                              open: true,
                              type: "validator",
                              id: val.id,
                              title: `Hapus Data Validator: ${val.name}`,
                              subtitle: `Apakah Anda yakin ingin menghapus data penilaian dari "${val.name}" (${val.role?.toUpperCase()})? Seluruh jawaban 25 butir kuesioner, catatan lapangan, dan koreksi citra yang dimasukkan oleh validator ini akan dihapus permanen dari sistem.`,
                              isDeleting: false,
                            })
                          }
                          className="h-8 text-xs rounded-xl font-semibold border-red-200 text-red-600 hover:bg-red-50 hover:border-red-300 gap-1"
                        >
                          <Trash2 className="size-3.5" />
                          <span>Hapus Data</span>
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))
            )}
          </div>
        )}

        {/* ================= SUB-TAB 3: REKAP KOREKSI CITRA ================= */}
        {activeAdminTab === "corrections" && (
          <div className="space-y-4 animate-in fade-in duration-200">
            {/* Action Bar & Search */}
            <div className="flex flex-col sm:flex-row items-center justify-between gap-2.5">
              <div className="relative w-full sm:w-72">
                <Search className="size-3.5 absolute left-3 top-3 text-slate-400" />
                <Input
                  placeholder="Cari ID sampel, penyakit, catatan..."
                  value={correctionSearch}
                  onChange={(e) => setCorrectionSearch(e.target.value)}
                  className="pl-8 text-xs h-9 rounded-xl bg-white"
                />
              </div>
              <Button
                size="sm"
                variant="outline"
                onClick={exportCSV}
                className="w-full sm:w-auto h-9 text-xs rounded-xl gap-1.5"
              >
                <Download className="size-3.5" />
                <span>Download Rekap CSV (Excel)</span>
              </Button>
            </div>

            {/* List of Corrections */}
            {filteredCorrections.length === 0 ? (
              <div className="p-8 bg-white rounded-2xl border border-dashed border-slate-200 text-center text-xs text-slate-500">
                {correctionSearch ? "Tidak ada koreksi yang cocok dengan pencarian." : "Belum ada citra yang ditandai salah label."}
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
                {filteredCorrections.map((corr: any) => (
                  <Card key={corr.correction_id} className="rounded-2xl border-slate-200 shadow-xs overflow-hidden">
                    <div className="flex">
                      {/* Thumbnail Zoomable */}
                      <div
                        className="relative size-28 shrink-0 bg-slate-900 cursor-pointer group"
                        onClick={() =>
                          setZoomModal({
                            open: true,
                            imgUrl: corr.image_url,
                            title: corr.sample_id,
                            meta: `${corr.original_label} (${corr.location})`,
                          })
                        }
                      >
                        <Image
                          src={corr.image_url}
                          alt={corr.sample_id}
                          fill
                          className="object-cover group-hover:scale-105 transition"
                          unoptimized
                        />
                        <div className="absolute inset-0 bg-black/30 flex items-center justify-center opacity-0 group-hover:opacity-100 transition">
                          <ZoomIn className="size-4 text-white" />
                        </div>
                      </div>

                      {/* Content */}
                      <div className="p-3 flex-1 space-y-1.5">
                        <div className="flex items-center justify-between">
                          <span className="font-mono text-[9px] text-slate-400 truncate max-w-[150px]">
                            {corr.sample_id}
                          </span>
                          <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-slate-100 text-slate-700">
                            {corr.location}
                          </span>
                        </div>

                        <div>
                          <span className="text-[9px] text-slate-400 block">Label Peneliti:</span>
                          <span className="text-xs font-medium text-slate-500 line-through">
                            {corr.original_label}
                          </span>
                        </div>

                        <div>
                          <span className="text-[9px] text-amber-700 font-bold block">Koreksi Ahli:</span>
                          <span className="text-xs font-bold text-amber-800">
                            {corr.expert_diagnosis || "Tidak ditentukan"}
                          </span>
                        </div>

                        {corr.symptom_notes && (
                          <p className="text-[10px] text-slate-600 italic bg-amber-50/60 p-1.5 rounded-lg border border-amber-100 line-clamp-2">
                            "{corr.symptom_notes}"
                          </p>
                        )}

                        <div className="pt-2 flex items-center justify-between border-t border-slate-100">
                          <span className="text-[10px] text-slate-400 truncate max-w-[140px]">
                            Validator: {corr.validator_name || "-"}
                          </span>
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() =>
                              setDeleteModal({
                                open: true,
                                type: "correction",
                                id: corr.correction_id,
                                title: `Hapus Koreksi Sampel: ${corr.sample_id}`,
                                subtitle: `Apakah Anda yakin ingin membatalkan dan menghapus catatan koreksi ahli untuk sampel "${corr.sample_id}"? Sampel akan kembali ke status normal tanpa catatan koreksi.`,
                                isDeleting: false,
                              })
                            }
                            className="h-6 px-2 text-[10px] font-semibold text-red-600 hover:bg-red-50 hover:text-red-700 rounded-lg gap-1"
                          >
                            <Trash2 className="size-3" />
                            <span>Hapus</span>
                          </Button>
                        </div>
                      </div>
                    </div>
                  </Card>
                ))}
              </div>
            )}
          </div>
        )}
      </main>

      {/* FULLSCREEN IMAGE ZOOM MODAL */}
      <Dialog open={zoomModal.open} onOpenChange={(open) => setZoomModal({ ...zoomModal, open })}>
        <DialogContent className="max-w-lg p-0 overflow-hidden rounded-3xl bg-slate-950 border-0 text-white">
          <DialogHeader className="p-3 bg-slate-900 border-b border-slate-800">
            <DialogTitle className="text-xs font-mono font-bold text-slate-200">{zoomModal.title}</DialogTitle>
            <DialogDescription className="text-[11px] text-slate-400">{zoomModal.meta}</DialogDescription>
          </DialogHeader>
          <div className="relative aspect-square w-full bg-black flex items-center justify-center">
            {zoomModal.imgUrl && (
              <Image src={zoomModal.imgUrl} alt={zoomModal.title} fill className="object-contain" unoptimized />
            )}
          </div>
          <div className="p-2.5 bg-slate-900 flex justify-end">
            <Button
              size="sm"
              variant="secondary"
              onClick={() => setZoomModal({ ...zoomModal, open: false })}
              className="text-xs rounded-xl"
            >
              Tutup
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* DELETE CONFIRMATION DIALOG */}
      <Dialog
        open={deleteModal.open}
        onOpenChange={(open) => {
          if (!deleteModal.isDeleting) {
            setDeleteModal((prev) => ({ ...prev, open }));
          }
        }}
      >
        <DialogContent className="max-w-md p-5 rounded-2xl bg-white border border-slate-200 shadow-xl">
          <DialogHeader className="space-y-2">
            <div className="size-11 rounded-2xl bg-red-100 text-red-600 flex items-center justify-center mx-auto sm:mx-0 shadow-xs">
              <Trash2 className="size-5" />
            </div>
            <DialogTitle className="text-base font-bold text-slate-900">
              {deleteModal.title || "Konfirmasi Hapus Data"}
            </DialogTitle>
            <DialogDescription className="text-xs text-slate-600 leading-relaxed">
              {deleteModal.subtitle || "Apakah Anda yakin ingin menghapus data ini? Tindakan ini tidak dapat dibatalkan."}
            </DialogDescription>
          </DialogHeader>

          <div className="flex items-center justify-end gap-2 pt-4 border-t border-slate-100 mt-2">
            <Button
              type="button"
              variant="outline"
              disabled={deleteModal.isDeleting}
              onClick={() => setDeleteModal((prev) => ({ ...prev, open: false }))}
              className="h-9 px-4 text-xs font-semibold rounded-xl"
            >
              Batal
            </Button>
            <Button
              type="button"
              disabled={deleteModal.isDeleting}
              onClick={executeDelete}
              className="h-9 px-4 text-xs font-bold rounded-xl bg-red-600 hover:bg-red-700 text-white shadow-xs gap-1.5"
            >
              {deleteModal.isDeleting ? (
                <>
                  <RefreshCw className="size-3.5 animate-spin" />
                  <span>Menghapus...</span>
                </>
              ) : (
                <>
                  <Trash2 className="size-3.5" />
                  <span>Ya, Hapus Sekarang</span>
                </>
              )}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
