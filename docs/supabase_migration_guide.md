# Supabase Database Migration Guide

This guide will walk you through migrating your RailMitra database away from Render’s 30-day expiring free tier to **Supabase's forever-free PostgreSQL database**.

## Phase 1: Create the Supabase Database

1. Go to [database.new](https://database.new) (which redirects to Supabase). Sign in with GitHub.
2. Click **"New Project"**.
3. Fill in the details:
   - **Name:** `railmitra-db`
   - **Database Password:** Click "Generate a password". **Copy this password and save it somewhere extremely safe immediately.** You will never be able to see it again.
   - **Region:** Choose a region closest to India (usually Mumbai or Singapore).
4. Click **"Create new project"**.
5. Wait about 3-5 minutes for the database to finish provisioning.

## Phase 2: Get Your Connection Strings (The Easy Way)

Supabase recently updated their dashboard to make this incredibly easy for Prisma users.

1. Once your project is ready, go to the main dashboard for your `railmitra-db` project.
2. Look at the very top right of the screen and click the **"Connect"** button.
3. A panel will pop open. Click on the **"ORMs"** tab (or "Node.js" / "Prisma" if categorized).
4. Select **Prisma** from the dropdown menu if asked.
5. Supabase will now display **both** the Transaction URL (Port 6543) and the Direct URL (Port 5432) perfectly formatted for your `.env` file!

*(Make sure you replace the `[YOUR-PASSWORD]` placeholder in the URLs with the actual password you created in Step 1).*

## Phase 3: Setup Locally & Push Tables

Now we tell your local computer to talk to Supabase so it can instantly build your empty tables (Users, Swaps, Sessions, etc).

1. Open your project in VSCode.
2. Navigate to your `server` folder.
3. Open your `server/.env` file. You will see your old `DATABASE_URL`.
4. Replace it entirely with the two Supabase URLs like this:

```env
# The Transaction URL (Port 6543, pgbouncer=true)
DATABASE_URL="postgresql://postgres.xxx:YOUR_PASSWORD@aws-0-ap-south-1.pooler.supabase.com:6543/postgres?pgbouncer=true"

# The Direct URL (Port 5432)
DIRECT_URL="postgresql://postgres.xxx:YOUR_PASSWORD@aws-0-ap-south-1.pooler.supabase.com:5432/postgres"
```

5. Open your `server/prisma/schema.prisma` file. Make sure your `datasource db` block includes the `directUrl` line like this:
```prisma
datasource db {
  provider  = "postgresql"
  url       = env("DATABASE_URL")
  directUrl = env("DIRECT_URL")
}
```

6. Open your terminal in the `server` folder and run this magic command:
```powershell
npx prisma db push
```
*(This commands Prisma to securely log into Supabase and instantly create all your empty tables. If it succeeds, you are 90% done!)*

## Phase 4: Point Render to Supabase

Finally, we tell your live cloud API to start sending all traffic to Supabase instead of the old Render database.

1. Go to your **Render Dashboard**.
2. Click on your `railmitra-api` Web Service.
3. On the left sidebar, click **Environment**.
4. Find the `DATABASE_URL` variable. Click "Edit".
5. Paste in the **Transaction Connection URL** (the same one you put in your local `.env` file ending in `6543/postgres?pgbouncer=true`).
6. Click **Save Changes**.
7. Render will automatically restart your server.

**🎉 Congratulations! Your API is now permanently hosted on Render for free, and your Database is permanently hosted on Supabase for free.**
