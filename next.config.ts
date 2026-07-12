import type { NextConfig } from "next";

const isGitHubPages = process.env.GITHUB_PAGES === "true";
const repositoryName = process.env.GITHUB_REPOSITORY?.split("/")[1] ?? "focusflow";

const nextConfig: NextConfig = isGitHubPages
  ? {
      output: "export",
      basePath: `/${repositoryName}`,
      assetPrefix: `/${repositoryName}/`,
      images: {
        unoptimized: true,
      },
      trailingSlash: true,
    }
  : {};

export default nextConfig;
