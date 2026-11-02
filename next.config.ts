import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  reactStrictMode: true,
  images: {
    domains: [
      'images.unsplash.com',
      'avatars.githubusercontent.com',
      'api.dicebear.com',
      'www.paypalobjects.com'
    ]
  }
};

export default nextConfig;

