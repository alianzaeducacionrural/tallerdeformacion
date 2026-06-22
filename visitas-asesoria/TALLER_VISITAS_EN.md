# Sistema de Taller — Visitas Escuela Nueva
## Documento de contexto para Claude Code

---

## 1. Descripción general

Sistema web para uso en un taller de capacitación. Los participantes simulan una visita de asesoría y acompañamiento a una sede educativa, diligencian un formulario con indicadores y compromisos, y el resultado se visualiza en tiempo real en dos dashboards:

- **Semáforo:** calificación por sede (Verde / Amarillo / Rojo)
- **Compromisos:** board estilo Kanban con estados (Pendiente / En proceso / Cumplido / Vencido)

---

## 2. Stack tecnológico

| Capa | Tecnología |
|---|---|
| Frontend | Vanilla HTML + CSS + JS (3 páginas estáticas) |
| Hosting | GitHub Pages |
| Backend | Google Apps Script (Web App) |
| Base de datos | Google Sheets |

> **Mismo patrón CORS que el proyecto de compromisos existente:** los POST deben enviarse con `Content-Type: text/plain;charset=utf-8` para evitar preflight en GAS.

---

## 3. Estructura de archivos

```
/
├── index.html          → Formulario de visita (página principal)
├── semaforo.html       → Dashboard Semáforo
├── compromisos.html    → Dashboard de Compromisos
├── style.css           → Estilos compartidos
├── config.js           → URL del GAS Web App (única constante a cambiar)
├── formulario.js
├── semaforo.js
└── compromisos.js
```

---

## 4. Google Sheets — estructura

### Hoja 1: `Visitas`

Cada fila = una visita registrada desde el formulario.

| Columna | Campo | Tipo |
|---|---|---|
| A | ID | Auto (timestamp + random) |
| B | Timestamp | Fecha/hora de envío |
| C | Asesor | Texto libre |
| D | Fecha de visita | Fecha (yyyy-MM-dd) |
| E | Municipio | Texto libre |
| F | Institución | Texto libre |
| G | Sede | Texto libre |
| H | GE1 — Elección de la junta directiva | "AA" / "AM" / "NA" |
| I | GE2 — Organización y operatividad de los comités | "AA" / "AM" / "NA" |
| J | GE3 — Dinamización instrumentos de aula | "AA" / "AM" / "NA" |
| K | GE4 — Hora de Gobierno Estudiantil | "AA" / "AM" / "NA" |
| L | GI5 — Uso de guías del proyecto | "AA" / "AM" / "NA" |
| M | GI6 — Dinamización de roles de trabajo | "AA" / "AM" / "NA" |
| N | GI7 — Dinamización formas de trabajo | "AA" / "AM" / "NA" |
| O | Recomendaciones | Texto libre |
| P | Compromiso 1 — Descripción | Texto libre |
| Q | Compromiso 1 — Responsable | Texto libre |
| R | Compromiso 1 — Fecha verificación | Fecha (yyyy-MM-dd) |
| S | Compromiso 2 — Descripción | Texto libre |
| T | Compromiso 2 — Responsable | Texto libre |
| U | Compromiso 2 — Fecha verificación | Fecha (yyyy-MM-dd) |
| V | Compromiso 3 — Descripción | Texto libre |
| W | Compromiso 3 — Responsable | Texto libre |
| X | Compromiso 3 — Fecha verificación | Fecha (yyyy-MM-dd) |

### Hoja 2: `Compromisos`

El GAS expande automáticamente cada visita en filas individuales de compromisos (una fila por compromiso). Esta hoja es la fuente del dashboard de compromisos.

| Columna | Campo |
|---|---|
| A | ID Compromiso (`visitaID + "#" + número`) |
| B | ID Visita |
| C | Asesor |
| D | Municipio |
| E | Institución |
| F | Sede |
| G | Número de compromiso (1, 2 o 3) |
| H | Descripción del compromiso |
| I | Responsable |
| J | Fecha de verificación |
| K | Estado inicial (`Pendiente` por defecto al crear) |
| L | Observaciones |
| M | Fecha de creación |
| N | Fecha de actualización |

---

## 5. Google Apps Script — API

### Archivo `Código.gs`

```javascript
const SHEET_VISITAS = 'Visitas';
const SHEET_COMPROMISOS = 'Compromisos';

function doGet(e) {
  const action = e.parameter.action;
  if (action === 'semaforo') return getSemaforo();
  if (action === 'compromisos') return getCompromisos();
  return jsonResponse({ error: 'Acción no reconocida' });
}

function doPost(e) {
  try {
    const data = JSON.parse(e.postData.contents);
    if (data.action === 'registrarVisita') return registrarVisita(data);
    if (data.action === 'actualizarCompromiso') return actualizarCompromiso(data);
    return jsonResponse({ error: 'Acción no reconocida' });
  } catch (err) {
    return jsonResponse({ error: err.message });
  }
}
```

### Endpoints

#### `GET ?action=semaforo`

Devuelve una lista de sedes con su calificación calculada.

```json
[
  {
    "municipio": "Aguadas",
    "institucion": "El Edén",
    "sede": "Antonio Gómez Estrada",
    "asesor": "Juan García",
    "fecha_visita": "2026-06-20",
    "puntaje": 1.71,
    "calificacion": "VERDE",
    "indicadores": {
      "GE1": "AA",
      "GE2": "AM",
      "GE3": "AA",
      "GE4": "AA",
      "GI5": "AA",
      "GI6": "AM",
      "GI7": "AA"
    },
    "recomendaciones": "Fortalecer la dinamización..."
  }
]
```

#### `GET ?action=compromisos`

Devuelve todos los compromisos con estado calculado.

```json
[
  {
    "id": "abc123#1",
    "visita_id": "abc123",
    "asesor": "Juan García",
    "municipio": "Aguadas",
    "institucion": "El Edén",
    "sede": "Central",
    "numero": 1,
    "descripcion": "Implementar guías del proyecto...",
    "responsable": "Docente Luz Marina",
    "fecha_verificacion": "2026-08-15",
    "estado_inicial": "Pendiente",
    "estado_calculado": "pendiente",
    "observaciones": ""
  }
]
```

> **Lógica estado_calculado** (se computa en GAS al momento del GET):
> - `estado_inicial === "Cumplido"` → `"cumplido"`
> - `estado_inicial !== "Cumplido"` y `hoy <= fecha_verificacion` → `"pendiente"`
> - `estado_inicial !== "Cumplido"` y `hoy > fecha_verificacion` → `"vencido"`

#### `POST action: "registrarVisita"`

Payload enviado desde el formulario:

```json
{
  "action": "registrarVisita",
  "asesor": "Juan García",
  "fecha_visita": "2026-06-20",
  "municipio": "Aguadas",
  "institucion": "El Edén",
  "sede": "Central",
  "indicadores": {
    "GE1": "AA",
    "GE2": "AM",
    "GE3": "NA",
    "GE4": "AA",
    "GI5": "AM",
    "GI6": "AA",
    "GI7": "AA"
  },
  "recomendaciones": "Texto de recomendaciones...",
  "compromisos": [
    {
      "descripcion": "Implementar libro de registros",
      "responsable": "Docente Luz Marina",
      "fecha_verificacion": "2026-08-15"
    },
    {
      "descripcion": "Socializar guías con padres",
      "responsable": "Rector",
      "fecha_verificacion": "2026-07-10"
    }
  ]
}
```

El GAS escribe en `Visitas` (1 fila) y en `Compromisos` (N filas según compromisos enviados).

#### `POST action: "actualizarCompromiso"`

```json
{
  "action": "actualizarCompromiso",
  "id": "abc123#1",
  "estado_inicial": "Cumplido",
  "observaciones": "Se verificó en visita del 15 de agosto."
}
```

---

## 6. Lógica del Semáforo

### Puntaje por indicador

| Respuesta | Valor |
|---|---|
| Aplicación adecuada (AA) | 2 |
| Aplicación con oportunidad de mejora (AM) | 1 |
| No se aplica (NA) | 0 |

### Calificación general (promedio de los 7 indicadores)

| Rango de puntaje | Color | Etiqueta |
|---|---|---|
| 1.5 — 2.0 | 🟢 Verde | `VERDE` |
| 0.8 — 1.49 | 🟡 Amarillo | `AMARILLO` |
| 0.0 — 0.79 | 🔴 Rojo | `ROJO` |

---

## 7. Indicadores del formulario

### Sección A — Gobierno Estudiantil

| Código | Indicador |
|---|---|
| GE1 | Elección de la junta directiva |
| GE2 | Organización y operatividad de los comités de gobierno |
| GE3 | Dinamización instrumentos de aula |
| GE4 | Hora de Gobierno Estudiantil |

### Sección B — Guías de Interaprendizaje

| Código | Indicador |
|---|---|
| GI5 | Uso de guías del proyecto |
| GI6 | Dinamización de roles de trabajo |
| GI7 | Dinamización formas de trabajo |

### Opciones de respuesta (igual para todos)

- `AA` → Aplicación adecuada
- `AM` → Aplicación con oportunidad de mejora
- `NA` → No se aplica

---

## 8. Formulario (index.html)

### Campos

| Campo | Tipo | Requerido |
|---|---|---|
| Asesor | Texto libre | ✅ |
| Fecha de visita | Date picker | ✅ |
| Municipio | Texto libre | ✅ |
| Institución | Texto libre | ✅ |
| Sede | Texto libre | ✅ |
| GE1 a GE4 (Gobierno Estudiantil) | Botones de selección única (AA / AM / NA) | ✅ todos |
| GI5 a GI7 (Guías de Interaprendizaje) | Botones de selección única (AA / AM / NA) | ✅ todos |
| Recomendaciones | Textarea | ❌ |
| Compromiso 1 — Descripción | Textarea | ✅ |
| Compromiso 1 — Responsable | Texto libre | ✅ |
| Compromiso 1 — Fecha verificación | Date picker | ✅ |
| Compromiso 2 y 3 | Igual al #1 | ❌ opcionales |

### UX del formulario

- Header morado con título "VISITAS ESCUELA NUEVA — TALLER" (igual estilo al original)
- Botones de indicadores: al seleccionar uno, los otros dos se desactivan visualmente
- Validación antes de enviar: campos requeridos y al menos Compromiso #1 completo
- Al enviar: spinner de carga → mensaje de éxito → opción de "Registrar otra visita" (limpia el form)
- Paleta de colores: morado `#6B21A8` como color principal (igual al original)

---

## 9. Dashboard Semáforo (semaforo.html)

### Vista principal — Tabla

Diferente al original (naranja/tabla simple) → propuesta visual:

- Fondo oscuro tipo dashboard moderno (`#0F172A` slate)
- Cards por sede en lugar de tabla, organizadas en grid
- Cada card muestra: Municipio · Institución · Sede · Badge de color (VERDE / AMARILLO / ROJO)
- Filtros en la parte superior: Municipio, Institución, Calificación
- Al hacer clic en una card → abre modal con detalle

### Modal de detalle de sede

Muestra (similar a la imagen 2 del semáforo existente):

- Nombre completo de la sede (Municipio › Institución › Sede)
- Asesor y fecha de visita
- **Tres columnas de indicadores** agrupados por resultado:
  - 🟢 Aplicación adecuada
  - 🟡 Con oportunidad de mejora
  - 🔴 No se aplica
- Recomendaciones en caja separada
- Puntaje promedio visible

---

## 10. Dashboard Compromisos (compromisos.html)

### Igual en lógica al dashboard de compromisos existente

- **KPIs superiores:** Pendientes · Cumplidos · Vencidos + barra de avance %
- **Alertas:** Próximos a vencer (7 días) y vencidos sin atender
- **Filtros:** Asesor · Municipio · Búsqueda libre
- **Board Kanban:** 3 columnas → PENDIENTE / CUMPLIDO / VENCIDO
- Cards con: descripción, institución · sede, responsable, badge estado, fecha verificación, observaciones
- Clic en card → modal para actualizar estado + observaciones
- POST al GAS para guardar cambio
- **Estado "Vencido"** se calcula en frontend/GAS, nunca se guarda como estado

### Diferencias visuales respecto al existente

- Paleta morada (mismo color del formulario) en lugar del gris/naranja actual
- Cards con borde izquierdo de color según estado (amarillo / verde / rojo)

---

## 11. Flujo completo de datos

```
[Participante taller]
        │
        ▼
  index.html (formulario)
        │ POST → registrarVisita
        ▼
  GAS doPost()
   ├── Escribe fila en Sheet "Visitas"
   └── Escribe N filas en Sheet "Compromisos"
        │
        ▼
  semaforo.html       →  GET ?action=semaforo   → GAS lee "Visitas"
  compromisos.html    →  GET ?action=compromisos → GAS lee "Compromisos"
```

---

## 12. Configuración (config.js)

```javascript
const CONFIG = {
  GAS_URL: 'https://script.google.com/macros/s/XXXXXXXX/exec',
  REFRESH_INTERVAL_MS: 30000  // auto-refresh cada 30 seg en dashboards
};
```

> Solo hay que cambiar `GAS_URL` al desplegar. El resto del sistema lo consume automáticamente.

---

## 13. Orden de implementación sugerido

1. **GAS + Sheets:** crear las 2 hojas, implementar `doGet` y `doPost`, desplegar como Web App
2. **config.js:** pegar la URL del Web App
3. **index.html + formulario.js:** formulario funcional con envío real
4. **semaforo.html + semaforo.js:** tabla/cards con modal de detalle
5. **compromisos.html + compromisos.js:** board Kanban con actualización de estado
6. **style.css:** unificar paleta morada en los 3 módulos
7. **Deploy en GitHub Pages**

---

## 14. Notas importantes

- **CORS en GAS POST:** siempre usar `Content-Type: text/plain;charset=utf-8` en el fetch del formulario para evitar preflight.
- **Fechas:** se almacenan en el Sheet como `yyyy-MM-dd` y se muestran al usuario como `dd/mm/aaaa`.
- **Sin autenticación:** el sistema es público, pensado para uso en taller presencial controlado.
- **Si una sede tiene múltiples visitas registradas:** el semáforo muestra la más reciente (ordenar por timestamp al leer).
- **Auto-refresh:** los dashboards se actualizan solos cada 30 segundos para ver en tiempo real los registros del taller.
