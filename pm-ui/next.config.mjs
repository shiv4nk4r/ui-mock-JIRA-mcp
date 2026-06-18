/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: {
    serverComponentsExternalPackages: [
      "@modelcontextprotocol/sdk",
      "@anthropic-ai/claude-code",
    ],
  },
};

export default nextConfig;
