import { fileURLToPath } from "url";
import { dirname } from "path";

const __dirname = dirname(fileURLToPath(import.meta.url));

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // Projektordner explizit als Tracing-Root setzen (es liegt ein fremdes
  // package-lock.json im Home-Verzeichnis, das Next sonst faelschlich waehlt).
  outputFileTracingRoot: __dirname,
  // maplibre-gl wird nur clientseitig geladen (siehe components/MapView via next/dynamic).
};

export default nextConfig;
