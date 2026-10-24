import { spawn } from "node:child_process";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const frontend = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const backend = resolve(frontend, "..", "backend");
const npm = process.platform === "win32" ? "npm.cmd" : "npm";
const children = [];

function start(command, args, cwd, env = process.env) {
  // Windows cannot spawn a .cmd shim (npm.cmd) directly in Node 24; run this
  // fixed, internal command through cmd.exe. Python remains a direct executable.
  const isWindowsCommandShim =
    process.platform === "win32" && command.toLowerCase().endsWith(".cmd");
  const executable = isWindowsCommandShim ? (process.env.ComSpec ?? "cmd.exe") : command;
  const commandArgs = isWindowsCommandShim
    ? ["/d", "/s", "/c", `${command} ${args.join(" ")}`]
    : args;
  const child = spawn(executable, commandArgs, {
    cwd,
    stdio: "inherit",
    env,
  });
  children.push(child);
  child.on("exit", (code) => {
    if (code && !process.exitCode) process.exitCode = code;
  });
  return child;
}

const apiHost = "127.0.0.1";
const apiPort = 8010;
const sharedEnv = {
  ...process.env,
  DJANGO_ALLOWED_HOSTS: "localhost,127.0.0.1",
  VITE_API_BASE_URL: `http://${apiHost}:${apiPort}`,
  VITE_USE_LOCAL_API_PROXY: "false",
  VITE_USE_MOCKS: "false",
};

console.log(`Starting Django API on http://${apiHost}:${apiPort} …`);
start(
  "python",
  ["manage.py", "runserver", `${apiHost}:${apiPort}`, "--noreload"],
  backend,
  sharedEnv,
);

console.log("Starting Vite frontend (preferring http://localhost:8090) …");
// Vite moves to the next available port if an older development tab/process is
// still open. It prints the precise URL to use, while retaining this API proxy.
start(npm, ["run", "dev", "--", "--port", "8090"], frontend, sharedEnv);

function stop() {
  for (const child of children) {
    if (!child.killed) child.kill();
  }
}

process.on("SIGINT", () => {
  stop();
  process.exit();
});
process.on("SIGTERM", () => {
  stop();
  process.exit();
});
