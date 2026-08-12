import type { Metadata } from "next";
import "./globals.css";

// Using the system font stack (set in globals.css) instead of a Google
// Font: it loads instantly with no network request, and works everywhere —
// including for non-Latin scripts like Falam Chin, which a downloaded Latin
// web font wouldn't cover anyway.

export const metadata: Metadata = {
  title: "WorshipFlow",
  description: "Church presentation and team scheduling",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className="h-full antialiased">
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
