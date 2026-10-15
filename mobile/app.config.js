// Adds a base URL to app.json only when the build sets EXPO_BASE_URL.
//
// GitHub Pages serves this repository from a subpath. Local `expo start` must
// stay at the server root, so app.json does not hold the base URL.

module.exports = ({ config }) => {
  const baseUrl = process.env.EXPO_BASE_URL;
  if (!baseUrl) return config;
  return { ...config, experiments: { ...config.experiments, baseUrl } };
};
