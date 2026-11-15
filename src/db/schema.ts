import { relations, sql } from "drizzle-orm";
import {
  boolean,
  index,
  integer,
  jsonb,
  pgTable,
  primaryKey,
  serial,
  text,
  timestamp,
  uniqueIndex,
  type AnyPgColumn,
} from "drizzle-orm/pg-core";

/* ------------------------------------------------------------------ */
/* Better Auth tables (core + admin plugin fields)                     */
/* ------------------------------------------------------------------ */

export const user = pgTable("user", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  email: text("email").notNull().unique(),
  emailVerified: boolean("email_verified").notNull().default(false),
  image: text("image"),
  role: text("role").default("editor"),
  banned: boolean("banned").default(false),
  banReason: text("ban_reason"),
  banExpires: timestamp("ban_expires"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const session = pgTable("session", {
  id: text("id").primaryKey(),
  expiresAt: timestamp("expires_at").notNull(),
  token: text("token").notNull().unique(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
  ipAddress: text("ip_address"),
  userAgent: text("user_agent"),
  userId: text("user_id")
    .notNull()
    .references(() => user.id, { onDelete: "cascade" }),
  impersonatedBy: text("impersonated_by"),
});

export const account = pgTable("account", {
  id: text("id").primaryKey(),
  accountId: text("account_id").notNull(),
  providerId: text("provider_id").notNull(),
  userId: text("user_id")
    .notNull()
    .references(() => user.id, { onDelete: "cascade" }),
  accessToken: text("access_token"),
  refreshToken: text("refresh_token"),
  idToken: text("id_token"),
  accessTokenExpiresAt: timestamp("access_token_expires_at"),
  refreshTokenExpiresAt: timestamp("refresh_token_expires_at"),
  scope: text("scope"),
  password: text("password"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const verification = pgTable("verification", {
  id: text("id").primaryKey(),
  identifier: text("identifier").notNull(),
  value: text("value").notNull(),
  expiresAt: timestamp("expires_at").notNull(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

/* ------------------------------------------------------------------ */
/* Media (R2)                                                          */
/* ------------------------------------------------------------------ */

export const media = pgTable(
  "media",
  {
    id: serial("id").primaryKey(),
    /** MediaWiki file name with spaces, e.g. "Agumon Icon.png" (unique key for wiki refs) */
    filename: text("filename").notNull(),
    r2Key: text("r2_key").notNull(),
    mime: text("mime"),
    width: integer("width"),
    height: integer("height"),
    size: integer("size"),
    alt: text("alt"),
    sourceUrl: text("source_url"),
    uploadedBy: text("uploaded_by").references(() => user.id, { onDelete: "set null" }),
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (t) => [uniqueIndex("media_filename_idx").on(t.filename)],
);

/* ------------------------------------------------------------------ */
/* Pages & categories                                                  */
/* ------------------------------------------------------------------ */

export const pages = pgTable(
  "pages",
  {
    id: serial("id").primaryKey(),
    /** URL slug, derived from the wiki title (e.g. "Agumon_(Classic)") */
    slug: text("slug").notNull(),
    title: text("title").notNull(),
    /** MediaWiki namespace (0 = main, 10 = template, 14 = category) */
    namespace: integer("namespace").notNull().default(0),
    type: text("type").notNull().default("article"), // article | digimon | item | map | quest | template | category
    wikitext: text("wikitext"),
    html: text("html"),
    summary: text("summary"),
    /** For redirect pages: the target title */
    redirectTo: text("redirect_to"),
    sourcePageId: integer("source_page_id"),
    sourceRevId: integer("source_rev_id"),
    published: boolean("published").notNull().default(true),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").notNull().defaultNow(),
    updatedBy: text("updated_by").references(() => user.id, { onDelete: "set null" }),
  },
  (t) => [
    uniqueIndex("pages_ns_slug_idx").on(t.namespace, t.slug),
    index("pages_type_idx").on(t.type),
    index("pages_search_idx").using(
      "gin",
      sql`to_tsvector('english', coalesce(${t.title}, '') || ' ' || coalesce(${t.summary}, ''))`,
    ),
  ],
);

export const categories = pgTable("categories", {
  id: serial("id").primaryKey(),
  name: text("name").notNull().unique(),
  slug: text("slug").notNull().unique(),
  description: text("description"),
});

export const pageCategories = pgTable(
  "page_categories",
  {
    pageId: integer("page_id")
      .notNull()
      .references(() => pages.id, { onDelete: "cascade" }),
    categoryId: integer("category_id")
      .notNull()
      .references(() => categories.id, { onDelete: "cascade" }),
  },
  (t) => [primaryKey({ columns: [t.pageId, t.categoryId] }), index("pc_cat_idx").on(t.categoryId)],
);

export const pageRevisions = pgTable(
  "page_revisions",
  {
    id: serial("id").primaryKey(),
    pageId: integer("page_id")
      .notNull()
      .references(() => pages.id, { onDelete: "cascade" }),
    /** full snapshot of the page (+ digimon data when relevant) */
    snapshot: jsonb("snapshot").notNull(),
    comment: text("comment"),
    userId: text("user_id").references(() => user.id, { onDelete: "set null" }),
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (t) => [index("rev_page_idx").on(t.pageId, t.createdAt)],
);

/* ------------------------------------------------------------------ */
/* Digimon                                                             */
/* ------------------------------------------------------------------ */

export type DigimonStats = {
  base?: Record<string, string>;
  max?: Record<string, string>;
  note?: string;
};

export const digimon = pgTable(
  "digimon",
  {
    id: serial("id").primaryKey(),
    pageId: integer("page_id")
      .notNull()
      .unique()
      .references(() => pages.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    slug: text("slug").notNull().unique(),
    names: jsonb("names").$type<Record<string, string>>().default({}),
    stage: text("stage"), // In-Training, Rookie, Champion, Ultimate, Mega, Burst Mode, Jogress, ...
    attribute: text("attribute"), // Vaccine / Data / Virus / Free / Unknown
    naturalAttribute: text("natural_attribute"), // Fire / Water / ...
    attackType: text("attack_type"), // SA / QA / NA / DE / CA ...
    digimonType: text("digimon_type"), // Dinosaur, ...
    rank: text("rank"),
    location: text("location"),
    rideable: boolean("rideable").default(false),
    egg: text("egg"),
    gdmo: boolean("gdmo").default(false),
    kdmo: boolean("kdmo").default(false),
    mercenary: boolean("mercenary").default(false),
    enemy: boolean("enemy").default(false),
    iconMediaId: integer("icon_media_id").references(() => media.id, { onDelete: "set null" }),
    imageMediaId: integer("image_media_id").references(() => media.id, { onDelete: "set null" }),
    stats: jsonb("stats").$type<DigimonStats>().default({}),
    rawInfobox: jsonb("raw_infobox").$type<Record<string, string>>().default({}),
    updatedAt: timestamp("updated_at").notNull().defaultNow(),
  },
  (t) => [index("digimon_stage_idx").on(t.stage), index("digimon_attr_idx").on(t.attribute)],
);

export const digimonFamilies = pgTable(
  "digimon_families",
  {
    digimonId: integer("digimon_id")
      .notNull()
      .references(() => digimon.id, { onDelete: "cascade" }),
    family: text("family").notNull(),
  },
  (t) => [primaryKey({ columns: [t.digimonId, t.family] })],
);

export const digimonAttacks = pgTable("digimon_attacks", {
  id: serial("id").primaryKey(),
  digimonId: integer("digimon_id")
    .notNull()
    .references(() => digimon.id, { onDelete: "cascade" }),
  position: integer("position").notNull().default(0),
  name: text("name").notNull(),
  iconName: text("icon_name"),
  element: text("element"),
  cooldown: text("cooldown"),
  dsCost: text("ds_cost"),
  skillPoints: text("skill_points"),
  animation: text("animation"),
  baseDamage: text("base_damage"),
  upgrade: text("upgrade"),
  description: text("description"),
  extra: jsonb("extra").$type<Record<string, string>>().default({}),
});

/* ------------------------------------------------------------------ */
/* Evolutions                                                          */
/* ------------------------------------------------------------------ */

export const evolutionLines = pgTable("evolution_lines", {
  id: serial("id").primaryKey(),
  /** Source template name, e.g. "Digivolve Agumon" (unique) */
  name: text("name").notNull().unique(),
  rootDigimonId: integer("root_digimon_id").references(() => digimon.id, { onDelete: "set null" }),
  note: text("note"),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const evolutionSteps = pgTable(
  "evolution_steps",
  {
    id: serial("id").primaryKey(),
    lineId: integer("line_id")
      .notNull()
      .references(() => evolutionLines.id, { onDelete: "cascade" }),
    position: integer("position").notNull(),
    /** Name as written in the source (may not have a page yet) */
    digimonName: text("digimon_name").notNull(),
    digimonId: integer("digimon_id").references(() => digimon.id, { onDelete: "set null" }),
    parentStepId: integer("parent_step_id").references((): AnyPgColumn => evolutionSteps.id, {
      onDelete: "cascade",
    }),
    unlockLevel: integer("unlock_level"),
    requiredItem: text("required_item"),
    kind: text("kind").notNull().default("normal"), // normal | burst | side_mega | jogress
  },
  (t) => [index("evo_line_idx").on(t.lineId, t.position), index("evo_digimon_idx").on(t.digimonName)],
);

/* ------------------------------------------------------------------ */
/* Analytics                                                           */
/* ------------------------------------------------------------------ */

export const pageViews = pgTable(
  "page_views",
  {
    id: serial("id").primaryKey(),
    path: text("path").notNull(),
    pageId: integer("page_id").references(() => pages.id, { onDelete: "set null" }),
    referrer: text("referrer"),
    country: text("country"),
    device: text("device"),
    visitorHash: text("visitor_hash"),
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (t) => [index("pv_created_idx").on(t.createdAt), index("pv_path_idx").on(t.path)],
);

export const searchQueries = pgTable(
  "search_queries",
  {
    id: serial("id").primaryKey(),
    query: text("query").notNull(),
    resultsCount: integer("results_count").notNull().default(0),
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (t) => [index("sq_created_idx").on(t.createdAt)],
);

/* ------------------------------------------------------------------ */
/* Relations                                                           */
/* ------------------------------------------------------------------ */

export const pagesRelations = relations(pages, ({ many, one }) => ({
  categories: many(pageCategories),
  revisions: many(pageRevisions),
  digimon: one(digimon, { fields: [pages.id], references: [digimon.pageId] }),
}));

export const pageCategoriesRelations = relations(pageCategories, ({ one }) => ({
  page: one(pages, { fields: [pageCategories.pageId], references: [pages.id] }),
  category: one(categories, { fields: [pageCategories.categoryId], references: [categories.id] }),
}));

export const categoriesRelations = relations(categories, ({ many }) => ({
  pages: many(pageCategories),
}));

export const digimonRelations = relations(digimon, ({ one, many }) => ({
  page: one(pages, { fields: [digimon.pageId], references: [pages.id] }),
  icon: one(media, { fields: [digimon.iconMediaId], references: [media.id], relationName: "icon" }),
  image: one(media, { fields: [digimon.imageMediaId], references: [media.id], relationName: "image" }),
  families: many(digimonFamilies),
  attacks: many(digimonAttacks),
}));

export const digimonFamiliesRelations = relations(digimonFamilies, ({ one }) => ({
  digimon: one(digimon, { fields: [digimonFamilies.digimonId], references: [digimon.id] }),
}));

export const digimonAttacksRelations = relations(digimonAttacks, ({ one }) => ({
  digimon: one(digimon, { fields: [digimonAttacks.digimonId], references: [digimon.id] }),
}));

export const evolutionLinesRelations = relations(evolutionLines, ({ many }) => ({
  steps: many(evolutionSteps),
}));

export const evolutionStepsRelations = relations(evolutionSteps, ({ one }) => ({
  line: one(evolutionLines, { fields: [evolutionSteps.lineId], references: [evolutionLines.id] }),
  digimon: one(digimon, { fields: [evolutionSteps.digimonId], references: [digimon.id] }),
}));

export const pageRevisionsRelations = relations(pageRevisions, ({ one }) => ({
  page: one(pages, { fields: [pageRevisions.pageId], references: [pages.id] }),
  user: one(user, { fields: [pageRevisions.userId], references: [user.id] }),
}));
