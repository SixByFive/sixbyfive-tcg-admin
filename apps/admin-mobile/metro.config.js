const { getDefaultConfig } = require("expo/metro-config");
const { withNativeWind } = require("nativewind/metro");
const path = require("path");

const projectRoot  = __dirname;
const monorepoRoot = path.resolve(projectRoot, "../..");

const config = getDefaultConfig(projectRoot);

config.watchFolders = [monorepoRoot];
config.resolver.nodeModulesPaths = [
  path.resolve(projectRoot,  "node_modules"),
  path.resolve(monorepoRoot, "node_modules"),
];
// pnpm uses symlinks into a .pnpm store — tell Metro not to follow them
// into the real path, but resolve relative to the symlink location instead.
config.resolver.unstable_enableSymlinks = true;

// Force react and react-native to always resolve from the app's own
// node_modules. In a pnpm monorepo, workspace package symlinks can cause
// Metro to find a second copy of React which resolves to null at runtime.
const FORCE_FROM_APP = ["react", "react-native", "react-native/"];
config.resolver.resolveRequest = (context, moduleName, platform) => {
  if (FORCE_FROM_APP.some((m) => moduleName === m || moduleName.startsWith(m))) {
    return context.resolveRequest(
      { ...context, originModulePath: path.join(projectRoot, "index.js") },
      moduleName,
      platform
    );
  }
  return context.resolveRequest(context, moduleName, platform);
};

module.exports = withNativeWind(config, { input: "./global.css" });
