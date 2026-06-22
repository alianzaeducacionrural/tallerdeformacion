/**
 * Sistema de Taller — Visitas Escuela Nueva
 * Backend / API en Google Apps Script (Web App).
 *
 * Frontend (index/semaforo/compromisos) se sirve desde GitHub Pages y se
 * comunica con este backend por fetch:
 *   - GET  ?action=semaforo      → sedes con calificación (semáforo)
 *   - GET  ?action=compromisos   → compromisos con estado calculado
 *   - POST action:registrarVisita     → guarda visita + compromisos
 *   - POST action:actualizarCompromiso→ actualiza estado/observaciones
 *
 * Los POST llegan con Content-Type text/plain (petición simple, sin preflight).
 */

// ====== CONFIGURACIÓN ======
const SHEET_ID = '14-M06IjBjsMh31lCK9frOD-zT1X8cwGWJmbZA6WwOsY';   // ID del Spreadsheet (vacío '' si el script está enlazado a la hoja)
const SHEET_VISITAS = 'Visitas';
const SHEET_COMPROMISOS = 'Compromisos';

const HEADERS_VISITAS = [
  'ID','Timestamp','Asesor','Fecha de visita','Municipio','Institución','Sede',
  'GE1','GE2','GE3','GE4','GI5','GI6','GI7','Recomendaciones',
  'C1 Descripción','C1 Responsable','C1 Fecha verificación',
  'C2 Descripción','C2 Responsable','C2 Fecha verificación',
  'C3 Descripción','C3 Responsable','C3 Fecha verificación'
];
const HEADERS_COMPROMISOS = [
  'ID Compromiso','ID Visita','Asesor','Municipio','Institución','Sede',
  'Número','Descripción','Responsable','Fecha verificación',
  'Estado','Observaciones','Fecha creación','Fecha actualización'
];

const INDICADORES = ['GE1','GE2','GE3','GE4','GI5','GI6','GI7'];
const VALOR = { AA: 2, AM: 1, NA: 0 };

// ====== RUTEO ======
function doGet(e) {
  var action = (e && e.parameter && e.parameter.action) || '';
  if (action === 'semaforo')    return json_(getSemaforo_());
  if (action === 'compromisos') return json_(getCompromisos_());
  return json_({ error: 'Acción no reconocida' });
}

function doPost(e) {
  try {
    var data = JSON.parse((e && e.postData && e.postData.contents) || '{}');
    if (data.action === 'registrarVisita')      return json_(registrarVisita_(data));
    if (data.action === 'actualizarCompromiso') return json_(actualizarCompromiso_(data));
    return json_({ error: 'Acción no reconocida' });
  } catch (err) {
    return json_({ error: String(err) });
  }
}

// ====== ESCRITURA ======
function registrarVisita_(data) {
  var lock = LockService.getScriptLock();
  try {
    lock.waitLock(20000);
    var ss = getSS_();
    var hojaV = getSheet_(ss, SHEET_VISITAS, HEADERS_VISITAS);
    var hojaC = getSheet_(ss, SHEET_COMPROMISOS, HEADERS_COMPROMISOS);

    var id = Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
    var ind = data.indicadores || {};
    var comp = data.compromisos || [];

    function c(i){ return comp[i] || {}; }
    hojaV.appendRow([
      id, new Date(), str_(data.asesor), str_(data.fecha_visita),
      str_(data.municipio), str_(data.institucion), str_(data.sede),
      ind.GE1||'', ind.GE2||'', ind.GE3||'', ind.GE4||'',
      ind.GI5||'', ind.GI6||'', ind.GI7||'',
      str_(data.recomendaciones),
      str_(c(0).descripcion), str_(c(0).responsable), str_(c(0).fecha_verificacion),
      str_(c(1).descripcion), str_(c(1).responsable), str_(c(1).fecha_verificacion),
      str_(c(2).descripcion), str_(c(2).responsable), str_(c(2).fecha_verificacion)
    ]);

    var now = new Date();
    var n = 0;
    comp.forEach(function (k, i) {
      if (!str_(k.descripcion)) return;
      n++;
      hojaC.appendRow([
        id + '#' + (i + 1), id, str_(data.asesor), str_(data.municipio),
        str_(data.institucion), str_(data.sede), (i + 1),
        str_(k.descripcion), str_(k.responsable), str_(k.fecha_verificacion),
        'Pendiente', '', now, now
      ]);
    });

    return { ok: true, id: id, compromisos: n };
  } finally {
    try { lock.releaseLock(); } catch (e) {}
  }
}

function actualizarCompromiso_(data) {
  var lock = LockService.getScriptLock();
  try {
    lock.waitLock(20000);
    var sh = getSheet_(getSS_(), SHEET_COMPROMISOS, HEADERS_COMPROMISOS);
    var last = sh.getLastRow();
    if (last < 2) return { ok: false, error: 'Sin compromisos' };
    var ids = sh.getRange(2, 1, last - 1, 1).getValues();
    for (var i = 0; i < ids.length; i++) {
      if (String(ids[i][0]) === String(data.id)) {
        var row = i + 2;
        if (data.estado_inicial) sh.getRange(row, 11).setValue(data.estado_inicial); // K Estado
        sh.getRange(row, 12).setValue(str_(data.observaciones));                      // L Observaciones
        sh.getRange(row, 14).setValue(new Date());                                     // N Fecha actualización
        return { ok: true };
      }
    }
    return { ok: false, error: 'Compromiso no encontrado' };
  } finally {
    try { lock.releaseLock(); } catch (e) {}
  }
}

// ====== LECTURA ======
function getSemaforo_() {
  var ss = getSS_();
  var sh = getSheet_(ss, SHEET_VISITAS, HEADERS_VISITAS);
  var last = sh.getLastRow();
  if (last < 2) return [];
  var rows = sh.getRange(2, 1, last - 1, HEADERS_VISITAS.length).getValues();
  var tz = ss.getSpreadsheetTimeZone();

  // Quedarse con la visita más reciente por sede (municipio|institucion|sede)
  var porSede = {};
  rows.forEach(function (r) {
    var key = [r[4], r[5], r[6]].join('|').toLowerCase();
    var ts = (r[1] instanceof Date) ? r[1].getTime() : 0;
    if (!porSede[key] || ts >= porSede[key]._ts) { porSede[key] = { r: r, _ts: ts }; }
  });

  return Object.keys(porSede).map(function (k) {
    var r = porSede[k].r;
    var ind = {}, suma = 0, cuenta = 0;
    INDICADORES.forEach(function (code, i) {
      var v = String(r[7 + i] || '').toUpperCase();
      ind[code] = v;
      if (VALOR.hasOwnProperty(v)) { suma += VALOR[v]; cuenta++; }
    });
    var puntaje = cuenta ? (suma / cuenta) : 0;
    return {
      municipio: r[4], institucion: r[5], sede: r[6], asesor: r[2],
      fecha_visita: fdate_(r[3], tz),
      puntaje: Math.round(puntaje * 100) / 100,
      calificacion: colorDe_(puntaje),
      indicadores: ind,
      recomendaciones: r[14] || ''
    };
  });
}

function getCompromisos_() {
  var ss = getSS_();
  var sh = getSheet_(ss, SHEET_COMPROMISOS, HEADERS_COMPROMISOS);
  var last = sh.getLastRow();
  if (last < 2) return [];
  var rows = sh.getRange(2, 1, last - 1, HEADERS_COMPROMISOS.length).getValues();
  var tz = ss.getSpreadsheetTimeZone();
  var hoy = new Date(); hoy.setHours(0, 0, 0, 0);

  return rows.map(function (r) {
    var estadoInicial = String(r[10] || 'Pendiente');
    var fechaVerif = r[9];
    var estado;
    if (estadoInicial === 'Cumplido') {
      estado = 'cumplido';
    } else {
      var fv = (fechaVerif instanceof Date) ? fechaVerif : parseFecha_(fechaVerif);
      estado = (fv && hoy > fv) ? 'vencido' : 'pendiente';
    }
    return {
      id: r[0], visita_id: r[1], asesor: r[2], municipio: r[3],
      institucion: r[4], sede: r[5], numero: r[6],
      descripcion: r[7], responsable: r[8],
      fecha_verificacion: fdate_(fechaVerif, tz),
      estado_inicial: estadoInicial, estado_calculado: estado,
      observaciones: r[11] || ''
    };
  });
}

// ====== UTILIDADES ======
function colorDe_(p) {
  if (p >= 1.5) return 'VERDE';
  if (p >= 0.8) return 'AMARILLO';
  return 'ROJO';
}

function getSS_() {
  return SHEET_ID ? SpreadsheetApp.openById(SHEET_ID) : SpreadsheetApp.getActiveSpreadsheet();
}

function getSheet_(ss, name, headers) {
  var sh = ss.getSheetByName(name);
  if (!sh) sh = ss.insertSheet(name);
  if (sh.getLastRow() === 0) {
    sh.getRange(1, 1, 1, headers.length).setValues([headers]).setFontWeight('bold')
      .setBackground('#0A5048').setFontColor('#ffffff');
    sh.setFrozenRows(1);
  }
  return sh;
}

function str_(v) { return (v == null ? '' : String(v)).trim(); }

function fdate_(d, tz) {
  if (d instanceof Date) return Utilities.formatDate(d, tz, 'yyyy-MM-dd');
  var s = str_(d);
  if (!s) return '';
  if (/^\d{4}-\d{2}-\d{2}/.test(s)) return s.slice(0, 10);        // ya viene yyyy-mm-dd / ISO
  var parsed = new Date(s);                                        // normaliza textos tipo "Wed Jul 22 2026 ..."
  if (!isNaN(parsed.getTime())) return Utilities.formatDate(parsed, tz, 'yyyy-MM-dd');
  return s;
}

function parseFecha_(s) {
  s = str_(s); if (!s) return null;
  var m = s.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (m) return new Date(+m[1], +m[2] - 1, +m[3]);
  var d = new Date(s); return isNaN(d) ? null : d;
}

function json_(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}

/** Ejecutar UNA vez para crear ambas hojas con encabezados. */
function setup() {
  var ss = getSS_();
  getSheet_(ss, SHEET_VISITAS, HEADERS_VISITAS);
  getSheet_(ss, SHEET_COMPROMISOS, HEADERS_COMPROMISOS);
  return 'Hojas listas: ' + SHEET_VISITAS + ' y ' + SHEET_COMPROMISOS;
}
