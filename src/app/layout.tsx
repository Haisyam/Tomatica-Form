import type { Metadata, Viewport } from "next";
import { Roboto_Flex } from "next/font/google";
import "./globals.css";

const robotoFlex = Roboto_Flex({
  subsets: ["latin"],
  variable: "--font-roboto-flex",
  display: "swap",
});

export const metadata: Metadata = {
  metadataBase: new URL("https://tomatica.haisyam.dev"),
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
    url: "https://tomatica.haisyam.dev",
    siteName: "Tomatica",
    locale: "id_ID",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "Tomatica",
    description: "Platform Uji Validasi Model Prediktif Penyakit Tanaman Tomat, Evaluasi Dataset Citra Daun & Buah, dan Sensor Mikroklimat.",
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
