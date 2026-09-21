import type { NextConfig } from "next";

const nextConfig: NextConfig = {
    // A self-contained server directory, so the runtime image carries the app
    // and the handful of packages it actually needs rather than node_modules.
    output: "standalone",
    // pdfkit reads its standard-font metrics from files inside its own package at
    // runtime, so it has to stay out of the server bundle to keep finding them.
    serverExternalPackages: ["pdfkit"],
};

export default nextConfig;
