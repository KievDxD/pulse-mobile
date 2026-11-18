# PULSE // MOBILE (Release V2.0 Production)

Cross-platform **Offline-First Field Operations Mobile Application** engineered with **React Native**, **Expo SDK 58**, **Expo Router**, **Strict TypeScript**, **Zustand + AsyncStorage**, real device sensors (**GPS, Camera QR, Network State, Hardware Biometrics**), and **native SHA-256 cryptography**.

Built with an **Industrial Mobile** design system (`#09090B` canvas, `#111114` structural cards, `48x48dp` Apple HIG / Material Design 3 touch targets, full Safe Area cutout handling, and tactile haptic feedback).

---

## Architecture Overview

```text
pulse-mobile/
├── app/
│   ├── _layout.tsx                 # SafeAreaProvider, StatusBar & Expo Router Stack
│   ├── lock.tsx                    # Auto-Biometric Prompt + Encrypted SecureStore User PIN Setup
│   └── (tabs)/
│       ├── _layout.tsx             # Persistent OperationalHeader + Safe-Area dynamic 4-tab bar
│       ├── index.tsx               # Command: Live KPIs, clean Empty State, real network & sync status
│       ├── capture.tsx             # Capture: Real GPS (expo-location) + Camera QR (expo-camera) + SHA-256
│       ├── queue.tsx               # Sync Queue: Audit ledger, JSON/CSV export (expo-sharing) & retries
│       └── device.tsx              # Device Lab: Live sensor telemetry, HTTP Sync URL & Viewport Simulator
├── src/
│   ├── components/
│   │   ├── OperationalHeader.tsx   # Live OS network listener (WIFI/CELLULAR/OFFLINE) + security gate
│   │   └── OperationCard.tsx       # Overflow-safe packet card with GPS, SHA-256 & transport mode
│   ├── services/
│   │   ├── biometricAuth.ts        # expo-local-authentication + SHA-256 salted PIN in expo-secure-store
│   │   ├── networkMonitor.ts       # expo-network real connectivity & IPv4 listener (Airplane Mode auto-sync)
│   │   ├── syncClient.ts           # Real HTTP fetch client (timeout + backoff) & verified local ledger
│   │   └── auditExporter.ts        # expo-file-system + expo-sharing JSON/CSV audit export
│   ├── store/
│   │   └── usePulseStore.ts        # Zustand Offline-First store persisted in AsyncStorage (clean init)
│   ├── theme/
│   │   ├── adaptive.ts             # useAdaptiveLayout(), clampFont(), maxContentWidth=960, Safe Areas
│   │   └── colors.ts               # Industrial high-contrast palette tokens
│   ├── types/
│   │   └── operations.ts           # Shared TypeScript contracts & canonical payload builder
│   └── utils/
│       ├── hash.ts                 # expo-crypto SHA-256 digest & integrity verification
│       └── haptics.ts              # Safe expo-haptics wrapper for iOS/Android
└── __tests__/
    ├── adaptive.test.ts            # Breakpoints, landscape Safe Areas, clampFont & 960dp maxWidth tests
    ├── syncEngine.test.ts          # Real network transitions, HTTP backoff, SHA-256 & export tests
    └── biometricAuth.test.ts       # Hardware biometrics & SecureStore PIN enrollment tests
```

---

## V2.0 Production Capabilities (Zero Mock Data / Zero Demo Bypasses)

### 1. Real Hardware Sensors & Native Cryptography
- **Biometrics & Encrypted PIN (`src/services/biometricAuth.ts` + `app/lock.tsx`)**: Automatically inspects `LocalAuthentication.hasHardwareAsync()` / `isEnrolledAsync()` and launches native FaceID/Fingerprint verification on startup. First-time operators enroll a personal 4-digit PIN hashed with SHA-256 and stored in `expo-secure-store`.
- **Real OS Connectivity (`src/services/networkMonitor.ts`)**: Subscribes to `expo-network` (`getNetworkStateAsync`, `getIpAddressAsync`, `addNetworkStateListener`) to detect Wi-Fi, Cellular, and Airplane Mode in real time. Turning Airplane Mode off automatically flushes queued packets without manual intervention.
- **Hardware GPS (`app/(tabs)/capture.tsx`)**: Requests foreground location permission via `expo-location` and captures real `latitude`, `longitude`, `accuracy` (m), and `altitude` (m), with manual coordinate fallback if permissions are denied.
- **Live Camera QR/Barcode Scanner (`app/(tabs)/capture.tsx`)**: Uses `CameraView` from `expo-camera` configured for `['qr', 'code128', 'ean13']` with tactile haptic confirmation and manual code fallback.
- **Native SHA-256 Integrity (`src/utils/hash.ts`)**: Uses `expo-crypto` (`Crypto.digestStringAsync(SHA256)`) to seal operations and verify payload integrity pre- and post-synchronization.

### 2. Real HTTP Sync Client & Audit Export (`src/services/syncClient.ts`, `src/services/auditExporter.ts`)
- Supports configuring a production REST API endpoint in **Device Lab** to `POST` signed packets using `fetch` with `AbortController` timeouts and exponential backoff retries.
- When no remote endpoint is configured, commits verified operations to a local SHA-256 transactional ledger (`AsyncStorage`) with post-write checksum validation.
- Exports complete operational histories (including SHA-256 digests and GPS telemetry) to **JSON** or **RFC-4180 CSV** via `expo-file-system` + `expo-sharing` (or browser file download on Web).

### 3. Zero-Overflow Adaptive Layout & Safe Area Precision (`src/theme/adaptive.ts`)
- Centers content at `maxContentWidth = 960` on tablets/wide screens and dynamically adapts `1 | 2 | 3` columns across `compact` (`< 380dp`), `standard` (`380–599dp`), and `tablet` (`>= 600dp`).
- Applies explicit `insets.top`, `insets.bottom`, `insets.left`, and `insets.right` (including landscape cutouts and bottom navigation bars via dynamic `tabBarHeight` and `scrollBottomPadding = insets.bottom + 96`).
- Provides `clampFont()` (`[0.85, 1.35]`) and enforces `flexShrink: 1` across horizontal rows so no text clips or overlaps on any screen.

---

## Running & Verification

```bash
# Install dependencies
npm install

# Start Expo Dev Server (Android, iOS, Web)
npm start

# Strict TypeScript verification (0 errors)
npx tsc --noEmit

# Run automated Jest test suite (22 tests)
npm test -- --watchAll=false

# Export cross-platform Metro web bundle
npx expo export --platform web
```
