const { spawn, execSync } = require("node:child_process");
const { createRequire } = require("node:module");
const { randomUUID } = require("node:crypto");
const fs = require("node:fs");
const os = require("node:os");
const http = require("node:http");
const path = require("node:path");
const { app } = require("electron");

const electronRequire = createRequire(__filename);
const desktopPkg = electronRequire("../package.json");
const { revision: expectedApiRevision } = electronRequire(
  "@writer/contracts/daemon-api-revision.json"
);

const expectedVersion = desktopPkg.version;
const autostartDisabled =
  process.env.WRITER_DAEMON_AUTOSTART === "0" || process.env.WRITER_DAEMON_AUTOSTART === "false";
const daemonHost = process.env.WRITER_DAEMON_HOST ?? "127.0.0.1";
const daemonPort = Number(process.env.WRITER_DAEMON_PORT ?? 47631);
const healthUrl = `http://${daemonHost}:${daemonPort}/health`;
const repoRoot = path.resolve(__dirname, "..", "..", "..");
const daemonDir = path.join(repoRoot, "apps", "daemon");
const startupTimeoutMs = 30_000;
const pollIntervalMs = 250;

/** @type {import("node:child_process").ChildProcess | null} */
let managedChild = null;
let spawnedByDesktop = false;

// Desktop-side daemon lifecycle log. In a packaged GUI build the Electron
// process has no visible console, so console output (and the daemon child's
// piped stderr) is lost. Persisting it next to the daemon's own log gives a
// single place to read when "Daemon did not become ready" appears.
const spawnLogDir = process.env.WRITER_DAEMON_LOG_DIR ?? path.join(os.homedir(), ".writer", "logs");
const spawnLogFile = path.join(spawnLogDir, "daemon-spawn.log");

// Shared secret between the daemon and the renderer (read at preload from the
// same file). The daemon historically minted a fresh randomUUID() on every
// start, so any daemon restart silently invalidated the token the renderer had
// already captured — every subsequent request 401'd (surfacing as a cryptic
// "Unexpected end of JSON input" in the UI). Persist the token once and pass it
// to every spawned daemon so it stays stable across restarts.
const daemonTokenFile = path.join(os.homedir(), ".writer", "daemon-token");

function resolveDaemonToken() {
  if (process.env.WRITER_DAEMON_TOKEN) {
    return process.env.WRITER_DAEMON_TOKEN;
  }
  try {
    const existing = fs.readFileSync(daemonTokenFile, "utf8").trim();
    if (existing) return existing;
  } catch {
    // No token file yet — generate and persist one below.
  }
  const token = randomUUID();
  try {
    fs.mkdirSync(path.dirname(daemonTokenFile), { recursive: true });
    fs.writeFileSync(daemonTokenFile, token, { mode: 0o600 });
  } catch {
    // Best-effort: the daemon also writes this file on startup.
  }
  return token;
}

const daemonToken = resolveDaemonToken();

function appendSpawnLog(text) {
  try {
    fs.mkdirSync(spawnLogDir, { recursive: true });
    fs.appendFileSync(spawnLogFile, text, "utf8");
  } catch {
    // Best-effort: never let logging break daemon startup.
  }
}

function log(message, meta) {
  const suffix = meta ? ` ${JSON.stringify(meta)}` : "";
  const line = `[writer-desktop] ${message}${suffix}`;
  console.log(line);
  appendSpawnLog(
    `${JSON.stringify({ timestamp: new Date().toISOString(), message, ...(meta ? { meta } : {}) })}\n`
  );
}

function fetchHealth() {
  return new Promise((resolve) => {
    const request = http.get(healthUrl, (response) => {
      let body = "";
      response.on("data", (chunk) => {
        body += chunk;
      });
      response.on("end", () => {
        if (response.statusCode !== 200) {
          resolve(null);
          return;
        }

        try {
          const payload = JSON.parse(body);
          if (typeof payload.version !== "string") {
            resolve(null);
            return;
          }

          resolve({
            version: payload.version,
            apiRevision:
              typeof payload.apiRevision === "string" ? payload.apiRevision : "",
            packaged: payload.packaged === true
          });
        } catch {
          resolve(null);
        }
      });
    });

    request.on("error", () => resolve(null));
    request.setTimeout(2_000, () => {
      request.destroy();
      resolve(null);
    });
  });
}

function isCompatible(health) {
  return (
    health !== null &&
    health.version === expectedVersion &&
    health.apiRevision === expectedApiRevision &&
    // A packaged app must not reuse a dev daemon — it lacks WRITER_RESOURCES_PATH
    // and cannot find llama-cli, breaking model download and VRAM detection.
    (!app.isPackaged || health.packaged === true)
  );
}

function shouldRestart(health) {
  return health !== null && !isCompatible(health);
}

function killProcessesOnPort(port) {
  try {
    let pids = [];
    if (process.platform === "win32") {
      // netstat output: "  TCP  0.0.0.0:47631  ...  LISTENING  <pid>"
      // -p TCP limits output to TCP connections only, significantly reducing
      // the output size (and parse time) on machines with many connections.
      const output = execSync(`netstat -p TCP -ano`, { encoding: "utf8" });
      for (const line of output.split("\n")) {
        if (line.includes(`:${port}`) && line.includes("LISTENING")) {
          const parts = line.trim().split(/\s+/);
          const pid = Number(parts[parts.length - 1]);
          if (Number.isInteger(pid) && pid > 0) pids.push(pid);
        }
      }
    } else {
      const output = execSync(`lsof -ti tcp:${port}`, { encoding: "utf8" }).trim();
      if (output) {
        pids = output.split("\n").map(Number).filter((n) => Number.isInteger(n) && n > 0);
      }
    }

    for (const pid of pids) {
      try {
        process.kill(pid, "SIGTERM");
      } catch {
        // Process may have already exited.
      }
    }
  } catch {
    // Nothing listening on the port.
  }
}

function waitForExit(child, timeoutMs = 5_000) {
  return new Promise((resolve) => {
    if (child.exitCode !== null) {
      resolve();
      return;
    }

    const timer = setTimeout(resolve, timeoutMs);
    child.once("exit", () => {
      clearTimeout(timer);
      resolve();
    });
  });
}

async function stopExistingDaemon() {
  if (managedChild) {
    managedChild.kill("SIGTERM");
    await waitForExit(managedChild);
    managedChild = null;
  }

  killProcessesOnPort(daemonPort);
  await new Promise((resolve) => setTimeout(resolve, 400));
}

function resolveTsxExecutable() {
  const binName = process.platform === "win32" ? "tsx.cmd" : "tsx";
  return path.join(repoRoot, "node_modules", ".bin", binName);
}

function resolvePackagedDaemon() {
  const resourcesPath = process.resourcesPath;
  const nodeExe = process.platform === "win32" ? "node.exe" : "node";
  return {
    nodePath: path.join(resourcesPath, "daemon", nodeExe),
    daemonBundle: path.join(resourcesPath, "daemon", "daemon.mjs")
  };
}

/** Append a Node CLI option to an existing NODE_OPTIONS string, avoiding duplicates. */
function appendNodeOption(existing, option) {
  const current = (existing ?? "").trim();
  if (current.split(/\s+/).includes(option)) {
    return current;
  }
  return current ? `${current} ${option}` : option;
}

function spawnDaemon() {
  let executable, args, cwd, useShell;

  if (app.isPackaged) {
    const { nodePath, daemonBundle } = resolvePackagedDaemon();
    // Fail loudly with an actionable message if the bundled runtime is missing
    // (e.g. an incomplete build, or antivirus quarantined node.exe). Without
    // this, a missing file surfaces only as the generic 30s timeout.
    for (const [label, target] of [["node runtime", nodePath], ["daemon bundle", daemonBundle]]) {
      if (!fs.existsSync(target)) {
        const message = `Packaged ${label} is missing at ${target}`;
        log(message);
        throw new Error(message);
      }
    }
    executable = nodePath;
    args = [daemonBundle];
    cwd = path.dirname(daemonBundle);
    useShell = false;
  } else {
    const tsxExecutable = resolveTsxExecutable();
    // On Windows the tsx launcher is a `.cmd` shim, which node's spawn cannot
    // execute directly (it fails with EINVAL). Route it through the shell there.
    // Safe to do here: the arguments are fixed and trusted (no user input), so
    // there is nothing to inject.
    executable = tsxExecutable;
    args = ["src/index.ts"];
    cwd = daemonDir;
    useShell = process.platform === "win32";
  }

  log("Spawning daemon", { executable, args, cwd, packaged: app.isPackaged });

  const child = spawn(executable, args, {
    cwd,
    shell: useShell,
    env: {
      ...process.env,
      WRITER_DAEMON_HOST: daemonHost,
      WRITER_DAEMON_PORT: String(daemonPort),
      WRITER_DAEMON_TOKEN: daemonToken,
      WRITER_DAEMON_VERSION: expectedVersion,
      WRITER_DAEMON_API_REVISION: expectedApiRevision,
      // Trust the OS certificate store so remote MCP servers (e.g. Figma at
      // https://mcp.figma.com) connect on machines behind a TLS-inspecting
      // corporate proxy that re-signs HTTPS with its own root CA. Without this,
      // Node's bundled CA store rejects the proxy cert ("fetch failed" /
      // SELF_SIGNED_CERT_IN_CHAIN). Append to any existing NODE_OPTIONS.
      NODE_OPTIONS: appendNodeOption(process.env.NODE_OPTIONS, "--use-system-ca"),
      // Pass the Electron resources path so the daemon can find bundled binaries
      // (e.g. llama-cli / llama-cli.exe) in production builds.
      ...(process.resourcesPath ? { WRITER_RESOURCES_PATH: process.resourcesPath } : {}),
      WRITER_DAEMON_PACKAGED: String(app.isPackaged)
    },
    stdio: ["ignore", "pipe", "pipe"],
    detached: false
  });

  child.on("error", (error) => {
    // Without this handler a spawn failure (e.g. EINVAL launching the tsx
    // shim, or ENOENT / antivirus block on the packaged node.exe) is swallowed
    // and the daemon silently never starts.
    log("Managed daemon failed to spawn", { message: error.message, code: error.code });
  });

  // Mirror the daemon's own stdout/stderr into the persisted spawn log. This is
  // the only place a pre-listen crash stack (printed via console.error in the
  // daemon) is captured in a packaged build with no visible console.
  child.stdout?.on("data", (chunk) => {
    process.stdout.write(chunk);
    appendSpawnLog(chunk.toString());
  });
  child.stderr?.on("data", (chunk) => {
    process.stderr.write(chunk);
    appendSpawnLog(chunk.toString());
  });
  child.on("exit", (code, signal) => {
    if (managedChild === child) {
      managedChild = null;
      spawnedByDesktop = false;
    }
    log("Managed daemon exited", { code, signal });
  });

  managedChild = child;
  spawnedByDesktop = true;
  return child;
}

async function waitForHealthyDaemon() {
  const deadline = Date.now() + startupTimeoutMs;

  while (Date.now() < deadline) {
    const health = await fetchHealth();
    if (isCompatible(health)) {
      return health;
    }

    await new Promise((resolve) => setTimeout(resolve, pollIntervalMs));
  }

  throw new Error(`Daemon did not become ready at ${healthUrl} within ${startupTimeoutMs}ms`);
}

async function ensureDaemonRunning() {
  if (autostartDisabled) {
    log("Daemon autostart disabled (WRITER_DAEMON_AUTOSTART=false)");
    return fetchHealth();
  }

  let health = await fetchHealth();
  if (isCompatible(health)) {
    log("Using existing daemon", health);
    return health;
  }

  if (shouldRestart(health)) {
    log("Restarting stale daemon", { current: health, expected: { version: expectedVersion, apiRevision: expectedApiRevision } });
    await stopExistingDaemon();
  } else if (!health) {
    log("Daemon not reachable; starting managed daemon");
  }

  spawnDaemon();
  health = await waitForHealthyDaemon();
  log("Daemon ready", health);
  return health;
}

async function stopManagedDaemon() {
  if (!spawnedByDesktop || !managedChild) {
    return;
  }

  managedChild.kill("SIGTERM");
  await waitForExit(managedChild);
  managedChild = null;
  spawnedByDesktop = false;
}

module.exports = {
  ensureDaemonRunning,
  stopManagedDaemon
};
