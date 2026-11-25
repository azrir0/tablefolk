import { getDb } from "./client.js";

async function main() {
  await getDb();
  console.log("[TableFolk DB] Seed complete.");
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
