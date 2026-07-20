const siteUrl = (process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000').replace(/\/+$/, '');

export default function sitemap() {
  return ['/', '/bookings', '/order', '/feedback', '/login', '/signup'].map((path) => ({
    url: `${siteUrl}${path}`,
    lastModified: new Date(),
  }));
}
