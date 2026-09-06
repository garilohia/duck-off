import { ImageResponse } from 'next/og';
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { site } from '../site';

export const dynamic = 'force-static';
export const alt = site.image.alt;
export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';

export default async function Image() {
  const [duck, font] = await Promise.all([
    readFile(join(process.cwd(), 'public/android-chrome-512x512.png')),
    // Satori needs a static font; the app itself uses the variable original.
    readFile(join(process.cwd(), 'assets/branding/Fredoka-SemiBold.ttf')),
  ]);

  return new ImageResponse(
    (
      <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', background: site.themeColor, color: '#173d72', fontFamily: 'Fredoka', padding: 64 }}>
        <div style={{ display: 'flex', flexDirection: 'column', width: 620 }}>
          <div style={{ display: 'flex', fontSize: 104, fontWeight: 600, letterSpacing: -5 }}>
            Duck <span style={{ color: '#ed7054', marginLeft: 20 }}>Off</span>
          </div>
          <div style={{ fontSize: 36, marginTop: 24 }}>{site.slogan}</div>
          <div style={{ fontSize: 22, marginTop: 44, color: '#496681' }}>{new URL(site.url).hostname}</div>
        </div>
        <img src={`data:image/png;base64,${duck.toString('base64')}`} width={440} height={440} alt="" style={{ objectFit: 'contain' }} />
      </div>
    ),
    { ...size, fonts: [{ name: 'Fredoka', data: font, weight: 600, style: 'normal' }] },
  );
}
