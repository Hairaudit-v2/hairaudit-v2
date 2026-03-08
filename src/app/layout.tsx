import { SpeedInsights } from "@vercel/speed-insights/next";
import "./globals.css";
import { logAuthEnvHealthOnce } from "@/lib/auth/validateAuthEnv";
import RecoveryHashRouter from "@/components/RecoveryHashRouter";

export default function RootLayout({ children }: { children: React.ReactNode }) {
  logAuthEnvHealthOnce();

  return (
    <html lang="en">
      <body className="min-h-screen">
        <RecoveryHashRouter />
        {children}
        <SpeedInsights />
      </body>
    </html>
  );
}
