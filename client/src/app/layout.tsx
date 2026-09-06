import type { Metadata, Viewport } from 'next';
import localFont from 'next/font/local';
import { site } from '../site';
import './globals.css';
const fredoka=localFont({src:'./fonts/Fredoka.ttf',variable:'--font-fredoka',weight:'400 700',display:'swap'});
export const metadata: Metadata = {
  metadataBase: new URL(site.url),
  title: { default: site.title, template: '%s | Duck Off' },
  description: site.description,
  applicationName: site.name,
  category: 'games',
  alternates: { canonical: '/' },
  manifest: '/site.webmanifest',
  icons: {
    icon: [
      { url: '/favicon.ico', sizes: '16x16 32x32 48x48', type: 'image/x-icon' },
      { url: '/favicon-16x16.png', sizes: '16x16', type: 'image/png' },
      { url: '/favicon-32x32.png', sizes: '32x32', type: 'image/png' },
      { url: '/favicon-96x96.png', sizes: '96x96', type: 'image/png' },
    ],
    apple: [{ url: '/apple-touch-icon.png', sizes: '180x180', type: 'image/png' }],
  },
  appleWebApp: { capable: true, title: site.name, statusBarStyle: 'default' },
  formatDetection: { telephone: false },
  openGraph: {
    type: 'website',
    locale: 'en_US',
    url: '/',
    siteName: site.name,
    title: site.title,
    description: site.description,
    images: [site.image],
  },
  twitter: {
    card: 'summary_large_image',
    title: site.title,
    description: site.description,
    images: [site.image],
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      'max-image-preview': 'large',
      'max-snippet': -1,
      'max-video-preview': -1,
    },
  },
};
export const viewport:Viewport={width:'device-width',initialScale:1,viewportFit:'cover',themeColor:site.themeColor,colorScheme:'light'};
export default function Layout({children}:{children:React.ReactNode}){return <html lang="en"><body className={fredoka.variable}>{children}</body></html>}
