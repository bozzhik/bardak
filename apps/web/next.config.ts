import type {NextConfig} from 'next'

const nextConfig: NextConfig = {
  experimental: {
    typedEnv: true,
  },

  output: 'standalone',
  transpilePackages: ['@repo/shared'],

  // typedRoutes: true,
  logging: {browserToTerminal: true},
  images: {
    qualities: [70, 100],
  },
}

export default nextConfig
