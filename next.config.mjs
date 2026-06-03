/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: {
    // Prevent webpack from bundling these ESM-only packages.
    // The MCP SDK (client/server/inMemory modules) and the AI SDKs all use
    // ESM syntax that webpack can't tree-shake in the App Router RSC context.
    // Listing them here lets Node.js require them natively at runtime.
    serverComponentsExternalPackages: [
      "@modelcontextprotocol/sdk",
      "@anthropic-ai/sdk",
      "@anthropic-ai/claude-code",
      "@google/generative-ai",
      "openai",
    ],
  },
};

export default nextConfig;
