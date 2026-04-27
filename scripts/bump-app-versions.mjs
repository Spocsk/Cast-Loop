#!/usr/bin/env node

import { execFileSync } from "node:child_process";
import { readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

const bumpType = process.argv[2] ?? "minor";
const supportedBumpTypes = new Set(["minor"]);

if (!supportedBumpTypes.has(bumpType)) {
  console.error(`Unsupported version bump "${bumpType}". Supported values: minor.`);
  process.exit(1);
}

const rootDir = resolve(new URL("..", import.meta.url).pathname);
const packagePaths = ["apps/web/package.json", "apps/api/package.json"];

const readJson = (path) => JSON.parse(readFileSync(resolve(rootDir, path), "utf8"));
const writeJson = (path, value) => {
  writeFileSync(resolve(rootDir, path), `${JSON.stringify(value, null, 2)}\n`);
};

const bumpMinor = (version) => {
  const match = version.match(/^(\d+)\.(\d+)\.(\d+)$/);

  if (!match) {
    throw new Error(`Version "${version}" is not a supported semver x.y.z value.`);
  }

  const major = Number(match[1]);
  const minor = Number(match[2]);

  return `${major}.${minor + 1}.0`;
};

const bumpedPackages = packagePaths.map((packagePath) => {
  const packageJson = readJson(packagePath);
  const previousVersion = packageJson.version;
  const nextVersion = bumpMinor(previousVersion);
  packageJson.version = nextVersion;
  writeJson(packagePath, packageJson);

  return {
    path: packagePath,
    name: packageJson.name,
    previousVersion,
    nextVersion
  };
});

const packageLockPath = "package-lock.json";
const packageLock = readJson(packageLockPath);

for (const bumpedPackage of bumpedPackages) {
  const packageEntry = packageLock.packages?.[bumpedPackage.path];

  if (packageEntry) {
    packageEntry.version = bumpedPackage.nextVersion;
  }
}

writeJson(packageLockPath, packageLock);

execFileSync("git", ["add", ...packagePaths, packageLockPath], {
  cwd: rootDir,
  stdio: "inherit"
});

for (const bumpedPackage of bumpedPackages) {
  console.log(`${bumpedPackage.name}: ${bumpedPackage.previousVersion} -> ${bumpedPackage.nextVersion}`);
}
