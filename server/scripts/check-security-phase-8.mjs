import { readFileSync } from "node:fs";
import { spawnSync } from "node:child_process";

const MAX_BUFFER = 200 * 1024 * 1024;
const EXCLUDED_PREFIXES = [
  ".git/",
  "assets/vendor/",
  "node_modules/"
];
const EXCLUDED_FILES = new Set([
  "package-lock.json"
]);

const knownSecretPatterns = [
  { name: "AWS access key", pattern: /\b(?:AKIA|ASIA)[0-9A-Z]{16}\b/g },
  { name: "Google API key", pattern: /\bAIza[0-9A-Za-z_-]{35}\b/g },
  { name: "Stripe secret key", pattern: /\b(?:sk|rk)_(?:live|test)_[0-9A-Za-z]{20,}\b/g },
  { name: "GitHub token", pattern: /\b(?:gh[pousr]_[A-Za-z0-9_]{30,}|github_pat_[A-Za-z0-9_]{30,})\b/g },
  { name: "Slack token", pattern: /\bxox[baprs]-[A-Za-z0-9-]{20,}\b/g },
  { name: "SendGrid API key", pattern: /\bSG\.[A-Za-z0-9_-]{20,}\.[A-Za-z0-9_-]{20,}\b/g },
  { name: "JWT", pattern: /\beyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\b/g },
  { name: "OpenAI project key", pattern: /\bsk-proj-[A-Za-z0-9_-]{20,}\b/g },
  { name: "OpenAI key", pattern: /\bsk-[A-Za-z0-9]{20,}\b/g }
];

const credentialAssignmentPattern = /^(?:[+-])?([A-Z][A-Z0-9_]*(?:KEY|TOKEN|SECRET|PASSWORD)[A-Z0-9_]*)\s*=\s*([^#\s][^#\s]*)/;
const nonCredentialAssignmentNames = new Set([
  "GIT_CONFIG_KEY_0",
  "SSLKEYLOGFILE"
]);

const findings = [];

assertGitignore();
scanCurrentTree();
scanGitHistory();
assertEnvFilesNotTracked();

if (findings.length > 0) {
  console.error("Phase 8 security scan failed:");
  for (const finding of findings) {
    console.error(`- ${finding}`);
  }
  process.exitCode = 1;
} else {
  console.log("Phase 8 security scan passed: no known secret formats or non-placeholder credential assignments found.");
}

function assertGitignore() {
  let gitignore = "";
  try {
    gitignore = readFileSync(".gitignore", "utf8");
  } catch (error) {
    findings.push(`.gitignore could not be read: ${error.message}`);
    return;
  }

  for (const requiredLine of [".env", ".env.*", "!.env.example"]) {
    if (!gitignore.split(/\r?\n/).includes(requiredLine)) {
      findings.push(`.gitignore is missing required entry ${requiredLine}`);
    }
  }
}

function scanCurrentTree() {
  const files = runGit(["ls-files", "--cached", "--others", "--exclude-standard"])
    .split(/\r?\n/)
    .map((file) => normalizePath(file))
    .filter(Boolean)
    .filter((file) => !shouldSkipFile(file));

  for (const file of files) {
    let content = "";
    try {
      content = readFileSync(file, "utf8");
    } catch {
      continue;
    }

    if (content.includes("\u0000")) continue;
    scanText(file, content);
  }
}

function scanGitHistory() {
  const history = runGit([
    "log",
    "-p",
    "--all",
    "--",
    ".",
    ":!assets/vendor",
    ":!package-lock.json"
  ]);

  scanText("git history", history);
}

function assertEnvFilesNotTracked() {
  const trackedEnvFiles = runGit(["ls-files", "--", ".env", ".env.*"])
    .split(/\r?\n/)
    .map((file) => file.trim())
    .filter(Boolean)
    .filter((file) => file !== ".env.example");

  for (const file of trackedEnvFiles) {
    findings.push(`tracked environment file is not allowed: ${file}`);
  }
}

function scanText(label, text) {
  const lines = text.split(/\r?\n/);

  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index];
    const lineNumber = index + 1;

    for (const { name, pattern } of knownSecretPatterns) {
      pattern.lastIndex = 0;
      let match = pattern.exec(line);
      while (match) {
        findings.push(`${label}:${lineNumber} ${name}: ${redactLine(line, match[0])}`);
        match = pattern.exec(line);
      }
    }

    const assignment = credentialAssignmentPattern.exec(line);
    if (assignment && !isAllowedCredentialAssignment(assignment[1], assignment[2])) {
      findings.push(`${label}:${lineNumber} credential assignment ${assignment[1]}=${redactValue(assignment[2])}`);
    }
  }
}

function isAllowedCredentialAssignment(name, value) {
  if (nonCredentialAssignmentNames.has(name)) return true;
  if (name.startsWith("GIT_CONFIG_KEY_")) return true;
  if (!value) return true;

  const normalized = value.trim().toLowerCase();
  return normalized === "..."
    || normalized.startsWith("<")
    || normalized.startsWith("&lt;")
    || normalized.includes("</code>")
    || normalized.startsWith("change-me")
    || normalized.startsWith("placeholder")
    || normalized === "example"
    || normalized.startsWith("example-")
    || normalized.startsWith("example_")
    || normalized.includes("example.com")
    || normalized.startsWith("tu-")
    || normalized.startsWith("your-")
    || normalized.startsWith("usa-un-token");
}

function shouldSkipFile(file) {
  return EXCLUDED_FILES.has(file)
    || EXCLUDED_PREFIXES.some((prefix) => file.startsWith(prefix));
}

function runGit(args) {
  const result = spawnSync("git", args, {
    encoding: "utf8",
    maxBuffer: MAX_BUFFER,
    windowsHide: true
  });

  if (result.error) {
    throw result.error;
  }

  if (result.status !== 0) {
    const detail = result.stderr || result.stdout || `exit code ${result.status}`;
    throw new Error(`git ${args.join(" ")} failed: ${detail.trim()}`);
  }

  return result.stdout || "";
}

function normalizePath(file) {
  return file.trim().replace(/\\/g, "/");
}

function redactLine(line, secret) {
  return line.replace(secret, redactValue(secret));
}

function redactValue(value) {
  if (value.length <= 8) return "[REDACTED]";
  return `${value.slice(0, 4)}...[REDACTED]...${value.slice(-4)}`;
}
