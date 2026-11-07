import type { Metadata, Viewport } from "next";
import { Bricolage_Grotesque, Figtree } from "next/font/google";
import { Suspense, type ReactNode } from "react";
import { AppShell } from "@/components/app-shell";
import { AuthProvider } from "@/modules/auth/auth-provider";
import { CloudSync } from "@/modules/auth/cloud-sync";
import { StoreProvider } from "@/modules/board/store";
import { UrlStateLoader } from "@/modules/board/url-state";
import "./globals.css";

const heading = Bricolage_Grotesque({ subsets: ["latin"], variable: "--font-heading" });
const body = Figtree({ subsets: ["latin"], variable: "--font-body" });

export const metadata: Metadata = {
  title: "PieceWise: find AI tools that fit your business",
  description:
    "See which AI tools actually fit the systems your small business already runs, what they really cost, and how to start.",
};

export const viewport: Viewport = { width: "device-width", initialScale: 1 };

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en" className={`${heading.variable} ${body.variable}`}>
      <body>
        <AuthProvider>
          <StoreProvider>
            <CloudSync>
              <Suspense fallback={null}>
                <UrlStateLoader />
              </Suspense>
              <AppShell>{children}</AppShell>
            </CloudSync>
          </StoreProvider>
        </AuthProvider>
      </body>
    </html>
  );
}
