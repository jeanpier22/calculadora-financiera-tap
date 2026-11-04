/* app.js - Interfaz de la calculadora: tablas editables, explicaciones, resultados y descarga del informe PDF. */
(function () {
  'use strict';
  var M = window.MotorFinanciero, EJ = window.EJEMPLO_FINANCIERO, KEY = 'tap_calculadora_financiera_v1';
  var S, R, tablas = [], actualizadores = [], temporizador = null;

  // ---------- utilidades ----------
  function clon(o) { return JSON.parse(JSON.stringify(o)); }
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  function nf(x, d) {
    if (x === null || x === undefined || !isFinite(x)) return 'n.d.';
    d = d === undefined ? 0 : d;
    var s = Math.abs(x).toFixed(d).replace(/\B(?=(\d{3})+(?!\d))/g, ',');
    return (x < 0 && Math.round(Math.abs(x) * Math.pow(10, d)) > 0) ? '(' + s + ')' : s;
  }
  function sol(x, d) { return (x === null || !isFinite(x)) ? 'n.d.' : 'S/ ' + nf(x, d === undefined ? 0 : d); }
  function pct(x, d) { return (x === null || !isFinite(x)) ? 'n.d.' : (x * 100).toFixed(d === undefined ? 1 : d) + ' %'; }
  function anios(x) { return x === null ? 'No se recupera en 3 años' : x.toFixed(2) + ' años'; }
  function h(tag, attrs, kids) {
    var e = document.createElement(tag);
    if (attrs) Object.keys(attrs).forEach(function (k) {
      if (k === 'class') e.className = attrs[k]; else if (k === 'html') e.innerHTML = attrs[k]; else if (k === 'text') e.textContent = attrs[k]; else e.setAttribute(k, attrs[k]);
    });
    (kids || []).forEach(function (c) { e.appendChild(typeof c === 'string' ? document.createTextNode(c) : c); });
    return e;
  }

  // ---------- datos ----------
  var nuevoProd = function () { return { nombre: '', precioMin: '', precioMax: '', disposicionPago: '', precio: '', demanda1: '' }; };
  var nuevoCV = function () { return { producto: '', concepto: '', cantidad: 1, costoUnit: '' }; };
  var nuevoCF = function () { return { concepto: '', tipo: 'Administrativo', mensual: '' }; };
  var nuevoInv = function () { return { concepto: '', categoria: 'Equipos', cantidad: 1, precioUnit: '', vidaUtil: 5 }; };
  function vacio() {
    return {
      nombre: '', grupo: '', integrantes: '',
      general: { cok: 0.20, tasaIR: 0.295, crecDemanda: 0.10, crecCostosFijos: 0.05, mesesCapTrabajo: 2 },
      productos: [nuevoProd()], cvItems: [nuevoCV()], cfItems: [nuevoCF()], invItems: [nuevoInv()],
      financ: { aportePropio: 0, prestamo: 0, tea: 0.20, plazo: 3 },
      mercado: { poblacion: 0, frecuencia: 1, cobertura: 0.5, disposicion: 0.5, interes: 0.5, participacion: 0.1, capacidadMensual: 0 }
    };
  }
  function normalizar(d) {
    var base = vacio(); d = d || {};
    ['nombre', 'grupo', 'integrantes'].forEach(function (k) { base[k] = d[k] || ''; });
    ['general', 'financ', 'mercado'].forEach(function (k) { Object.keys(base[k]).forEach(function (c) { if (d[k] && d[k][c] !== undefined) base[k][c] = d[k][c]; }); });
    ['productos', 'cvItems', 'cfItems', 'invItems'].forEach(function (k) { if (d[k] && d[k].length) base[k] = clon(d[k]); });
    return base;
  }
  function guardar() { try { localStorage.setItem(KEY, JSON.stringify(S)); } catch (e) { /* sin almacenamiento */ } }
  function cargarGuardado() { try { var t = localStorage.getItem(KEY); return t ? normalizar(JSON.parse(t)) : null; } catch (e) { return null; } }

  // ---------- controles ----------
  function campoNum(obj, key, o) {
    o = o || {};
    var i = h('input', { type: 'number', step: o.step || 'any', 'aria-label': o.label || key });
    if (o.min !== undefined) i.min = o.min; if (o.max !== undefined) i.max = o.max;
    var v = obj[key]; i.value = (v === '' || v == null) ? '' : (o.pct ? +(v * 100).toFixed(4) : v);
    i.addEventListener('input', function () { var t = i.value; obj[key] = t === '' ? '' : (o.pct ? Number(t) / 100 : Number(t)); cambio(); });
    return i;
  }
  function campoTxt(obj, key, o) {
    o = o || {};
    var i = h('input', { type: 'text', 'aria-label': o.label || key, placeholder: o.ph || '' }); i.value = obj[key] || ''; i.dataset.prev = i.value;
    i.addEventListener('input', function () { var antes = i.dataset.prev; obj[key] = i.value; i.dataset.prev = i.value; if (o.alCambiar) o.alCambiar(antes, i.value); cambio(); });
    return i;
  }
  function campoSel(obj, key, opts, o) {
    o = o || {};
    var s = h('select', { 'aria-label': o.label || key }); var lista = typeof opts === 'function' ? opts() : opts;
    if (o.vacio) s.appendChild(h('option', { value: '', text: '- elegir -' }));
    lista.forEach(function (t) { s.appendChild(h('option', { value: t, text: t })); });
    s.value = obj[key] || ''; s.addEventListener('change', function () { obj[key] = s.value; cambio(); });
    return s;
  }
  function etiqueta(texto, control, ayuda) { return h('label', { class: 'campo' }, [texto, control].concat(ayuda ? [h('small', { text: ayuda })] : [])); }

  // ---------- tablas editables ----------
  function tablaEditable(cfg) {
    var cont = h('div'), wrap = h('div', { class: 'tabla-wrap' }), reg = { calcs: [], pintar: null };
    var btn = h('button', { class: 'agregar', type: 'button', text: '+ Agregar fila' });
    function pintar() {
      wrap.innerHTML = ''; reg.calcs = [];
      var rows = cfg.get(), t = h('table', { class: 'ed' }), thead = h('thead'), trh = h('tr');
      cfg.cols.forEach(function (c) { trh.appendChild(h('th', { class: c.tipo === 'num' || c.tipo === 'calc' ? 'num' : '', text: c.label })); });
      trh.appendChild(h('th', { text: '' })); thead.appendChild(trh); t.appendChild(thead);
      var tb = h('tbody');
      rows.forEach(function (row, idx) {
        var tr = h('tr');
        cfg.cols.forEach(function (c) {
          var td = h('td');
          if (c.tipo === 'calc') { td.className = 'calc'; reg.calcs.push({ td: td, fn: c.calc, row: row }); }
          else if (c.tipo === 'num') td.appendChild(campoNum(row, c.key, { step: c.step, label: c.label, pct: c.pct, min: c.min }));
          else if (c.tipo === 'sel') td.appendChild(campoSel(row, c.key, c.opts, { vacio: c.vacio, label: c.label }));
          else td.appendChild(campoTxt(row, c.key, { label: c.label, alCambiar: c.alCambiar, ph: c.ph }));
          tr.appendChild(td);
        });
        var x = h('td', { class: 'x' }), q = h('button', { class: 'quitar', type: 'button', title: 'Quitar fila', 'aria-label': 'Quitar fila', text: '×' });
        q.addEventListener('click', function () { rows.splice(idx, 1); if (!rows.length) rows.push(cfg.nuevo()); pintar(); if (cfg.alEstructura) cfg.alEstructura(); cambio(); });
        x.appendChild(q); tr.appendChild(x); tb.appendChild(tr);
      });
      t.appendChild(tb); wrap.appendChild(t); actualizarCalculos();
    }
    btn.addEventListener('click', function () { var rows = cfg.get(); if (cfg.max && rows.length >= cfg.max) return; rows.push(cfg.nuevo()); pintar(); if (cfg.alEstructura) cfg.alEstructura(); cambio(); });
    cont.appendChild(wrap); cont.appendChild(btn); reg.pintar = pintar; reg.el = cont; reg.cfg = cfg; tablas.push(reg); pintar();
    return reg;
  }
  function nombresProductos() { return S.productos.map(function (p) { return p.nombre; }).filter(function (n) { return String(n).trim() !== ''; }); }

  // ---------- explicaciones ----------
  var C = {};
  C.general = '<p><b>COK (tasa de descuento).</b> Es la rentabilidad mínima que exigen quienes ponen el dinero. Con ella se «traen a hoy» los flujos futuros: S/ 1,000 que se recibirán dentro de un año valen S/ 1,000 ÷ 1.20 = S/ 833 hoy si la COK es 20 %.</p>' +
    '<div class="formula">Valor actual = flujo del año t ÷ (1 + COK) ^ t</div>' +
    '<p><b>Impuesto a la renta.</b> Porcentaje de la utilidad que se paga al Estado; depende del régimen tributario (confírmelo con SUNAT o un contador). Si hay pérdida, ese año no se paga impuesto; esta calculadora no compensa pérdidas entre años.</p>' +
    '<p><b>Crecimiento de la demanda y de los costos fijos.</b> Son supuestos anuales que se aplican desde el año 2. Justifíquelos con una fuente (tendencia del sector, inflación) o declárelos como hipótesis.</p>' +
    '<p><b>Meses de capital de trabajo.</b> Dinero para pagar costos y gastos mientras el negocio todavía no cobra lo suficiente. Normalmente se cubren de 1 a 4 meses.</p>';
  C.productos = '<div class="regla"><b>Regla de coherencia:</b> el precio se decide mirando al mercado (la competencia y lo que el cliente está dispuesto a pagar), <b>no</b> sumando un margen al costo sobre la misma demanda.</div>' +
    '<p>Si el precio sale de «costo + margen» calculado con la misma demanda, siempre habrá ganancia a esa demanda y el punto de equilibrio quedará por debajo: la comparación parece una validación, pero es circular y no demuestra nada.</p>' +
    '<p><b>Cómo fijarlo:</b> 1) registre el rango de precios de la competencia, 2) registre cuánto está dispuesto a pagar el cliente (encuesta, entrevista o hipótesis declarada), 3) elija su precio dentro de ese rango y 4) compruebe que deje margen sobre el costo variable. La calculadora avisa si el precio sale del rango o supera la disposición a pagar.</p>' +
    '<div class="formula">Demanda del año t = demanda del año 1 × (1 + crecimiento) ^ (t − 1)</div>' +
    '<div class="ejemplo"><b>Ejemplo (datos ficticios).</b> Mantenimiento básico: la competencia cobra entre S/ 50 y S/ 80, el cliente pagaría hasta S/ 65 y se elige S/ 60. Con 1,500 unidades en el año 1 y 15 % de crecimiento: año 2 = 1,500 × 1.15 = 1,725 unidades.</div>';
  C.cv = '<p>Son los costos que <b>aumentan con cada unidad vendida</b>: insumos, repuestos, mano de obra por servicio, movilidad. Detalle qué consume <b>una</b> unidad y la calculadora suma el costo variable unitario (CVu).</p>' +
    '<div class="formula">CVu = suma de (cantidad × costo unitario) de cada concepto<br>Margen de contribución = precio − CVu</div>' +
    '<div class="ejemplo"><b>Ejemplo.</b> Mantenimiento básico: 8 + 4 + 18 + 5 = <b>S/ 35</b>. Con un precio de S/ 60, el margen de contribución es 60 − 35 = <b>S/ 25</b> por unidad: lo que cada venta aporta para cubrir los costos fijos.</div>';
  C.cf = '<p>Son los costos que se pagan <b>se venda mucho o poco</b>: sueldos fijos, alquiler, servicios, contabilidad, publicidad fija. Escriba el monto mensual; el año 1 es mensual × 12 y los años siguientes crecen con el supuesto de costos fijos.</p>' +
    '<div class="formula">Costo fijo anual del año t = monto mensual × 12 × (1 + crecimiento) ^ (t − 1)</div>' +
    '<p><b>Administrativo</b> (gestión de la empresa) y <b>Venta</b> (comercialización) se separan porque se muestran por separado en el estado de resultados. La depreciación se calcula en la sección de inversión.</p>' +
    '<div class="ejemplo"><b>Ejemplo.</b> Costos fijos mensuales de S/ 4,530 → S/ 54,360 en el año 1.</div>';
  C.inv = '<p><b>Inversión fija:</b> lo que se compra una vez para operar (equipos, mobiliario, marca, licencias). Se «reparte» como <b>depreciación</b> durante su vida útil; no es una salida de caja cada año, pero sí reduce la utilidad y por tanto el impuesto.</p>' +
    '<div class="formula">Depreciación anual = monto ÷ vida útil (mientras dure la vida útil)<br>Capital de trabajo = meses × (costos variables + gastos fijos operativos del año 1) ÷ 12</div>' +
    '<p>El capital de trabajo incluye <b>todos</b> los egresos operativos (variables y fijos), sin depreciación porque no es una salida de efectivo. Se recupera al final del año 3.</p>' +
    '<div class="ejemplo"><b>Ejemplo.</b> Laptop S/ 2,800 con vida útil de 4 años → depreciación de S/ 700 al año. Capital de trabajo de 2 meses: 2 × (106,500 + 54,360) ÷ 12 = <b>S/ 26,810</b>.</div>';
  C.financ = '<p>La inversión total se financia con <b>aporte propio</b> y, si quiere, un <b>préstamo</b>. Las dos fuentes juntas deben cubrir la inversión total. El préstamo se paga con una cuota constante anual.</p>' +
    '<div class="formula">Cuota = P × i ÷ (1 − (1 + i) ^ −n)<br>Interés del año = saldo inicial × TEA<br>Amortización = cuota − interés</div>' +
    '<p>Los intereses son un gasto financiero: reducen la utilidad antes de impuestos (y el impuesto). El VAN y la TIR <b>económicos</b> no consideran el préstamo; los <b>financieros</b> sí.</p>' +
    '<div class="ejemplo"><b>Ejemplo.</b> Préstamo de S/ 15,000, TEA 24 %, 3 años → cuota anual de S/ 7,571; interés del año 1 = 15,000 × 24 % = S/ 3,600.</div>';
  C.mercado = '<p>Sirve para comprobar que la demanda que usted proyecta <b>cabe en el mercado real</b>. Cada filtro necesita una fuente (INEI, encuesta, entrevistas) o declararse como hipótesis.</p>' +
    '<div class="formula">TAM = población objetivo × frecuencia de compra<br>SAM = TAM × cobertura × disposición a pagar × interés<br>SOM = SAM × participación inicial</div>' +
    '<p><b>TAM</b>: mercado total teórico. <b>SAM</b>: la parte que usted puede atender y que acepta su propuesta. <b>SOM</b>: lo que realmente puede captar en el año 1. La demanda del año 1 no puede superar el SOM, ni la del año 3 su capacidad operativa.</p>' +
    '<div class="ejemplo"><b>Ejemplo.</b> 120,000 × 1.2 = 144,000 (TAM) → × 40 % × 50 % × 35 % = 10,080 (SAM) → × 22 % = <b>2,218</b> (SOM). La demanda del año 1 es 2,100: cabe.</div>';
  C.eerr = '<p>Muestra si el negocio gana o pierde cada año. Parte de los ingresos y va restando costos y gastos hasta llegar a la utilidad neta.</p>' +
    '<div class="formula">Margen de contribución = ingresos − costos variables<br>EBIT (utilidad operativa) = margen − gastos administrativos − gastos de venta − depreciación<br>Utilidad antes de impuestos = EBIT − intereses<br>Utilidad neta = utilidad antes de impuestos − impuesto a la renta</div>';
  C.flujos = '<p>El <b>flujo de caja</b> mide el dinero que realmente entra y sale. Se diferencia de la utilidad porque la depreciación no es salida de dinero y porque la inversión sí lo es.</p>' +
    '<div class="formula">Flujo económico = EBIT − impuesto sobre el EBIT + depreciación (+ recuperación del capital de trabajo en el año 3)<br>Flujo financiero = utilidad neta + depreciación − amortización del préstamo (+ préstamo recibido en el año 0)</div>' +
    '<p><b>VAN</b>: suma de los flujos descontados a la COK. Si es mayor que 0, el proyecto rinde más que lo mínimo exigido.<br><b>TIR</b>: tasa de rendimiento del proyecto; debe superar la COK.<br><b>Periodo de recuperación</b>: años que tarda el flujo acumulado en cubrir la inversión.<br><b>Beneficio/Costo</b>: valor actual de los flujos de los años 1 a 3 por cada sol invertido (debe ser mayor que 1).</p>' +
    '<div class="formula">VAN = flujo₀ + Σ flujoₜ ÷ (1 + COK)ᵗ     |     TIR: tasa que hace VAN = 0</div>';
  C.pe = '<p>Es la cantidad de ventas con la que el negocio <b>no gana ni pierde</b>: los ingresos cubren exactamente los costos. Por debajo hay pérdida; por encima, ganancia.</p>' +
    '<div class="formula">Punto de equilibrio (unidades) = costos fijos ÷ margen de contribución ponderado por unidad<br>Punto de equilibrio (soles) = unidades de equilibrio × precio promedio ponderado<br>Margen de seguridad = (demanda − punto de equilibrio) ÷ demanda</div>' +
    '<p>Con varios productos, el margen y el precio se <b>ponderan</b> por la mezcla de unidades vendidas. Solo entran costos <b>fijos</b>: si se incluye el costo total, el costo variable se cuenta dos veces y el equilibrio sale inflado.</p>' +
    '<div class="ejemplo"><b>Ejemplo.</b> Costos fijos año 1: 36,360 + 18,000 + 2,150 = S/ 56,510. Margen ponderado: 71 % × 25 + 29 % × 60 = S/ 35 por unidad. Equilibrio = 56,510 ÷ 35 = <b>1,615 unidades</b>, frente a una demanda de 2,100: margen de seguridad de 23 %.</div>';
  C.verif = '<p>Controles automáticos de coherencia entre las partes del modelo. <b>OK</b>: cumple. <b>REVISAR</b>: corrija el supuesto o justifíquelo en su informe. <b>Sin datos</b>: falta información para evaluarlo.</p>';

  function concepto(html) { return h('details', { class: 'concepto' }, [h('summary', { text: '¿Qué es y cómo se calcula?' }), h('div', { class: 'cuerpo', html: html })]); }

  // ---------- secciones ----------
  function construir() {
    tablas = []; actualizadores = [];
    var cont = document.getElementById('secciones'); cont.innerHTML = '';
    var nav = document.getElementById('nav'); nav.innerHTML = '';
    var lista = [];
    function seccion(id, num, titulo, lead, conceptoHtml, hijos) {
      var s = h('section', { class: 'card', id: id }, [h('h2', {}, [h('span', { class: 'num', text: num }), titulo])]);
      if (lead) s.appendChild(h('p', { class: 'lead', text: lead }));
      if (conceptoHtml) s.appendChild(concepto(conceptoHtml));
      hijos.forEach(function (c) { s.appendChild(c); });
      cont.appendChild(s); lista.push([id, num + '. ' + titulo]);
    }
    function chips(id, fn) {
      var c = h('div', { class: 'chips', id: id }); actualizadores.push(function () { c.innerHTML = fn(); }); return c;
    }

    seccion('s-datos', '1', 'Datos del proyecto', 'Estos datos aparecen en la portada del informe.', null, [
      h('div', { class: 'rej' }, [etiqueta('Nombre del proyecto', campoTxt(S, 'nombre', { label: 'Nombre del proyecto' })), etiqueta('Grupo', campoTxt(S, 'grupo', { label: 'Grupo' })), etiqueta('Integrantes', campoTxt(S, 'integrantes', { label: 'Integrantes' }), 'Separe los nombres con punto y coma.')])
    ]);
    var g = S.general;
    seccion('s-general', '2', 'Supuestos generales', 'Valores que afectan a todo el modelo.', C.general, [
      h('div', { class: 'rej' }, [
        etiqueta('Tasa de descuento (COK) %', campoNum(g, 'cok', { pct: true, step: '0.1', label: 'COK' }), 'Rentabilidad mínima exigida.'),
        etiqueta('Impuesto a la renta %', campoNum(g, 'tasaIR', { pct: true, step: '0.1', label: 'Impuesto a la renta' }), 'Confirme el régimen con SUNAT o contador.'),
        etiqueta('Crecimiento anual de la demanda %', campoNum(g, 'crecDemanda', { pct: true, step: '0.1', label: 'Crecimiento de la demanda' }), 'Se aplica desde el año 2.'),
        etiqueta('Crecimiento anual de costos fijos %', campoNum(g, 'crecCostosFijos', { pct: true, step: '0.1', label: 'Crecimiento de costos fijos' }), 'Inflación o ajustes de sueldos.'),
        etiqueta('Meses de capital de trabajo', campoNum(g, 'mesesCapTrabajo', { step: '1', min: 0, label: 'Meses de capital de trabajo' }), 'Meses de egresos operativos a financiar.')
      ])
    ]);
    var tProd = tablaEditable({
      get: function () { return S.productos; }, nuevo: nuevoProd, max: 5,
      alEstructura: function () { refrescarCV(); },
      cols: [
        { label: 'Producto o servicio', key: 'nombre', tipo: 'text', ph: 'Nombre', alCambiar: function (antes, ahora) { S.cvItems.forEach(function (it) { if (it.producto === antes) it.producto = ahora; }); refrescarCV(); } },
        { label: 'Precio mín. competencia', key: 'precioMin', tipo: 'num', step: '0.01' },
        { label: 'Precio máx. competencia', key: 'precioMax', tipo: 'num', step: '0.01' },
        { label: 'Disposición a pagar', key: 'disposicionPago', tipo: 'num', step: '0.01' },
        { label: 'Precio final', key: 'precio', tipo: 'num', step: '0.01' },
        { label: 'Demanda año 1 (unid.)', key: 'demanda1', tipo: 'num', step: '1' },
        { label: 'Costo variable unit.', tipo: 'calc', calc: function (r) { var p = prodPor(r.nombre); return p ? sol(p.cvu, 2) : '-'; } },
        { label: 'Margen', tipo: 'calc', calc: function (r) { var p = prodPor(r.nombre); return p ? sol(p.margen, 2) + ' (' + pct(p.margenPct, 0) + ')' : '-'; } }
      ]
    });
    seccion('s-productos', '3', 'Productos, precio y demanda', 'Hasta 5 productos o servicios. El precio se fija con el mercado, no con el costo.', C.productos, [tProd.el]);
    var tCV = tablaEditable({
      get: function () { return S.cvItems; }, nuevo: nuevoCV,
      cols: [
        { label: 'Producto', key: 'producto', tipo: 'sel', opts: nombresProductos, vacio: true },
        { label: 'Concepto (insumo, mano de obra...)', key: 'concepto', tipo: 'text', ph: 'Concepto' },
        { label: 'Cantidad', key: 'cantidad', tipo: 'num', step: 'any' },
        { label: 'Costo unitario', key: 'costoUnit', tipo: 'num', step: '0.01' },
        { label: 'Subtotal', tipo: 'calc', calc: function (r) { return sol((+r.cantidad || 0) * (+r.costoUnit || 0), 2); } }
      ]
    });
    function refrescarCV() { tCV.pintar(); }
    seccion('s-cv', '4', 'Costos variables por unidad', 'Qué consume UNA unidad vendida de cada producto.', C.cv, [tCV.el,
      chips('chips-cv', function () { return R.productos.map(function (p) { return '<span class="chip">' + esc(p.nombre) + ': costo variable <b>' + sol(p.cvu, 2) + '</b> · margen <b>' + sol(p.margen, 2) + '</b> (' + pct(p.margenPct, 0) + ')</span>'; }).join(''); })]);
    var tCF = tablaEditable({
      get: function () { return S.cfItems; }, nuevo: nuevoCF,
      cols: [
        { label: 'Concepto', key: 'concepto', tipo: 'text', ph: 'Concepto' },
        { label: 'Tipo', key: 'tipo', tipo: 'sel', opts: ['Administrativo', 'Venta'] },
        { label: 'Monto mensual', key: 'mensual', tipo: 'num', step: '0.01' },
        { label: 'Monto anual (año 1)', tipo: 'calc', calc: function (r) { return sol((+r.mensual || 0) * 12, 0); } }
      ]
    });
    seccion('s-cf', '5', 'Costos fijos', 'Se pagan se venda mucho o poco. Escriba el monto mensual.', C.cf, [tCF.el,
      chips('chips-cf', function () { return '<span class="chip">Administrativos: <b>' + sol(R.cf.admMes) + '</b>/mes</span><span class="chip">De venta: <b>' + sol(R.cf.venMes) + '</b>/mes</span><span class="chip">Total año 1: <b>' + sol((R.cf.admMes + R.cf.venMes) * 12) + '</b></span>'; })]);
    var tInv = tablaEditable({
      get: function () { return S.invItems; }, nuevo: nuevoInv,
      cols: [
        { label: 'Concepto', key: 'concepto', tipo: 'text', ph: 'Concepto' },
        { label: 'Categoría', key: 'categoria', tipo: 'sel', opts: ['Equipos', 'Mobiliario', 'Intangibles', 'Gastos preoperativos', 'Vehículos', 'Inmuebles', 'Otros'] },
        { label: 'Cantidad', key: 'cantidad', tipo: 'num', step: 'any' },
        { label: 'Precio unitario', key: 'precioUnit', tipo: 'num', step: '0.01' },
        { label: 'Vida útil (años)', key: 'vidaUtil', tipo: 'num', step: '1', min: 0 },
        { label: 'Monto', tipo: 'calc', calc: function (r) { return sol((+r.cantidad || 0) * (+r.precioUnit || 0), 0); } },
        { label: 'Deprec. año 1', tipo: 'calc', calc: function (r) { var m = (+r.cantidad || 0) * (+r.precioUnit || 0), v = +r.vidaUtil || 0; return sol(v > 0 ? m / v : 0, 0); } }
      ]
    });
    seccion('s-inv', '6', 'Inversión y capital de trabajo', 'Lo que se compra una sola vez para operar, más el dinero para los primeros meses.', C.inv, [tInv.el,
      chips('chips-inv', function () { return '<span class="chip">Inversión fija: <b>' + sol(R.inversion.fija) + '</b></span><span class="chip">Capital de trabajo: <b>' + sol(R.inversion.capTrabajo) + '</b></span><span class="chip">Inversión total: <b>' + sol(R.inversion.total) + '</b></span>'; })]);
    var f = S.financ;
    seccion('s-fin', '7', 'Financiamiento', 'Cómo se paga la inversión: aporte propio y préstamo.', C.financ, [
      h('div', { class: 'rej' }, [
        etiqueta('Aporte propio (S/)', campoNum(f, 'aportePropio', { step: '100', label: 'Aporte propio' })),
        etiqueta('Préstamo (S/)', campoNum(f, 'prestamo', { step: '100', label: 'Préstamo' }), 'Cero si no hay préstamo.'),
        etiqueta('TEA del préstamo %', campoNum(f, 'tea', { pct: true, step: '0.1', label: 'TEA' })),
        etiqueta('Plazo (años, 1 a 3)', campoNum(f, 'plazo', { step: '1', min: 1, max: 3, label: 'Plazo' }))
      ]),
      chips('chips-fin', function () { var fu = (+S.financ.aportePropio || 0) + (+S.financ.prestamo || 0); return '<span class="chip">Cuota anual: <b>' + sol(R.prestamo.cuotaAnual) + '</b></span><span class="chip">Fuentes: <b>' + sol(fu) + '</b> frente a inversión de <b>' + sol(R.inversion.total) + '</b></span>'; })]);
    var m = S.mercado;
    seccion('s-mercado', '8', 'Mercado: TAM, SAM y SOM', 'Compruebe que la demanda proyectada cabe en el mercado alcanzable.', C.mercado, [
      h('div', { class: 'rej' }, [
        etiqueta('Población objetivo (personas)', campoNum(m, 'poblacion', { step: '100', label: 'Población objetivo' }), 'Fuente: INEI u otra.'),
        etiqueta('Compras por persona al año', campoNum(m, 'frecuencia', { step: '0.1', label: 'Frecuencia' })),
        etiqueta('Cobertura geográfica inicial %', campoNum(m, 'cobertura', { pct: true, step: '1', label: 'Cobertura' })),
        etiqueta('Disposición a pagar el precio %', campoNum(m, 'disposicion', { pct: true, step: '1', label: 'Disposición' }), 'Encuesta o hipótesis.'),
        etiqueta('Interés en su propuesta %', campoNum(m, 'interes', { pct: true, step: '1', label: 'Interés' })),
        etiqueta('Participación inicial %', campoNum(m, 'participacion', { pct: true, step: '1', label: 'Participación' })),
        etiqueta('Capacidad operativa mensual (unid.)', campoNum(m, 'capacidadMensual', { step: '10', label: 'Capacidad mensual' }))
      ]),
      chips('chips-mer', function () { return '<span class="chip">TAM: <b>' + nf(R.mercado.tam) + '</b></span><span class="chip">SAM: <b>' + nf(R.mercado.sam) + '</b></span><span class="chip">SOM: <b>' + nf(R.mercado.som) + '</b></span><span class="chip">Capacidad anual: <b>' + nf(R.mercado.capAnual) + '</b></span><span class="chip">Demanda año 1: <b>' + nf(R.totales.unidades[0]) + '</b> · año 3: <b>' + nf(R.totales.unidades[2]) + '</b></span>'; })]);
    lista.push(['resultados', '9. Resultados']);
    var gr = h('div', { class: 'grupo', text: 'Datos de entrada' }); nav.appendChild(gr);
    lista.forEach(function (it, i) {
      if (i === 8) nav.appendChild(h('div', { class: 'grupo', text: 'Resultados' }));
      nav.appendChild(h('a', { href: '#' + it[0], text: it[1] }));
    });
  }

  function prodPor(nombre) { return R.productos.filter(function (p) { return p.nombre === nombre; })[0]; }

  // ---------- recalculo ----------
  function actualizarCalculos() {
    if (!R) return;
    tablas.forEach(function (t) { t.calcs.forEach(function (c) { c.td.textContent = c.fn(c.row); }); });
    actualizadores.forEach(function (f) { f(); });
  }
  function cambio() {
    R = M.calcular(S); actualizarCalculos(); renderResultados();
    var av = document.getElementById('aviso'); if (av) av.style.display = /EJEMPLO/.test(S.nombre || '') ? '' : 'none';
    clearTimeout(temporizador); temporizador = setTimeout(guardar, 400);
  }

  // ---------- graficos SVG ----------
  function svgPE() {
    var g = R.grafPE; if (!g.length) return '';
    var W = 640, H = 320, ml = 62, mr = 16, mt = 18, mb = 44, w = W - ml - mr, hh = H - mt - mb;
    var xmax = g[g.length - 1].u, ymax = Math.max.apply(null, g.map(function (p) { return Math.max(p.ingreso, p.costoTotal); })) * 1.05;
    function px(u) { return ml + w * u / xmax; } function py(v) { return mt + hh - hh * v / ymax; }
    var s = '<svg class="graf" viewBox="0 0 ' + W + ' ' + H + '" role="img" aria-label="Gráfico del punto de equilibrio">';
    for (var i = 0; i <= 5; i++) { var v = ymax * i / 5, y = py(v); s += '<line x1="' + ml + '" x2="' + (W - mr) + '" y1="' + y + '" y2="' + y + '" stroke="currentColor" opacity=".12"/><text x="' + (ml - 6) + '" y="' + (y + 4) + '" text-anchor="end">' + nf(v) + '</text>'; }
    for (var j = 0; j <= 5; j++) { var u = xmax * j / 5; s += '<text x="' + px(u) + '" y="' + (mt + hh + 16) + '" text-anchor="middle">' + nf(u) + '</text>'; }
    s += '<text x="' + (ml + w / 2) + '" y="' + (H - 8) + '" text-anchor="middle">Unidades vendidas (año 1)</text>';
    [['ingreso', '#2f7fb0', 'Ingresos'], ['costoTotal', '#c8503c', 'Costo total'], ['costoFijo', '#888', 'Costo fijo']].forEach(function (d, k) {
      s += '<polyline fill="none" stroke="' + d[1] + '" stroke-width="2.2" points="' + g.map(function (p) { return px(p.u) + ',' + py(p[d[0]]); }).join(' ') + '"/>';
      s += '<rect x="' + (ml + 8 + k * 110) + '" y="' + (mt + 2) + '" width="12" height="4" fill="' + d[1] + '"/><text x="' + (ml + 24 + k * 110) + '" y="' + (mt + 8) + '">' + d[2] + '</text>';
    });
    var pe = R.pe[0];
    if (pe.unidades !== null && pe.unidades <= xmax) s += '<circle cx="' + px(pe.unidades) + '" cy="' + py(pe.soles) + '" r="5" fill="#111"/><text class="t" x="' + (px(pe.unidades) + 8) + '" y="' + (py(pe.soles) + 16) + '">Equilibrio: ' + nf(pe.unidades) + ' unid.</text>';
    var dx = px(R.totales.unidades[0]);
    s += '<line x1="' + dx + '" x2="' + dx + '" y1="' + mt + '" y2="' + (mt + hh) + '" stroke="#2a9d5c" stroke-dasharray="4 4"/><text x="' + (dx - 4) + '" y="' + (mt + 22) + '" text-anchor="end" fill="#2a9d5c">Demanda ' + nf(R.totales.unidades[0]) + '</text>';
    return s + '</svg>';
  }
  function svgFlujo() {
    var fl = R.flujos.fce, ac = R.flujos.fceAcum, W = 640, H = 300, ml = 62, mr = 16, mt = 18, mb = 40, w = W - ml - mr, hh = H - mt - mb;
    var vmax = Math.max.apply(null, fl.concat(ac).concat([1])) * 1.1, vmin = Math.min.apply(null, fl.concat(ac).concat([0])) * 1.1;
    function py(v) { return mt + hh - hh * (v - vmin) / (vmax - vmin); }
    var s = '<svg class="graf" viewBox="0 0 ' + W + ' ' + H + '" role="img" aria-label="Flujo de caja por año">';
    for (var i = 0; i <= 5; i++) { var v = vmin + (vmax - vmin) * i / 5, y = py(v); s += '<line x1="' + ml + '" x2="' + (W - mr) + '" y1="' + y + '" y2="' + y + '" stroke="currentColor" opacity=".12"/><text x="' + (ml - 6) + '" y="' + (y + 4) + '" text-anchor="end">' + nf(v) + '</text>'; }
    s += '<line x1="' + ml + '" x2="' + (W - mr) + '" y1="' + py(0) + '" y2="' + py(0) + '" stroke="currentColor" opacity=".5"/>';
    var bw = w / 4 * 0.3;
    fl.forEach(function (v, k) {
      var cx = ml + w * (k + 0.5) / 4, a = ac[k];
      s += '<rect x="' + (cx - bw - 2) + '" y="' + (v >= 0 ? py(v) : py(0)) + '" width="' + bw + '" height="' + Math.abs(py(v) - py(0)) + '" fill="' + (v >= 0 ? '#2f7fb0' : '#c8503c') + '"/>';
      s += '<rect x="' + (cx + 2) + '" y="' + (a >= 0 ? py(a) : py(0)) + '" width="' + bw + '" height="' + Math.abs(py(a) - py(0)) + '" fill="#7a9a7a"/>';
      s += '<text x="' + cx + '" y="' + (mt + hh + 16) + '" text-anchor="middle">Año ' + k + '</text>';
    });
    s += '<rect x="' + (ml + 8) + '" y="' + (mt + 2) + '" width="12" height="4" fill="#2f7fb0"/><text x="' + (ml + 24) + '" y="' + (mt + 8) + '">Flujo del año</text><rect x="' + (ml + 130) + '" y="' + (mt + 2) + '" width="12" height="4" fill="#7a9a7a"/><text x="' + (ml + 146) + '" y="' + (mt + 8) + '">Flujo acumulado</text>';
    return s + '</svg>';
  }

  // ---------- resultados ----------
  function tablaHTML(head, rows, totales) {
    var s = '<div class="tabla-wrap"><table><thead><tr>' + head.map(function (t, i) { return '<th' + (i > 0 ? ' class="num"' : '') + '>' + esc(t) + '</th>'; }).join('') + '</tr></thead><tbody>';
    rows.forEach(function (r, ri) { s += '<tr' + ((totales || []).indexOf(ri) >= 0 ? ' class="total"' : '') + '>' + r.map(function (c, i) { return '<td' + (i > 0 ? ' class="num"' : '') + '>' + esc(c) + '</td>'; }).join('') + '</tr>'; });
    return s + '</tbody></table></div>';
  }
  function kpi(t, v, s, clase) { return '<div class="kpi ' + (clase || '') + '"><div class="t">' + esc(t) + '</div><div class="v">' + esc(v) + '</div><div class="s">' + esc(s || '') + '</div></div>'; }
  function renderResultados() {
    var cont = document.getElementById('resultados'), abiertos = {};
    Array.prototype.forEach.call(cont.querySelectorAll('details'), function (d, i) { abiertos[i] = d.open; });
    var ind = R.ind, inv = R.inversion, pe1 = R.pe[0], an = ['Año 1', 'Año 2', 'Año 3'];
    var viable = ind.vanE > 0 && ind.tirE !== null && ind.tirE > R.cok;
    var h_ = '<section class="card"><h2><span class="num">9</span>Resultados</h2><p class="lead">Se recalculan al instante cuando cambia cualquier dato.</p>';
    h_ += '<div class="veredicto ' + (viable ? 'ok' : 'mal') + '"><b>' + (viable ? 'Con estos supuestos el proyecto es económicamente viable' : 'Con estos supuestos el proyecto NO es económicamente viable') + '</b> (VAN económico ' + sol(ind.vanE) + ', TIR ' + pct(ind.tirE) + ' frente a una COK de ' + pct(R.cok) + ').</div>';
    h_ += '<div class="kpis">' +
      kpi('Inversión total', sol(inv.total), 'Fija ' + sol(inv.fija) + ' + capital de trabajo ' + sol(inv.capTrabajo)) +
      kpi('VAN económico', sol(ind.vanE), 'Mayor que 0 es bueno', ind.vanE > 0 ? 'bueno' : 'malo') +
      kpi('TIR económica', pct(ind.tirE), 'COK ' + pct(R.cok), ind.tirE !== null && ind.tirE > R.cok ? 'bueno' : 'malo') +
      kpi('Recuperación', anios(ind.priE), 'Periodo de recuperación') +
      kpi('Beneficio / Costo', ind.bc === null ? 'n.d.' : ind.bc.toFixed(2), 'Mayor que 1 es bueno', ind.bc !== null && ind.bc > 1 ? 'bueno' : 'malo') +
      kpi('Punto de equilibrio año 1', pe1.unidades === null ? 'n.d.' : nf(pe1.unidades) + ' unid.', sol(pe1.soles) + ' en ventas') +
      kpi('Margen de seguridad', pct(pe1.margenSeg), 'Demanda ' + nf(R.totales.unidades[0]) + ' unid.', pe1.margenSeg !== null && pe1.margenSeg > 0 ? 'bueno' : 'malo') +
      kpi('Verificaciones', R.resumenVerif.ok + ' de ' + R.resumenVerif.total, 'Coherencia del modelo', R.resumenVerif.ok === R.resumenVerif.total ? 'bueno' : 'malo') + '</div>';

    h_ += '<h3>9.1 Verificaciones de coherencia</h3><details class="concepto"><summary>¿Qué es y cómo se lee?</summary><div class="cuerpo">' + C.verif + '</div></details><ul class="verif">' +
      R.verificaciones.map(function (c) { var e = c.ok === null ? 'ND' : (c.ok ? 'OK' : 'REVISAR'); return '<li><span class="est ' + e + '">' + (e === 'ND' ? 'Sin datos' : e) + '</span><span>' + esc(c.texto) + '<small>' + esc(c.detalle) + '</small></span></li>'; }).join('') + '</ul>';

    var e = R.eerr;
    function fila(t, arr) { return [t].concat(arr.map(function (v) { return sol(v); })); }
    h_ += '<h3>9.2 Estado de resultados</h3><details class="concepto"><summary>¿Qué es y cómo se calcula?</summary><div class="cuerpo">' + C.eerr + '</div></details>' +
      tablaHTML(['Concepto'].concat(an), [fila('Ingresos por ventas', e.ingresos), fila('(-) Costos variables', e.cv), fila('(=) Margen de contribución', e.margenContrib), fila('(-) Gastos administrativos', e.adm), fila('(-) Gastos de venta', e.ven),
        fila('(-) Depreciación', e.dep), fila('(=) Utilidad operativa (EBIT)', e.ebit), fila('(-) Gastos financieros', e.interes), fila('(=) Utilidad antes de impuestos', e.ebt), fila('(-) Impuesto a la renta', e.ir), fila('(=) Utilidad neta', e.neta)], [2, 6, 8, 10]);

    var f = R.flujos, cab = ['Concepto', 'Año 0', 'Año 1', 'Año 2', 'Año 3'];
    function f5(t, arr) { return [t].concat(arr.map(function (v) { return v === null ? '' : sol(v); })); }
    h_ += '<h3>9.3 Flujos de caja e indicadores</h3><details class="concepto"><summary>¿Qué es y cómo se calcula?</summary><div class="cuerpo">' + C.flujos + '</div></details>' +
      tablaHTML(cab, [f5('Utilidad operativa (EBIT)', [null].concat(e.ebit)), f5('(-) Impuesto sobre el EBIT', [null].concat(f.irEcon)), f5('(+) Depreciación', [null].concat(R.cf.dep)), f5('(-) Inversión total', [-inv.total, 0, 0, 0]),
        f5('(+) Recuperación del capital de trabajo', [0].concat(f.recup)), f5('Flujo de caja económico', f.fce), f5('Flujo acumulado', f.fceAcum)], [5, 6]) +
      '<h3 style="margin-top:14px">Flujo de caja financiero (con préstamo)</h3>' +
      tablaHTML(cab, [f5('Utilidad neta', [null].concat(e.neta)), f5('(+) Depreciación', [null].concat(R.cf.dep)), f5('(-) Amortización del préstamo', [null].concat(R.prestamo.amort)), f5('(+) Préstamo recibido', [R.prestamo.monto, 0, 0, 0]),
        f5('(-) Inversión total', [-inv.total, 0, 0, 0]), f5('(+) Recuperación del capital de trabajo', [0].concat(f.recup)), f5('Flujo de caja financiero', f.fcf)], [6]) +
      '<h3 style="margin-top:14px">Indicadores (COK ' + pct(R.cok) + ')</h3>' +
      tablaHTML(['Indicador', 'Económico', 'Financiero'], [['VAN', sol(ind.vanE), sol(ind.vanF)], ['TIR', pct(ind.tirE), pct(ind.tirF)], ['Periodo de recuperación', anios(ind.priE), anios(ind.priF)], ['Beneficio / Costo', ind.bc === null ? 'n.d.' : ind.bc.toFixed(2), '-']]) +
      '<div style="margin-top:12px">' + svgFlujo() + '</div>';

    h_ += '<h3>9.4 Punto de equilibrio</h3><details class="concepto"><summary>¿Qué es y cómo se calcula?</summary><div class="cuerpo">' + C.pe + '</div></details>' +
      tablaHTML(['Concepto'].concat(an), [
        ['Unidades proyectadas'].concat(R.pe.map(function (p) { return nf(p.demanda); })),
        ['Costos fijos (adm. + venta + deprec.)'].concat(R.pe.map(function (p) { return sol(p.costosFijos); })),
        ['Margen de contribución ponderado'].concat(R.pe.map(function (p) { return sol(p.margenPond, 2); })),
        ['Precio promedio ponderado'].concat(R.pe.map(function (p) { return sol(p.precioProm, 2); })),
        ['Punto de equilibrio (unidades)'].concat(R.pe.map(function (p) { return p.unidades === null ? 'n.d.' : nf(p.unidades); })),
        ['Punto de equilibrio (soles)'].concat(R.pe.map(function (p) { return sol(p.soles); })),
        ['Margen de seguridad'].concat(R.pe.map(function (p) { return pct(p.margenSeg); }))], [4, 5, 6]) +
      '<div style="margin-top:12px">' + svgPE() + '</div>' +
      '<div class="chips" style="margin-top:14px"><button class="btn primario" id="btnPDF2" type="button" style="border-color:#f2c94c">Generar informe (PDF)</button></div></section>';
    cont.innerHTML = h_;
    Array.prototype.forEach.call(cont.querySelectorAll('details'), function (d, i) { if (abiertos[i]) d.open = true; });
    var b2 = document.getElementById('btnPDF2'); if (b2) b2.addEventListener('click', descargarPDF);
  }

  // ---------- acciones ----------
  var observador = null;
  function observarNav() {
    if (!('IntersectionObserver' in window)) return;
    if (observador) observador.disconnect();
    var links = {};
    Array.prototype.forEach.call(document.querySelectorAll('#nav a'), function (a) { links[a.getAttribute('href').slice(1)] = a; });
    observador = new IntersectionObserver(function (en) { en.forEach(function (x) { if (x.isIntersecting && links[x.target.id]) { Object.keys(links).forEach(function (k) { links[k].classList.remove('activo'); }); links[x.target.id].classList.add('activo'); } }); }, { rootMargin: '-20% 0px -70% 0px' });
    Object.keys(links).forEach(function (id) { var el = document.getElementById(id); if (el) observador.observe(el); });
  }
  function slug(t) { return String(t || 'proyecto').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '').slice(0, 40) || 'proyecto'; }
  function descargarPDF() {
    if (!window.jspdf || !window.InformeFinanciero) { alert('No se cargaron las librerías del PDF. Verifique que la carpeta "lib" esté junto a index.html.'); return; }
    try {
      var doc = window.InformeFinanciero.generar(window.jspdf.jsPDF, S, R, { fecha: new Date().toLocaleDateString('es-PE') });
      doc.save('Informe_financiero_' + slug(S.nombre) + '.pdf');
    } catch (e) { alert('No se pudo generar el PDF: ' + e.message); }
  }
  function cargarDatos(d, ejemplo) {
    S = normalizar(d); R = M.calcular(S); construir(); cambio(); observarNav();
  }
  function descargarJSON() {
    var blob = new Blob([JSON.stringify(S, null, 2)], { type: 'application/json' }), a = document.createElement('a');
    a.href = URL.createObjectURL(blob); a.download = 'datos_financieros_' + slug(S.nombre) + '.json'; document.body.appendChild(a); a.click();
    setTimeout(function () { URL.revokeObjectURL(a.href); a.remove(); }, 500);
  }
  function iniciar() {
    document.getElementById('btnEjemplo').addEventListener('click', function () { cargarDatos(clon(EJ), true); });
    document.getElementById('btnLimpiar').addEventListener('click', function () { if (confirm('Se borrarán los datos actuales de esta página. ¿Continuar?')) cargarDatos(vacio(), false); });
    document.getElementById('btnGuardar').addEventListener('click', descargarJSON);
    document.getElementById('btnCargar').addEventListener('click', function () { document.getElementById('archivo').click(); });
    document.getElementById('archivo').addEventListener('change', function (ev) {
      var f = ev.target.files[0]; if (!f) return; var rd = new FileReader();
      rd.onload = function () { try { cargarDatos(JSON.parse(rd.result), false); } catch (e) { alert('El archivo no es válido.'); } };
      rd.readAsText(f); ev.target.value = '';
    });
    var expandido = false;
    document.getElementById('btnExpl').addEventListener('click', function () {
      expandido = !expandido; Array.prototype.forEach.call(document.querySelectorAll('details'), function (d) { d.open = expandido; });
      this.textContent = expandido ? 'Ocultar explicaciones' : 'Mostrar explicaciones';
    });
    document.getElementById('btnPDF').addEventListener('click', descargarPDF);
    var guardado = cargarGuardado();
    cargarDatos(guardado || clon(EJ), !guardado);
  }
  document.addEventListener('DOMContentLoaded', iniciar);
})();
