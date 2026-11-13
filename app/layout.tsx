import type { Metadata } from "next";
import { Kanit } from "next/font/google";
import "./globals.css";

const kanit = Kanit({
  subsets: ["thai", "latin"],
  weight: ["300", "400", "500", "600", "700"],
  display: "swap",
});

export const metadata: Metadata = {
  title: "ใบเสร็จรับเงิน - บ้านพักใจ",
  description: "ระบบออกใบเสร็จรับเงิน บริษัท บ้านพักใจ จำกัด",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="th">
      <body className={kanit.className}>{children}</body>
    </html>
  );
}
