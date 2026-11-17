# Pateá: producto, identidad y oportunidades

Dossier visual en español, en formato A4 horizontal y estética Game. Referencia: app Flutter 1.0.33+34, rama `feat/flutter-mobile-app`, revisión del 17/11/2026.

## Alcance editorial

33 páginas: identidad, tipografías, imágenes, recorrido funcional, ampliaciones, publicidad contextual, paquetes comerciales, economía ilustrativa y fuentes oficiales.

Las capturas usan componentes reales de Flutter con datos ficticios del arnés de pruebas. No representan usuarios, ingresos o acuerdos acreditados. Las fotos son recursos ilustrativos de marca. Las propuestas y el ejercicio económico están separados de las funciones integradas. No se realizaron cambios en Firebase ni llamadas pagas de IA para producir las capturas.

La revisión funcional comprende las rutas y servicios móviles, modelos de partidos y competiciones, evaluaciones, perfiles, grupos, equipos, búsqueda y diseño. Entrenamiento actual: sugerencias locales por atributos. Comunidad actual: lectura de actividad. Cobros, reservas y anuncios: propuestas pendientes de implementación y validación.

## Reproducir

Desde `patea_mobile`, con Flutter y dependencias instalados:

```powershell
flutter test --no-pub --update-goldens tool/presentation_export_test.dart --reporter expanded
```

Desde la raíz, con Python (`Pillow`, `reportlab`, `pymupdf`) y Node (`sharp`):

```powershell
$env:PYTHONUTF8='1'
python presentation/prepare_assets.py
python presentation/build_dossier.py
python presentation/render_review.py
```

Salida: `output/pdf/Patea_Game_Producto_y_Oportunidades.pdf`. Intermedios y hojas de revisión: `tmp/pdfs` (no se versionan). Revisar cada página renderizada antes de distribuir una actualización. Fuentes comerciales: enlaces oficiales al final del PDF; los valores económicos son supuestos explícitos, no una previsión.

## Recursos

Logo oficial en `patea_mobile/assets/icons/logo_patea.svg`; iconos deportivos Tabler con su licencia MIT existente; imágenes en `assets/brand`; tipografías locales de la aplicación en `google_fonts`. Se usa la paleta actual de `lib/core/theme/patea_colors.dart`.

## Guía de uso A4

Entrega adicional: `output/pdf/Patea_Guia_de_Uso_Game_A4.pdf`.

50 páginas A4 vertical: 39 procesos, índice con enlaces, marcadores, roles, estados, glosario, recorrido completo y resolución de problemas. El contenido está en `guide_content.py` y la maquetación en `build_user_guide.py`. Se limita a funciones actuales; distingue las pantallas integradas de los accesos disponibles (por ejemplo, Comunidad no tiene entrada directa desde la barra principal).

Después de exportar las capturas y preparar los recursos:

```powershell
python presentation/build_user_guide.py
python presentation/render_review.py --guide
python presentation/check_user_guide.py
```

La revisión se guarda en `tmp/pdfs/guide`. Las capturas adicionales incluyen menú personal, creación de equipo y liga, disponibilidad y carga de clips. Los recortes del menú y del selector de clips sólo quitan espacio vacío para facilitar su lectura; no alteran controles. Todo usa datos de demostración y no escribe en servicios externos.
