# RailMitra Codebase Analysis Report

## 1. Overview
RailMitra (Seat Seeker) is a full-stack application designed for crowdsourced train seat availability and swapping. The application comprises a mobile frontend built with React Native and Expo, and a backend server built with Node.js, Express, and Prisma.

## 2. Frontend Architecture (React Native / Expo)
- **Framework**: Expo (v54), utilizing the new file-based routing (`expo-router`).
- **State & Data Management**: Custom hooks and services are used. Services include `apiService.ts`, `swapEngine.ts`, and `swapStore.ts` for managing seat swaps and application state.
- **Key Features**:
  - Offline capabilities with Mesh networking (`NearbyMeshBridge.ts`, `meshBridge.ts`), allowing users to connect and negotiate swaps locally without internet using Bluetooth/WiFi Direct.
  - Multi-tab navigation (History, Settings, PNR tracking, Route details, Seat Swaps, etc.).
  - Localization support (`localization.ts`).
  - Telemetry (`telemetry.ts`) for analytics.
- **Testing**: Jest and React Native Testing Library setup is in place (`jest.config.js`).

## 3. Backend Architecture (Node.js / Express)
- **Location**: `/server` directory.
- **Frameworks**: Express.js with TypeScript (`ts-node`).
- **Database**: Prisma ORM (`@prisma/client` v6.4.0) is used to interact with the database. Contains a `prisma/seed.ts` script for populating initial data.
- **Core Modules**:
  - `index.ts`: Main entry point configuring Express and middleware.
  - `core-logic.ts`: Business logic regarding seat availability and crowdsourcing.
  - `pnr-parser.ts`: Utility for parsing PNR data.
  - `smart-utilities.ts`: Helper functions.
  - `telemetry.ts`: Server-side analytics and error tracking.
- **Security**: Features `cors` and `express-rate-limit` for API protection.
- **Testing**: Jest and `ts-jest` for unit testing.

## 4. CI/CD & DevOps
- **GitHub Actions**: Configured in `.github/workflows/`.
  - `ci.yml`: General CI checks.
  - `backend-ci.yml`: Specific linting, testing, and building for the backend.
  - `mobile-ci.yml`: Verification and build processes for the Expo app.
- **Deployment**: Contains `render.yaml` for potential Render deployment, and Docker support (`Dockerfile`, `.dockerignore` in the server directory). Expo configuration (`eas.json`, `app.json`) handles mobile app builds via Expo Application Services (EAS).

## 5. Summary and Recommendations
The codebase is well-structured with clear separation of concerns between standard UI, offline P2P networking, and backend services.
- **Mesh Networking**: The offline mesh networking is a standout feature and should be carefully tested across different device vendors due to Android API fragmentations.
- **Type Safety**: The project strongly utilizes TypeScript across both frontend and backend natively.
- **Testing Coverage**: Ensure robust integration tests exist between `swapEngine.ts` and the backend, particularly for offline-to-online sync resolution.
