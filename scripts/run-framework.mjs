import { spawn } from "node:child_process";
// The exported repository has no Sites build helpers or hosting manifest.
// Run its declared Next.js dependency directly; do not invent a Sites identity.
const mode = process.argv[2];
if (!["dev", "build", "start"].includes(mode))
  throw new Error("Expected dev, build or start");
// Accept the supervised preview's Vite-style flags without changing the app runtime.
const flags = process.argv
  .slice(3)
  .filter((arg) => arg !== "--strictPort")
  .map((arg) => (arg === "--host" ? "--hostname" : arg));
const child = spawn(
  process.execPath,
  ["node_modules/next/dist/bin/next", mode, ...flags],
  { stdio: "inherit" },
);
for (const signal of ["SIGINT", "SIGTERM"])
  process.on(signal, () => child.kill(signal));
child.on("exit", (code) => process.exit(code ?? 1));
