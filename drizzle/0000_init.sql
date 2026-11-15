CREATE TABLE "account" (
	"id" text PRIMARY KEY NOT NULL,
	"account_id" text NOT NULL,
	"provider_id" text NOT NULL,
	"user_id" text NOT NULL,
	"access_token" text,
	"refresh_token" text,
	"id_token" text,
	"access_token_expires_at" timestamp,
	"refresh_token_expires_at" timestamp,
	"scope" text,
	"password" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "categories" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"slug" text NOT NULL,
	"description" text,
	CONSTRAINT "categories_name_unique" UNIQUE("name"),
	CONSTRAINT "categories_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
CREATE TABLE "digimon" (
	"id" serial PRIMARY KEY NOT NULL,
	"page_id" integer NOT NULL,
	"name" text NOT NULL,
	"slug" text NOT NULL,
	"names" jsonb DEFAULT '{}'::jsonb,
	"stage" text,
	"attribute" text,
	"natural_attribute" text,
	"attack_type" text,
	"digimon_type" text,
	"rank" text,
	"location" text,
	"rideable" boolean DEFAULT false,
	"egg" text,
	"gdmo" boolean DEFAULT false,
	"kdmo" boolean DEFAULT false,
	"mercenary" boolean DEFAULT false,
	"enemy" boolean DEFAULT false,
	"icon_media_id" integer,
	"image_media_id" integer,
	"stats" jsonb DEFAULT '{}'::jsonb,
	"raw_infobox" jsonb DEFAULT '{}'::jsonb,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "digimon_page_id_unique" UNIQUE("page_id"),
	CONSTRAINT "digimon_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
CREATE TABLE "digimon_attacks" (
	"id" serial PRIMARY KEY NOT NULL,
	"digimon_id" integer NOT NULL,
	"position" integer DEFAULT 0 NOT NULL,
	"name" text NOT NULL,
	"icon_name" text,
	"element" text,
	"cooldown" text,
	"ds_cost" text,
	"skill_points" text,
	"animation" text,
	"base_damage" text,
	"upgrade" text,
	"description" text,
	"extra" jsonb DEFAULT '{}'::jsonb
);
--> statement-breakpoint
CREATE TABLE "digimon_families" (
	"digimon_id" integer NOT NULL,
	"family" text NOT NULL,
	CONSTRAINT "digimon_families_digimon_id_family_pk" PRIMARY KEY("digimon_id","family")
);
--> statement-breakpoint
CREATE TABLE "evolution_lines" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"root_digimon_id" integer,
	"note" text,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "evolution_lines_name_unique" UNIQUE("name")
);
--> statement-breakpoint
CREATE TABLE "evolution_steps" (
	"id" serial PRIMARY KEY NOT NULL,
	"line_id" integer NOT NULL,
	"position" integer NOT NULL,
	"digimon_name" text NOT NULL,
	"digimon_id" integer,
	"parent_step_id" integer,
	"unlock_level" integer,
	"required_item" text,
	"kind" text DEFAULT 'normal' NOT NULL
);
--> statement-breakpoint
CREATE TABLE "media" (
	"id" serial PRIMARY KEY NOT NULL,
	"filename" text NOT NULL,
	"r2_key" text NOT NULL,
	"mime" text,
	"width" integer,
	"height" integer,
	"size" integer,
	"alt" text,
	"source_url" text,
	"uploaded_by" text,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "page_categories" (
	"page_id" integer NOT NULL,
	"category_id" integer NOT NULL,
	CONSTRAINT "page_categories_page_id_category_id_pk" PRIMARY KEY("page_id","category_id")
);
--> statement-breakpoint
CREATE TABLE "page_revisions" (
	"id" serial PRIMARY KEY NOT NULL,
	"page_id" integer NOT NULL,
	"snapshot" jsonb NOT NULL,
	"comment" text,
	"user_id" text,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "page_views" (
	"id" serial PRIMARY KEY NOT NULL,
	"path" text NOT NULL,
	"page_id" integer,
	"referrer" text,
	"country" text,
	"device" text,
	"visitor_hash" text,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "pages" (
	"id" serial PRIMARY KEY NOT NULL,
	"slug" text NOT NULL,
	"title" text NOT NULL,
	"namespace" integer DEFAULT 0 NOT NULL,
	"type" text DEFAULT 'article' NOT NULL,
	"wikitext" text,
	"html" text,
	"summary" text,
	"redirect_to" text,
	"source_page_id" integer,
	"source_rev_id" integer,
	"published" boolean DEFAULT true NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"updated_by" text
);
--> statement-breakpoint
CREATE TABLE "search_queries" (
	"id" serial PRIMARY KEY NOT NULL,
	"query" text NOT NULL,
	"results_count" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "session" (
	"id" text PRIMARY KEY NOT NULL,
	"expires_at" timestamp NOT NULL,
	"token" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"ip_address" text,
	"user_agent" text,
	"user_id" text NOT NULL,
	"impersonated_by" text,
	CONSTRAINT "session_token_unique" UNIQUE("token")
);
--> statement-breakpoint
CREATE TABLE "user" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"email" text NOT NULL,
	"email_verified" boolean DEFAULT false NOT NULL,
	"image" text,
	"role" text DEFAULT 'editor',
	"banned" boolean DEFAULT false,
	"ban_reason" text,
	"ban_expires" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "user_email_unique" UNIQUE("email")
);
--> statement-breakpoint
CREATE TABLE "verification" (
	"id" text PRIMARY KEY NOT NULL,
	"identifier" text NOT NULL,
	"value" text NOT NULL,
	"expires_at" timestamp NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "account" ADD CONSTRAINT "account_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "digimon" ADD CONSTRAINT "digimon_page_id_pages_id_fk" FOREIGN KEY ("page_id") REFERENCES "public"."pages"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "digimon" ADD CONSTRAINT "digimon_icon_media_id_media_id_fk" FOREIGN KEY ("icon_media_id") REFERENCES "public"."media"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "digimon" ADD CONSTRAINT "digimon_image_media_id_media_id_fk" FOREIGN KEY ("image_media_id") REFERENCES "public"."media"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "digimon_attacks" ADD CONSTRAINT "digimon_attacks_digimon_id_digimon_id_fk" FOREIGN KEY ("digimon_id") REFERENCES "public"."digimon"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "digimon_families" ADD CONSTRAINT "digimon_families_digimon_id_digimon_id_fk" FOREIGN KEY ("digimon_id") REFERENCES "public"."digimon"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "evolution_lines" ADD CONSTRAINT "evolution_lines_root_digimon_id_digimon_id_fk" FOREIGN KEY ("root_digimon_id") REFERENCES "public"."digimon"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "evolution_steps" ADD CONSTRAINT "evolution_steps_line_id_evolution_lines_id_fk" FOREIGN KEY ("line_id") REFERENCES "public"."evolution_lines"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "evolution_steps" ADD CONSTRAINT "evolution_steps_digimon_id_digimon_id_fk" FOREIGN KEY ("digimon_id") REFERENCES "public"."digimon"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "evolution_steps" ADD CONSTRAINT "evolution_steps_parent_step_id_evolution_steps_id_fk" FOREIGN KEY ("parent_step_id") REFERENCES "public"."evolution_steps"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "media" ADD CONSTRAINT "media_uploaded_by_user_id_fk" FOREIGN KEY ("uploaded_by") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "page_categories" ADD CONSTRAINT "page_categories_page_id_pages_id_fk" FOREIGN KEY ("page_id") REFERENCES "public"."pages"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "page_categories" ADD CONSTRAINT "page_categories_category_id_categories_id_fk" FOREIGN KEY ("category_id") REFERENCES "public"."categories"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "page_revisions" ADD CONSTRAINT "page_revisions_page_id_pages_id_fk" FOREIGN KEY ("page_id") REFERENCES "public"."pages"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "page_revisions" ADD CONSTRAINT "page_revisions_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "page_views" ADD CONSTRAINT "page_views_page_id_pages_id_fk" FOREIGN KEY ("page_id") REFERENCES "public"."pages"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pages" ADD CONSTRAINT "pages_updated_by_user_id_fk" FOREIGN KEY ("updated_by") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "session" ADD CONSTRAINT "session_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "digimon_stage_idx" ON "digimon" USING btree ("stage");--> statement-breakpoint
CREATE INDEX "digimon_attr_idx" ON "digimon" USING btree ("attribute");--> statement-breakpoint
CREATE INDEX "evo_line_idx" ON "evolution_steps" USING btree ("line_id","position");--> statement-breakpoint
CREATE INDEX "evo_digimon_idx" ON "evolution_steps" USING btree ("digimon_name");--> statement-breakpoint
CREATE UNIQUE INDEX "media_filename_idx" ON "media" USING btree ("filename");--> statement-breakpoint
CREATE INDEX "pc_cat_idx" ON "page_categories" USING btree ("category_id");--> statement-breakpoint
CREATE INDEX "rev_page_idx" ON "page_revisions" USING btree ("page_id","created_at");--> statement-breakpoint
CREATE INDEX "pv_created_idx" ON "page_views" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "pv_path_idx" ON "page_views" USING btree ("path");--> statement-breakpoint
CREATE UNIQUE INDEX "pages_ns_slug_idx" ON "pages" USING btree ("namespace","slug");--> statement-breakpoint
CREATE INDEX "pages_type_idx" ON "pages" USING btree ("type");--> statement-breakpoint
CREATE INDEX "pages_search_idx" ON "pages" USING gin (to_tsvector('english', coalesce("title", '') || ' ' || coalesce("summary", '')));--> statement-breakpoint
CREATE INDEX "sq_created_idx" ON "search_queries" USING btree ("created_at");