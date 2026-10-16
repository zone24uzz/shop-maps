import type { Metadata, Viewport } from 'next';
import { Barlow, Barlow_Semi_Condensed } from 'next/font/google';
import type { ReactNode } from 'react';
// Leaflet's stylesheet is global and must load before our overrides in globals.css.
import 'leaflet/dist/leaflet.css';
import './globals.css';

// Barlow is drawn after highway signage lettering, which suits a product about
// roads and deliveries. Both families are self-hosted by next/font at build time.
const barlow = Barlow({
  subsets: ['latin', 'latin-ext'],
  weight: ['400', '500', '600'],
  variable: '--font-barlow',
  display: 'swap',
});

const barlowSemiCondensed = Barlow_Semi_Condensed({
  subsets: ['latin', 'latin-ext'],
  weight: ['600'],
  variable: '--font-barlow-semi-condensed',
  display: 'swap',
});

export const metadata: Metadata = {
  title: 'Logistics Map: Toshkent do‘konlari xaritasi',
  description:
    'Toshkent shahridagi do‘konlar va logistika nuqtalarini xaritada ko‘rish, qidirish va tanlash paneli.',
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  themeColor: '#16202e',
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="uz" className={`${barlow.variable} ${barlowSemiCondensed.variable}`}>
      <body>{children}</body>
    </html>
  );
}
