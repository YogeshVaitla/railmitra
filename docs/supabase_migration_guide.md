# PostgreSQL / Supabase migration runbook

Do not deploy this branch to the existing database until exposed credentials are rotated and a backup restoration has been tested. Copy connection values from your provider into deployment secrets; never paste them into Git or log output.

Set DATABASE_URL to the application connection and DIRECT_URL to the direct/migration connection. Verify pool limits and migration connectivity with your provider. Use a separate staging database for pre-prod.

For an empty database, run `npx prisma migrate deploy` from server. It applies the legacy baseline followed by the isolated v2 tables. For an existing database previously managed by db push, first compare the live schema with the baseline in a disposable clone and resolve any drift. Only after confirming equivalence, run `npx prisma migrate resolve --applied 202609150001_baseline`, then `npx prisma migrate deploy`. Do not mark the baseline applied to an empty database or blindly mark it after a failure.

V2 never trusts legacy userId values. Old unsigned offers are not imported. Both passengers need the v2 client, configured against the same v2 service. Retain the old tables temporarily for rollback; the owner must choose and execute a deletion/retention plan for legacy production data.

Before production: back up, restore into staging, compare row counts, apply migrations, run the API integration tests against a disposable local test database, and rehearse rollback. A code rollback must never run destructive reverse migrations on passenger data. Disable automatic deployment on the hosting provider; use the reviewed-release workflow only after all release gates are satisfied.
