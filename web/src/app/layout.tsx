import type { Metadata, Viewport } from "next";
import { Gowun_Batang, Gowun_Dodum } from "next/font/google";
import { AmplitudeInit } from "@/components/AmplitudeInit";
import { Footer } from "@/components/Footer";
import { SiteHeader } from "@/components/SiteHeader";
import "./globals.css";

const batang = Gowun_Batang({ weight: "700", subsets: ["latin"], display: "swap", preload: false, variable: "--font-batang" });
const dodum = Gowun_Dodum({ weight: "400", subsets: ["latin"], display: "swap", preload: false, variable: "--font-dodum" });

export const metadata: Metadata = {
  title: "갈피",
  description: "읽을 책, 갈피가 안 잡힐 때",
};

// No dark mode (DESIGN): opt out of browsers' automatic dark theme so the art keeps its colours.
export const viewport: Viewport = { colorScheme: "only light" };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ko" className={`${batang.variable} ${dodum.variable}`}>
      <body>
        <AmplitudeInit />
        <div className="column">
          <SiteHeader />
          <main>{children}</main>
          <Footer />
        </div>
      </body>
    </html>
  );
}
