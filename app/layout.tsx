import type { Metadata } from "next";
import { Inter, Plus_Jakarta_Sans } from "next/font/google";
import Script from "next/script";
import "./globals.css";
import { Providers } from "@/components/Providers";
import { cn } from "@/lib/utils";

const inter = Inter({ subsets: ["latin"], variable: "--font-sans" });
const display = Plus_Jakarta_Sans({
  subsets: ["latin"],
  weight: ["500", "600", "700", "800"],
  variable: "--font-display",
  fallback: ["ui-sans-serif", "system-ui", "Segoe UI", "Helvetica", "Arial", "sans-serif"],
  display: "swap",
});

export const metadata: Metadata = {
  title: "Kruti.io - AI-Powered LinkedIn Content Platform",
  description: "Kruti.io helps professionals create, schedule, and publish LinkedIn content using AI. Powered by Google Gemini.",
  verification: {
    google: "3PtMkclQtn24rcMvN_fMWe3gBTMiCSb8Bst-HbmcmbU",
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning className="scroll-smooth">
      <head>
        <Script async src="https://www.googletagmanager.com/gtag/js?id=G-S7N11CZFK4" strategy="afterInteractive" />
        <Script id="google-analytics" strategy="afterInteractive">
          {`
            window.dataLayer = window.dataLayer || [];
            function gtag(){dataLayer.push(arguments);}
            gtag('js', new Date());

            gtag('config', 'G-S7N11CZFK4');
          `}
        </Script>
      </head>
      <body className={cn(inter.className, inter.variable, display.variable, "bg-white dark:bg-gray-950 text-gray-900 dark:text-gray-100")}>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
