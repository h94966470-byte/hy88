import type { NextConfig } from "next";
import JavaScriptObfuscator from "webpack-obfuscator";

const nextConfig: NextConfig = {
  productionBrowserSourceMaps: false,
  webpack: (config, { dev, isServer }) => {
    if (!dev && !isServer) {
      config.plugins.push(
        new JavaScriptObfuscator({
          compact: true,
          controlFlowFlattening: true,
          controlFlowFlatteningThreshold: 0.75,
          deadCodeInjection: false,
          disableConsoleOutput: true,
          identifierNamesGenerator: "hexadecimal",
          stringArray: true,
          stringArrayEncoding: ["base64"],
          stringArrayThreshold: 0.75,
        }),
      );
    }

    return config;
  },
};

export default nextConfig;
