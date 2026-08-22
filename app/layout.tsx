import type { Metadata } from "next";
import { env } from "@/lib/env";
import { AppShell } from "@/components/app-shell";
import "./globals.css";

export const metadata: Metadata = {
  title: "CARBONX",
  description: "Carbon-credit incident intelligence platform",
};

export const dynamic = "force-dynamic";

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  // Importing the server-only environment module here makes invalid
  // configuration fail before the application can serve a request.
  void env;

  return (
    <html lang="en">
      <body><AppShell>{children}</AppShell></body>
    </html>
  );
}
