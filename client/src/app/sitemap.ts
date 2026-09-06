import type { MetadataRoute } from 'next';
import { site } from '../site';

export const dynamic = 'force-static';

export default function sitemap(): MetadataRoute.Sitemap {
  // Rooms use query strings on the homepage, not separate indexable pages.
  return [{ url: `${site.url}/` }];
}
