# PULSE // MOBILE (Release V1.0)

Cross-platform **Offline-First Field Operations Mobile Application** engineered with **React Native**, **Expo SDK 58**, **Expo Router**, **Strict TypeScript**, **Zustand + AsyncStorage**, and hardware-backed **Biometric Security**.

Designed around an **Industrial Mobile** aesthetic (high-contrast `#09090B` canvas, `#111114` cards, `1px` structural borders, Apple HIG & Material Design 3 `48x48dp` minimum touch targets, and tactile haptic feedback).

---

## Architecture Overview

```text
pulse-mobile/
├── app/
│   ├── _layout.tsx                 # Root SafeAreaProvider, StatusBar & Expo Router Stack
│   ├── lock.tsx                    # Biometric Gate (FaceID/TouchID) + PIN (2026) + 1-Click Demo Unlock
│   └── (tabs)/
│       ├── _layout.tsx             # Persistent OperationalHeader + 4-tab bottom navigation
│       ├── index.tsx               # Command: Adaptive KPI grid, sync engine monitor & operations feed
│       ├── capture.tsx             # Capture: One-handed report form, GPS telemetry & haptic QR scanner
│       ├── queue.tsx               # Sync Queue: Packet audit, SHA-256 ledger, fault simulation & retry
│       └── device.tsx              # Device Lab: Live viewport telemetry & multi-device simulator
├── src/
│   ├── components/
│   │   ├── OperationalHeader.tsx   # Real-time ONLINE / OFFLINE AIRPLANE toggle + security badge
│   │   └── OperationCard.tsx       # Reusable packet card with SHA-256 hash & retry controls
│   ├── services/
│   │   └── biometricAuth.ts        # expo-local-authentication + expo-secure-store + PIN 2026 fallback
│   ├── store/
│   │   └── usePulseStore.ts        # Zustand Offline-First store persisted in AsyncStorage
│   ├── theme/
│   │   ├── adaptive.ts             # useAdaptiveLayout() hook & calculateAdaptiveMetrics() engine
│   │   └── colors.ts               # Industrial high-contrast palette tokens
│   └── utils/
│       ├── hash.ts                 # Pure TypeScript SHA-256 integrity hashing & byte auditing
│       └── haptics.ts              # Safe expo-haptics wrapper for iOS/Android
└── __tests__/
    ├── adaptive.test.ts            # Multi-device breakpoint, orientation, inset & touch tests
    ├── syncEngine.test.ts          # Offline-First queue, auto-sync, fault & retry tests
    └── biometricAuth.test.ts       # Biometric hardware, PIN 2026 & Instant Demo Unlock tests
```

---

## Core Engineering Pillars

### 1. Multi-Device Adaptive Layout Engine (`src/theme/adaptive.ts`)
`useAdaptiveLayout()` combines `useWindowDimensions()` and `useSafeAreaInsets()` with `calculateAdaptiveMetrics()` to adapt layouts across form factors in real time:

| Breakpoint | Width Range | Portrait Columns | Landscape Columns |
| :--- | :--- | :--- | :--- |
| **`compact`** | `< 380 dp` | `1` column | `1` column |
| **`standard`** | `380 – 599 dp` | `1` column | `2` columns (`3` when `>= 900 dp`) |
| **`tablet`** | `>= 600 dp` | `2` columns | `3` columns |

- **Accessibility & Ergonomics**: Clamps system font scaling to `[0.85, 1.35]` and guarantees `MIN_TOUCH_TARGET_DP = 48` across all interactive controls.
- **Safe Area Precision**: Accounts for iOS notches / Dynamic Island and Android gesture navigation bars via `safePadding`.

### 2. Offline-First Synchronization Engine (`src/store/usePulseStore.ts`)
- **Preloaded Operational Seed**: Initializes with 6 realistic industrial field reports (`INITIAL_OPERATIONS`), spanning `CRITICAL`, `HIGH`, and `NORMAL` priorities.
- **Airplane Mode Buffering**: Toggling the top header to **OFFLINE AIRPLANE** stores newly captured reports locally in `AsyncStorage` as `QUEUED_LOCAL` with a deterministic `sha256:...` digest computed in `src/utils/hash.ts`.
- **Sequential Cloud Replication**: Returning to **ONLINE** automatically flushes queued packets sequentially (`QUEUED_LOCAL` -> `SYNCING` -> `SYNCED_CLOUD`), recording simulated uplink latency (`ms`) and `syncedAt` timestamps.
- **Fault Injection & Retry**: Supports simulating gateway packet drops (`SYNC_FAILED` with incremented `retryCount`) and per-packet recovery via `retryOperation()`.

### 3. Biometric & Enclave Security (`src/services/biometricAuth.ts` + `app/lock.tsx`)
- Integrates `expo-local-authentication` (Face ID / Touch ID / Android BiometricPrompt) with `expo-secure-store` (Keychain / Android Keystore AES-256) and Web storage fallback.
- Includes fallback security PIN **`2026`** and an **Instant Demo Unlock (1-Click)** button for immediate evaluation in emulators or browsers.

---

## Running & Verification

### Prerequisites
- Node.js 20+ (verified on Node v24)
- Expo Go app (iOS / Android) or Android Studio / Xcode simulator

### Installation
```bash
npm install
```

### Run on Mobile & Web
```bash
# Start Expo Dev Server (scan QR with Expo Go on iOS/Android)
npm start

# Launch directly on Android emulator
npm run android

# Launch directly on iOS simulator (macOS)
npm run ios

# Launch Web preview
npm run web
```

### Quality & Build Verification
```bash
# 1. Strict TypeScript check
npx tsc --noEmit

# 2. Automated Jest test suite (19 tests across adaptive, sync engine & biometric auth)
npm test -- --watchAll=false

# 3. Cross-platform Web Metro bundle export
npx expo export --platform web
```
