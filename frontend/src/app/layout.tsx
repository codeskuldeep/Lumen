import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { Providers } from "@/components/providers";
import "./globals.css";

const geistSans = Geist({ variable: "--font-geist-sans", subsets: ["latin"] });
const geistMono = Geist_Mono({ variable: "--font-geist-mono", subsets: ["latin"] });

export const metadata: Metadata = {
  title: { default: "Lumen — AI visibility for agencies", template: "%s · Lumen" },
  description: "Track whether ChatGPT and Google AI mention your clients' brands.",
};
export const viewport: Viewport = { themeColor: "#07060f" };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${geistSans.variable} ${geistMono.variable} grain`}>
      <body>
        <div className="aurora" aria-hidden><i /><i /><i /></div>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
