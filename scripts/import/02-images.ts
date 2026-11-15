/**
 * Step 2: copy every wiki image into Cloudflare R2 and register it in the `media` table.
 * Skips files already present in the DB, so it can be re-run safely.
 *
 *   npm run import:images [-- --limit 100] [-- --concurrency 6]
 */
import "dotenv/config"; // must run before the db module is evaluated
import { db } from "../../src/db";
import { media } from "../../src/db/schema";
import { putObject, wikiFileKey } from "../../src/lib/r2";
import { arg, download, imagesFile, pool, readJson, type RawImage } from "./lib";

async function main() {
  const images = readJson<RawImage[]>(imagesFile());
  const existing = new Set((await db.select({ f: media.filename }).from(media)).map((r) => r.f));
  const limit = arg("limit") ? Number(arg("limit")) : Infinity;
  const todo = images.filter((i) => !existing.has(i.name.replace(/_/g, " "))).slice(0, limit);
  console.log(`images: ${images.length} total, ${existing.size} already in R2, ${todo.length} to upload`);

  let done = 0;
  const failed: string[] = [];
  await pool(todo, Number(arg("concurrency") ?? 6), async (img) => {
    const filename = img.name.replace(/_/g, " ");
    try {
      const { body, type } = await download(img.url);
      const key = wikiFileKey(filename);
      await putObject(key, body, img.mime || type || undefined);
      await db
        .insert(media)
        .values({
          filename,
          r2Key: key,
          mime: img.mime,
          width: img.width || null,
          height: img.height || null,
          size: img.size,
          sourceUrl: img.url,
        })
        .onConflictDoNothing();
    } catch (e) {
      failed.push(`${filename}: ${(e as Error).message}`);
    }
    done++;
    if (done % 20 === 0 || done === todo.length) process.stdout.write(`\ruploaded ${done}/${todo.length}`);
  });
  process.stdout.write("\n");
  if (failed.length) console.warn(`${failed.length} failed:\n  ` + failed.slice(0, 30).join("\n  "));
  console.log("images done");
  process.exit(0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
