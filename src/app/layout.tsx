import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";

import { ThemeProvider } from "@/components/theme/theme-provider";
import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { accentBootstrapScript } from "@/lib/accent-cookie";
import { DEFAULT_ACCENT } from "@/lib/theme";

import "./globals.css";

const geist = Geist({
  variable: "--font-sans",
  subsets: ["latin"],
  display: "swap",
});

const geistMono = Geist_Mono({
  variable: "--font-mono",
  subsets: ["latin"],
  display: "swap",
});

export const metadata: Metadata = {
  title: {
    default: "Studi — Your space to study better",
    template: "%s · Studi",
  },
  description:
    "Plan your studies, stay focused, and make progress — all in one place.",
};

export const viewport: Viewport = {
  viewportFit: "cover",
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#F4EFEB" },
    { media: "(prefers-color-scheme: dark)", color: "#171315" },
  ],
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html
      lang="en"
      data-accent={DEFAULT_ACCENT}
      data-scroll-behavior="smooth"
      className={`${geist.variable} ${geistMono.variable} h-full`}
      suppressHydrationWarning
    >
      <head>
        <script
          dangerouslySetInnerHTML={{ __html: accentBootstrapScript }}
        />
      </head>
      <body className="min-h-full font-sans antialiased">
        <ThemeProvider defaultAccent={DEFAULT_ACCENT} defaultAppearance="system">
          <TooltipProvider>
            {children}
            <Toaster richColors closeButton position="bottom-right" />
          </TooltipProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
