/* Formulario de visita — Escuela Nueva */
(function () {
  var SEC_A = [
    { code: 'GE1', t: 'Elección de la junta directiva' },
    { code: 'GE2', t: 'Organización y operatividad de los comités de gobierno' },
    { code: 'GE3', t: 'Dinamización instrumentos de aula' },
    { code: 'GE4', t: 'Hora de Gobierno Estudiantil' }
  ];
  var SEC_B = [
    { code: 'GI5', t: 'Uso de guías del proyecto' },
    { code: 'GI6', t: 'Dinamización de roles de trabajo' },
    { code: 'GI7', t: 'Dinamización formas de trabajo' }
  ];
  var OPTS = [
    { v: 'AA', lb: 'Aplicación adecuada', c: 'o-aa' },
    { v: 'AM', lb: 'Aplicación con oportunidad de mejora', c: 'o-am' },
    { v: 'NA', lb: 'No aplica', c: 'o-na' }
  ];

  function indHTML(it) {
    var opts = OPTS.map(function (o, i) {
      var id = it.code + '_' + i;
      return '<div class="' + o.c + '"><input type="radio" name="' + it.code + '" id="' + id + '" value="' + o.v + '">' +
        '<label for="' + id + '">' + o.lb + '</label></div>';
    }).join('');
    return '<div class="ind"><div class="ind-t">' + it.t + '</div>' +
      '<div class="opts">' + opts + '</div></div>';
  }

  document.getElementById('secA').innerHTML = SEC_A.map(indHTML).join('');
  document.getElementById('secB').innerHTML = SEC_B.map(indHTML).join('');

  var compHTML = '';
  for (var n = 1; n <= 3; n++) {
    var opc = n === 1 ? '<span class="req">*</span>' : '<span class="opc">Opcional</span>';
    compHTML += '<div class="compromiso"><div class="ch">Compromiso ' + n + ' ' + opc + '</div>' +
      '<div class="fld"><label>Descripción</label><textarea id="c' + n + '_desc" rows="2" placeholder="¿Qué se compromete a mejorar?"></textarea></div>' +
      '<div class="grid2">' +
        '<div class="fld"><label>Responsable</label><input id="c' + n + '_resp" placeholder="Nombre del responsable"></div>' +
        '<div class="fld"><label>Fecha de verificación</label><input id="c' + n + '_fecha" type="date"></div>' +
      '</div></div>';
  }
  document.getElementById('compromisos').innerHTML = compHTML;

  var INDS = SEC_A.concat(SEC_B);
  function val(id) { var e = document.getElementById(id); return e ? e.value.trim() : ''; }
  function radio(name) { var e = document.querySelector('input[name="' + name + '"]:checked'); return e ? e.value : ''; }

  // ====== Utilidades ======
  function esc(s) { return (s == null ? '' : String(s)).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }
  function fechaDDMM(iso) { var m = String(iso || '').match(/^(\d{4})-(\d{2})-(\d{2})/); return m ? (m[3] + '/' + m[2] + '/' + m[1]) : (iso || ''); }

  function buildData() {
    var indicadores = {};
    INDS.forEach(function (it) { indicadores[it.code] = radio(it.code); });
    var compromisos = [];
    for (var c = 1; c <= 3; c++) {
      if (val('c' + c + '_desc')) {
        compromisos.push({
          descripcion: val('c' + c + '_desc'),
          responsable: val('c' + c + '_resp'),
          fecha_verificacion: val('c' + c + '_fecha')
        });
      }
    }
    return {
      action: 'registrarVisita',
      asesor: val('asesor'), fecha_visita: val('fecha_visita'),
      municipio: val('municipio'), institucion: val('institucion'), sede: val('sede'),
      indicadores: indicadores, recomendaciones: val('recomendaciones'),
      compromisos: compromisos
    };
  }

  function summaryHTML(d) {
    var cont = { AA: 0, AM: 0, NA: 0 };
    INDS.forEach(function (it) { var v = d.indicadores[it.code]; if (cont[v] != null) cont[v]++; });
    return '<div class="sum-grid">' +
        '<div class="full"><div class="k">Sede</div><div class="v">' + esc(d.sede) + '</div></div>' +
        '<div><div class="k">Municipio · Institución</div><div class="v">' + esc(d.municipio) + ' · ' + esc(d.institucion) + '</div></div>' +
        '<div><div class="k">Fecha</div><div class="v">' + fechaDDMM(d.fecha_visita) + '</div></div>' +
        '<div><div class="k">Asesor</div><div class="v">' + esc(d.asesor) + '</div></div>' +
        '<div><div class="k">Compromisos</div><div class="v">' + d.compromisos.length + '</div></div>' +
      '</div>' +
      '<div class="sum-sec">Valoración de indicadores</div>' +
      '<div class="vchips">' +
        '<span class="vchip verde">' + cont.AA + ' adecuada</span>' +
        '<span class="vchip amarillo">' + cont.AM + ' con mejora</span>' +
        '<span class="vchip rojo">' + cont.NA + ' no aplica</span>' +
      '</div>';
  }

  // ====== Modal ======
  var modal = document.getElementById('modal');
  var modalBox = document.getElementById('modalBox');
  var pending = null;
  var state = '';

  function showModal() { modal.classList.add('show'); }
  function hideModal() { modal.classList.remove('show'); state = ''; }

  function openConfirm() {
    pending = buildData();
    state = 'confirm';
    modalBox.innerHTML =
      '<div class="mhead"><button class="x" data-close>&times;</button>' +
      '<h3>Confirmar registro</h3><div class="msub">Revise la información antes de enviar.</div></div>' +
      '<div class="mbody">' + summaryHTML(pending) +
      '<div class="mfoot"><button class="btn ghost" data-close>Volver y editar</button>' +
      '<button class="btn primary" id="mConfirm">Confirmar y enviar</button></div></div>';
    document.getElementById('mConfirm').addEventListener('click', send);
    bindClose();
    showModal();
  }

  function showLoading() {
    state = 'loading';
    modalBox.innerHTML = '<div class="mbody mload"><div class="spin"></div><p>Enviando registro…</p></div>';
  }

  function showSuccess(d, res) {
    state = 'success';
    var n = (res && res.compromisos != null) ? res.compromisos : d.compromisos.length;
    modalBox.innerHTML =
      '<div class="mbody">' +
        '<div class="ck"><svg width="38" height="38" viewBox="0 0 24 24" fill="none"><path d="M5 13l4 4L19 7" stroke="#fff" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/></svg></div>' +
        '<div class="mtit">¡Visita registrada!</div>' +
        '<div class="mtxt">La información se envió correctamente. Se guardó la visita y ' + n + ' compromiso(s), y ya aparecen en los tableros.</div>' +
        summaryHTML(d) +
        '<div class="mfoot center"><button class="btn primary" id="mOtra">Registrar otra visita</button>' +
        '<a class="btn" href="semaforo.html">Ver Semáforo</a>' +
        '<a class="btn" href="compromisos.html">Ver Compromisos</a></div>' +
      '</div>';
    document.getElementById('mOtra').addEventListener('click', function () { hideModal(); resetForm(); });
  }

  function showError(msg) {
    state = 'error';
    modalBox.innerHTML =
      '<div class="mhead"><button class="x" data-close>&times;</button>' +
      '<h3>No se pudo registrar</h3><div class="msub">La visita no fue enviada.</div></div>' +
      '<div class="mbody"><div class="err-box">' + esc(msg) + '</div>' +
      '<div class="mfoot"><button class="btn ghost" data-close>Cerrar</button>' +
      '<button class="btn primary" id="mRetry">Reintentar envío</button></div></div>';
    document.getElementById('mRetry').addEventListener('click', send);
    bindClose();
  }

  function bindClose() {
    Array.prototype.forEach.call(modalBox.querySelectorAll('[data-close]'), function (el) {
      el.addEventListener('click', hideModal);
    });
  }

  function parseRes(r) {
    return r.text().then(function (t) {
      try { return JSON.parse(t); }
      catch (e) { throw new Error('El servidor respondió en un formato inesperado. Verifique que el Apps Script esté desplegado con acceso "Cualquier persona".'); }
    });
  }
  function friendly(e) {
    var m = (e && e.message) ? e.message : String(e);
    if (/Failed to fetch|NetworkError|Load failed|TypeError/i.test(m))
      return 'No se pudo conectar con el servidor. Revise su conexión a internet e intente de nuevo.';
    return m;
  }

  function send() {
    if (!pending) return;
    showLoading();
    fetch(CONFIG.GAS_URL, { method: 'POST', body: JSON.stringify(pending) })
      .then(parseRes)
      .then(function (res) {
        if (res && res.ok) showSuccess(pending, res);
        else throw new Error((res && res.error) || 'Respuesta inválida del servidor.');
      })
      .catch(function (e) { showError(friendly(e)); });
  }

  function resetForm() {
    document.getElementById('form').reset();
    document.getElementById('err').textContent = '';
    pending = null;
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  // Cerrar al hacer clic fuera (no durante la carga); tras éxito, reinicia el formulario.
  modal.addEventListener('click', function (e) {
    if (e.target !== modal) return;
    if (state === 'loading') return;
    if (state === 'success') { hideModal(); resetForm(); return; }
    hideModal();
  });
  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape' && state && state !== 'loading') {
      if (state === 'success') resetForm();
      hideModal();
    }
  });

  // ====== Submit: valida y abre confirmación ======
  document.getElementById('form').addEventListener('submit', function (ev) {
    ev.preventDefault();
    var err = document.getElementById('err'); err.textContent = '';

    var req = ['asesor', 'fecha_visita', 'municipio', 'institucion', 'sede'];
    for (var i = 0; i < req.length; i++) {
      if (!val(req[i])) { err.textContent = 'Complete los datos generales (campos con *).'; return; }
    }
    var faltan = INDS.filter(function (it) { return !radio(it.code); });
    if (faltan.length) { err.textContent = 'Valore los 7 indicadores (faltan ' + faltan.length + ').'; return; }
    if (!val('c1_desc') || !val('c1_resp') || !val('c1_fecha')) {
      err.textContent = 'El Compromiso 1 es obligatorio (descripción, responsable y fecha).'; return;
    }

    openConfirm();
  });
})();
