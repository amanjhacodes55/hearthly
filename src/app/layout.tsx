import type { Metadata, Viewport } from "next";
import { Fraunces, Plus_Jakarta_Sans } from "next/font/google";
import "./globals.css";
import Providers from "@/components/Providers";

const body = Plus_Jakarta_Sans({ subsets: ["latin"], variable: "--font-body", display: "swap" });
const heading = Fraunces({ subsets: ["latin"], variable: "--font-heading", display: "swap", axes: ["SOFT", "opsz"] });

export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXTAUTH_URL || process.env.RENDER_EXTERNAL_URL || "http://localhost:3005"),
  title: { default: "Hearthly — conversations that feel like home", template: "%s · Hearthly" },
  description: "Hearthly is open-source customer messaging: a warm chat widget, a shared realtime inbox, CRM, automations, a help center and a real developer platform.",
  applicationName: "Hearthly",
  openGraph: { type: "website", siteName: "Hearthly", title: "Hearthly — conversations that feel like home", description: "Open-source live chat, shared inbox, CRM and developer API. Free forever, AGPL-3.0." },
  twitter: { card: "summary_large_image", title: "Hearthly — conversations that feel like home", description: "Open-source live chat, shared inbox, CRM and developer API." },
};
export const viewport: Viewport = { themeColor: [{ media: "(prefers-color-scheme: light)", color: "#fbf7f2" }, { media: "(prefers-color-scheme: dark)", color: "#1a1123" }] };

// Sets the theme before paint (no flash). Static string, no user input.
const themeScript = `(function(){try{var t=localStorage.getItem('hearthly-theme')||'system';var d=t==='dark'||(t==='system'&&matchMedia('(prefers-color-scheme: dark)').matches);document.documentElement.dataset.theme=d?'dark':'light'}catch(e){}})()`;

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning className={`${body.variable} ${heading.variable}`}>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
      </head>
      <body>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
