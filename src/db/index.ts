import { Pool } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-serverless";
import * as schema from "./schema";

const globalForDb = globalThis as unknown as { pool?: Pool };

// The pool connects lazily on first query, so importing this module never needs credentials.
globalForDb.pool ??= new Pool({ connectionString: process.env.DATABASE_URL });

export const db = drizzle({ client: globalForDb.pool, schema });
export type DB = typeof db;
export { schema };
