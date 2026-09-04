# Deploys y versiones de la app móvil

Cómo llega Pateá a un teléfono, en las dos plataformas, y de dónde sale cada
número. Para el detalle de la clave de firma de Android y su respaldo, ver
[ANDROID_RELEASE_SIGNING.md](./ANDROID_RELEASE_SIGNING.md).

## En una línea

Un push a `feat/flutter-mobile-app` que toque `patea_mobile/` o
`codemagic.yaml` dispara **dos** builds en Codemagic: el IPA va a TestFlight y
el APK a Firebase App Distribution. No hay que subir números a mano ni correr
nada localmente.

## Versiones

`version:` en `patea_mobile/pubspec.yaml` es la única fuente del **nombre** de
versión, y vale para las dos plataformas:

```yaml
version: 1.0.2+3
#        ^^^^^ nombre  ^ número de build (se ignora en CI)
```

El **número de build** no sale del pubspec, porque cada tienda tiene su propia
regla y acordarse de subirlo a mano es exactamente el tipo de cosa que se
olvida:

| | Nombre | Número de build | De dónde sale |
| --- | --- | --- | --- |
| iOS | `1.0.2` | `CFBundleVersion` | último publicado en TestFlight + 1 |
| Android | `1.0.2` | `versionCode` | `$PROJECT_BUILD_NUMBER` de Codemagic |

Los dos números **divergen entre sí a propósito**. TestFlight rechaza dos
subidas con el mismo número para un mismo nombre de versión, así que ahí el
único origen confiable es la propia TestFlight; en Android alcanza con un
contador que sólo suba. No hay que intentar alinearlos.

Para publicar una versión nueva alcanza con cambiar el `1.0.2` del pubspec y
pushear. El `+3` quedó ahí por historia y no lo usa el CI.

## iOS → TestFlight

**Workflow:** `ios-testflight` en `codemagic.yaml`.

### Identificadores

| Dato | Valor |
| --- | --- |
| Bundle ID | `com.patea.app` |
| Equipo de Apple | `V2PH3V3SJN` |
| Apple ID de la app | `6808798274` (el número que aparece en la URL de App Store Connect) |
| Firebase iOS appId | `1:5614567933:ios:040e51bd084d88b6861994` |
| Clave de API para CI | `codemagic`, Key ID `A2R79NVDJ3`, rol *Gestor de apps* |
| Issuer ID | `ccb01500-4443-4dd9-9d7e-99ad9c281602` |
| App en Codemagic | `codemagic.io/app/6a9b3fecaea87264a4d6ae80` |

### Firma

Esto es lo que más costó y conviene no volver a descubrirlo:

1. El bloque `ios_signing` con `distribution_type`/`bundle_identifier` **sólo
   busca** certificado y perfil ya emitidos. Si no existen, falla con *"No
   matching profiles found"*. No los crea.
2. El paso `app-store-connect fetch-signing-files --create` tampoco alcanza
   cuando el equipo de Apple **ya tiene** un certificado de distribución
   emitido desde otro lado. Fue el caso: había uno de la otra app del equipo
   (ACOS), creado con otra clave de API, cuya clave privada Codemagic no
   tiene. El comando lo encontraba, avisaba *"Cannot save Signing Certificates
   without certificate private key"* —**sin marcar el paso en rojo**— y, sin
   certificado usable, tampoco emitía el perfil. El build recién moría después,
   con un mensaje engañoso sobre *"No development certificates available"* que
   manda a buscar el problema en el lugar equivocado.
3. Lo que funciona, y es lo que está configurado:
   - certificado **generado desde Codemagic** (*Team settings → Code signing
     identities → Generate certificate*), referencia `patea_distribution`,
     tipo Apple Distribution, vence 2027-09-04. Al generarlo Codemagic se
     queda con la clave privada, que es justamente lo que faltaba;
   - provisioning profile creado a mano en el portal de Apple (*Profiles → App
     Store*, `com.patea.app`, apuntando a ese certificado), llamado
     `Patea App Store`, importado a Codemagic con *Fetch profiles* como
     `patea_appstore`;
   - los dos referenciados por nombre en `ios_signing`, y un único paso
     `xcode-project use-profiles` que los aplica al proyecto.

Apple limita la cantidad de certificados de distribución por equipo. Antes de
generar otro, mirar
[developer.apple.com/account/resources/certificates](https://developer.apple.com/account/resources/certificates/list):
si se llenó, **revocar uno rompe las builds de la app que lo use**.

### Cumplimiento de exportación

`ITSAppUsesNonExemptEncryption=false` está declarado en
`patea_mobile/ios/Runner/Info.plist`. Sin eso, la build sube y procesa bien
pero queda en TestFlight como *"Lista para enviar"* esperando que alguien
conteste el cuestionario a mano, **no se habilita para ningún tester**, y el
paso *App Store distribution* de Codemagic falla esperando una build que nunca
se habilita — con el IPA ya generado y subido, que es lo desconcertante.

La respuesta es "no" porque la app sólo usa criptografía estándar: HTTPS contra
Firebase y contra las APIs de clima y geocoding.

### Push en iOS

Los entitlements están en dos archivos, porque el valor de `aps-environment`
cambia según el destino:

- `ios/Runner/Runner.entitlements` → `development`, usado por la config Debug.
- `ios/Runner/RunnerRelease.entitlements` → `production`, usado por Release y
  Profile.

Al engancharlos en `project.pbxproj`, ojo: el orden de las configuraciones en
ese archivo es **Profile, Debug, Release**, no el alfabético.

Falta todavía subir la clave APNs a Firebase para que las notificaciones
lleguen de verdad en iOS.

## Android → Firebase App Distribution

**Workflow:** `android-app-distribution` en `codemagic.yaml`.

| Dato | Valor |
| --- | --- |
| applicationId | `com.patea.app.patea_mobile` |
| Firebase Android appId | `1:5614567933:android:4b0b919482aa0dc5861994` |
| Grupo de testers | `test-patea` (no `patea-test`) |
| Alias del keystore | `patea-upload` |

El artefacto es un **APK**, no un AAB, porque App Distribution lo instala
directo en el teléfono desde la app *Firebase App Tester*. Para Google Play
haría falta `flutter build appbundle`, y ese camino todavía no existe.

### La firma, y por qué hay un paso que la verifica

`android/app/build.gradle.kts` lee la firma de `android/key.properties`. Si ese
archivo no existe, **el build de release cae en silencio a la firma de debug**:
sale un APK que instala perfecto pero con el SHA equivocado, así que el login
con Google y App Check con Play Integrity fallan sin ningún mensaje que apunte
a la causa. Por eso el workflow arma `key.properties` desde lo que inyecta
`android_signing`, y después hay un paso que corre `apksigner verify` y compara
contra el SHA-256 de la clave de subida. Si no coincide, el build falla ahí en
vez de repartirle a los testers un APK inservible.

## Lo que hay que cargar una sola vez en Codemagic

Todo esto ya está, menos los dos últimos:

| Qué | Dónde | Estado |
| --- | --- | --- |
| Integración App Store Connect `patea` | Team settings → Integrations | listo |
| Variable `APP_STORE_APPLE_ID=6808798274`, grupo `patea_ios` | App → Environment variables | listo |
| Certificado `patea_distribution` | Code signing identities → iOS certificates | listo |
| Perfil `patea_appstore` | Code signing identities → iOS provisioning profiles | listo |
| Keystore `patea_upload` | Code signing identities → Android keystores | **falta** |
| `FIREBASE_SERVICE_ACCOUNT`, grupo `patea_android` | App → Environment variables, marcado secreto | **falta** |

Los dos que faltan son secretos y los tiene que subir una persona:

- **Keystore**: subir `~/.patea-keys/patea-upload.jks` con su contraseña y
  alias `patea-upload`, nombre de referencia `patea_upload`. De paso queda como
  una copia más de una clave que hoy existe en un solo lugar del mundo.
- **Cuenta de servicio**: crear una en el proyecto `mil-disculpis` con el rol
  *Firebase App Distribution Admin*, bajar el JSON y pegarlo como variable
  `FIREBASE_SERVICE_ACCOUNT` en el grupo `patea_android`, marcada como secreta.

Hasta que estén, el workflow de Android falla y el de iOS anda igual: son
independientes.

## Deploy manual, cuando hace falta

El camino de CI no reemplaza saber compilar a mano. Para Android sigue valiendo
lo de [ANDROID_RELEASE_SIGNING.md](./ANDROID_RELEASE_SIGNING.md), con dos
trampas de esta máquina que **no** aplican en CI:

- `D:\Pateá` tiene un acento y rompe `aapt`/Gradle: hay que espejar a
  `D:\dev\patea_mobile` con robocopy antes de compilar. Ojo que robocopy
  excluye `.dart_tool`, así que un paquete nuevo pide `flutter pub get` también
  en el espejo.
- `flutter build apk --release` falla localmente con un error críptico
  (`"25.0.2"`); `./gradlew.bat assembleRelease` anda. En Codemagic el comando
  de Flutter funciona sin problema.

Para iOS no hay camino manual desde acá: hace falta una Mac, y para eso está
Codemagic.

## Estado al 2026-09-04

- iOS: primera build en TestFlight, **1.0.2 (1)**. Le falta contestar el
  cuestionario de cumplimiento de exportación a esa compilación puntual (las
  próximas ya salen derecho por el `Info.plist`) y crear un grupo de testers.
- Android: se venía distribuyendo a mano; el workflow existe pero espera los
  dos secretos de arriba.
