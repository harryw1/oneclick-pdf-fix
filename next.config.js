/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: {
    serverComponentsExternalPackages: ['sharp', 'pdf-lib', '@google-cloud/vision'],
  },
  eslint: {
    // Only run ESLint on specific directories to avoid dependency warnings
    dirs: ['src/pages', 'src/components', 'src/utils', 'src/types'],
  },
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: '**',
      },
    ],
  },
}

module.exports = nextConfig