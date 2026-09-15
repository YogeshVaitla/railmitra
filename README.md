# RailMitra

RailMitra V1 coordinates a voluntary seat exchange between two Android passengers. Both phones independently sign acceptance; the exchange is complete only after both phones confirm it. The app does not alter railway reservations and is not affiliated with Indian Railways or IRCTC.

## Supported release scope

- Direct two-passenger swaps in SL, 3A, 3E and 2A
- Same train number, service date, class and identical ticket segments
- Berth preference and optional target coach, including same-berth coach swaps
- Foreground nearby Bluetooth/Wi-Fi exchange plus optional HTTPS cloud sync
- Signed installation identity, replay-safe cancellation, retry queue, report/block and data deletion

The release does not include PNR verification, ticket booking, vacancy/toilet demos, family optimization, multi-person cycles, chat, GPS tracking, background alerts, payments or iOS support.

## Local checks

```bash
npm ci --ignore-scripts
npm run lint
npx tsc --noEmit
npm test -- --runInBand
node scripts/check-secrets.cjs
npx expo prebuild --platform android --no-install
node scripts/check-native.cjs
```

The server requires PostgreSQL. Copy `server/.env.example` to an untracked local `.env`, use a disposable `railmitra_test` database for integration tests, and run:

```bash
cd server
npm ci --ignore-scripts
npm run build
npx prisma migrate deploy
TEST_DATABASE_URL=postgresql://railmitra_test:test_password@localhost:5432/railmitra_test npm test -- --runInBand
```

For app builds, configure `EXPO_PUBLIC_API_URL`, `EXPO_PUBLIC_PRIVACY_URL` and `EXPO_PUBLIC_SUPPORT_EMAIL` in distinct preview/production EAS environments. Production configuration fails if these public values are missing or use placeholders. Configure `DATABASE_URL`, `DIRECT_URL`, a random `ADMIN_TOKEN`, `TRUST_PROXY_HOPS=1` and release version metadata in the server secret manager.

## Deployment

Automatic backend deployment is disabled. The manual production workflow runs all client, PostgreSQL, Docker and Android gates, requests deployment of the exact reviewed main-branch commit, and verifies that exact commit from `/api/health`. `pre-prod` is for staging and review. See `docs/supabase_migration_guide.md` before applying migrations to an existing database.

## Release responsibility

Source checks cannot complete external Play Console work or validate physical radios. Before submission, complete every unchecked item in `PLAY_RELEASE_STATUS.md`. Never reuse credentials previously committed to this repository; rotate them with the provider and review access logs.
