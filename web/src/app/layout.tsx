import type { Metadata } from "next";
import { Gowun_Batang, Gowun_Dodum } from "next/font/google";
import { Footer } from "@/components/Footer";
import "./globals.css";

const batang = Gowun_Batang({ weight: "700", subsets: ["latin"], display: "swap", preload: false, variable: "--font-batang" });
const dodum = Gowun_Dodum({ weight: "400", subsets: ["latin"], display: "swap", preload: false, variable: "--font-dodum" });

export const metadata: Metadata = {
  title: "갈피",
  description: "읽을 책, 갈피가 안 잡힐 때",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ko" className={`${batang.variable} ${dodum.variable}`}>
      <body>
        <div className="column">
          <main>{children}</main>
          <Footer />
        </div>
      </body>
    </html>
  );
}
