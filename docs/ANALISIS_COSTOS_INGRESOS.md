# Análisis de Costos e Ingresos – Pateá

> Última actualización: 2026-02-25
> Escenarios basados en 200 DAU (conservador) y 500 DAU (optimista)
> Todos los valores en USD salvo que se indique lo contrario

---

## 1. COSTOS OPERATIVOS MENSUALES

### A. Firebase / Google Cloud

#### Firebase App Hosting (Cloud Run)
La app corre en Firebase App Hosting, que internamente usa Cloud Run.

| Capa | Free tier | Costo excedente |
|------|-----------|-----------------|
| vCPU-segundo | 180K/mes | $0.00002400/vCPU-seg |
| GiB-segundo RAM | 360K/mes | $0.0000025/GiB-seg |
| Solicitudes | 2M/mes | $0.40/1M solicitudes |
| Egress | 1GB/mes | $0.12/GB |

**Estimación:**
- 200 DAU × 6 requests/sesión = 1,200 req/día = 36,000 req/mes → dentro del free tier
- Egress ~100MB/día = 3GB/mes → $0.24 excedente
- Instancias idle: ~$3-8/mes (mínimo de instancias activas)
- **200 DAU: $3–10/mes | 500 DAU: $10–25/mes**

---

#### Firestore

| Operación | Free tier/día | Costo excedente |
|-----------|---------------|-----------------|
| Lecturas | 50,000 | $0.06/100K |
| Escrituras | 20,000 | $0.18/100K |
| Eliminaciones | 20,000 | $0.02/100K |
| Almacenamiento | 1 GB total | $0.18/GB/mes |

**Estimación con 200 DAU:**
- 200 usuarios × 8 páginas × ~30 reads/página = 48,000 reads/día ≈ en el límite free
- Con onSnapshot activos (real-time) puede superar fácilmente el límite
- Escrituras (evaluaciones, matches, etc.): ~2,000–5,000/día → dentro del free
- **200 DAU: $5–20/mes | 500 DAU: $25–60/mes**

> **Riesgo alto:** Los `onSnapshot` de `useDoc` generan lecturas continuas. Cada usuario conectado puede generar 5-10 listeners activos simultáneos.

---

#### Google Gemini AI (via Genkit)

Modelos usados en la app:

| Modelo | Uso principal | Precio estimado |
|--------|--------------|-----------------|
| `gemini-2.0-flash` | Análisis texto, equipos, coach | ~$0.10/1M tokens input, $0.40/1M output |
| `gemini-2.5-flash-image-preview` | Generación de fotos de jugador | ~$0.039–0.05/imagen |

**Estimación de generación de imágenes:**
- 3 créditos gratis/mes × N jugadores activos
- Si 200 DAU tienen 1 jugador activo c/u y usan 1.5 créditos/mes promedio:
  - 200 × 1.5 = 300 generaciones/mes × $0.05 = **$15/mes**
- Más generaciones pagadas (estimado 50 extra/mes): **$2.50/mes**
- Flujos de texto (análisis, conversación coach, crónica): 500 usos/mes × 2K tokens = ~$0.05/mes
- **200 DAU: $17–25/mes | 500 DAU: $40–70/mes**

> Este es el **costo variable más significativo** y crece directo con el uso de IA.

---

#### Firebase Storage

| Recurso | Free tier | Costo excedente |
|---------|-----------|-----------------|
| Almacenamiento | 5 GB | $0.026/GB/mes |
| Descarga | 1 GB/día | $0.12/GB |
| Operaciones upload | 20,000/día | $0.05/10K ops |

**Estimación:**
- Imágenes generadas: ~300–750/mes × 500KB = 150–375 MB/mes de crecimiento
- Crecimiento acumulado año 1: ~2–4 GB → dentro del free tier inicialmente
- Descargas: cada load de perfil descarga 1 foto (~500KB) → 200 DAU × 3 perfiles/sesión = 300MB/día = 9GB/mes
- Excedente egress: (9–1GB) × 30 = ~$9.60/mes
- **200 DAU: $5–15/mes | 500 DAU: $15–35/mes**

---

#### Cloud Functions

| Recurso | Free tier/mes | Costo excedente |
|---------|---------------|-----------------|
| Invocaciones | 2M | $0.40/1M |
| Compute (GHz-segundos) | 400K | $0.0000100/GHz-seg |

**Funciones activas:**
- `resetMonthlyCredits`: 1 invocación/mes → costo ≈ $0
- Webhook MercadoPago: pocas invocaciones mientras está deshabilitado
- **200 DAU: $0–2/mes | 500 DAU: $0–5/mes**

---

#### Google Maps API

| API | Free/mes | Costo excedente |
|-----|----------|-----------------|
| Maps JavaScript | $200 crédito gratis | $0.007/carga |
| Geocoding | Incluido en $200 | $0.005/request |
| Places | Incluido en $200 | Variable |

El crédito de $200/mes cubre aproximadamente:
- 28,000 cargas de mapa por mes
- Con 200 DAU que usan mapa ~2 veces/semana = 1,600/mes → **totalmente dentro del free**
- **200 DAU: $0/mes | 500 DAU: $0–5/mes**

---

#### Firebase Authentication
- Free hasta 10,000 MAU → $0 para etapa inicial
- 200 MAU → $0/mes

---

#### Dominio
- Dominio `.app` o `.com.uy`: ~$15–20/año = **$1.25–1.67/mes**

---

### Resumen de Costos Mensuales

| Servicio | 200 DAU (conservador) | 500 DAU (optimista) |
|----------|----------------------|---------------------|
| Firebase App Hosting | $3–10 | $10–25 |
| Firestore | $5–20 | $25–60 |
| Firebase Storage | $5–15 | $15–35 |
| Cloud Functions | $0–2 | $0–5 |
| **Google Gemini AI** | **$17–25** | **$40–70** |
| Google Maps API | $0 | $0–5 |
| Firebase Auth | $0 | $0 |
| Dominio | $1.50 | $1.50 |
| **TOTAL ESTIMADO** | **$31–73/mes** | **$91–201/mes** |
| **Punto medio** | **~$52/mes** | **~$146/mes** |

> **El costo más difícil de controlar es Gemini AI.** Si un usuario abusa de la generación de imágenes (con rewarded ads o bugs), el costo puede escalar rápidamente. Se recomienda un límite hard de generaciones por usuario/mes.

---

## 2. INGRESOS ESTIMADOS

### Canal A: Display Banners (Google AdSense)

**Métricas clave LATAM:**
- RPM (Revenue Per Mille pageviews): $0.30–$1.20 USD en Argentina/Uruguay
- Fill rate estimado: 60–80% (no siempre hay ad disponible)

**Cálculo:**
```
200 DAU × 6 pageviews/sesión = 1,200 PV/día × 30 = 36,000 PV/mes
RPM efectivo con 70% fill: $0.60 promedio
Ingresos: 36,000/1,000 × $0.60 = $21.60/mes

500 DAU:
90,000 PV/mes × ($0.60/1,000) = $54.00/mes
```

| Escenario | PV/mes | RPM | Ingreso mensual |
|-----------|--------|-----|-----------------|
| 200 DAU pesimista | 36,000 | $0.30 | $10.80 |
| 200 DAU base | 36,000 | $0.60 | $21.60 |
| 200 DAU optimista | 36,000 | $1.20 | $43.20 |
| 500 DAU base | 90,000 | $0.60 | $54.00 |
| 500 DAU optimista | 90,000 | $1.20 | $108.00 |

> **Nota:** El RPM real depende fuertemente del contenido y audiencia. Apps de deportes amateur LATAM tienden al rango bajo ($0.30–$0.80). Los primeros 3–6 meses AdSense paga menos mientras el algoritmo aprende la audiencia.

---

### Canal B: Rewarded Ads

**Flujo:** Usuario sin créditos → "Ver anuncio" → obtiene 1 crédito de imagen

**Métricas estimadas:**
- 10–15% de usuarios activos inician un rewarded ad por sesión
- Tasa de completación: 65–80%
- Revenue por completación en LATAM: $0.04–$0.15 USD

**Cálculo:**
```
200 DAU × 12% que intentan = 24 usuarios/día
× 75% completion = 18 completaciones/día
× $0.08 (RPM rewarded) = $1.44/día
× 30 días = $43.20/mes

500 DAU:
60 intentos/día × 75% × $0.08 = $3.60/día = $108/mes
```

| Escenario | Usuarios/día | Completion | Rev/comp | Mensual |
|-----------|-------------|------------|----------|---------|
| 200 DAU conservador | 15 | 65% | $0.04 | $11.70 |
| 200 DAU base | 24 | 75% | $0.08 | $43.20 |
| 200 DAU optimista | 30 | 80% | $0.15 | $108.00 |
| 500 DAU base | 60 | 75% | $0.08 | $108.00 |
| 500 DAU optimista | 75 | 80% | $0.15 | $270.00 |

> **El rewarded ad es el canal más rentable por usuario.** Un usuario que ve 1 rewarded/día genera ~$2.40/mes vs ~$0.11/mes de banners.

---

### Canal C: Venta de Créditos (MercadoPago)

*Actualmente deshabilitado. Proyección para cuando se reactive:*

**Supuestos:**
- 3–5% de usuarios activos compran créditos alguna vez
- Ticket promedio: $10 USD (Paquete Mediano)
- Frecuencia: 1 compra cada 2 meses por usuario que paga
- Comisión MercadoPago: ~4.99% + IVA ≈ 6%

**Cálculo:**
```
200 DAU × 4% conversión mensual = 8 compras/mes
× $10 promedio × (1 - 0.06 fee) = $75.20/mes

500 DAU:
500 × 4% = 20 compras/mes × $10 × 0.94 = $188/mes
```

| Escenario | Compradores/mes | Ticket | Fee MP | Neto mensual |
|-----------|----------------|--------|--------|--------------|
| 200 DAU conservador | 4 | $7 | 6% | $26.32 |
| 200 DAU base | 8 | $10 | 6% | $75.20 |
| 200 DAU optimista | 12 | $13 | 6% | $146.64 |
| 500 DAU base | 20 | $10 | 6% | $188.00 |
| 500 DAU optimista | 30 | $13 | 6% | $366.60 |

---

### Resumen de Ingresos Mensuales

#### Escenario A: Solo ads (MercadoPago deshabilitado)

| Canal | 200 DAU | 500 DAU |
|-------|---------|---------|
| Display banners | $21.60 | $54.00 |
| Rewarded ads | $43.20 | $108.00 |
| **Total ads** | **$64.80** | **$162.00** |

#### Escenario B: Ads + Créditos (MercadoPago activo)

| Canal | 200 DAU | 500 DAU |
|-------|---------|---------|
| Display banners | $21.60 | $54.00 |
| Rewarded ads | $43.20 | $108.00 |
| Créditos (MP) | $75.20 | $188.00 |
| **Total combinado** | **$140.00** | **$350.00** |

---

## 3. ANÁLISIS DE RENTABILIDAD (P&L)

### Solo con Ads (sin MercadoPago)

| Métrica | 200 DAU | 500 DAU |
|---------|---------|---------|
| Ingresos ads | $64.80 | $162.00 |
| Costos operativos | $52.00 | $146.00 |
| **Resultado** | **+$12.80** | **+$16.00** |
| Margen | ~20% | ~11% |

> Con solo ads, la app apenas cubre costos. Rentable técnicamente, pero sin margen para crecer.

---

### Ads + Créditos (modelo completo)

| Métrica | 200 DAU | 500 DAU |
|---------|---------|---------|
| Ingresos totales | $140.00 | $350.00 |
| Costos operativos | $52.00 | $146.00 |
| **Resultado** | **+$88.00** | **+$204.00** |
| Margen | ~63% | ~58% |

---

### Punto de Equilibrio (Break-even)

Sin créditos (solo ads):
- Se necesitan ~160 DAU para cubrir $52/mes de costos base
- Con ads a RPM base ($0.60 banners + $0.08 rewarded): ~162 DAU

Con modelo completo:
- Break-even mucho más temprano: ~70–80 DAU si hay conversión a créditos

---

## 4. RIESGOS Y VARIABLES CRÍTICAS

### Riesgos de Costo

| Riesgo | Impacto | Probabilidad | Mitigación |
|--------|---------|-------------|------------|
| Abuso de generación de imágenes | Alto (+$50–200/mes) | Media | Límite hard de generaciones por usuario/mes |
| Spike de tráfico viral | Alto (×3–5 costos) | Baja | Alertas de billing en Firebase |
| Lecturas Firestore descontroladas | Alto (+$30–80/mes) | Media | Revisar listeners onSnapshot |
| Gemini API sin cuota | Crítico | Baja | Configurar quota limits en Google Cloud Console |

### Riesgos de Ingresos

| Riesgo | Impacto | Probabilidad | Mitigación |
|--------|---------|-------------|------------|
| Rechazo de AdSense por contenido | Sin ingresos ads | Baja-Media | Revisar políticas antes de aplicar |
| RPM muy bajo (< $0.20) | -70% ingresos banner | Media | Diversificar redes (Meta Audience Network) |
| Ad blockers usuarios técnicos | -20–40% impresiones | Alta | Rewarded ads menos bloqueados |
| MercadoPago rechaza cuenta | Sin créditos | Baja | Stripe como alternativa |
| Pocos usuarios adoptan rewarded | -50% ingresos canal B | Media | UX clara del beneficio (crédito concreto) |

---

## 5. PROYECCIÓN AÑO 1 (mensual)

Asumiendo crecimiento gradual: 50 DAU mes 1 → 200 DAU mes 6 → 400 DAU mes 12

| Mes | DAU est. | Costos | Ingresos (ads) | Ingresos (total) | Balance |
|-----|----------|--------|----------------|------------------|---------|
| 1 | 50 | $20 | $16 | $16 | -$4 |
| 2 | 80 | $28 | $26 | $26 | -$2 |
| 3 | 120 | $38 | $39 | $39 | +$1 |
| 4 | 160 | $46 | $52 | $52 | +$6 |
| 5 | 200 | $52 | $65 | $65 | +$13 |
| 6 | 240 | $62 | $78 | $140* | +$78* |
| 7 | 280 | $75 | $91 | $170* | +$95* |
| 8 | 320 | $90 | $104 | $200* | +$110* |
| 9 | 360 | $104 | $116 | $230* | +$126* |
| 10 | 380 | $110 | $123 | $245* | +$135* |
| 11 | 400 | $118 | $130 | $260* | +$142* |
| 12 | 420 | $124 | $136 | $275* | +$151* |

*\* Asumiendo MercadoPago activo desde mes 6*

**Totales año 1:**
- Costos acumulados: ~$867
- Ingresos acumulados (solo ads): ~$876 → break-even año 1
- Ingresos acumulados (ads + créditos desde mes 6): ~$1,718 → **+$851 ganancia neta año 1**

---

## 6. RECOMENDACIONES DE PRIORIDAD

### Corto plazo (ahora)
1. **Activar AdSense + Rewarded ads** → primeros ingresos sin necesidad de MP
2. **Configurar alertas de billing** en Firebase Console (límite $100/mes)
3. **Limitar generaciones AI por usuario** (max 10/mes free, 50/mes pagado)
4. **Auditar onSnapshot listeners** para reducir lecturas Firestore

### Mediano plazo (1–3 meses)
5. **Reactivar MercadoPago** → multiplica ingresos ×2–3
6. **Optimizar imágenes en Storage** (WebP, lazy load) → reducir egress
7. **Implementar AdSense Auto Ads** para maximizar RPM

### Largo plazo (3–12 meses)
8. **Explorar plan premium** ($3–5 USD/mes = sin ads + créditos extra)
9. **Sponsors directos** (canchas, marcas deportivas LATAM) → mayor margen
10. **B2B: licenciar a ligas/academias** → ingresos recurrentes estables

---

## 7. COMPARATIVA: MODELO SOLO ADS vs MODELO HÍBRIDO

| | Solo Ads | Ads + Créditos | Ads + Créditos + Premium |
|--|---------|----------------|--------------------------|
| Ingresos potenciales/año (500 DAU) | $1,944 | $4,200 | $6,000+ |
| Dependencia de terceros | Alta (AdSense) | Media | Baja |
| Predecibilidad de ingresos | Baja | Media | Alta |
| Esfuerzo de implementación | Bajo | Medio | Alto |
| Riesgo de rechazo (AdSense) | Alto | Moderado | Bajo |

**Conclusión:** El modelo híbrido (ads + créditos) es el más viable para Pateá en el corto plazo. Los ads cubren costos operativos; los créditos generan el margen real.

---

*Nota: Todas las estimaciones son proyecciones basadas en benchmarks de mercado LATAM para apps deportivas de nicho. Los valores reales dependerán del comportamiento real de los usuarios, las tasas de CPM que AdSense asigne a la audiencia, y el tipo de cambio ARS/USD.*
