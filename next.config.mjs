import withPWA from '@ducanh2912/next-pwa';

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,

  // Use server output mode instead of export for Firebase App Hosting
  output: 'standalone',

  // Disable source maps in production to avoid exposing file paths
  productionBrowserSourceMaps: false,

  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'picsum.photos',
      },
      {
        protocol: 'https',
        hostname: 'lh3.googleusercontent.com',
      },
      {
        protocol: 'https',
        hostname: 'storage.googleapis.com',
      },
    ],
  },

  // Skip trailing slash redirect to avoid generating error pages
  skipTrailingSlashRedirect: true,

  experimental: {
    serverActions: {
      bodySizeLimit: '10mb',
    },
  },

  // Disable static optimization completely
  generateBuildId: async () => {
    return 'build-' + Date.now();
  },

  // Webpack config to ensure clean paths
  webpack: (config, { isServer }) => {
    // Override default devtool to not include absolute paths
    if (!isServer) {
      config.devtool = false;
    }

    // Exclude genkit from client bundle
    if (!isServer) {
      config.resolve = config.resolve || {};
      config.resolve.alias = config.resolve.alias || {};
      config.resolve.alias['genkit'] = false;
      config.resolve.alias['@genkit-ai/core'] = false;
      config.resolve.alias['@opentelemetry/instrumentation'] = false;
    }

    return config;
  },
};

export default withPWA({
  dest: 'public',
  disable: process.env.NODE_ENV === 'development',
  register: true,
  skipWaiting: true,
})(nextConfig);
