import type { Metadata } from 'next';
import './globals.css';
import { DemoProvider } from '@/components/DemoProvider';

export const metadata: Metadata = {
  title: 'CityLens',
  description:
    'Block-level mapping for heat, equity, canopy, flood risk, and air quality — aligned with climate justice. SDG 11 · SDG 13 · SDG 10',
  icons: { icon: [{ url: '/logo.png', type: 'image/png' }] },
  openGraph: {
    title: 'CityLens',
    description:
      'Multi-lens urban mapping: heat vulnerability, tree canopy, flood risk, air quality, and income equity on one map.',
    type: 'website',
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body>
        <DemoProvider>
          {children}
        </DemoProvider>
      </body>
    </html>
  );
}
