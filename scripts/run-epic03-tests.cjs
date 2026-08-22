const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { spawnSync } = require("node:child_process");

const root = path.resolve(__dirname, "..");
const outputDirectory = fs.mkdtempSync(
  path.join(os.tmpdir(), "carbonx-epic03-tests-"),
);
const tscCommand = process.execPath;
const tscScript = path.join(root, "node_modules", "typescript", "bin", "tsc");
const sourceFiles = [
  "tests/epic-03.test.ts",
  "tests/epic-04.test.ts",
  "tests/epic-06.test.ts",
  "tests/epic-05.test.ts",
  "tests/epic-08.test.ts",
  "lib/services/audit.ts",
  "lib/services/blockchain.ts",
  "lib/services/ai-service.ts",
  "lib/services/incidents.ts",
  "lib/services/geospatial.ts",
  "lib/services/risk-engine.ts",
  "lib/services/event-processing.ts",
  "lib/prisma.ts",
  "lib/turf.d.ts",
  "lib/validations/incidents.ts",
  "lib/validations/ai.ts",
  "lib/validations/audit.ts",
];

try {
  const compile = spawnSync(
    tscCommand,
    [
      tscScript,
      ...sourceFiles,
      "--module",
      "commonjs",
      "--target",
      "es2022",
      "--outDir",
      outputDirectory,
      "--esModuleInterop",
      "--skipLibCheck",
      "--strict",
      "--moduleResolution",
      "node",
      "--types",
      "node",
      "--noEmitOnError",
    ],
    { cwd: root, stdio: "inherit" },
  );
  if (compile.status !== 0) process.exit(compile.status ?? 1);

  const testFile = path.join(outputDirectory, "tests", "epic-03.test.js");
  const testFiles = [
    testFile,
    path.join(outputDirectory, "tests", "epic-04.test.js"),
    path.join(outputDirectory, "tests", "epic-06.test.js"),
    path.join(outputDirectory, "tests", "epic-05.test.js"),
    path.join(outputDirectory, "tests", "epic-08.test.js"),
  ];
  for (const file of testFiles) {
    const test = spawnSync(
      process.execPath,
      ["--conditions=react-server", "--test", file],
      {
        cwd: root,
        stdio: "inherit",
        env: {
          ...process.env,
          NODE_PATH: path.join(root, "node_modules"),
        },
      },
    );
    if (test.status !== 0) process.exit(test.status ?? 1);
  }
} finally {
  fs.rmSync(outputDirectory, { recursive: true, force: true });
}
