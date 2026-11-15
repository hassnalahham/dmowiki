# DMO Wiki

> [!WARNING]
> ⚠️ **IMPORTANT**
>
> All data and content are sourced from [DMO Wiki](https://dmowiki.com).

A Next.js 16 rebuild of [dmowiki.com](https://dmowiki.com) with structured Digimon data, interactive
evolution trees, an editing dashboard and built-in analytics.

- **Frontend:** Next.js App Router (Cache Components), Tailwind v4
- **Database:** Neon Postgres + Drizzle ORM
- **Images:** Cloudflare R2 (direct browser uploads via presigned URLs)
- **Auth:** Better Auth (email/password, `admin` / `editor` roles, sign-up disabled)

> Private/personal project. The source wiki publishes no content license and asks for reference-only
> use, so keep deployments private (the site sends `noindex`).

## Setup

1. `cp .env.example .env` and fill in:
   - `DATABASE_URL` – Neon **pooled** connection string
   - `R2_ACCOUNT_ID`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`, `R2_BUCKET`, `R2_PUBLIC_URL`
   - `BETTER_AUTH_SECRET` (`openssl rand -base64 32`), `BETTER_AUTH_URL`, `ANALYTICS_SALT`
2. R2 bucket: enable public access (r2.dev or custom domain) and add a CORS rule so the dashboard can upload:
   ```json
   [
     {
       "AllowedOrigins": ["http://localhost:3000", "https://your-domain"],
       "AllowedMethods": ["PUT"],
       "AllowedHeaders": ["content-type"]
     }
   ]
   ```
3. `npm install && npm run db:migrate`

4. Import the wiki:
   ```bash
   npm run import:fetch
   npm run import:images
   npm run import:load
   ```
5. To create admin for the dashboard :

   ```bash
      npm run create-admin -- --email you@example.com --password "a-strong-password" --name "You"
   ```

6. How to get ANALYTICS_SALT and BETTER_AUTH_SECRET use :

   ```bash
      node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
   ```

   or

   ```bash
      openssl rand -hex 32
   ```

   and copy it into the .env file make sure both are different (Generate the code 2 times)

7. `npm run dev` → site at `/`, dashboard at `/dashboard` (sign in at `/login`).
