import { resolve } from "node:path";

/** Where the reference files (provider index, health rates) live. */
export function dataDir(env: NodeJS.ProcessEnv = process.env): string {
  return env.ASKRIGHTO_DATA_DIR
    ? resolve(env.ASKRIGHTO_DATA_DIR)
    : resolve(process.cwd(), "data");
}
