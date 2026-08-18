import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Lets the dev server be reached from a phone on the same Wi-Fi (e.g. http://192.168.x.x:3000)
  // without Next.js blocking its own JS chunk/HMR requests as cross-origin.
  allowedDevOrigins: process.env.DEV_LAN_ORIGIN ? [process.env.DEV_LAN_ORIGIN] : undefined,
};

export default nextConfig;
