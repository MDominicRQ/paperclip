import fs from "node:fs/promises";
import path from "node:path";
import type {
  AdapterEnvironmentCheck,
  AdapterEnvironmentTestContext,
  AdapterEnvironmentTestResult,
} from "@paperclipai/adapter-utils";
import { parseObject } from "@paperclipai/adapter-utils/server-utils";

function summarizeStatus(checks: AdapterEnvironmentCheck[]): AdapterEnvironmentTestResult["status"] {
  if (checks.some((check) => check.level === "error")) return "fail";
  if (checks.some((check) => check.level === "warn")) return "warn";
  return "pass";
}

export async function testEnvironment(
  ctx: AdapterEnvironmentTestContext,
): Promise<AdapterEnvironmentTestResult> {
  const checks: AdapterEnvironmentCheck[] = [];

  const config = parseObject(ctx.config);
  const hermesCommand =
    (typeof config.hermesCommand === "string" && config.hermesCommand.trim()
      ? config.hermesCommand.trim()
      : typeof config.command === "string" && config.command.trim()
        ? config.command.trim()
        : "hermes");
  const hermesHome = typeof config.hermesHome === "string" && config.hermesHome.trim()
    ? config.hermesHome.trim()
    : process.env.HERMES_HOME ?? "/paperclip/hermes";
  const configPath = path.join(hermesHome, "config.yaml");
  const envPath = path.join(hermesHome, ".env");
  const skillsPath = path.join(hermesHome, "skills");
  const mcpServerPath = typeof config.mcpServerPath === "string" && config.mcpServerPath.trim()
    ? config.mcpServerPath.trim()
    : "/usr/local/bin/paperclip-mcp-server";
  const paperclipApiUrl = typeof config.paperclipApiUrl === "string" && config.paperclipApiUrl.trim()
    ? config.paperclipApiUrl.trim()
    : "http://localhost:3100/api";

  const envConfig = (typeof config.env === "object" && config.env !== null ? config.env : {}) as Record<string, string>;
  const hasExplicitApiKey = typeof envConfig.PAPERCLIP_API_KEY === "string" && envConfig.PAPERCLIP_API_KEY.trim().length > 0;

  checks.push({
    code: "hermes_cli_check",
    level: "info",
    message: `Hermes CLI probe: ${hermesCommand}`,
    detail: "Run: hermes --version",
  });

  checks.push({
    code: "hermes_mcp_server_binary",
    level: "info",
    message: `MCP server binary: ${mcpServerPath}`,
    detail: "Paperclip MCP tools require paperclip-mcp-server to be installed.",
  });

  checks.push({
    code: "hermes_mcp_python_dep",
    level: "info",
    message: "Python 'mcp' package required for MCP tool support",
    detail: "Install with: uv pip install mcp (or pip install mcp)",
  });

  checks.push({
    code: "hermes_paperclip_api",
    level: "info",
    message: `Paperclip API URL: ${paperclipApiUrl}`,
    detail: hasExplicitApiKey ? "PAPERCLIP_API_KEY is set in adapter config." : "PAPERCLIP_API_KEY will be injected at runtime from authToken.",
  });

  checks.push({
    code: "hermes_shared_home",
    level: "info",
    message: `HERMES_HOME: ${hermesHome}`,
    detail: "Paperclip uses the shared Hermes home so CLI/TUI configuration, sessions, memory, and skills stay unified.",
  });

  const configContent = await fs.readFile(configPath, "utf8").catch(() => null);
  checks.push({
    code: "hermes_shared_config",
    level: configContent ? "info" : "warn",
    message: configContent ? `Hermes config found: ${configPath}` : `Hermes config not found: ${configPath}`,
    detail: configContent
      ? "Paperclip should see the same config created by hermes setup or the Hermes TUI."
      : "Run hermes setup with this HERMES_HOME, or mount/copy your existing Hermes config here.",
  });

  const envContent = await fs.readFile(envPath, "utf8").catch(() => null);
  const hasEnvProviderKey = Boolean(envContent && /^(OPENROUTER_API_KEY|OPENAI_API_KEY|ANTHROPIC_API_KEY|NOUS_API_KEY)=.+/m.test(envContent));
  const hasConfigProvider = Boolean(configContent && /^\s*(provider|base_url|default)\s*:/m.test(configContent));
  const hasProcessProviderKey = ["OPENROUTER_API_KEY", "OPENAI_API_KEY", "ANTHROPIC_API_KEY", "NOUS_API_KEY"]
    .some((key) => typeof process.env[key] === "string" && process.env[key]!.trim().length > 0);
  checks.push({
    code: "hermes_provider_credentials",
    level: hasEnvProviderKey || hasProcessProviderKey || hasConfigProvider ? "info" : "warn",
    message: hasEnvProviderKey || hasProcessProviderKey || hasConfigProvider
      ? "Hermes provider configuration detected"
      : "No Hermes provider credentials detected in shared .env or process env",
    detail: hasEnvProviderKey
      ? `Provider key found in ${envPath}.`
      : hasProcessProviderKey
        ? "Provider key found in process environment."
        : hasConfigProvider
          ? `Provider/model fields found in ${configPath}.`
          : "Hermes may trigger non-interactive setup unless config.yaml points at a configured provider or a provider API key is available.",
  });

  const skillDirs = await fs.readdir(skillsPath, { withFileTypes: true }).catch(() => []);
  checks.push({
    code: "hermes_shared_skills",
    level: "info",
    message: `Hermes skills directory: ${skillsPath}`,
    detail: skillDirs.length > 0
      ? `${skillDirs.filter((entry) => entry.isDirectory()).length} skill categories/directories detected.`
      : "No Hermes skills detected yet. Paperclip-managed skills will be linked under skills/paperclip when synced.",
  });

  return {
    adapterType: ctx.adapterType,
    status: summarizeStatus(checks),
    checks,
    testedAt: new Date().toISOString(),
  };
}
