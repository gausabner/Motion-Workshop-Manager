import type { NextConfig } from "next";

const nextConfig: NextConfig = {
    // pdfkit reads its standard-font metrics from files inside its own package at
    // runtime, so it has to stay out of the server bundle to keep finding them.
    serverExternalPackages: ["pdfkit"],
};

export default nextConfig;
