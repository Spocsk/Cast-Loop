import { existsSync } from "node:fs";
import { join, resolve } from "node:path";

const findMonorepoEnv = () => {
  let dir = import.meta.dirname;

  for (let i = 0; i < 10; i += 1) {
    const candidate = join(dir, ".env");

    if (existsSync(candidate)) {
      return candidate;
    }

    const parent = resolve(dir, "..");

    if (parent === dir) {
      break;
    }

    dir = parent;
  }

  return undefined;
};

const envFilePath = findMonorepoEnv();

if (envFilePath && typeof process.loadEnvFile === "function") {
  process.loadEnvFile(envFilePath);
}

/** @type {import('next').NextConfig} */
const nextConfig = {
  typedRoutes: true,
  output: "standalone",
  outputFileTracingRoot: resolve(import.meta.dirname, "../..")
};

export default nextConfig;
