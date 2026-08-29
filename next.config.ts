import os from "os";
import type { NextConfig } from "next";
import path from "path";
import { fileURLToPath } from "url";

const projectRoot = path.dirname(fileURLToPath(import.meta.url));

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
    ],
  },
  serverExternalPackages: ["bcryptjs", "exceljs", "pdfkit", "googleapis", "@vercel/blob", "sharp"],
  experimental: {
    serverActions: {
      bodySizeLimit: "8mb",
    },
  },
  turbopack: {
    root: projectRoot,
  },
};

export default nextConfig;
