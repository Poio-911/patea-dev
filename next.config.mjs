
/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  images: {
    remotePatterns: [
      { protocol: 'https', hostname: 'picsum.photos' },
      { protocol: 'https', hostname: 'lh3.googleusercontent.com' },
      { protocol: 'https', hostname: 'storage.googleapis.com' },
    ],
  },
  // Moved under experimental to satisfy Next.js config schema.
  experimental: {
    serverActions: {
      bodySizeLimit: '10mb',
      // allowedOrigins can be added here if needed
    },
  },
};

export default nextConfig;
