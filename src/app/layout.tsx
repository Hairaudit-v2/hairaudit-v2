import { SpeedInsights } from "@vercel/speed-insights/next";
import "./globals.css";
import { logAuthEnvHealthOnce } from "@/lib/auth/validateAuthEnv";

export default function RootLayout({ children }: { children: React.ReactNode }) {
  logAuthEnvHealthOnce();

  return (
    <html lang="en">
      <body className="min-h-screen">
        {children}
        <SpeedInsights />
      </body>
    </html>
  );
}
