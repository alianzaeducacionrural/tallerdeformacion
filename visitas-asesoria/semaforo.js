/* Dashboard Semáforo — Escuela Nueva */
(function () {
  var IND_LABEL = {
    GE1: 'Elección de la junta directiva',
    GE2: 'Organización y operatividad de los comités',
    GE3: 'Dinamización instrumentos de aula',
    GE4: 'Hora de Gobierno Estudiantil',
    GI5: 'Uso de guías del proyecto',
    GI6: 'Dinamización de roles de trabajo',
    GI7: 'Dinamización formas de trabajo'
  };
  var CLASE = { VERDE: 'verde', AMARILLO: 'amarillo', ROJO: 'rojo' };
  var COLOR = { VERDE: 'var(--verde)', AMARILLO: 'var(--amarillo)', ROJO: 'var(--rojo)' };
  var ALL = [];

  var primeraCarga = true;
  function load() {
    if (primeraCarga) {
      document.getElementById('loading').style.display = 'block';
      document.getElementById('dash').style.display = 'none';
    }
    fetch(CONFIG.GAS_URL + '?action=semaforo')
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
  function fechaDDMM(v) {
    if (!v) return '';
    v = String(v);
    var m = v.match(/(\d{4})-(\d{2})-(\d{2})/);
    if (m) return m[3] + '/' + m[2] + '/' + m[1];
    var d = new Date(v);
    if (isNaN(d.getTime())) return v;
    return ('0' + d.getDate()).slice(-2) + '/' + ('0' + (d.getMonth() + 1)).slice(-2) + '/' + d.getFullYear();
  }

  function uniq(key) {
    var s = {}; ALL.forEach(function (x) { var v = (x[key] || '').toString().trim(); if (v) s[v] = 1; });
    return Object.keys(s).sort();
  }
  function buildFilters() {
    fill('fMun', uniq('municipio')); fill('fInst', uniq('institucion'));
  }
  function fill(id, arr) {
    var sel = document.getElementById(id), cur = sel.value, first = sel.options[0].outerHTML;
    sel.innerHTML = first + arr.map(function (v) { return '<option>' + esc(v) + '</option>'; }).join('');
    sel.value = cur;
  }

  function filtered() {
    var m = document.getElementById('fMun').value,
        i = document.getElementById('fInst').value,
        c = document.getElementById('fCal').value;
    return ALL.filter(function (x) {
      return (!m || x.municipio == m) && (!i || x.institucion == i) && (!c || x.calificacion == c);
    });
  }

  function render() {
    var rows = filtered();
    rows.sort(function (a, b) {
      return (a.municipio || '').localeCompare(b.municipio || '', 'es') ||
             (a.institucion || '').localeCompare(b.institucion || '', 'es') ||
             (a.sede || '').localeCompare(b.sede || '', 'es');
    });
    document.getElementById('count').textContent = rows.length + ' de ' + ALL.length + ' sedes';

    var cont = { VERDE: 0, AMARILLO: 0, ROJO: 0 };
    ALL.forEach(function (x) { if (cont.hasOwnProperty(x.calificacion)) cont[x.calificacion]++; });
    var kpis = [
      { lab: 'Sedes visitadas', num: ALL.length, ic: '🏫', ac: '#0F7A63' },
      { lab: 'Verde', num: cont.VERDE, ic: '🟢', ac: '#17a673' },
      { lab: 'Amarillo', num: cont.AMARILLO, ic: '🟡', ac: '#d99400' },
      { lab: 'Rojo', num: cont.ROJO, ic: '🔴', ac: '#d6443c' }
    ];
    document.getElementById('kpis').innerHTML = kpis.map(function (k) {
      return '<div class="kpi" style="--ac:' + k.ac + '"><div class="ic">' + k.ic + '</div>' +
        '<div><div class="num">' + k.num + '</div><div class="lab">' + k.lab + '</div></div></div>';
    }).join('');

    var box = document.getElementById('sedes');
    if (!rows.length) { box.innerHTML = '<div class="empty" style="grid-column:1/-1">No hay sedes para este filtro.</div>'; return; }
    box.innerHTML = rows.map(function (x, idx) {
      var cls = CLASE[x.calificacion] || 'pend';
      return '<div class="sede" style="--c:' + (COLOR[x.calificacion] || 'var(--line)') + '" data-i="' + idx + '">' +
        '<div class="muni">' + esc(x.municipio) + '</div>' +
        '<div class="nom">' + esc(x.sede) + '</div>' +
        '<div class="inst">' + esc(x.institucion) + '</div>' +
        '<div class="row"><span class="pill ' + cls + '"><span class="dot ' + cls + '"></span>' + esc(x.calificacion) + '</span>' +
        '<span class="asesor">' + (x.puntaje != null ? x.puntaje.toFixed(2) + ' / 2' : '') + '</span></div>' +
        '</div>';
    }).join('');

    // referencia para el modal (en el mismo orden filtrado)
    box._rows = rows;
    Array.prototype.forEach.call(box.querySelectorAll('.sede'), function (el) {
      el.addEventListener('click', function () { openModal(box._rows[+el.dataset.i]); });
    });
  }

  function openModal(x) {
    document.getElementById('mTit').textContent = x.sede;
    document.getElementById('mSub').textContent = x.municipio + ' › ' + x.institucion +
      '  ·  ' + (x.asesor || 's/asesor') + '  ·  ' + fechaDDMM(x.fecha_visita);

    var grupos = { AA: [], AM: [], NA: [] };
    Object.keys(x.indicadores || {}).forEach(function (code) {
      var v = x.indicadores[code];
      if (grupos[v]) grupos[v].push((IND_LABEL[code] || code));
    });

    function grpHTML(items, cls, icon, titulo) {
      if (!items.length) return '';
      return '<div class="grp ' + cls + '"><h4>' + icon + ' ' + titulo + ' (' + items.length + ')</h4><ul>' +
        items.map(function (t) { return '<li>' + esc(t) + '</li>'; }).join('') + '</ul></div>';
    }

    var cls = CLASE[x.calificacion] || 'pend';
    var html =
      '<div class="scorebar"><span class="val">' + (x.puntaje != null ? x.puntaje.toFixed(2) : '—') + '</span>' +
      '<span style="color:var(--ink3);font-size:.85rem">puntaje promedio (0–2)</span>' +
      '<span class="pill ' + cls + '" style="margin-left:auto"><span class="dot ' + cls + '"></span>' + esc(x.calificacion) + '</span></div>' +
      grpHTML(grupos.AA, 'g-verde', '🟢', 'Aplicación adecuada') +
      grpHTML(grupos.AM, 'g-amar', '🟡', 'Con oportunidad de mejora') +
      grpHTML(grupos.NA, 'g-rojo', '🔴', 'No se aplica') +
      (x.recomendaciones ? '<div class="reco"><span class="k">Recomendaciones</span>' + esc(x.recomendaciones) + '</div>' : '');

    document.getElementById('mBody').innerHTML = html;
    document.getElementById('modal').classList.add('show');
  }
  function closeModal() { document.getElementById('modal').classList.remove('show'); }

  function esc(s) { return (s == null ? '' : String(s)).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }

  document.getElementById('fMun').addEventListener('change', render);
  document.getElementById('fInst').addEventListener('change', render);
  document.getElementById('fCal').addEventListener('change', render);
  document.getElementById('clearF').addEventListener('click', function () {
    document.getElementById('fMun').value = '';
    document.getElementById('fInst').value = '';
    document.getElementById('fCal').value = '';
    render();
  });
  document.getElementById('mClose').addEventListener('click', closeModal);
  document.getElementById('modal').addEventListener('click', function (e) { if (e.target === this) closeModal(); });
  document.addEventListener('keydown', function (e) { if (e.key === 'Escape') closeModal(); });

  load();
  if (CONFIG.REFRESH_INTERVAL_MS) setInterval(load, CONFIG.REFRESH_INTERVAL_MS);
})();
