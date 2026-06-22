/* Dashboard de Compromisos (Kanban) — Escuela Nueva */
(function () {
  var ALL = [];
  var actual = null;     // compromiso en edición
  var draggedId = null;  // compromiso que se está arrastrando

  var COLOR = { pendiente: 'var(--pend)', cumplido: 'var(--verde)', vencido: 'var(--rojo)' };

  var primeraCarga = true;
  function load() {
    if (primeraCarga) {
      document.getElementById('loading').style.display = 'block';
      document.getElementById('dash').style.display = 'none';
    }
    fetch(CONFIG.GAS_URL + '?action=compromisos')
      .then(parseRes)
      .then(function (data) {
        ALL = Array.isArray(data) ? data : [];
        primeraCarga = false;
        document.getElementById('loading').style.display = 'none';
        document.getElementById('dash').style.display = 'block';
        buildFilters(); render();
      })
      .catch(function (e) {
        if (primeraCarga) {
          document.getElementById('loading').innerHTML =
            '<p style="color:var(--rojo);font-weight:600">No se pudieron cargar los datos.</p>' +
            '<p class="muted" style="margin-top:6px">' + esc(friendly(e)) + '</p>' +
            '<button class="btn" style="margin-top:14px" onclick="location.reload()">Reintentar</button>';
        }
      });
  }

  function parseRes(r) {
    return r.text().then(function (t) {
      try { return JSON.parse(t); }
      catch (e) { throw new Error('Respuesta inesperada del servidor. Verifique el despliegue del Apps Script (acceso "Cualquier persona").'); }
    });
  }
  function friendly(e) {
    var m = (e && e.message) ? e.message : String(e);
    if (/Failed to fetch|NetworkError|Load failed|TypeError/i.test(m)) return 'Sin conexión con el servidor. Revise su internet.';
    return m;
  }

  function uniq(key) {
    var s = {}; ALL.forEach(function (x) { var v = (x[key] || '').toString().trim(); if (v) s[v] = 1; });
    return Object.keys(s).sort();
  }
  function buildFilters() {
    fill('fAsesor', uniq('asesor')); fill('fMun', uniq('municipio'));
  }
  function fill(id, arr) {
    var sel = document.getElementById(id), cur = sel.value, first = sel.options[0].outerHTML;
    sel.innerHTML = first + arr.map(function (v) { return '<option>' + esc(v) + '</option>'; }).join('');
    sel.value = cur;
  }

  function filtered() {
    var a = document.getElementById('fAsesor').value,
        m = document.getElementById('fMun').value,
        q = document.getElementById('fBuscar').value.trim().toLowerCase();
    return ALL.filter(function (x) {
      if (a && x.asesor != a) return false;
      if (m && x.municipio != m) return false;
      if (q) {
        var blob = [x.descripcion, x.responsable, x.sede, x.institucion, x.municipio].join(' ').toLowerCase();
        if (blob.indexOf(q) === -1) return false;
      }
      return true;
    });
  }

  // Convierte cualquier representación de fecha (yyyy-mm-dd, ISO, o Date.toString) a un Date local a medianoche.
  function toDate(v) {
    if (!v) return null;
    v = String(v);
    var m = v.match(/(\d{4})-(\d{2})-(\d{2})/);
    if (m) return new Date(+m[1], +m[2] - 1, +m[3]);
    var d = new Date(v);
    if (isNaN(d.getTime())) return null;
    d.setHours(0, 0, 0, 0);
    return d;
  }
  function diasPara(v) {
    var f = toDate(v); if (!f) return null;
    var hoy = new Date(); hoy.setHours(0, 0, 0, 0);
    return Math.round((f - hoy) / 86400000);
  }
  function fechaCorta(v) {
    var f = toDate(v); if (!f) return '';
    return ('0' + f.getDate()).slice(-2) + '/' + ('0' + (f.getMonth() + 1)).slice(-2) + '/' + f.getFullYear();
  }

  function render() {
    var rows = filtered();
    document.getElementById('count').textContent = rows.length + ' de ' + ALL.length + ' compromisos';

    var grupos = { pendiente: [], cumplido: [], vencido: [] };
    rows.forEach(function (x) { (grupos[x.estado_calculado] || grupos.pendiente).push(x); });

    // KPIs sobre TODO el conjunto (no filtrado) para visión global
    var tot = { pendiente: 0, cumplido: 0, vencido: 0 };
    ALL.forEach(function (x) { if (tot.hasOwnProperty(x.estado_calculado)) tot[x.estado_calculado]++; });
    var total = ALL.length;
    var pct = total ? Math.round(tot.cumplido / total * 100) : 0;

    var kpis = [
      { lab: 'Total', num: total, ic: '📋', ac: '#0F7A63' },
      { lab: 'Pendientes', num: tot.pendiente, ic: '🔵', ac: '#2f8fd6' },
      { lab: 'Cumplidos', num: tot.cumplido, ic: '🟢', ac: '#17a673' },
      { lab: 'Vencidos', num: tot.vencido, ic: '🔴', ac: '#d6443c' }
    ];
    document.getElementById('kpis').innerHTML = kpis.map(function (k) {
      return '<div class="kpi" style="--ac:' + k.ac + '"><div class="ic">' + k.ic + '</div>' +
        '<div><div class="num">' + k.num + '</div><div class="lab">' + k.lab + '</div></div></div>';
    }).join('');
    document.getElementById('pPct').textContent = pct + '%';
    document.getElementById('pFill').style.width = pct + '%';

    // Alertas (sobre todo el conjunto)
    var prox = ALL.filter(function (x) { var d = diasPara(x.fecha_verificacion); return x.estado_calculado === 'pendiente' && d !== null && d >= 0 && d <= 7; });
    var venc = ALL.filter(function (x) { return x.estado_calculado === 'vencido'; });
    var ap = document.getElementById('alertProx'), av = document.getElementById('alertVenc');
    if (prox.length) { ap.style.display = 'block'; ap.innerHTML = '<b>⏰ ' + prox.length + '</b> compromiso(s) próximos a vencer (≤ 7 días).'; } else ap.style.display = 'none';
    if (venc.length) { av.style.display = 'block'; av.innerHTML = '<b>⚠️ ' + venc.length + '</b> compromiso(s) vencidos sin cumplir.'; } else av.style.display = 'none';

    paint('colPend', grupos.pendiente, 'pendiente'); document.getElementById('cPend').textContent = grupos.pendiente.length;
    paint('colCump', grupos.cumplido, 'cumplido'); document.getElementById('cCump').textContent = grupos.cumplido.length;
    paint('colVenc', grupos.vencido, 'vencido'); document.getElementById('cVenc').textContent = grupos.vencido.length;
  }

  function paint(elId, items, estado) {
    var el = document.getElementById(elId);
    if (!items.length) { el.innerHTML = '<div class="vacio">Sin compromisos</div>'; return; }
    el.innerHTML = items.map(function (x) {
      var d = diasPara(x.fecha_verificacion);
      var fechaTxt = fechaCorta(x.fecha_verificacion);
      if (estado === 'pendiente' && d !== null) {
        fechaTxt += d === 0 ? ' · hoy' : ' · ' + (d === 1 ? 'falta 1 día' : 'faltan ' + d + ' días');
      }
      if (estado === 'vencido' && d !== null) {
        var n = Math.abs(d);
        fechaTxt += ' · ' + (n === 1 ? 'hace 1 día' : 'hace ' + n + ' días');
      }
      return '<div class="ccard" draggable="true" style="--c:' + COLOR[estado] + '" data-id="' + esc(x.id) + '">' +
        '<div class="desc">' + esc(x.descripcion) + '</div>' +
        '<div class="meta"><b>' + esc(x.sede) + '</b> · ' + esc(x.institucion) + '<br>👤 ' + esc(x.responsable || 's/responsable') +
        (x.observaciones ? '<br>📝 ' + esc(x.observaciones) : '') + '</div>' +
        '<div class="fecha">📅 ' + fechaTxt + '</div>' +
        '</div>';
    }).join('');
    Array.prototype.forEach.call(el.querySelectorAll('.ccard'), function (c) {
      c.addEventListener('click', function () { openModal(c.dataset.id); });
      c.addEventListener('dragstart', function (e) {
        draggedId = c.dataset.id; c.classList.add('dragging');
        e.dataTransfer.effectAllowed = 'move';
        try { e.dataTransfer.setData('text/plain', c.dataset.id); } catch (_) {}
      });
      c.addEventListener('dragend', function () { c.classList.remove('dragging'); });
    });
  }

  // Recalcula el estado lógico tras un cambio (sin esperar a recargar del servidor).
  function recalc(c) {
    if (c.estado_inicial === 'Cumplido') { c.estado_calculado = 'cumplido'; return; }
    var d = diasPara(c.fecha_verificacion);
    c.estado_calculado = (d !== null && d < 0) ? 'vencido' : 'pendiente';
  }

  function openModal(id, preset) {
    actual = ALL.filter(function (x) { return String(x.id) === String(id); })[0];
    if (!actual) return;
    document.getElementById('mSub').textContent = actual.municipio + ' › ' + actual.institucion + ' › ' + actual.sede;
    document.getElementById('mInfo').innerHTML =
      '<b>' + esc(actual.descripcion) + '</b><br>👤 ' + esc(actual.responsable || 's/responsable') +
      ' · 📅 ' + fechaCorta(actual.fecha_verificacion) + ' · ' + esc(actual.asesor || '');
    document.getElementById('mEstado').value = preset || ((actual.estado_inicial === 'Cumplido') ? 'Cumplido' : 'Pendiente');
    document.getElementById('mObs').value = actual.observaciones || '';
    document.getElementById('modal').classList.add('show');
  }

  // ====== Drag & drop entre columnas ======
  function onDrop(colKey) {
    var id = draggedId; draggedId = null;
    if (!id) return;
    if (colKey === 'venc') { showAlert(); return; }
    openModal(id, colKey === 'cump' ? 'Cumplido' : 'Pendiente');
  }
  function setupDnD() {
    Array.prototype.forEach.call(document.querySelectorAll('.col'), function (col) {
      var key = col.dataset.col;
      if (key === 'venc') col.classList.add('nodrop');
      col.addEventListener('dragover', function (e) { e.preventDefault(); col.classList.add('dragover'); });
      col.addEventListener('dragleave', function (e) { if (!col.contains(e.relatedTarget)) col.classList.remove('dragover'); });
      col.addEventListener('drop', function (e) { e.preventDefault(); col.classList.remove('dragover'); onDrop(key); });
    });
  }

  // ====== Alerta (intento de mover a Vencido) ======
  function showAlert() {
    document.getElementById('aMsg').textContent =
      'El estado “Vencido” no se asigna manualmente: se aplica automáticamente cuando se cumple la fecha de verificación y el compromiso sigue pendiente.';
    document.getElementById('alertModal').classList.add('show');
  }
  function closeAlert() { document.getElementById('alertModal').classList.remove('show'); }
  function closeModal() { document.getElementById('modal').classList.remove('show'); actual = null; }

  function save() {
    if (!actual) return;
    var btn = document.getElementById('mSave');
    btn.disabled = true; btn.textContent = 'Guardando…';
    var payload = {
      action: 'actualizarCompromiso',
      id: actual.id,
      estado_inicial: document.getElementById('mEstado').value,
      observaciones: document.getElementById('mObs').value.trim()
    };
    var ref = actual;
    fetch(CONFIG.GAS_URL, { method: 'POST', body: JSON.stringify(payload) })
      .then(parseRes)
      .then(function (res) {
        if (!(res && res.ok)) throw new Error((res && res.error) || 'No se pudo guardar el cambio.');
        // actualización optimista local + recálculo del estado para reubicar la tarjeta
        ref.estado_inicial = payload.estado_inicial;
        ref.observaciones = payload.observaciones;
        recalc(ref);
        closeModal(); render(); toast('Compromiso actualizado ✓');
      })
      .catch(function (e) { toast('Error: ' + friendly(e)); })
      .then(function () { btn.disabled = false; btn.textContent = 'Guardar cambios'; });
  }

  var toastT;
  function toast(msg) {
    var t = document.getElementById('toast'); t.textContent = msg; t.classList.add('show');
    clearTimeout(toastT); toastT = setTimeout(function () { t.classList.remove('show'); }, 2600);
  }

  function esc(s) { return (s == null ? '' : String(s)).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }

  document.getElementById('fAsesor').addEventListener('change', render);
  document.getElementById('fMun').addEventListener('change', render);
  document.getElementById('fBuscar').addEventListener('input', render);
  document.getElementById('clearF').addEventListener('click', function () {
    document.getElementById('fAsesor').value = '';
    document.getElementById('fMun').value = '';
    document.getElementById('fBuscar').value = '';
    render();
  });
  document.getElementById('mClose').addEventListener('click', closeModal);
  document.getElementById('mCancel').addEventListener('click', closeModal);
  document.getElementById('mSave').addEventListener('click', save);
  document.getElementById('modal').addEventListener('click', function (e) { if (e.target === this) closeModal(); });
  document.getElementById('aClose').addEventListener('click', closeAlert);
  document.getElementById('aOk').addEventListener('click', closeAlert);
  document.getElementById('alertModal').addEventListener('click', function (e) { if (e.target === this) closeAlert(); });
  document.addEventListener('keydown', function (e) { if (e.key === 'Escape') { closeModal(); closeAlert(); } });

  setupDnD();
  load();
  if (CONFIG.REFRESH_INTERVAL_MS) setInterval(function () { if (!document.getElementById('modal').classList.contains('show')) load(); }, CONFIG.REFRESH_INTERVAL_MS);
})();
