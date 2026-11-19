# PULSE // MOBILE (Release V3.0 Production)

Aplicación móvil nativa multiplataforma de operaciones en campo con arquitectura **Offline-First**, **Ledger Criptográfico Encadenado (Tamper-Evident SHA-256)**, **evidencia fotográfica sellada con EXIF/GPS** y **telemetría física en tiempo real**, construida con **React Native**, **Expo SDK 58**, **Expo Router**, **TypeScript estricto** y **Zustand + AsyncStorage**.

Diseñada bajo una estética **Industrial Mobile** de alto contraste (`#09090B` de fondo, tarjetas `#111114`, áreas táctiles mínimas de `48x48dp` conforme a Apple HIG y Material Design 3, manejo completo de Safe Areas y virtualización con `FlatList`).

---

## Arquitectura del Proyecto

```text
pulse-mobile/
├── app/
│   ├── _layout.tsx                     # SafeAreaProvider, StatusBar oscura y Stack de Expo Router
│   ├── lock.tsx                        # Biometría automática + Enrolamiento de PIN SHA-256 en SecureStore
│   └── (tabs)/
│       ├── _layout.tsx                 # OperationalHeader persistente + barra inferior dinámica con insets
│       ├── index.tsx                   # Command: KPIs, estado de cadena SHA-256 e inspector rápido
│       ├── capture.tsx                 # Capture: GPS + Cámara QR + Foto Evidencia + Sellado Encadenado
│       ├── queue.tsx                   # Sync Queue: FlatList virtualizado, Banner de Cadena y Export JSON/CSV
│       └── device.tsx                  # Device Lab: Batería + Acelerómetro en vivo, Perfil Operador y Endpoint
├── src/
│   ├── components/
│   │   ├── OperationalHeader.tsx       # Listener real OS + callsign de operador + compuerta biométrica
│   │   ├── OperationCard.tsx           # Tarjeta con miniatura fotográfica, índice #N y prevHash
│   │   └── OperationInspectorModal.tsx # Inspector criptográfico (Foto, Mapa GPS, Hashes y syncLog)
│   ├── services/
│   │   ├── ledgerIntegrity.ts          # Encadenamiento prevHash y auditoría verifyLedgerIntegrity()
│   │   ├── photoEvidence.ts            # Captura de evidencia con expo-image-picker, EXIF y GPS
│   │   ├── deviceTelemetry.ts          # expo-battery + expo-sensors Accelerometer (STATIC / MOVING_IN_FIELD)
│   │   ├── operatorProfile.ts          # Identidad (Operator ID, Callsign, Unit/Sector) en SecureStore
│   │   ├── biometricAuth.ts            # expo-local-authentication + PIN SHA-256 en expo-secure-store
│   │   ├── networkMonitor.ts           # expo-network (Wi-Fi/Celular/Modo Avión y auto-sync al reconectar)
│   │   ├── syncClient.ts               # Conector HTTP real (timeout + backoff exponencial) y ledger local
│   │   └── auditExporter.ts            # Exportación JSON/CSV con verificación de cadena (expo-sharing)
│   ├── store/
│   │   └── usePulseStore.ts            # Store Zustand Offline-First persistido en AsyncStorage
│   ├── theme/
│   │   ├── adaptive.ts                 # useAdaptiveLayout(), clampFont(), maxContentWidth=960 y Safe Areas
│   │   └── colors.ts                   # Tokens de paleta industrial
│   ├── types/
│   │   └── operations.ts               # Contratos FieldOperation, PhotoEvidence, OperatorProfile y SyncAttemptLog
│   └── utils/
│       ├── hash.ts                     # Digest SHA-256 nativo con expo-crypto
│       └── haptics.ts                  # Retroalimentación háptica segura para iOS/Android
└── __tests__/
    ├── ledgerIntegrity.test.ts         # Pruebas de cadena prevHash, alteración local, foto y operador
    ├── telemetry.test.ts               # Pruebas de batería, acelerómetro, foto EXIF y perfil operador
    ├── syncEngine.test.ts              # Pruebas de red real, backoff HTTP, SHA-256 y exportación V3
    ├── adaptive.test.ts                # Pruebas de breakpoints, Safe Areas horizontales y clampFont
    └── biometricAuth.test.ts           # Pruebas de biometría por hardware y PIN en SecureStore
```

---

## Capacidades de Producción V3.0

### 1. Ledger Criptográfico Encadenado (`src/services/ledgerIntegrity.ts`)
- Cada operación calcula su hash `SHA-256` real (`expo-crypto`) e incorpora el `prevHash` del registro inmediatamente anterior (partiendo de `GENESIS_HASH` en `chainIndex: 0`).
- `verifyLedgerIntegrity(records)` audita toda la cadena cronológica y certifica `VERIFIED_CHAIN` (verde) o detecta manipulaciones con `TAMPER_DETECTED` (rojo) directamente en `Sync Queue`.

### 2. Evidencia Fotográfica Sellada (`src/services/photoEvidence.ts` y `app/(tabs)/capture.tsx`)
- Captura fotografías comprimidas reales con `expo-image-picker` (`launchCameraAsync` / `launchImageLibraryAsync`), adjuntando resolución, timestamp UTC, resumen EXIF y coordenadas GPS vinculadas al hash SHA-256 del reporte.
- Muestra miniaturas en cada tarjeta y vista completa dentro del modal de inspección.

### 3. Telemetría Física e Identidad de Operador (`src/services/deviceTelemetry.ts`, `src/services/operatorProfile.ts`)
- **Batería y Movimiento (`expo-battery` + `expo-sensors`)**: Lee nivel de batería, estado de carga y acelerómetro en 3 ejes (`500ms`) para clasificar al operador como `STATIC` o `MOVING_IN_FIELD`, con degradación segura en Web/emuladores.
- **Perfil de Operador**: Configura y guarda `Operator ID`, `Callsign / Nombre` y `Unit / Sector` en `expo-secure-store`, incrustándolo en cada paquete firmado y en los archivos `JSON` y `CSV` exportados.

### 4. Rendimiento Nativo con `FlatList` e Inspector Criptográfico (`app/(tabs)/queue.tsx`, `src/components/OperationInspectorModal.tsx`)
- Lista virtualizada multi-columna con `FlatList` (`keyExtractor`, `removeClippedSubviews`, `initialNumToRender`, `maxToRenderPerBatch`) para manejar cientos de registros sin pérdida de FPS.
- Al tocar cualquier tarjeta se abre el **Inspector Criptográfico** con evidencia fotográfica, enlace externo a Google Maps, `Payload Hash (SHA-256)`, `Previous Hash`, verificación de cadena y log cronológico de intentos de sincronización.

---

## Ejecución y Verificación

```bash
# Instalar dependencias
npm install

# Iniciar servidor Expo (Android, iOS, Web)
npm start

# Verificación estricta de TypeScript (0 errores)
npx tsc --noEmit

# Suite automatizada Jest (35 tests en 5 suites)
npm test -- --watchAll=false

# Exportación de bundle multiplataforma Web / Metro
npx expo export --platform web
```
