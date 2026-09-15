# Google Play release status

Updated 15 September 2026 for `pre-prod`. A checked item means implemented or locally verified; it does not mean Google Play has approved the app.

## Implemented in this branch

- [x] Removed tracked credentials, databases and logs; added examples, ignores and a secret check.
- [x] Added signed installation ownership, strict transitions, input/payload limits and replay protection.
- [x] Added two independent acceptances and completions with stable IDs and transactional server writes.
- [x] Added complete cloud reconciliation, durable retries, explicit HTTP errors and repaired Nearby relay/reconnect behavior.
- [x] Added class, service date, segment, seat and target-coach compatibility, including same-berth swaps.
- [x] Removed multi-person, background geofence, mock PNR/vacancy/toilet features and their release claims.
- [x] Added report/block, deletion, retention cleanup and bounded storage/queues/server records.
- [x] Rewrote release UI, privacy, terms and empty/error states; release language is English.
- [x] Added final vector-based branding assets.
- [x] Added reviewed migrations, protected diagnostics and gated exact-commit deployment.
- [x] Configured API 36 and removed background location, audio, storage and overlay permissions.
- [x] Added protocol, restart, replay, cloud failure, two-phone, competing-consent and three-peer tests.

## Verified locally

- [x] Client TypeScript, Jest (12 focused V2 tests), Android JavaScript export and Expo Android prebuild.
- [x] Backend TypeScript/Prisma build and existing backend tests (40).
- [x] Current-tree credential scan and generated-native consistency checks.

## Required before deployment or Play submission

- [ ] Rotate all database credentials exposed in Git history, update provider secrets and inspect access logs.
- [ ] Use a separate staging database/API. Test backup restoration, migration drift and connection limits.
- [ ] Publish the privacy text at a stable HTTPS URL and configure verified support email/build variables.
- [ ] Configure a random server `ADMIN_TOKEN`; restrict moderation access and define report response ownership.
- [ ] Review hosting/Google SDK logging and retention, then complete Data safety from the final binary.
- [ ] Pass CI PostgreSQL integration, Docker and native Android builds, which were unavailable locally.
- [ ] Build/sign the `.aab`, enable Play App Signing, protect the upload key and confirm `com.railmitra.app`.
- [ ] Inspect the final manifest and AAB for API 36, 64-bit ABIs and 16 KB page compatibility.
- [ ] Test an internal-track install, accessibility, screen sizes, text scaling, keyboard and edge-to-edge layout.
- [ ] Run the physical test scenarios below on two and three phones, including real train conditions.
- [ ] Complete developer verification, store listing assets/details, content rating, audience, ads, app access, Data safety and applicable Nearby/UGC declarations.
- [ ] Give reviewers a safe test train/date and two-passenger instructions; address the pre-launch report.
- [ ] If required by the Console, run a closed test with at least 12 opted-in testers for 14 continuous days.
- [ ] Review current dependency alerts. Remaining findings are transitive framework/tooling advisories; do not claim vulnerability-free status.
- [ ] Decide retention/deletion for legacy production tables. V2 does not import old unsigned identities.

## Physical acceptance scenarios

1. Two phones create, discover, independently accept and independently complete; both end at Completed.
2. Decline/cancel before and after one acceptance; timeout and passenger no-show.
3. Cloud-only, nearby-only and transport switching.
4. Three phones relay, deduplicate, depart and reconnect.
5. Competing accepts, repeated taps, duplicates, replay and out-of-order delivery.
6. Airplane mode, HTTP 500, slow response, lost acknowledgment and recovery.
7. Process death, relaunch, lock, foreground/background, permission refusal and radios disabled.
8. Different class/segment, invalid seat, expiry and overnight service date.
9. Deletion with queued work; ensure the offer never reappears.
10. Supported Android/OEM versions, signing, accessibility, 16 KB devices and real trains.
