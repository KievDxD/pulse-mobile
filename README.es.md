# PULSE // MOBILE (Release V1.0)

Aplicación móvil nativa multiplataforma de operaciones en campo con arquitectura **Offline-First**, **diseño adaptativo multi-dispositivo** y **seguridad biométrica respaldada por hardware**, construida con **React Native**, **Expo SDK 58**, **Expo Router**, **TypeScript estricto** y **Zustand + AsyncStorage**.

Diseñada bajo una estética **Industrial Mobile** de alto contraste (`#09090B` de fondo, tarjetas `#111114`, bordes estructurales `1px`, áreas táctiles mínimas de `48x48dp` conforme a Apple HIG y Material Design 3, y retroalimentación háptica con `expo-haptics`).

---

## Arquitectura del Proyecto

```text
pulse-mobile/
├── app/
│   ├── _layout.tsx                 # SafeAreaProvider, StatusBar oscura y Stack de Expo Router
│   ├── lock.tsx                    # Compuerta biométrica (FaceID/TouchID) + PIN (2026) + 1-Click Demo
│   └── (tabs)/
│       ├── _layout.tsx             # OperationalHeader persistente + barra inferior de 4 pestañas
│       ├── index.tsx               # Command: KPIs adaptativos, motor de sincronización y feed reciente
│       ├── capture.tsx             # Capture: Formulario ergonómico, GPS y escáner QR háptico
│       ├── queue.tsx               # Sync Queue: Auditoría de paquetes, SHA-256, fallo simulado y reintento
│       └── device.tsx              # Device Lab: Inspector de métricas vivas y simulador multi-dispositivo
├── src/
│   ├── components/
│   │   ├── OperationalHeader.tsx   # Selector ONLINE / OFFLINE AIRPLANE en tiempo real + estado de seguridad
│   │   └── OperationCard.tsx       # Tarjeta reutilizable de operación con digest SHA-256 y reintento
│   ├── services/
│   │   └── biometricAuth.ts        # expo-local-authentication + expo-secure-store + PIN 2026
│   ├── store/
│   │   └── usePulseStore.ts        # Store Zustand Offline-First persistido en AsyncStorage
│   ├── theme/
│   │   ├── adaptive.ts             # Hook useAdaptiveLayout() y motor calculateAdaptiveMetrics()
│   │   └── colors.ts               # Tokens de paleta industrial de alto contraste
│   └── utils/
│       ├── hash.ts                 # Cómputo SHA-256 determinístico en TypeScript puro
│       └── haptics.ts              # Wrapper seguro de expo-haptics para iOS/Android
└── __tests__/
    ├── adaptive.test.ts            # Pruebas de breakpoints, orientación, insets y áreas táctiles
    ├── syncEngine.test.ts          # Pruebas del motor Offline-First, auto-sync, fallos y reintentos
    └── biometricAuth.test.ts       # Pruebas de biometría, PIN 2026 e Instant Demo Unlock
```

---

## Pilares de Ingeniería

### 1. Motor de Adaptabilidad Multi-Dispositivo (`src/theme/adaptive.ts`)
El hook `useAdaptiveLayout()` combina `useWindowDimensions()` y `useSafeAreaInsets()` sobre la función pura `calculateAdaptiveMetrics()` para recalcular la UI en tiempo real:

| Breakpoint | Rango de Ancho | Columnas Vertical (`portrait`) | Columnas Horizontal (`landscape`) |
| :--- | :--- | :--- | :--- |
| **`compact`** | `< 380 dp` | `1` columna | `1` columna |
| **`standard`** | `380 – 599 dp` | `1` columna | `2` columnas (`3` si `>= 900 dp`) |
| **`tablet`** | `>= 600 dp` | `2` columnas | `3` columnas |

- **Accesibilidad y Ergonomía**: Limita el escalado tipográfico del sistema al rango `[0.85, 1.35]` y garantiza `MIN_TOUCH_TARGET_DP = 48` en botones y controles.
- **Áreas Seguras**: Calcula `safePadding` contemplando notches, Dynamic Island en iOS y barras de navegación por gestos en Android.

### 2. Motor Offline-First con Cola de Sincronización (`src/store/usePulseStore.ts`)
- **Datos Iniciales Realistas**: Precarga 6 operaciones de campo (`INITIAL_OPERATIONS`) con prioridades `CRITICAL`, `HIGH` y `NORMAL`.
- **Modo Avión / Sin Conexión**: Al activar **OFFLINE AIRPLANE** en el encabezado, los nuevos reportes se almacenan localmente en `AsyncStorage` con estado `QUEUED_LOCAL` y firma de integridad `sha256:...` (`src/utils/hash.ts`).
- **Sincronización Secuencial al Reconectar**: Al volver a **ONLINE**, el motor procesa secuencialmente los paquetes pendientes (`QUEUED_LOCAL` -> `SYNCING` -> `SYNCED_CLOUD`), calculando latencia (`ms`) y registrando `syncedAt`.
- **Simulación de Fallos y Reintentos**: Permite inyectar caídas de red (`SYNC_FAILED` con incremento de `retryCount`) y recuperar paquetes individuales mediante `retryOperation()`.

### 3. Seguridad Biométrica y PIN (`src/services/biometricAuth.ts` + `app/lock.tsx`)
- Utiliza `expo-local-authentication` (huella dactilar / Face ID) y almacenamiento cifrado en `expo-secure-store` (Keychain en iOS / Android Keystore AES-256), con respaldo seguro para navegador.
- Incluye PIN de respaldo **`2026`** y el botón **Instant Demo Unlock (1-Click)** para acceso inmediato en emuladores o navegador web.

---

## Ejecución y Verificación

### Requisitos
- Node.js 20+ (verificado en Node v24)
- App Expo Go (iOS / Android) o emulador Android Studio / iOS Simulator

### Instalación
```bash
npm install
```

### Ejecución en Android, iOS y Web
```bash
# Iniciar servidor de desarrollo Expo
npm start

# Ejecutar en emulador Android
npm run android

# Ejecutar en simulador iOS (macOS)
npm run ios

# Ejecutar vista previa Web
npm run web
```

### Verificación de Calidad y Compilación
```bash
# 1. Validación estricta de TypeScript
npx tsc --noEmit

# 2. Suite automatizada de pruebas en Jest (19 tests)
npm test -- --watchAll=false

# 3. Exportación del bundle multiplataforma (Web / Metro)
npx expo export --platform web
```
