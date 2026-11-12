import type { Metadata } from "next";
import { Fraunces, Source_Sans_3 } from "next/font/google";

import { ThemeProvider } from "@/components/theme/theme-provider";
import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { accentBootstrapScript } from "@/lib/accent-cookie";
import { DEFAULT_ACCENT } from "@/lib/theme";

import "./globals.css";

const sourceSans = Source_Sans_3({
  variable: "--font-sans",
  subsets: ["latin"],
  display: "swap",
});

const fraunces = Fraunces({
  variable: "--font-display",
  subsets: ["latin"],
  display: "swap",
});

export const metadata: Metadata = {
  title: {
    default: "Studi — Study & productivity for university",
    template: "%s · Studi",
  },
  description:
    "A calm, Notion-inspired workspace for academic planning, focus, and studying together.",
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
      className={`${sourceSans.variable} ${fraunces.variable} h-full`}
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
