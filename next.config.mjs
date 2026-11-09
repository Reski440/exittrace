// Playwright is only loaded dynamically inside the local test runner,
// never at build time on Vercel. Keep it external to server bundles.
/** @type {import('next').NextConfig} */
const config = {
  experimental: { serverComponentsExternalPackages: ['playwright'] },
}
export default config
