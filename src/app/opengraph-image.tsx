import { ImageResponse } from "next/og";

export const runtime = "nodejs";
export const alt = "Tomatica - Validasi Model & Dataset Tanaman Tomat";
export const size = {
  width: 1200,
  height: 630,
};
export const contentType = "image/png";

export default function Image() {
  return new ImageResponse(
    (
      <div
        style={{
          height: "100%",
          width: "100%",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          backgroundColor: "#064e3b",
          color: "white",
          fontFamily: "sans-serif",
          padding: "60px",
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            width: "110px",
            height: "110px",
            borderRadius: "32px",
            backgroundColor: "#10b981",
            boxShadow: "0 12px 30px rgba(0,0,0,0.35)",
            fontSize: "64px",
            marginBottom: "20px",
          }}
        >
          🍅
        </div>

        <div
          style={{
            fontSize: "68px",
            fontWeight: 900,
            letterSpacing: "-0.03em",
            color: "#ffffff",
            marginBottom: "12px",
          }}
        >
          Tomatica
        </div>

        <div
          style={{
            fontSize: "26px",
            fontWeight: 600,
            color: "#a7f3d0",
            textAlign: "center",
            maxWidth: "850px",
            lineHeight: 1.35,
            marginBottom: "32px",
          }}
        >
          Uji Validasi Cross-Zone Model Prediktif Penyakit Tanaman Tomat
        </div>

        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: "16px",
          }}
        >
          <div
            style={{
              padding: "10px 24px",
              borderRadius: "9999px",
              backgroundColor: "rgba(255, 255, 255, 0.12)",
              border: "1px solid rgba(255, 255, 255, 0.2)",
              fontSize: "18px",
              color: "#ecfdf5",
              fontWeight: 600,
            }}
          >
            🌿 2.888 Citra Daun & Buah
          </div>
          <div
            style={{
              padding: "10px 24px",
              borderRadius: "9999px",
              backgroundColor: "rgba(255, 255, 255, 0.12)",
              border: "1px solid rgba(255, 255, 255, 0.2)",
              fontSize: "18px",
              color: "#ecfdf5",
              fontWeight: 600,
            }}
          >
            📡 Sensor IoT Mikroklimat
          </div>
          <div
            style={{
              padding: "10px 24px",
              borderRadius: "9999px",
              backgroundColor: "rgba(255, 255, 255, 0.12)",
              border: "1px solid rgba(255, 255, 255, 0.2)",
              fontSize: "18px",
              color: "#ecfdf5",
              fontWeight: 600,
            }}
          >
            📋 Expert Judgment Form
          </div>
        </div>
      </div>
    ),
    {
      ...size,
    }
  );
}
