import type {NextConfig} from 'next'

const nextConfig: NextConfig = {
  transpilePackages: ['@repo/shared'],
  experimental: {
    typedEnv: true,
    browserDebugInfoInTerminal: true,
  },

  typedRoutes: true,
  images: {
    qualities: [70, 100],
  },
}

export default nextConfig
