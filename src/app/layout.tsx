import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Buffer Guard — Janu-worry Reserve & Retail Defense",
  description: "History-tracked South African budgeting engine modeling festive season retail and protected January buffers.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className="min-h-screen bg-slate-50 antialiased font-sans">{children}</body>
    </html>
  );
}
