#!/usr/bin/env node
/**
 * Compare local supabase/migrations/*.sql against a remote migration snapshot.
 *
 * Usage:
 *   pnpm check:migrations
 *   node scripts/check-migrations.mjs --remote supabase/.remote-migrations.snapshot.json
 *
 * Refresh snapshot after querying remote (Supabase MCP list_migrations or dashboard):
 *   node scripts/check-migrations.mjs --write-remote supabase/.remote-migrations.snapshot.json
 */
import fs from "node:fs";
import path from "node:path";

const ROOT = process.cwd();
const LOCAL_DIR = path.join(ROOT, "supabase", "migrations");
const DEFAULT_REMOTE = path.join(ROOT, "supabase", ".remote-migrations.snapshot.json");

function listLocalMigrations() {
  if (!fs.existsSync(LOCAL_DIR)) {
    console.error(`Missing ${LOCAL_DIR}`);
    process.exit(1);
  }
  return fs
    .readdirSync(LOCAL_DIR)
    .filter((f) => f.endsWith(".sql"))
    .sort();
}

function parseArgs(argv) {
  const out = { remotePath: DEFAULT_REMOTE, writeRemote: false };
  for (let i = 2; i < argv.length; i++) {
    if (argv[i] === "--remote" && argv[i + 1]) {
      out.remotePath = path.resolve(argv[++i]);
    } else if (argv[i] === "--write-remote" && argv[i + 1]) {
      out.remotePath = path.resolve(argv[++i]);
      out.writeRemote = true;
    }
  }
  return out;
}

function loadRemoteSnapshot(remotePath) {
  if (!fs.existsSync(remotePath)) {
    return null;
  }
  const raw = JSON.parse(fs.readFileSync(remotePath, "utf8"));
  const rows = Array.isArray(raw) ? raw : raw.migrations ?? [];
  return rows.map((row) => ({
    version: String(row.version ?? ""),
    name: String(row.name ?? ""),
  }));
}

function migrationStem(filename) {
  return filename.replace(/\.sql$/, "");
}

function main() {
  const { remotePath, writeRemote } = parseArgs(process.argv);
  const local = listLocalMigrations();

  if (writeRemote) {
    const template = {
      project_ref: "vbzjkqhvzfunahmlxevb",
      captured_at: new Date().toISOString(),
      note: "Refresh via Supabase MCP list_migrations or SQL Editor schema_migrations query.",
      migrations: [],
    };
    fs.mkdirSync(path.dirname(remotePath), { recursive: true });
    fs.writeFileSync(remotePath, `${JSON.stringify(template, null, 2)}\n`);
    console.log(`Wrote remote snapshot template to ${remotePath}`);
    console.log(`Local migration count: ${local.length}`);
    return;
  }

  const remote = loadRemoteSnapshot(remotePath);
  console.log(`Local migrations: ${local.length}`);

  if (!remote) {
    console.warn(`No remote snapshot at ${remotePath} — local list only.`);
    console.log(local.join("\n"));
    process.exit(0);
  }

  const remoteNames = new Set(remote.map((r) => r.name));
  const remoteStems = new Set(remote.map((r) => r.name.replace(/\.sql$/, "")));
  const pending = local.filter((file) => {
    const stem = migrationStem(file);
    return !remoteNames.has(file) && !remoteNames.has(stem) && !remoteStems.has(stem);
  });

  console.log(`Remote applied (snapshot): ${remote.length}`);
  console.log(`Pending local migrations: ${pending.length}`);
  if (pending.length) {
    console.log("\nPending:");
    for (const file of pending) {
      console.log(`  - ${file}`);
    }
  }

  const unknownRemote = remote.filter((r) => {
    const name = r.name.endsWith(".sql") ? r.name : `${r.name}.sql`;
    const stem = migrationStem(name);
    return !local.includes(name) && !local.some((f) => migrationStem(f) === stem || f === r.name);
  });
  if (unknownRemote.length) {
    console.log("\nRemote-only (not in local repo):");
    for (const row of unknownRemote) {
      console.log(`  - ${row.version} ${row.name}`);
    }
  }

  process.exit(pending.length ? 1 : 0);
}

main();
