# Firma de la app Android

## Lo que hay que saber primero

La clave de subida (*upload key*) de Pateá existe **en un solo lugar del mundo**:

```
~/.patea-keys/patea-upload.jks
```

No está en git y no debe estarlo (`patea_mobile/android/.gitignore` ya ignora
`key.properties`, y el `.jks` nunca se commiteó — verificado con
`git log --all -- "*.jks"`, que devuelve vacío).

**Si ese archivo se pierde, no se puede volver a publicar una actualización de
la app nunca más.** Google Play rechaza cualquier subida firmada con otra
clave. La única salida sería publicar una app nueva, con otro package name,
perdiendo instalaciones, reseñas y ranking. No hay soporte que lo revierta.

Lo mismo vale para la contraseña: está en `patea_mobile/android/key.properties`,
que tampoco está en git. El `.jks` sin la contraseña no sirve para nada, así que
**hay que respaldar los dos**, y en lugares distintos.

## Qué hacer

Copiar `~/.patea-keys/patea-upload.jks` y `patea_mobile/android/key.properties`
a por lo menos dos destinos que no sean esta computadora. Un gestor de
contraseñas con archivos adjuntos (1Password, Bitwarden) sirve para los dos
juntos; un pendrive guardado físicamente aparte también.

No subirlos a Drive/Dropbox de la cuenta de trabajo sin cifrarlos antes: quien
tenga el `.jks` y la contraseña puede firmar una app que Android va a aceptar
como si fuera Pateá.

## Datos para verificar un respaldo

Al restaurar desde un backup, confirmar que es el archivo correcto:

```bash
keytool -list -v -keystore patea-upload.jks -alias patea-upload
```

| Dato | Valor |
| --- | --- |
| Alias | `patea-upload` |
| SHA-256 | `DF:CE:3E:9B:E7:A6:40:9C:EE:E9:18:0C:D8:64:35:5F:2B:FA:78:98:0E:43:65:6A:B9:53:FB:1D:46:A8:59:7E` |
| Válida hasta | 19 de enero de 2054 |

Ese SHA-256 es el mismo que está registrado en Firebase para la app Android
(`1:5614567933:android:4b0b919482aa0dc5861994`), que es lo que hace funcionar
App Check con Play Integrity y el login con Google en builds de release. Si
alguna vez cambia la clave, hay que registrar el nuevo SHA en Firebase o esas
dos cosas dejan de andar sin aviso claro.

## Cuando se suba por primera vez a Play

Play App Signing vuelve a firmar el AAB con una **clave de firma propia de
Google**, distinta de la de subida. Esa clave tiene su propio SHA-256, que
aparece en Play Console → *Configuración* → *Integridad de la app*. **También
hay que registrarlo en Firebase**, o en la app descargada desde Play (no en la
que instalás por USB) App Check y el login con Google van a fallar:

```bash
firebase apps:android:sha:create 1:5614567933:android:4b0b919482aa0dc5861994 <SHA256_DE_PLAY> --project=mil-disculpis
```

## Distribuir una build de prueba (Firebase App Distribution)

Es la vía para instalar la app en un teléfono real sin pasar por Play: los
testers la reciben por mail y la instalan desde la app **Firebase App Tester**.
La build que se sube va firmada con la clave de subida de arriba, así que el
login con Google y App Check con Play Integrity funcionan igual que en Play.

```bash
# 1. Espejo a una ruta sin acentos — `D:\Pateá` rompe aapt/Gradle.
robocopy "D:\Pateá\patea_mobile" "D:\dev\patea_mobile" /MIR /XD build .dart_tool .gradle

# 2. Compilar. `flutter build apk --release` falla con un error críptico
#    ("25.0.2"); Gradle directo anda.
cd /d/dev/patea_mobile/android && ./gradlew.bat assembleRelease --no-daemon

# 3. Subir y repartir.
firebase appdistribution:distribute \
  /d/dev/patea_mobile/build/app/outputs/flutter-apk/app-release.apk \
  --app 1:5614567933:android:4b0b919482aa0dc5861994 \
  --project mil-disculpis \
  --release-notes "qué cambió" \
  --testers "santiago.lopez@agileworks.com.uy"
```

Tres cosas que hacen perder tiempo si no se saben:

**`key.properties` quiere ruta de Windows.** Gradle usa `file()`, que resuelve
`/c/Users/...` (formato de Git Bash) contra la raíz del disco actual, o sea
`D:\c\Users\...`, que no existe — y como el build cae en silencio a la firma de
debug, salís con un APK que Play rechaza sin decirte por qué. Tiene que ser
`storeFile=C:/Users/poio9/.patea-keys/patea-upload.jks`.

**Subir a Play App Signing.** Para Play va un AAB (`bundleRelease`), no el APK.
App Distribution acepta los dos; el APK es más cómodo porque se instala directo.

**Subir el `version:` de `pubspec.yaml` en cada build.** Si no, todas las
entregas aparecen como "1.0.0 (1)" en la lista del tester y no se distinguen.

Verificar que un APK salió con la clave buena, no con la de debug:

```bash
"$ANDROID_SDK_ROOT/build-tools/<ver>/apksigner.bat" verify --print-certs app-release.apk
```

El SHA-256 que imprime tiene que ser el `dfce3e...59 7e` de la tabla de arriba.
