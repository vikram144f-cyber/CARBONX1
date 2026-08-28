const path = require("node:path");
const { spawnSync } = require("node:child_process");

const root = path.resolve(__dirname, "..");
const checks = [
  "run-epic03-db-verification.cjs",
  "run-epic04-db-verification.cjs",
  "run-epic05-db-verification.cjs",
  "run-epic06-db-verification.cjs",
  "run-epic08-db-verification.cjs",
];

if (!process.env.DATABASE_URL) {
  console.error(
    "DATABASE_URL is required for database verification. Start PostgreSQL or use the CI workflow.",
  );
  process.exit(2);
}

for (const check of checks) {
  console.log("\n=== " + check + " ===");
  const result = spawnSync(process.execPath, [path.join(__dirname, check)], {
    cwd: root,
    stdio: "inherit",
    env: {
      ...process.env,
      NODE_ENV: "test",
    },
  });

  if (result.error) {
    console.error(check + " could not start: " + result.error.message);
    process.exit(1);
  }
  if (result.status !== 0) {
    process.exit(result.status ?? 1);
  }
}

console.log("\nALL_DATABASE_VERIFICATIONS_PASS");
