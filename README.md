# PULSE // MOBILE (Release V3.0 Production)

Cross-platform **Offline-First Field Operations Mobile Application** engineered with **React Native**, **Expo SDK 58**, **Expo Router**, **Strict TypeScript**, **Zustand + AsyncStorage**, a **Tamper-Evident SHA-256 Hash Chain Ledger**, **EXIF/GPS-sealed Photographic Evidence**, and live **Physical Sensor Telemetry**.

Designed with an **Industrial Mobile** visual system (`#09090B` canvas, `#111114` cards, `48x48dp` Apple HIG / Material Design 3 touch targets, atomic Safe Area frame + cutout handling across portrait and phone landscape, and virtualized `FlatList` rendering).

---

## Architecture Overview

```text
pulse-mobile/
├── app/
│   ├── _layout.tsx                     # Root Slot layout, StatusBar & web 100dvh viewport sync
│   ├── +html.tsx                       # Web HTML shell with viewport-fit=cover & 100dvh reset
│   ├── lock.tsx                        # Auto-Biometric Prompt + Encrypted SecureStore User PIN Setup
│   └── (tabs)/
│       ├── _layout.tsx                 # OperationalHeader + detachInactiveScreens={false} dynamic TabBar
│       ├── index.tsx                   # Command: KPIs, hash-chain indicator & flexbox tap-to-inspect feed
│       ├── capture.tsx                 # Capture: GPS + QR Camera + Photo Evidence + SHA-256 Chain Seal
│       ├── queue.tsx                   # Sync Queue: Virtualized FlatList, Chain Banner & JSON/CSV export
│       └── device.tsx                  # Device Lab: Battery + Accelerometer telemetry, Operator Profile & HTTP URL
├── src/
│   ├── components/
│   │   ├── OperationalHeader.tsx       # Live OS network listener + operator callsign + security badge
│   │   ├── OperationCard.tsx           # Overflow-safe card with photo thumbnail, chain #index & prevHash
│   │   └── OperationInspectorModal.tsx # Landscape-aware Cryptographic Inspector (Photo, GPS Maps, hashes & syncLog)
│   ├── services/
│   │   ├── ledgerIntegrity.ts          # Tamper-evident prevHash linking & verifyLedgerIntegrity() auditor
│   │   ├── photoEvidence.ts            # expo-image-picker camera & library capture with EXIF + GPS binding
│   │   ├── deviceTelemetry.ts          # expo-battery + expo-sensors Accelerometer (STATIC vs MOVING_IN_FIELD)
│   │   ├── operatorProfile.ts          # Operator ID, Callsign & Unit/Sector persisted in SecureStore
│   │   ├── biometricAuth.ts            # expo-local-authentication + SHA-256 PIN in expo-secure-store
│   │   ├── networkMonitor.ts           # expo-network connectivity & IPv4 listener (auto-sync on reconnect)
│   │   ├── syncClient.ts               # Real HTTP fetch client (timeout + backoff) & verified local ledger
│   │   └── auditExporter.ts            # JSON/CSV export with chainVerification via expo-file-system & expo-sharing
│   ├── store/
│   │   └── usePulseStore.ts            # Zustand Offline-First store persisted in AsyncStorage
│   ├── theme/
│   │   ├── adaptive.ts                 # useSafeAreaFrame()-synced useAdaptiveLayout(), clampFont() & contentPadding
│   │   └── colors.ts                   # Industrial high-contrast palette tokens
│   ├── types/
│   │   └── operations.ts               # FieldOperation, PhotoEvidence, OperatorProfile & SyncAttemptLog contracts
│   └── utils/
│       ├── hash.ts                     # expo-crypto SHA-256 digest & verification
│       └── haptics.ts                  # Safe expo-haptics feedback helper
├── __tests__/
│   ├── ledgerIntegrity.test.ts         # Hash chain linking, tampering, photo/operator mutation & order tests
│   ├── telemetry.test.ts               # Battery, accelerometer motion classification, photo & profile tests
│   ├── syncEngine.test.ts              # Network transitions, HTTP backoff, SHA-256 & V3 JSON/CSV export tests
│   ├── adaptive.test.ts                # Breakpoints, asymmetric landscape Safe Areas, clampFont & 960dp centering
│   └── biometricAuth.test.ts           # Hardware biometrics & SecureStore PIN enrollment tests
├── app.json                            # Expo SDK 58 config, native permissions & Android keyboard resize
└── eas.json                            # EAS Build profiles (development, preview APK, production)
```

---

## V3.0 Production Capabilities

### 1. Tamper-Evident SHA-256 Hash Chain (`src/services/ledgerIntegrity.ts`)
- Every captured field operation computes its canonical `SHA-256` digest via `expo-crypto` and embeds `prevHash` pointing to the immediately preceding record (starting from `GENESIS_HASH` at `chainIndex: 0`).
- `verifyLedgerIntegrity(records)` traverses the chronological ledger, verifying both payload integrity and every `prevHash` pointer to certify `VERIFIED_CHAIN` (green) or flag `TAMPER_DETECTED` (red) in **Sync Queue**.

### 2. Sealed Photographic Evidence (`src/services/photoEvidence.ts` & `app/(tabs)/capture.tsx`)
- Uses `expo-image-picker` (`launchCameraAsync` / `launchImageLibraryAsync`) to capture compressed field photos with EXIF metadata, pixel resolution, UTC timestamp, and active GPS coordinates bound inside the record's SHA-256 envelope.
- Displays thumbnails on cards and full-resolution previews inside `OperationInspectorModal`.

### 3. Live Physical Device Telemetry & Operator Identity (`src/services/deviceTelemetry.ts`, `src/services/operatorProfile.ts`)
- **Battery & Motion (`expo-battery` + `expo-sensors`)**: Streams live battery level, charging state, and 3-axis accelerometer g-force (`500ms` sampling) to classify `STATIC` vs `MOVING_IN_FIELD`, with graceful degradation on Web or simulators.
- **Operator Identity**: Persists `Operator ID`, `Callsign`, and `Unit / Sector` in `expo-secure-store`, signing every captured record and JSON/CSV audit export.

### 4. Multi-Device Adaptive Layout & Rotation Stability (`src/theme/adaptive.ts`, `app/(tabs)/_layout.tsx`)
- **Atomic Native Frame + Insets**: `useAdaptiveLayout()` reads `useSafeAreaFrame()` on native iOS/Android so viewport dimensions and cutout/navigation-bar insets update atomically on orientation changes.
- **Rotation-Safe Navigation**: Root `<Slot />` and `<Tabs detachInactiveScreens={false}>` prevent `react-native-screens` from clipping rotated screens to stale portrait bounds, while `contentPaddingLeft` / `contentPaddingRight` and `canSplitTwoColumns` keep rotated phones (`height < 500`) full-width without uneven voids or overflow.

### 5. High-Performance Virtualized Audit & Inspector (`app/(tabs)/queue.tsx`, `src/components/OperationInspectorModal.tsx`)
- Multi-column `FlatList` (`keyExtractor`, `initialNumToRender`, `maxToRenderPerBatch`, orientation-reactive `key`) handles large operation ledgers smoothly across portrait and landscape.
- Tapping any record opens the orientation-aware **Cryptographic Inspector Modal** displaying full photo evidence, external Maps link (`Linking.openURL`), full `Payload Hash (SHA-256)`, `Previous Hash`, chain verification badge, and chronological `syncLog`.

---

## Running & Verification

```bash
# Install dependencies
npm install

# Start Expo Dev Server (Android, iOS, Web)
npm start

# Run directly on Android / iOS / Web
npm run android
npm run ios
npm run web

# Build Android internal preview APK via EAS
npx eas build --platform android --profile preview

# Strict TypeScript check (0 errors)
npx tsc --noEmit

# Automated Jest suite (37 tests across 5 suites)
npm test -- --watchAll=false

# Cross-platform Metro web bundle export
npx expo export --platform web
```
