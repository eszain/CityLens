import type { Metadata } from 'next';
import './globals.css';
import { DemoProvider } from '@/components/DemoProvider';

export const metadata: Metadata = {
  title: 'CityLens — Urban Heat Intelligence',
  description: 'Real-time urban heat island monitoring for climate justice. SDG 11 · SDG 13 · SDG 10',
  icons: { icon: '/favicon.ico' },
  openGraph: {
    title: 'CityLens',
    description: 'AI-powered heat vulnerability mapping for equitable cities.',
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
