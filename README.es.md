# PULSE // MOBILE (Release V2.0 Production)

Aplicación móvil nativa multiplataforma de operaciones en campo con arquitectura **Offline-First**, sensores reales del dispositivo (**GPS, Cámara QR/Códigos de Barra, Estado Real de Red, Biometría por Hardware**) y criptografía nativa **SHA-256**, construida con **React Native**, **Expo SDK 58**, **Expo Router**, **TypeScript estricto** y **Zustand + AsyncStorage**.

Diseñada bajo una estética **Industrial Mobile** de alto contraste (`#09090B` de fondo, tarjetas `#111114`, áreas táctiles mínimas de `48x48dp` conforme a Apple HIG y Material Design 3, manejo completo de Safe Areas y retroalimentación háptica).

---

## Arquitectura del Proyecto

```text
pulse-mobile/
├── app/
│   ├── _layout.tsx                 # SafeAreaProvider, StatusBar oscura y Stack de Expo Router
│   ├── lock.tsx                    # Lanzamiento biométrico automático + Registro de PIN cifrado en SecureStore
│   └── (tabs)/
│       ├── _layout.tsx             # OperationalHeader persistente + barra inferior dinámica con insets.bottom
│       ├── index.tsx               # Command: KPIs vivos, Empty State limpio, estado real de red y cola
│       ├── capture.tsx             # Capture: GPS real (expo-location) + Escáner QR (expo-camera) + SHA-256
│       ├── queue.tsx               # Sync Queue: Auditoría, exportación JSON/CSV (expo-sharing) y reintentos
│       └── device.tsx              # Device Lab: Telemetría de sensores, Endpoint HTTP y Simulador Viewport
├── src/
│   ├── components/
│   │   ├── OperationalHeader.tsx   # Listener real OS (WIFI/CELLULAR/OFFLINE) + compuerta de seguridad
│   │   └── OperationCard.tsx       # Tarjeta anti-desbordamiento con GPS, SHA-256 y modo de transporte
│   ├── services/
│   │   ├── biometricAuth.ts        # expo-local-authentication + PIN SHA-256 en expo-secure-store
│   │   ├── networkMonitor.ts       # expo-network (conectividad real, IPv4 y auto-sync al salir de Modo Avión)
│   │   ├── syncClient.ts           # Cliente HTTP real (timeout + backoff exponencial) y ledger verificado
│   │   └── auditExporter.ts        # Exportación JSON/CSV con expo-file-system y expo-sharing
│   ├── store/
│   │   └── usePulseStore.ts        # Store Zustand Offline-First persistido en AsyncStorage (inicio limpio)
│   ├── theme/
│   │   ├── adaptive.ts             # useAdaptiveLayout(), clampFont(), maxContentWidth=960 y Safe Areas
│   │   └── colors.ts               # Paleta industrial de alto contraste
│   ├── types/
│   │   └── operations.ts           # Contratos TypeScript compartidos y serializador canónico
│   └── utils/
│       ├── hash.ts                 # Digest SHA-256 real con expo-crypto y verificación de integridad
│       └── haptics.ts              # Wrapper seguro de expo-haptics para iOS/Android
└── __tests__/
    ├── adaptive.test.ts            # Pruebas de breakpoints, Safe Areas horizontales, clampFont y 960dp
    ├── syncEngine.test.ts          # Pruebas de red real, backoff HTTP, SHA-256 y exportación JSON/CSV
    └── biometricAuth.test.ts       # Pruebas de biometría por hardware y enrolamiento de PIN en SecureStore
```

---

## Capacidades de Producción V2.0 (Cero Datos Falsos / Cero Botones Demo)

### 1. Sensores Reales y Criptografía Nativa
- **Biometría y PIN Cifrado (`src/services/biometricAuth.ts` + `app/lock.tsx`)**: Inspecciona `LocalAuthentication.hasHardwareAsync()` / `isEnrolledAsync()` y lanza la verificación biométrica automáticamente al abrir la app. En el primer ingreso permite configurar un PIN personal de 4 dígitos, hasheado con SHA-256 y guardado en `expo-secure-store`.
- **Conectividad Real (`src/services/networkMonitor.ts`)**: Escucha en tiempo real Wi-Fi, Datos Móviles y Modo Avión mediante `expo-network` (`getNetworkStateAsync`, `getIpAddressAsync`, `addNetworkStateListener`), sincronizando automáticamente al recuperar conexión.
- **GPS por Hardware (`app/(tabs)/capture.tsx`)**: Solicita permisos de ubicación (`expo-location`) y captura `latitude`, `longitude`, precisión (`accuracy` en metros) y altitud (`altitude`), con respaldo manual si se deniega el permiso.
- **Escáner QR / Códigos de Barra Real (`app/(tabs)/capture.tsx`)**: Utiliza `CameraView` de `expo-camera` (`['qr', 'code128', 'ean13']`) con respuesta háptica al escanear checkpoints físicos.
- **Integridad SHA-256 Real (`src/utils/hash.ts`)**: Sella cada registro con `Crypto.digestStringAsync(SHA256)` de `expo-crypto` y valida la firma antes y después de sincronizar.

### 2. Conector HTTP Real y Exportación de Auditoría (`src/services/syncClient.ts`, `src/services/auditExporter.ts`)
- Permite configurar un endpoint REST externo en **Device Lab** para enviar registros por `fetch` con `AbortController` (timeout) y reintentos con backoff exponencial.
- Cuando no hay servidor remoto configurado, persiste las operaciones en el ledger transaccional local verificado con lectura posterior SHA-256.
- Exporta el historial completo con hashes SHA-256 y coordenadas GPS en **JSON** o **CSV** usando `expo-file-system` + `expo-sharing` (o descarga directa en navegador Web).

### 3. Corrección Total de Resolución y Safe Areas (`src/theme/adaptive.ts`)
- Centra el contenido en tablets/pantallas anchas con `maxContentWidth = 960` y adapta columnas (`1 | 2 | 3`) en `compact` (`< 380dp`), `standard` (`380–599dp`) y `tablet` (`>= 600dp`).
- Aplica explícitamente `insets.top`, `insets.bottom`, `insets.left` y `insets.right` (cubriendo rotación horizontal con notches y barras de navegación inferiores mediante `tabBarHeight` dinámico y `scrollBottomPadding = insets.bottom + 96`).
- Incorpora `clampFont()` (`[0.85, 1.35]`) y `flexShrink: 1` en filas horizontales para evitar desbordamientos o textos cortados desde `320dp` hasta `1024dp+`.

---

## Ejecución y Verificación

```bash
# Instalar dependencias
npm install

# Iniciar servidor Expo (Android, iOS, Web)
npm start

# Verificación estricta de TypeScript (0 errores)
npx tsc --noEmit

# Ejecutar suite de pruebas automatizadas Jest (22 tests)
npm test -- --watchAll=false

# Exportar bundle multiplataforma Web / Metro
npx expo export --platform web
```
