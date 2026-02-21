import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "archon",
  description: "archon",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return children;
}
