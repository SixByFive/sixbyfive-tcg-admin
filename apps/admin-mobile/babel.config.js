module.exports = function (api) {
  api.cache(true);
  return {
    presets: [
      ["babel-preset-expo", { jsxImportSource: "nativewind" }],
    ],
    // NOTE: do NOT add "nativewind/babel" here — it exports a config object
    // (not a plugin function) and causes ".plugins is not a valid Plugin property".
    // withNativeWind() in metro.config.js handles the CSS interop instead.
  };
};
