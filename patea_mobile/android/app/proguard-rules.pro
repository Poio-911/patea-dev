# Reglas de R8 para el build de release.

# Flutter mantiene sus propias reglas vía el plugin de Gradle; acá van sólo
# las que necesitan los paquetes que usa Pateá.

# --- Firebase / Google Play Services ---
-keep class com.google.firebase.** { *; }
-keep class com.google.android.gms.** { *; }
-dontwarn com.google.firebase.**
-dontwarn com.google.android.gms.**

# Crashlytics necesita los números de línea y los nombres de archivo para que
# los stack traces del panel sean legibles.
-keepattributes SourceFile,LineNumberTable
-keep public class * extends java.lang.Exception

# --- Modelos serializados desde/hacia Firestore ---
# Los modelos de Pateá se mapean a mano con fromFirestore/toMap, así que no
# hace falta reflexión. Se mantienen igual las anotaciones por si alguna
# dependencia las usa.
-keepattributes *Annotation*,Signature,InnerClasses,EnclosingMethod

# --- Play Core (deferred components de Flutter) ---
-dontwarn com.google.android.play.core.**
