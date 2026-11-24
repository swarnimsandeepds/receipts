import "./globals.css";
import type { ReactNode } from "react";

export const metadata = {
  title: "Receipts",
  description: "No receipt, no outreach.",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body className="bg-white text-neutral-900 antialiased">{children}</body>
    </html>
  );
}
