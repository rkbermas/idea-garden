import type { Metadata, Viewport } from "next";
import "@fontsource-variable/literata/opsz.css";
import "@fontsource-variable/literata/opsz-italic.css";
import "@fontsource-variable/instrument-sans/wdth.css";
import "./globals.css";

export const metadata: Metadata = {
  title: { default: "Idea Garden", template: "%s · Idea Garden" },
  description: "A personal bank of ideas you've encountered and want to keep thinking about.",
  icons: { icon: "/icon.svg" },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#F6F7F3" },
    { media: "(prefers-color-scheme: dark)", color: "#121614" },
  ],
};

// Apply the saved theme before first paint so there's no flash.
const themeScript = `(function(){try{var t=localStorage.getItem('idea-garden:theme')||'system';var d=t==='dark'||(t==='system'&&matchMedia('(prefers-color-scheme: dark)').matches);document.documentElement.classList.toggle('dark',d);}catch(e){}})();`;

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
      </head>
      <body>{children}</body>
    </html>
  );
}
