import os from "os";
import path from "path";
import type { NextConfig } from "next";

function hostsRedLocal() {
  const hosts = new Set<string>(["localhost", "127.0.0.1", "127.0.0.1:3005"]);
  for (const infos of Object.values(os.networkInterfaces())) {
    for (const info of infos ?? []) {
      const familia = String(info.family);
      if ((familia === "IPv4" || familia === "4") && !info.internal) {
        hosts.add(info.address);
        hosts.add(`${info.address}:3005`);
      }
    }
  }
  return [...hosts];
}

const nextConfig: NextConfig = {
  turbopack: {
    root: path.resolve(__dirname),
  },
  allowedDevOrigins: hostsRedLocal(),
  images: {
    remotePatterns: [
      { protocol: "https", hostname: "images.openfoodfacts.org" },
      { protocol: "https", hostname: "static.openfoodfacts.org" },
      { protocol: "https", hostname: "images.openbeautyfacts.org" },
      { protocol: "https", hostname: "images.openproductsfacts.org" },
      { protocol: "https", hostname: "jumboargentina.vteximg.com.br" },
      { protocol: "https", hostname: "carrefourar.vteximg.com.br" },
      { protocol: "https", hostname: "discoargentina.vteximg.com.br" },
      { protocol: "https", hostname: "veaargentina.vteximg.com.br" },
      { protocol: "https", hostname: "**.vteximg.com.br" },
      { protocol: "https", hostname: "**.vtexassets.com" },
      { protocol: "https", hostname: "*.public.blob.vercel-storage.com" },
      { protocol: "https", hostname: "*.blob.vercel-storage.com" },
    ],
  },
  serverExternalPackages: [
    "bcryptjs",
    "exceljs",
    "pdfkit",
    "googleapis",
    "@vercel/blob",
    "@libsql/client",
    "sharp",
  ],
  experimental: {
    serverActions: {
      bodySizeLimit: "8mb",
    },
  },
  outputFileTracingIncludes: {
    "/*": ["./data/*.json"],
  },
};

export default nextConfig;
