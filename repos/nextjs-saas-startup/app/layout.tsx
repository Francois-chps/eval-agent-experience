import type { Metadata } from "next";
import type { ReactNode } from "react";
import Link from "next/link";
import "./globals.css";

export const metadata: Metadata = {
  title: "Tablo",
  description: "Team scheduling for independent restaurants.",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body>
        <header className="header">
          <Link href="/" className="logo">
            Tablo
          </Link>
          <nav className="nav">
            <Link href="/login">Log in</Link>
            <Link href="/signup">Sign up</Link>
          </nav>
        </header>
        {children}
      </body>
    </html>
  );
}
