export default function robots() {
  return {
    rules: {
      userAgent: '*',
      allow: '/',
    },
    sitemap: 'https://hammurabi-two.vercel.app/sitemap.xml',
  }
}