import { spawn } from "node:child_process";
import { createServer } from "node:net";
import { setTimeout } from "node:timers/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const root = path.resolve(path.dirname(__filename), "..");

function getFreePort() {
  return new Promise((resolve, reject) => {
    const server = createServer();
    server.listen(0, () => {
      const port = server.address().port;
      server.close(() => resolve(port));
    });
    server.on("error", reject);
  });
}

async function fetchJson(url) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}

async function main() {
  const port = await getFreePort();
  const distPath = path.join(root, "integrations", "vendor", "agents-sms", "dist", "index.js");

  const env = {
    ...process.env,
    PORT: String(port),
    TRANSPORT: "sse",
    FIVESIM_API_KEY: "",
    SMSACTIVATE_API_KEY: "",
    ONLINESIM_API_KEY: "",
    CRYPTOBOT_TOKEN: "",
    MCP_SMS_API_KEY: "",
  };

  const proc = spawn("node", [distPath], {
    cwd: root,
    env,
    stdio: ["ignore", "pipe", "pipe"],
  });

  let stdout = "";
  let stderr = "";
  proc.stdout.on("data", (d) => { stdout += d; });
  proc.stderr.on("data", (d) => { stderr += d; });

  try {
    await setTimeout(2500);
    const health = await fetchJson(`http://localhost:${port}/health`);
    if (health.status !== "ok") {
      throw new Error(`Unexpected health status: ${JSON.stringify(health)}`);
    }
    console.log(`agents-sms smoke test passed: health=${health.status} providers=${JSON.stringify(health.providers)}`);
  } catch (err) {
    console.error("agents-sms smoke test failed:", err.message);
    console.error("stdout:", stdout);
    console.error("stderr:", stderr);
    process.exitCode = 1;
  } finally {
    proc.kill("SIGTERM");
    await setTimeout(500);
    if (!proc.killed) proc.kill("SIGKILL");
  }
}

main();
