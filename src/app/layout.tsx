import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { ThemeProvider } from "@/contexts/ThemeContext";
import { AuthProvider } from "@/contexts/AuthContext";
import { Toaster } from "@/components/ui/sonner";
import Script from "next/script";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Blumenote – AI Notes Assistant, Summaries, Flashcards , Quizzes, Podcasts, and More",
  description:
    "Upload PDFs, documents, webpages, YouTube videos, or write your own notes with the AI-powered editor.Transform any content into summaries, quizzes, flashcards, podcasts, and smart study notes using AI. Study smarter with Blumenote.",
  keywords: [
    "AI notes",
    "AI summarizer",
    "flashcards generator",
    "quiz generator",
    "study tool",
    "PDF summarizer",
    "note taking app",
    "AI study assistant",
    "YouTube transcript",
    "audio transcription",
    "YouTube summarizer",
    "AI podcast",
    "meeting note taker",
    "meeting summarizer",
    "document summarizer",
    "webpage summarizer"
  ],
  openGraph: {
    title: "Blumenote – Turn Any Content Into Smart Study Notes",
    description:
      "Upload content → Get AI Assistant that writes summaries, quizzes, flashcards, podcasts, and more. Study smarter with Blumenote.",
    url: "https://blumenote.com",
    siteName: "Blumenote",
    images: [
      {
        url: "/public/dashboard.jpg",
        width: 1200,
        height: 630,
        alt: "Blumenote AI Preview"
      }
    ],
    type: "website"
  },
  // Link favicon & PWA assets
  icons: {
    icon: [
      { url: "/favicon.ico" },
      { url: "/favicon-16x16.png", sizes: "16x16", type: "image/png" },
      { url: "/favicon-32x32.png", sizes: "32x32", type: "image/png" },
      { url: "/android-chrome-192x192.png", sizes: "192x192", type: "image/png" },
      { url: "/android-chrome-512x512.png", sizes: "512x512", type: "image/png" }
    ],
    apple: "/apple-touch-icon.png",
    shortcut: "/favicon.ico"
  },
  manifest: "/site.webmanifest",
  themeColor: "#ffffff"
};


export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        {/* Razorpay checkout script */}
        <Script src="https://checkout.razorpay.com/v1/checkout.js" strategy="afterInteractive" />
        <ThemeProvider>
          <AuthProvider>
            {children}
            {/* Global toast notifications */}
            <Toaster />
          </AuthProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
