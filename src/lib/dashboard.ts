import "server-only";
import { asc } from "drizzle-orm";
import { db } from "@/db";
import { digimon } from "@/db/schema";

export async function digimonLookup() {
  const all = await db.select({ name: digimon.name, slug: digimon.slug }).from(digimon).orderBy(asc(digimon.name));
  return { names: all.map((d) => d.name), slugs: Object.fromEntries(all.map((d) => [d.name.toLowerCase(), d.slug])) };
}
