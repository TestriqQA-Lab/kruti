import type { Metadata } from "next";
import { Inter, Fraunces } from "next/font/google";
import "./globals.css";
import { Providers } from "@/components/Providers";
import { cn } from "@/lib/utils";

const inter = Inter({ subsets: ["latin"], variable: "--font-sans" });
const fraunces = Fraunces({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-display",
  fallback: ["Georgia", "Cambria", "Times New Roman", "serif"],
  display: "swap",
});

export const metadata: Metadata = {
  title: "Kruti.io — AI-Powered LinkedIn Content Platform",
  description: "Kruti.io helps professionals create, schedule, and publish LinkedIn content using AI. Powered by Google Gemini.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className={cn(inter.className, inter.variable, fraunces.variable, "bg-white dark:bg-gray-950 text-gray-900 dark:text-gray-100")}>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
