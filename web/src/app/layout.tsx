import type { Metadata, Viewport } from "next";
import { Gowun_Batang, Gowun_Dodum } from "next/font/google";
import { AmplitudeInit } from "@/components/AmplitudeInit";
import { Footer } from "@/components/Footer";
import { LoginReturn } from "@/components/account/LoginReturn";
import { LoginSheet } from "@/components/account/LoginSheet";
import { SiteHeader } from "@/components/SiteHeader";
import "./globals.css";

const batang = Gowun_Batang({ weight: "700", subsets: ["latin"], display: "swap", preload: false, variable: "--font-batang" });
const dodum = Gowun_Dodum({ weight: "400", subsets: ["latin"], display: "swap", preload: false, variable: "--font-dodum" });

/** The public address, for the absolute URLs of the link preview card (set NEXT_PUBLIC_SITE_URL when the domain is connected). */
const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || "https://galpi-omega.vercel.app";
const DESCRIPTION = "읽을 책, 갈피가 안 잡힐 때 — 질문 몇 개면 책갈피가 한 권을 건네요";

// Link preview card (10-05, 시안 B): app/opengraph-image.png and twitter-image.png are picked up by file convention.
export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: "갈피",
  description: DESCRIPTION,
  openGraph: { type: "website", siteName: "갈피", locale: "ko_KR", title: "갈피", description: DESCRIPTION, url: "/" },
  twitter: { card: "summary_large_image", title: "갈피", description: DESCRIPTION },
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
          {/* after the page: TrackVisit's flow restore reads the login mark before LoginReturn takes it off the address */}
          <LoginReturn />
          <LoginSheet />
        </div>
      </body>
    </html>
  );
}
