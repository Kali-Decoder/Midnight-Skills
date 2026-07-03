import type { Metadata } from "next";
import { Montserrat, Orbitron } from "next/font/google";
import { ThemeProvider } from "@/components/providers/theme-provider";
import { ThemeModeNotice } from "@/components/shared/theme-mode-notice";
import { LayoutShell } from "@/components/layout/layout-shell";
import { NavbarWithAuth } from "@/components/layout/navbar-with-auth";
import { Toaster } from "sonner";
import { loadRegistry } from "@/lib/registry";
import "./globals.css";

const montserrat = Montserrat({
  subsets: ["latin"],
  variable: "--font-body",
  display: "swap",
});

const orbitron = Orbitron({
  subsets: ["latin"],
  variable: "--font-heading-face",
  display: "swap",
  weight: ["400", "500", "600", "700", "800", "900"],
});

const site = loadRegistry().site;

export const metadata: Metadata = {
  title: `${site?.name ?? "MIDSKILLS"} — Skill Marketplace for Midnight Network`,
  description: site?.description,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${montserrat.variable} ${orbitron.variable}`} suppressHydrationWarning>
      <body className="antialiased">
        <script
          dangerouslySetInnerHTML={{
            __html: `(function(){try{var t=localStorage.getItem("midskills-theme");if(t==="dark"||t==="light"){document.documentElement.dataset.theme=t;document.documentElement.style.colorScheme=t;}}catch(e){}})();`,
          }}
        />
        <ThemeProvider>
          <LayoutShell navbar={<NavbarWithAuth />}>{children}</LayoutShell>
          <Toaster />
          <ThemeModeNotice />
        </ThemeProvider>
      </body>
    </html>
  );
}
