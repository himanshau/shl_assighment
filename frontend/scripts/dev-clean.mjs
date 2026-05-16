import { existsSync, rmSync } from "node:fs";
import { join } from "node:path";

const cwd = process.cwd();
const targets = [".next", join("node_modules", ".cache")];

for (const dir of targets) {
  const path = join(cwd, dir);
  if (!existsSync(path)) continue;
  try {
    rmSync(path, { recursive: true, force: true, maxRetries: 3, retryDelay: 200 });
    console.log(`Removed ${dir}`);
  } catch (err) {
    console.error(
      `Could not remove ${dir}. Stop "npm run dev" / close the browser, then retry.`,
    );
    console.error(err instanceof Error ? err.message : err);
    process.exit(1);
  }
}
