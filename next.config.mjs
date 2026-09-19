/** @type {import('next').NextConfig} */
const nextConfig = {
  output: process.env.VERCEL ? undefined : 'standalone',
  typescript: {
    ignoreBuildErrors: true,
  },
  images: {
    unoptimized: true,
  },
}

export default nextConfig

