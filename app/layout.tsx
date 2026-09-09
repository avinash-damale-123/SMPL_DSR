import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "SMPL DSR Dashboard",
  description: "Sales and transaction monitoring for EUC and SML",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
