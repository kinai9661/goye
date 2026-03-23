import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Generic Task Panel",
  description: "Compliant task dashboard powered by FastAPI and Next.js",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="zh-Hant">
      <body>{children}</body>
    </html>
  );
}
