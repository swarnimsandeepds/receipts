/** @type {import('next').NextConfig} */
module.exports = {
  serverExternalPackages: ["@moss-js/moss", "@moss-js/moss-core", "@flexprice/sdk"],
  // NEXT_STATIC_EXPORT=1 builds the static UI bundle served by the Python backend (scripts/build_python_ui.sh).
  ...(process.env.NEXT_STATIC_EXPORT ? { output: "export" } : {}),
};
