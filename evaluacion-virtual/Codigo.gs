/**
 * Evaluación Virtual de Talleres de Capacitación — Comité de Cafeteros
 * Backend / API en Google Apps Script (solo este archivo va en Apps Script).
 *
 * El formulario (form.html) y el panel (admin.html) se sirven desde GitHub
 * y se comunican con este backend por fetch:
 *   - POST  /exec        → guarda una evaluación (body JSON).
 *   - GET   /exec         → devuelve todas las respuestas en JSON (para el panel).
 *
 * Despliegue: ver README.md
 */

// ====== CONFIGURACIÓN ======
const SHEET_ID   = '12HvTyf0mMpO7cV7kgZ1ERPG3YJPEy7TgUIvvyMI3XJs';
const SHEET_NAME = 'Respuestas';

// Orden EXACTO de las columnas en la hoja
const HEADERS = [
  'Marca temporal',                                       // 0
  'Entidad Aportante',                                    // 1
  'Nombre del Taller',                                    // 2
  'Municipio',                                            // 3
  'Fecha del Taller',                                     // 4
  'Coordinador(es)',                                      // 5
  'Docente (opcional)',                                   // 6
  '1. Oportunidad, Organización y Coordinación',          // 7
  '2. Claridad y profundidad de los contenidos',          // 8
  '3. Calidad y funcionalidad de documentos de apoyo',    // 9
  '4. Desempeño pedagógico de los Orientadores',          // 10
  '5. Explicación de la menor calificación',              // 11
  'Tema destacado 1',                                     // 12
  'Tema destacado 2',                                     // 13
  'Tema destacado 3',                                     // 14
  '7. Temas en que le gustaría profundizar'               // 15
];

// ====== ENDPOINTS ======

/** GET → devuelve las respuestas en JSON (consumido por admin.html en GitHub). */
function doGet(e) {
  return json_(getResultsData_());
}

/** POST → guarda una evaluación (body JSON enviado por form.html en GitHub). */
function doPost(e) {
  try {
    var data = JSON.parse((e && e.postData && e.postData.contents) || '{}');
    saveRow_(data);
    return json_({ ok: true });
  } catch (err) {
    return json_({ ok: false, error: String(err) });
  }
}

// ====== LÓGICA ======

function saveRow_(data) {
  var lock = LockService.getScriptLock();
  try {
    lock.waitLock(20000);
    var sh = getSheet_();
    sh.appendRow([
      new Date(),
      str_(data.entidad), str_(data.taller), str_(data.municipio),
      str_(data.fecha), str_(data.coordinadores), str_(data.docente),
      data.q1 || '', data.q2 || '', data.q3 || '', data.q4 || '',
      str_(data.q5), str_(data.tema1), str_(data.tema2), str_(data.tema3), str_(data.q7)
    ]);
  } finally {
    try { lock.releaseLock(); } catch (e) {}
  }
}

function getResultsData_() {
  var sh = getSheet_();
  var lastRow = sh.getLastRow();
  if (lastRow < 2) return { ok: true, headers: HEADERS, rows: [] };

  var values = sh.getRange(2, 1, lastRow - 1, HEADERS.length).getValues();
  var tz = Session.getScriptTimeZone();
  var rows = values.map(function (r) {
    if (r[0] instanceof Date) r[0] = Utilities.formatDate(r[0], tz, 'yyyy-MM-dd HH:mm');
    if (r[4] instanceof Date) r[4] = Utilities.formatDate(r[4], tz, 'yyyy-MM-dd');
    return r;
  });
  return { ok: true, headers: HEADERS, rows: rows };
}

// ====== UTILIDADES ======

function getSheet_() {
  var ss = SpreadsheetApp.openById(SHEET_ID);
  var sh = ss.getSheetByName(SHEET_NAME);
  if (!sh) sh = ss.insertSheet(SHEET_NAME);
  if (sh.getLastRow() === 0) {
    sh.getRange(1, 1, 1, HEADERS.length).setValues([HEADERS]).setFontWeight('bold');
    sh.setFrozenRows(1);
    sh.getRange(1, 1, 1, HEADERS.length).setBackground('#0A5048').setFontColor('#ffffff');
  }
  return sh;
}

function str_(v) { return (v == null ? '' : String(v)).trim(); }

function json_(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}

/** Ejecutar UNA vez desde el editor para crear la hoja con encabezados. */
function setup() {
  getSheet_();
  return 'Hoja "' + SHEET_NAME + '" lista con encabezados.';
}
