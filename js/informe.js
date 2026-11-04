/* informe.js - Genera el informe en PDF (jsPDF + AutoTable). Tablas y figuras con titulo, numero y nota de fuente (APA 7). */
(function (root) {
  'use strict';
  var AZUL = [31, 58, 77], GRIS = [90, 100, 110], CLARO = [238, 243, 246], VERDE = [0, 110, 60], ROJO = [170, 30, 40];
  var MARG = 15, ANCHO = 180;

  function nf(x, d) {
    if (x === null || x === undefined || !isFinite(x)) return 'n.d.';
    d = d === undefined ? 0 : d;
    var s = Math.abs(x).toFixed(d).replace(/\B(?=(\d{3})+(?!\d))/g, ',');
    return (x < 0 && Math.round(Math.abs(x) * Math.pow(10, d)) > 0 ? '(' + s + ')' : s);
  }
  function sol(x, d) { return (x === null || !isFinite(x)) ? 'n.d.' : 'S/ ' + nf(x, d === undefined ? 0 : d); }
  function pct(x, d) { return (x === null || !isFinite(x)) ? 'n.d.' : (x * 100).toFixed(d === undefined ? 1 : d) + ' %'; }
  function anios(x) { return x === null ? 'No se recupera en 3 años' : x.toFixed(2) + ' años'; }

  function generar(jsPDF, S, R, opciones) {
    opciones = opciones || {};
    var doc = new jsPDF({ unit: 'mm', format: 'a4' });
    var y = 0, nTabla = 0, nFig = 0, pagina = 1;

    function nueva() { doc.addPage(); y = 22; }
    function espacio(h) { if (y + h > 280) nueva(); }
    function h1(t) { espacio(52); doc.setFont('helvetica', 'bold'); doc.setFontSize(13); doc.setTextColor.apply(doc, AZUL); doc.text(t, MARG, y); y += 2; doc.setDrawColor.apply(doc, AZUL); doc.setLineWidth(0.4); doc.line(MARG, y, MARG + ANCHO, y); y += 6; }
    function h2(t) { espacio(12); doc.setFont('helvetica', 'bold'); doc.setFontSize(10.5); doc.setTextColor(40, 40, 40); doc.text(t, MARG, y); y += 5; }
    function parrafo(t, o) {
      o = o || {}; doc.setFont('helvetica', o.bold ? 'bold' : 'normal'); doc.setFontSize(o.size || 9.5);
      doc.setTextColor.apply(doc, o.color || [40, 40, 40]);
      var lines = doc.splitTextToSize(t, ANCHO - (o.sangria || 0));
      espacio(lines.length * 4.6 + 1); doc.text(lines, MARG + (o.sangria || 0), y); y += lines.length * 4.6 + 1;
    }
    function nota(t) { doc.setFont('helvetica', 'italic'); doc.setFontSize(8); doc.setTextColor.apply(doc, GRIS); var l = doc.splitTextToSize('Nota. ' + t, ANCHO); espacio(l.length * 3.6 + 2); doc.text(l, MARG, y); y += l.length * 3.6 + 4; }
    function caption(tipo, titulo) {
      var n = tipo === 'Tabla' ? ++nTabla : ++nFig;
      espacio(14); doc.setFont('helvetica', 'bold'); doc.setFontSize(9); doc.setTextColor(40, 40, 40); doc.text(tipo + ' ' + n, MARG, y); y += 4.2;
      doc.setFont('helvetica', 'italic'); doc.text(titulo, MARG, y); y += 2.6;
    }
    function tabla(titulo, head, body, opts, fuente) {
      opts = opts || {};
      caption('Tabla', titulo);
      doc.autoTable({
        startY: y, head: [head], body: body, theme: 'grid', margin: { left: MARG, right: MARG, top: 20 },
        styles: { font: 'helvetica', fontSize: opts.size || 8.5, cellPadding: 1.6, lineColor: [190, 200, 208], lineWidth: 0.15, textColor: [30, 30, 30], overflow: 'linebreak' },
        headStyles: { fillColor: AZUL, textColor: 255, halign: 'center', fontStyle: 'bold' },
        alternateRowStyles: { fillColor: [248, 250, 251] },
        columnStyles: opts.cols || {},
        didParseCell: function (d) {
          if (d.section === 'body' && opts.totalRows && opts.totalRows.indexOf(d.row.index) >= 0) { d.cell.styles.fontStyle = 'bold'; d.cell.styles.fillColor = CLARO; }
          if (opts.colorResultado && d.section === 'body' && d.column.index === opts.colorResultado) {
            var v = String(d.cell.raw);
            d.cell.styles.fontStyle = 'bold'; d.cell.styles.halign = 'center';
            d.cell.styles.textColor = v === 'OK' ? VERDE : (v === 'REVISAR' ? ROJO : GRIS);
          }
        }
      });
      y = doc.lastAutoTable.finalY + 2;
      nota(fuente || 'Elaboración propia con los supuestos del grupo. Montos en soles, sin IGV.');
    }

    // ---------- figuras vectoriales ----------
    function ejes(x0, y0, w, h, xmax, ymin, ymax, etx, ety, nx, ny) {
      doc.setDrawColor(215, 222, 228); doc.setLineWidth(0.15); doc.setFontSize(7); doc.setTextColor.apply(doc, GRIS); doc.setFont('helvetica', 'normal');
      for (var i = 0; i <= ny; i++) {
        var yy = y0 + h - h * i / ny, val = ymin + (ymax - ymin) * i / ny;
        doc.line(x0, yy, x0 + w, yy); doc.text(nf(val, 0), x0 - 1.5, yy + 1, { align: 'right' });
      }
      for (var j = 0; j <= nx; j++) { var xx = x0 + w * j / nx; doc.text(nf(xmax * j / nx, 0), xx, y0 + h + 4, { align: 'center' }); }
      doc.setDrawColor(90, 100, 110); doc.setLineWidth(0.3); doc.line(x0, y0, x0, y0 + h); doc.line(x0, y0 + h, x0 + w, y0 + h);
      doc.setFontSize(7.5); doc.text(etx, x0 + w / 2, y0 + h + 8.5, { align: 'center' }); doc.text(ety, x0 - 12, y0 - 2);
    }
    function figuraPE() {
      var g = R.grafPE; if (!g.length) return;
      caption('Figura', 'Punto de equilibrio del año 1: ingresos, costo total y costo fijo');
      var h = 68, w = 150, x0 = MARG + 22, y0 = y + 3; espacio(h + 20); y0 = y + 3;
      var xmax = g[g.length - 1].u, ymax = Math.max.apply(null, g.map(function (p) { return Math.max(p.ingreso, p.costoTotal); })) * 1.05;
      ejes(x0, y0, w, h, xmax, 0, ymax, 'Unidades vendidas', 'Soles', 5, 5);
      function px(u) { return x0 + w * u / xmax; } function py(v) { return y0 + h - h * v / ymax; }
      var series = [['ingreso', [31, 120, 180], 'Ingresos'], ['costoTotal', [200, 80, 60], 'Costo total'], ['costoFijo', [120, 120, 120], 'Costo fijo']];
      series.forEach(function (s, k) {
        doc.setDrawColor.apply(doc, s[1]); doc.setLineWidth(0.7);
        for (var i = 1; i < g.length; i++) doc.line(px(g[i - 1].u), py(g[i - 1][s[0]]), px(g[i].u), py(g[i][s[0]]));
        doc.setFillColor.apply(doc, s[1]); doc.rect(x0 + 4 + k * 38, y0 + h + 11, 4, 2, 'F'); doc.setTextColor(40, 40, 40); doc.setFontSize(7.5); doc.text(s[2], x0 + 9.5 + k * 38, y0 + h + 12.7);
      });
      var pe = R.pe[0];
      if (pe.unidades !== null && pe.unidades <= xmax) {
        doc.setFillColor(20, 20, 20); doc.circle(px(pe.unidades), py(pe.soles), 1.3, 'F');
        doc.setFontSize(7.5); doc.setFont('helvetica', 'bold'); doc.text('Equilibrio: ' + nf(pe.unidades, 0) + ' unid. / ' + sol(pe.soles), px(pe.unidades) + 2.5, py(pe.soles) + 6);
      }
      var dx = px(R.totales.unidades[0]);
      doc.setDrawColor(40, 140, 80); doc.setLineWidth(0.3); doc.setLineDashPattern([1.2, 1.2], 0); doc.line(dx, y0, dx, y0 + h); doc.setLineDashPattern([], 0);
      doc.setFont('helvetica', 'normal'); doc.setTextColor.apply(doc, VERDE); doc.text('Demanda ' + nf(R.totales.unidades[0], 0), dx - 1.5, y0 + 3.5, { align: 'right' });
      y = y0 + h + 17; nota('Elaboración propia. Ingresos con el precio promedio ponderado, costo total = costos fijos + costo variable promedio x unidades.');
    }
    function figuraFlujo() {
      caption('Figura', 'Flujo de caja económico por año y flujo acumulado');
      var fl = R.flujos.fce, ac = R.flujos.fceAcum, etiquetas = ['Año 0', 'Año 1', 'Año 2', 'Año 3'];
      var h = 60, w = 150, x0 = MARG + 22; espacio(h + 18); var y0 = y + 3;
      var vmax = Math.max.apply(null, fl.concat(ac).concat([1])) * 1.1, vmin = Math.min.apply(null, fl.concat(ac).concat([0])) * 1.1;
      doc.setDrawColor(215, 222, 228); doc.setLineWidth(0.15); doc.setFontSize(7); doc.setTextColor.apply(doc, GRIS);
      for (var i = 0; i <= 5; i++) { var v = vmin + (vmax - vmin) * i / 5, yy = y0 + h - h * (v - vmin) / (vmax - vmin); doc.line(x0, yy, x0 + w, yy); doc.text(nf(v, 0), x0 - 1.5, yy + 1, { align: 'right' }); }
      var cero = y0 + h - h * (0 - vmin) / (vmax - vmin); doc.setDrawColor(60, 60, 60); doc.setLineWidth(0.3); doc.line(x0, cero, x0 + w, cero);
      var bw = w / 4 * 0.32;
      fl.forEach(function (v, k) {
        var cx = x0 + w * (k + 0.5) / 4, top = y0 + h - h * (Math.max(v, 0) - vmin) / (vmax - vmin), alto = h * Math.abs(v) / (vmax - vmin);
        doc.setFillColor.apply(doc, v >= 0 ? [31, 120, 180] : [200, 80, 60]);
        doc.rect(cx - bw - 0.5, v >= 0 ? top : cero, bw, alto, 'F');
        doc.setFillColor(120, 150, 120); var av = ac[k], atop = y0 + h - h * (Math.max(av, 0) - vmin) / (vmax - vmin), aalto = h * Math.abs(av) / (vmax - vmin);
        doc.rect(cx + 0.5, av >= 0 ? atop : cero, bw, aalto, 'F');
        doc.setFontSize(7.5); doc.setTextColor(40, 40, 40); doc.text(etiquetas[k], cx, y0 + h + 4, { align: 'center' });
      });
      doc.setFillColor(31, 120, 180); doc.rect(x0 + 4, y0 + h + 8, 4, 2, 'F'); doc.setFontSize(7.5); doc.text('Flujo del año', x0 + 9.5, y0 + h + 9.7);
      doc.setFillColor(120, 150, 120); doc.rect(x0 + 40, y0 + h + 8, 4, 2, 'F'); doc.text('Flujo acumulado', x0 + 45.5, y0 + h + 9.7);
      y = y0 + h + 14; nota('Elaboración propia. El flujo del año 3 incluye la recuperación del capital de trabajo.');
    }

    // =================== PORTADA ===================
    doc.setFillColor.apply(doc, AZUL); doc.rect(0, 0, 210, 52, 'F');
    doc.setTextColor(255, 255, 255); doc.setFont('helvetica', 'bold'); doc.setFontSize(20); doc.text('Proyección financiera a 3 años', MARG, 24);
    doc.setFont('helvetica', 'normal'); doc.setFontSize(11); doc.text('Capítulo 6 del TAP - Unidad Didáctica Proyecto Integrador', MARG, 33);
    doc.setFontSize(9); doc.text('Informe generado el ' + (opciones.fecha || ''), MARG, 44);
    y = 66; doc.setTextColor(30, 30, 30); doc.setFont('helvetica', 'bold'); doc.setFontSize(14);
    var tl = doc.splitTextToSize(S.nombre || 'Proyecto sin nombre', ANCHO); doc.text(tl, MARG, y); y += tl.length * 6.5;
    doc.setFont('helvetica', 'normal'); doc.setFontSize(10.5); doc.setTextColor.apply(doc, GRIS);
    doc.text('Grupo: ' + (S.grupo || '-'), MARG, y); y += 5.5;
    var il = doc.splitTextToSize('Integrantes: ' + (S.integrantes || '-'), ANCHO); doc.text(il, MARG, y); y += il.length * 5.2 + 6;

    // =================== 1. RESUMEN ===================
    h1('1. Resumen ejecutivo');
    var ind = R.ind, inv = R.inversion, pe1 = R.pe[0];
    var viable = ind.vanE > 0 && ind.tirE !== null && ind.tirE > R.cok;
    parrafo('Con los supuestos ingresados, el proyecto ' + (viable ? 'resulta económicamente viable' : 'NO resulta económicamente viable') +
      ' en el horizonte de 3 anios: el VAN económico es ' + sol(ind.vanE) + ' a una tasa de descuento (COK) de ' + pct(R.cok) +
      ' y la TIR económica es ' + pct(ind.tirE) + (ind.tirE !== null ? (ind.tirE > R.cok ? ', superior a la COK.' : ', inferior a la COK.') : '.'));
    tabla('Indicadores clave del proyecto', ['Indicador', 'Resultado', 'Cómo interpretarlo'], [
      ['Inversión total', sol(inv.total), 'Inversión fija (' + sol(inv.fija) + ') más capital de trabajo (' + sol(inv.capTrabajo) + ').'],
      ['VAN económico', sol(ind.vanE), 'Mayor que cero: rinde más que la rentabilidad mínima exigida.'],
      ['TIR económica', pct(ind.tirE), 'Debe superar la COK (' + pct(R.cok) + ').'],
      ['Periodo de recuperación', anios(ind.priE), 'Tiempo en que el flujo acumulado cubre la inversión.'],
      ['Beneficio / Costo', ind.bc === null ? 'n.d.' : ind.bc.toFixed(2), 'Valor actual de los flujos por cada sol invertido (mayor que 1).'],
      ['Punto de equilibrio año 1', pe1.unidades === null ? 'n.d.' : nf(pe1.unidades, 0) + ' unid. (' + sol(pe1.soles) + ')', 'Ventas mínimas para cubrir los costos fijos.'],
      ['Margen de seguridad año 1', pct(pe1.margenSeg), 'Cuánto puede caer la demanda antes de entrar en pérdida.']
    ], { cols: { 0: { cellWidth: 42, fontStyle: 'bold' }, 1: { cellWidth: 42, halign: 'right' } } });
    var rv = R.resumenVerif;
    parrafo('Verificaciones de coherencia cumplidas: ' + rv.ok + ' de ' + rv.total + '.' + (rv.ok < rv.total ? ' Revise los puntos marcados como REVISAR en la sección 7.' : ''), { bold: true, color: rv.ok < rv.total ? ROJO : VERDE });

    // =================== 2. SUPUESTOS ===================
    nueva(); h1('2. Supuestos del proyecto');
    tabla('Supuestos generales', ['Supuesto', 'Valor'], [
      ['Tasa de descuento (COK)', pct(R.cok)], ['Impuesto a la renta', pct(R.tasaIR)], ['Crecimiento anual de la demanda', pct(S.general.crecDemanda)],
      ['Crecimiento anual de costos fijos', pct(S.general.crecCostosFijos)], ['Meses de capital de trabajo', String(S.general.mesesCapTrabajo)]
    ], { cols: { 1: { halign: 'right' } } });
    tabla('Productos o servicios, precio y costo variable unitario', ['Producto', 'Rango competencia', 'Disp. a pagar', 'Precio', 'Costo var.', 'Margen', 'Margen %', 'Demanda a1'],
      R.productos.map(function (p) {
        return [p.nombre, (p.precioMin > 0 ? sol(p.precioMin) + ' a ' + sol(p.precioMax) : 'n.d.'), p.disposicion > 0 ? sol(p.disposicion) : 'n.d.', sol(p.precio, 2), sol(p.cvu, 2), sol(p.margen, 2), pct(p.margenPct, 0), nf(p.demanda1, 0)];
      }), { size: 8, cols: { 0: { cellWidth: 34 } } }, 'Elaboración propia. Precio fijado según la competencia y la disposición a pagar; margen = precio - costo variable unitario.');
    var cvRows = [];
    R.productos.forEach(function (p) { p.cvDetalle.forEach(function (d, i) { cvRows.push([i === 0 ? p.nombre : '', d.concepto, nf(d.cantidad, 2), sol(d.costoUnit, 2), sol(d.subtotal, 2)]); }); cvRows.push(['', 'Costo variable unitario', '', '', sol(p.cvu, 2)]); });
    var totCv = []; cvRows.forEach(function (r, i) { if (r[1] === 'Costo variable unitario') totCv.push(i); });
    tabla('Detalle del costo variable unitario', ['Producto', 'Concepto', 'Cantidad', 'Costo unitario', 'Subtotal'], cvRows, { totalRows: totCv, cols: { 2: { halign: 'right' }, 3: { halign: 'right' }, 4: { halign: 'right' } } });
    var cfRows = (S.cfItems || []).filter(function (i) { return (i.concepto || '') !== '' || +i.mensual; }).map(function (i) { return [i.concepto, i.tipo, sol(+i.mensual, 0), sol(+i.mensual * 12, 0)]; });
    cfRows.push(['Total costos fijos', '', sol(R.cf.admMes + R.cf.venMes, 0), sol((R.cf.admMes + R.cf.venMes) * 12, 0)]);
    tabla('Costos fijos del año 1', ['Concepto', 'Tipo', 'Mensual', 'Anual'], cfRows, { totalRows: [cfRows.length - 1], cols: { 2: { halign: 'right' }, 3: { halign: 'right' } } });
    var ivRows = inv.items.map(function (i) { return [i.concepto, i.categoria, nf(i.cantidad, 0), sol(i.precioUnit, 0), sol(i.monto, 0), String(i.vida), sol(i.dep[0], 0)]; });
    ivRows.push(['Inversión fija', '', '', '', sol(inv.fija, 0), '', sol(R.cf.dep[0], 0)]);
    ivRows.push(['Capital de trabajo (' + S.general.mesesCapTrabajo + ' meses de egresos operativos)', '', '', '', sol(inv.capTrabajo, 0), '', '']);
    ivRows.push(['INVERSIÓN TOTAL', '', '', '', sol(inv.total, 0), '', '']);
    tabla('Inversión, depreciación y capital de trabajo', ['Concepto', 'Categoría', 'Cant.', 'Precio unit.', 'Monto', 'Vida (a.)', 'Deprec. a1'], ivRows,
      { size: 8, totalRows: [ivRows.length - 3, ivRows.length - 2, ivRows.length - 1], cols: { 0: { cellWidth: 52 }, 2: { halign: 'right' }, 3: { halign: 'right' }, 4: { halign: 'right' }, 5: { halign: 'center' }, 6: { halign: 'right' } } },
      'Elaboración propia. Depreciación lineal = monto / vida util. Capital de trabajo = meses x (costos variables + gastos fijos operativos del año 1) / 12.');
    var pr = R.prestamo;
    tabla('Financiamiento', ['Concepto', 'Valor'], [
      ['Aporte propio', sol(S.financ.aportePropio, 0)], ['Préstamo', sol(pr.monto, 0)], ['TEA', pct(pr.tea)], ['Plazo (años)', String(pr.plazo)],
      ['Cuota anual constante', sol(pr.cuotaAnual, 0)], ['Fuentes totales', sol((+S.financ.aportePropio || 0) + pr.monto, 0)], ['Inversión total requerida', sol(inv.total, 0)]
    ], { cols: { 1: { halign: 'right' } } });
    var mk = R.mercado, mm = S.mercado;
    tabla('Tamaño de mercado: TAM, SAM y SOM', ['Concepto', 'Valor'], [
      ['Población objetivo', nf(mm.poblacion, 0)], ['Frecuencia de compra anual', nf(mm.frecuencia, 2)], ['Cobertura geográfica', pct(mm.cobertura, 0)], ['Disposición a pagar', pct(mm.disposicion, 0)],
      ['Interés en la propuesta', pct(mm.interes, 0)], ['Participación inicial', pct(mm.participacion, 0)],
      ['TAM (unidades/año)', nf(mk.tam, 0)], ['SAM (unidades/año)', nf(mk.sam, 0)], ['SOM (unidades/año)', nf(mk.som, 0)], ['Capacidad operativa anual', nf(mk.capAnual, 0)]
    ], { totalRows: [6, 7, 8], cols: { 1: { halign: 'right' } } });

    // =================== 3. PROYECCION ===================
    h1('3. Proyección de ventas y costos');
    var an = ['Año 1', 'Año 2', 'Año 3'], rowsU = R.productos.map(function (p) { return [p.nombre].concat(p.unidades.map(function (u) { return nf(u, 0); })); });
    rowsU.push(['Total unidades'].concat(R.totales.unidades.map(function (u) { return nf(u, 0); })));
    tabla('Unidades vendidas proyectadas', ['Producto'].concat(an), rowsU, { totalRows: [rowsU.length - 1], cols: { 1: { halign: 'right' }, 2: { halign: 'right' }, 3: { halign: 'right' } } });
    var rowsI = R.productos.map(function (p) { return [p.nombre].concat(p.ingresos.map(function (u) { return sol(u, 0); })); });
    rowsI.push(['Total ingresos'].concat(R.totales.ingresos.map(function (u) { return sol(u, 0); })));
    tabla('Ingresos por ventas proyectados', ['Producto'].concat(an), rowsI, { totalRows: [rowsI.length - 1], cols: { 1: { halign: 'right' }, 2: { halign: 'right' }, 3: { halign: 'right' } } });

    // =================== 4. EERR ===================
    h1('4. Estado de resultados proyectado');
    var e = R.eerr;
    function fila(t, arr) { return [t].concat(arr.map(function (v) { return sol(v, 0); })); }
    var er = [fila('Ingresos por ventas', e.ingresos), fila('(-) Costos variables', e.cv), fila('(=) Margen de contribución', e.margenContrib), fila('(-) Gastos administrativos', e.adm), fila('(-) Gastos de venta', e.ven),
      fila('(-) Depreciación', e.dep), fila('(=) Utilidad operativa (EBIT)', e.ebit), fila('(-) Gastos financieros', e.interes), fila('(=) Utilidad antes de impuestos', e.ebt), fila('(-) Impuesto a la renta', e.ir), fila('(=) Utilidad neta', e.neta)];
    tabla('Estado de resultados proyectado', ['Concepto'].concat(an), er, { totalRows: [2, 6, 8, 10], cols: { 1: { halign: 'right' }, 2: { halign: 'right' }, 3: { halign: 'right' } } });

    // =================== 5. FLUJOS ===================
    h1('5. Flujos de caja e indicadores de rentabilidad');
    var f = R.flujos, cab = ['Concepto', 'Año 0', 'Año 1', 'Año 2', 'Año 3'];
    function f5(t, arr) { return [t].concat(arr.map(function (v) { return v === null ? '' : sol(v, 0); })); }
    var ebit = R.eerr.ebit, dep = R.cf.dep;
    tabla('Flujo de caja económico', cab, [
      f5('Utilidad operativa (EBIT)', [null].concat(ebit)), f5('(-) Impuesto sobre el EBIT', [null].concat(f.irEcon)), f5('(+) Depreciación', [null].concat(dep)),
      f5('(-) Inversión total', [-inv.total, 0, 0, 0]), f5('(+) Recuperación del capital de trabajo', [0].concat(f.recup)), f5('Flujo de caja económico', f.fce), f5('Flujo acumulado', f.fceAcum)
    ], { totalRows: [5, 6], cols: { 1: { halign: 'right' }, 2: { halign: 'right' }, 3: { halign: 'right' }, 4: { halign: 'right' } } });
    tabla('Flujo de caja financiero (con préstamo)', cab, [
      f5('Utilidad neta', [null].concat(R.eerr.neta)), f5('(+) Depreciación', [null].concat(dep)), f5('(-) Amortización del préstamo', [null].concat(pr.amort)), f5('(+) Préstamo recibido', [pr.monto, 0, 0, 0]),
      f5('(-) Inversión total', [-inv.total, 0, 0, 0]), f5('(+) Recuperación del capital de trabajo', [0].concat(f.recup)), f5('Flujo de caja financiero', f.fcf)
    ], { totalRows: [6], cols: { 1: { halign: 'right' }, 2: { halign: 'right' }, 3: { halign: 'right' }, 4: { halign: 'right' } } });
    tabla('Indicadores de rentabilidad (COK ' + pct(R.cok) + ')', ['Indicador', 'Económico', 'Financiero'], [
      ['VAN', sol(ind.vanE), sol(ind.vanF)], ['TIR', pct(ind.tirE), pct(ind.tirF)], ['Periodo de recuperación', anios(ind.priE), anios(ind.priF)], ['Beneficio / Costo', ind.bc === null ? 'n.d.' : ind.bc.toFixed(2), '-']
    ], { cols: { 1: { halign: 'right' }, 2: { halign: 'right' } } });
    figuraFlujo();

    // =================== 6. PE ===================
    h1('6. Punto de equilibrio');
    var peRows = [
      ['Unidades proyectadas'].concat(R.pe.map(function (p) { return nf(p.demanda, 0); })),
      ['Costos fijos (adm. + venta + deprec.)'].concat(R.pe.map(function (p) { return sol(p.costosFijos, 0); })),
      ['Margen de contribución ponderado'].concat(R.pe.map(function (p) { return sol(p.margenPond, 2); })),
      ['Precio promedio ponderado'].concat(R.pe.map(function (p) { return sol(p.precioProm, 2); })),
      ['Punto de equilibrio (unidades)'].concat(R.pe.map(function (p) { return p.unidades === null ? 'n.d.' : nf(p.unidades, 0); })),
      ['Punto de equilibrio (soles)'].concat(R.pe.map(function (p) { return sol(p.soles, 0); })),
      ['Margen de seguridad'].concat(R.pe.map(function (p) { return pct(p.margenSeg); }))
    ];
    tabla('Punto de equilibrio por año', ['Concepto'].concat(an), peRows, { totalRows: [4, 5, 6], cols: { 1: { halign: 'right' }, 2: { halign: 'right' }, 3: { halign: 'right' } } },
      'Elaboración propia. PE = costos fijos / margen de contribución ponderado; margen de seguridad = (demanda - PE) / demanda.');
    var peP = R.productos.map(function (p, i) { return [p.nombre].concat(R.pe.map(function (x) { return x.porProducto[i] === null ? 'n.d.' : nf(x.porProducto[i], 0); })); });
    tabla('Unidades de equilibrio por producto (según la mezcla de ventas)', ['Producto'].concat(an), peP, { cols: { 1: { halign: 'right' }, 2: { halign: 'right' }, 3: { halign: 'right' } } });
    figuraPE();

    // =================== 7. VERIFICACIONES ===================
    h1('7. Verificaciones de coherencia');
    tabla('Verificaciones de coherencia del modelo', ['Verificación', 'Detalle', 'Resultado'],
      R.verificaciones.map(function (c) { return [c.texto, c.detalle, c.ok === null ? 'Sin datos' : (c.ok ? 'OK' : 'REVISAR')]; }),
      { size: 8, colorResultado: 2, cols: { 0: { cellWidth: 70 }, 2: { cellWidth: 22 } } }, 'Elaboración propia. REVISAR indica que el supuesto debe corregirse o justificarse en el informe del grupo.');

    // =================== 8. FORMULAS ===================
    h1('8. Fórmulas utilizadas');
    var fm = [
      ['Demanda del año t', 'Demanda año 1 x (1 + crecimiento) ^ (t - 1)'], ['Costo variable unitario', 'Suma de (cantidad x costo unitario) de cada insumo'], ['Margen de contribución', 'Precio - costo variable unitario'],
      ['Costos fijos del año t', 'Monto mensual x 12 x (1 + crecimiento) ^ (t - 1)'], ['Depreciación anual', 'Monto / vida util (mientras dure la vida util)'], ['Capital de trabajo', 'Meses x (costos variables + gastos fijos operativos del año 1) / 12'],
      ['Cuota del préstamo', 'P x i / (1 - (1 + i) ^ -n)'], ['Utilidad operativa (EBIT)', 'Margen de contribución - gastos administrativos - gastos de venta - depreciación'],
      ['Flujo económico', 'EBIT - impuesto sobre el EBIT + depreciación (+ recuperación de capital de trabajo en el año 3)'], ['VAN', 'Flujo del año 0 + suma de flujo(t) / (1 + COK) ^ t'],
      ['TIR', 'Tasa que hace el VAN igual a cero'], ['Periodo de recuperación', 'Año en que el flujo acumulado pasa a ser positivo, con interpolacion'], ['Beneficio / Costo', 'Valor actual de los flujos de los años 1 a 3 / inversión total'],
      ['Punto de equilibrio', 'Costos fijos / margen de contribución ponderado por unidad'], ['Margen de seguridad', '(Demanda - punto de equilibrio) / demanda'], ['TAM, SAM, SOM', 'TAM = población x frecuencia; SAM = TAM x cobertura x disposición x interes; SOM = SAM x participación']
    ];
    tabla('Fórmulas del modelo', ['Concepto', 'Fórmula'], fm, { size: 8.5, cols: { 0: { cellWidth: 48, fontStyle: 'bold' } } }, 'Simplificaciones: montos sin IGV, depreciación lineal, sin valor residual, impuesto sin compensación de pérdidas.');

    // pie de pagina
    var total = doc.getNumberOfPages();
    for (var p = 1; p <= total; p++) {
      doc.setPage(p); doc.setFont('helvetica', 'normal'); doc.setFontSize(8); doc.setTextColor.apply(doc, GRIS);
      if (p > 1) { doc.text((S.nombre || 'Proyecto').slice(0, 90), MARG, 10); doc.setDrawColor(200, 205, 210); doc.setLineWidth(0.2); doc.line(MARG, 12, MARG + ANCHO, 12); }
      doc.text('Página ' + p + ' de ' + total, 195, 290, { align: 'right' });
    }
    return doc;
  }

  var api = { generar: generar };
  if (typeof module !== 'undefined' && module.exports) module.exports = api; else root.InformeFinanciero = api;
})(typeof self !== 'undefined' ? self : this);
