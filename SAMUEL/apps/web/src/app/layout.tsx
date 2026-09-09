import type { Metadata, Viewport } from 'next';
import { PwaRegister } from '@/components/pwa/PwaRegister';
import './globals.css';

export const metadata: Metadata = {
  title: 'Rotas',
  description: 'Operações externas · Rotas',
  manifest: '/manifest.webmanifest',
  appleWebApp: {
    capable: true,
    title: 'Rotas',
    statusBarStyle: 'black-translucent',
  },
  icons: {
    apple: '/icons/icon-192.png',
  },
};

export const viewport: Viewport = {
  themeColor: '#121212',
  width: 'device-width',
  initialScale: 1,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
        <link
          href="https://fonts.googleapis.com/css2?family=Overpass:wght@400;500;600;700&display=swap"
          rel="stylesheet"
        />
      </head>
      <body className="min-h-screen bg-canvas font-sans antialiased text-brand-900">
        {/*
          THESIS: Operational dispatch console — density and consequence, not dashboard cards.
          OWN-WORLD: #121212 ground, #1C1C1E plates, #FF5722 the only interactive hue; Overpass; mint #2EE6C7 only on route polylines.
          STORY: Dispatcher or field tech knows where they are, what is late, and what to do next.
          FIRST VIEWPORT: Dark chrome. Situation first, then attention, then execution. One orange primary per view.
          FORM: Brief-pinned operational dark console (2026-09-06). Seed: brief-pinned.
          FINISH: unreviewed and undocumented is unfinished; this build ends with the finish review, the verdict, DESIGN.md, and every shipping raster carrying its provenance
        */}
        <PwaRegister />
        {children}
      </body>
    </html>
  );
}
