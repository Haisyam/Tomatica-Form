import type { Metadata, Viewport } from "next";
import { Roboto_Flex } from "next/font/google";
import "./globals.css";

const robotoFlex = Roboto_Flex({
  subsets: ["latin"],
  variable: "--font-roboto-flex",
  display: "swap",
});

const getBaseUrl = () => {
  if (process.env.NEXT_PUBLIC_SITE_URL) {
    const u = process.env.NEXT_PUBLIC_SITE_URL;
    return u.startsWith("http") ? u : `https://${u}`;
  }
  if (process.env.VERCEL_PROJECT_PRODUCTION_URL) {
    return `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`;
  }
  if (process.env.VERCEL_URL) {
    return `https://${process.env.VERCEL_URL}`;
  }
  return "http://localhost:3000";
};

const baseUrl = getBaseUrl();

export const metadata: Metadata = {
  metadataBase: new URL(baseUrl),
  title: "Tomatica",
  description: "Platform Uji Validasi Model Prediktif Penyakit Tanaman Tomat, Evaluasi Dataset Citra Daun & Buah, dan Sensor Mikroklimat.",
  keywords: ["Tomatica", "Penyakit Tomat", "Expert Judgment", "Validasi Model", "Agroklimat", "Fitopatologi", "POPT Sukabumi"],
  authors: [{ name: "Tomatica Research Team" }],
  icons: {
    icon: [
      { url: "/favicon.svg", type: "image/svg+xml" },
    ],
    shortcut: "/favicon.svg",
    apple: "/favicon.svg",
  },
  openGraph: {
    title: "Tomatica",
    description: "Platform Uji Validasi Model Prediktif Penyakit Tanaman Tomat, Evaluasi Dataset Citra Daun & Buah, dan Sensor Mikroklimat.",
    url: baseUrl,
    siteName: "Tomatica",
    locale: "id_ID",
    type: "website",
    images: [
      {
        url: "/og-image.png",
        width: 1200,
        height: 630,
        alt: "Tomatica - Validasi Model & Dataset Tanaman Tomat",
        type: "image/png",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "Tomatica",
    description: "Platform Uji Validasi Model Prediktif Penyakit Tanaman Tomat, Evaluasi Dataset Citra Daun & Buah, dan Sensor Mikroklimat.",
    images: [
      {
        url: "/og-image.png",
        width: 1200,
        height: 630,
        alt: "Tomatica - Validasi Model & Dataset Tanaman Tomat",
      },
    ],
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  viewportFit: "cover",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="id"
      className={`${robotoFlex.variable} h-full antialiased`}
      suppressHydrationWarning
    >
      <body
        className="min-h-full flex flex-col bg-slate-50 text-slate-900 selection:bg-emerald-100 selection:text-emerald-900 font-sans"
        suppressHydrationWarning
      >
        {children}
      </body>
    </html>
  );
}
