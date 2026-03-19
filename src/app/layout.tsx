import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import ErrorBoundary from "@/components/layout/ErrorBoundary";
import HtmlLangSync from "@/components/layout/HtmlLangSync";
import { AuthProvider } from "@/components/auth/AuthProvider";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "CVzzer — Créez votre CV adapté à chaque offre d'emploi",
  description:
    "Créez votre CV, lettre de motivation et email de candidature adaptés à chaque offre d'emploi grâce à l'IA — 100% gratuit. Templates professionnels, PDF téléchargeable.",
  keywords: [
    "CV gratuit",
    "lettre de motivation",
    "IA",
    "générateur CV",
    "CV adapté",
    "candidature",
    "free CV builder",
    "AI resume",
  ],
  openGraph: {
    title: "CVzzer — Votre CV parfait en quelques minutes",
    description:
      "Collez votre expérience et l'offre d'emploi. Notre IA génère un CV adapté, une lettre de motivation et un email de candidature.",
    type: "website",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="fr">
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased min-h-screen flex flex-col`}
      >
        <ErrorBoundary>
          <AuthProvider>
            <HtmlLangSync />
            {children}
          </AuthProvider>
        </ErrorBoundary>
      </body>
    </html>
  );
}
