# Evaluación Virtual de Talleres — Comité de Cafeteros

Formulario web (basado en el formato **GP-IE-R-07**) que guarda las respuestas en Google Sheets,
más un panel de resultados con dashboard.

## Arquitectura

- **`Codigo.gs`** → único archivo en **Google Apps Script**. Funciona como API:
  - `POST /exec` guarda una evaluación.
  - `GET /exec` devuelve todas las respuestas en JSON (para el panel).
- **`form.html`** y **`admin.html`** → se sirven desde **GitHub Pages** y consumen ese API por `fetch`.
- **Hoja destino:** `12HvTyf0mMpO7cV7kgZ1ERPG3YJPEy7TgUIvvyMI3XJs`, pestaña **"Respuestas"**.

El formulario lee el pre-llenado del encabezado de **su propia URL** (`?taller=...&municipio=...`).

## 1) Backend en Apps Script (una sola vez)

1. Abre <https://script.google.com> → **Nuevo proyecto**.
2. Pega el contenido de `Codigo.gs`. Guarda 💾.
3. Menú **Ejecutar → `setup`** (autoriza permisos la primera vez). Crea la pestaña "Respuestas".
4. **Implementar → Nueva implementación → Aplicación web**:
   - *Ejecutar como:* **Yo**
   - *Quién tiene acceso:* **Cualquier persona**
   - Implementar y copiar la **URL `/exec`**.

> La URL `/exec` actual ya está embebida en `form.html` y `admin.html` (constante `API`).
> Si vuelves a desplegar y cambia, actualiza esa constante en ambos archivos.

**Al editar `Codigo.gs` después:** Implementar → *Administrar implementaciones* → editar (✏️) →
**Versión: Nueva versión** → Implementar (si no, la URL sigue sirviendo la versión vieja).

## 2) Páginas en GitHub

Sube `form.html`, `admin.html` y `generar.html` al repo (se publican con GitHub Pages). Por ejemplo:

- Formulario: `https://<tu-sitio>/evaluacion-virtual/form.html`
- Panel:      `https://<tu-sitio>/evaluacion-virtual/admin.html`
- Generador de enlaces: `https://<tu-sitio>/evaluacion-virtual/generar.html`

## Uso

- **Generar el enlace (forma fácil):** abre `generar.html`, llena los datos del taller y obtén el
  enlace ya armado + un código QR para compartir o imprimir. Es la vía recomendada.

- **Formulario pre-llenado por taller** (lo que genera la página anterior, ideal para un QR por evento):
  ```
  .../form.html?taller=Encuentro%20de%20Rectores&municipio=Manzanares&fecha=2026-05-30&coordinadores=Equipo%20de%20Padrinos
  ```
  Parámetros: `entidad`, `taller`, `municipio`, `fecha` (yyyy-mm-dd), `coordinadores`.
  Lo que no envíes por URL queda como campo editable. Entidad por defecto: *"Alianza de Educación Rural"*.

- **Panel de resultados:** `.../admin.html`

## Dashboard

- KPIs: total de evaluaciones, promedio general (1–4), % de satisfacción, n.º de talleres.
- Distribución Excelente / Bueno / Regular / Malo por cada aspecto, con promedio.
- Gauge de satisfacción (Excelente + Bueno).
- Comentarios cualitativos (pregunta 5, temas destacados, temas a profundizar).
- Filtros por taller y municipio + exportación a CSV.

Puntaje: Excelente = 4 · Bueno = 3 · Regular = 2 · Malo = 1.

## Notas técnicas

- El `POST` se envía con `Content-Type: text/plain` (petición "simple") para evitar el preflight
  CORS que Apps Script no maneja. El backend lo parsea con `JSON.parse(e.postData.contents)`.
- El panel es de acceso abierto (sin contraseña). Para protegerlo más adelante se puede exigir
  una clave en `doGet`/`getResultsData_`; pídelo y lo activamos.
