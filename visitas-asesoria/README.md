# Sistema de Taller — Visitas Escuela Nueva

Formulario de visita de asesoría + dos tableros en tiempo real (Semáforo y Compromisos).
Tono claro esmeralda, consistente con el resto del sitio.

## Arquitectura

- **`Codigo.gs`** → backend en Google Apps Script (API). `GET` lee, `POST` escribe.
- **Frontend estático en GitHub Pages:** `index.html`, `semaforo.html`, `compromisos.html`
  con sus `*.js`, `style.css` y `config.js`.
- **Datos:** Google Sheets con dos hojas (`Visitas` y `Compromisos`).
- **CORS:** los `POST` se envían con `Content-Type: text/plain` (petición simple, sin preflight).

## Archivos

| Archivo | Dónde va | Rol |
|---|---|---|
| `Codigo.gs` | Apps Script | API (doGet/doPost) |
| `config.js` | GitHub | URL del backend (`GAS_URL`) |
| `style.css` | GitHub | Estilos compartidos |
| `index.html` + `formulario.js` | GitHub | Formulario de visita |
| `semaforo.html` + `semaforo.js` | GitHub | Tablero Semáforo |
| `compromisos.html` + `compromisos.js` | GitHub | Tablero Kanban de compromisos |

## 1) Backend (Apps Script)

1. Crea/abre el Google Sheet que servirá de base de datos.
2. **Extensiones → Apps Script** (queda enlazado a esa hoja; deja `SHEET_ID = ''`).
   *(O bien crea un proyecto suelto en script.google.com y pon el ID de la hoja en `SHEET_ID`.)*
3. Pega `Codigo.gs`. Guarda.
4. **Ejecutar → `setup`** (autoriza permisos). Crea las hojas `Visitas` y `Compromisos`.
5. **Implementar → Nueva implementación → Aplicación web**:
   - *Ejecutar como:* **Yo**
   - *Quién tiene acceso:* **Cualquier persona**
   - Copia la **URL `/exec`**.

> Al editar `Codigo.gs` después: Implementar → *Administrar implementaciones* → ✏️ → **Nueva versión**.

## 2) Frontend (GitHub Pages)

1. Pega la URL `/exec` en `config.js` (`GAS_URL`).
2. Sube la carpeta al repo. Quedará, por ejemplo:
   - Formulario: `https://<tu-sitio>/visitas-asesoria/index.html`
   - Semáforo: `https://<tu-sitio>/visitas-asesoria/semaforo.html`
   - Compromisos: `https://<tu-sitio>/visitas-asesoria/compromisos.html`

## Lógica del Semáforo

Cada indicador: `AA` = 2 · `AM` = 1 · `NA` = 0. Promedio de los 7 indicadores:

| Puntaje | Color |
|---|---|
| 1.5 – 2.0 | 🟢 Verde |
| 0.8 – 1.49 | 🟡 Amarillo |
| 0.0 – 0.79 | 🔴 Rojo |

Si una sede tiene varias visitas, el semáforo usa la **más reciente**.

## Estados de compromisos

Calculados en el backend al momento de leer (nunca se guarda "vencido"):
- `Cumplido` → 🟢 cumplido
- pendiente y hoy ≤ fecha de verificación → 🔵 pendiente
- pendiente y hoy > fecha de verificación → 🔴 vencido

## Notas

- Dashboards con **auto-refresh** cada 30 s (`REFRESH_INTERVAL_MS` en `config.js`).
- Fechas: se guardan `yyyy-MM-dd` y se muestran `dd/mm/aaaa`.
- Sin autenticación: pensado para taller presencial controlado.
