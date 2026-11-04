/* motor.js - Calculo de la proyección financiera a 3 años (Capítulo 6 del TAP).
   Es la misma logica que usa la plantilla de Excel: si cambias un supuesto, ambos dan igual resultado.
   Montos en soles, sin IGV. No depende del navegador: tambien corre en Node. */
(function (root) {
  'use strict';
  var N = 3; // horizonte: 3 años

  function n(x) { var v = Number(x); return isFinite(v) ? v : 0; }
  function sum(a) { return a.reduce(function (s, x) { return s + x; }, 0); }
  function por3(fn) { return [0, 1, 2].map(fn); }

  // VAN con el flujo del periodo 0 sin descontar
  function van(tasa, flujos) {
    return flujos.reduce(function (s, f, t) { return s + f / Math.pow(1 + tasa, t); }, 0);
  }
  // TIR por biseccion; null si no hay cambio de signo
  function tir(flujos) {
    var lo = -0.99, hi = 10, flo = van(lo, flujos), fhi = van(hi, flujos);
    if (!(flo * fhi < 0)) return null;
    for (var i = 0; i < 200; i++) {
      var m = (lo + hi) / 2, fm = van(m, flujos);
      if (flo * fm <= 0) { hi = m; fhi = fm; } else { lo = m; flo = fm; }
    }
    return (lo + hi) / 2;
  }
  // Periodo de recuperación simple (años); null si no se recupera en el horizonte
  function pri(flujos) {
    var acum = flujos[0];
    if (acum >= 0) return 0;
    for (var t = 1; t < flujos.length; t++) {
      var prev = acum; acum += flujos[t];
      if (acum >= 0) return (t - 1) + (-prev) / flujos[t];
    }
    return null;
  }

  function calcular(d) {
    var g = d.general || {}, f = d.financ || {}, m = d.mercado || {};
    var cok = n(g.cok), tIR = n(g.tasaIR), gD = n(g.crecDemanda), gCF = n(g.crecCostosFijos), mesesCT = n(g.mesesCapTrabajo);

    // ---------- Productos, costo variable unitario y proyección de ventas ----------
    var prods = (d.productos || []).filter(function (p) { return String(p.nombre || '').trim() !== ''; });
    var cvu = {}, cvDet = {};
    prods.forEach(function (p) { cvu[p.nombre] = 0; cvDet[p.nombre] = []; });
    (d.cvItems || []).forEach(function (it) {
      if (Object.prototype.hasOwnProperty.call(cvu, it.producto)) {
        var sub = n(it.cantidad) * n(it.costoUnit);
        cvu[it.producto] += sub;
        cvDet[it.producto].push({ concepto: it.concepto, cantidad: n(it.cantidad), costoUnit: n(it.costoUnit), subtotal: sub });
      }
    });
    var productos = prods.map(function (p) {
      var precio = n(p.precio), c = cvu[p.nombre];
      var unidades = por3(function (t) { return n(p.demanda1) * Math.pow(1 + gD, t); });
      return {
        nombre: p.nombre, precio: precio, precioMin: n(p.precioMin), precioMax: n(p.precioMax), disposicion: n(p.disposicionPago),
        demanda1: n(p.demanda1), cvu: c, margen: precio - c, margenPct: precio ? (precio - c) / precio : 0,
        unidades: unidades,
        ingresos: unidades.map(function (u) { return u * precio; }),
        cvTotal: unidades.map(function (u) { return u * c; }),
        cvDetalle: cvDet[p.nombre]
      };
    });
    function tot(key) { return por3(function (t) { return sum(productos.map(function (p) { return p[key][t]; })); }); }
    var unidades = tot('unidades'), ingresos = tot('ingresos'), cv = tot('cvTotal');
    var margenContrib = por3(function (t) { return ingresos[t] - cv[t]; });

    // ---------- Costos fijos ----------
    var cfItems = (d.cfItems || []).filter(function (i) { return String(i.concepto || '').trim() !== '' || n(i.mensual) !== 0; });
    var admMes = sum(cfItems.filter(function (i) { return i.tipo === 'Administrativo'; }).map(function (i) { return n(i.mensual); }));
    var venMes = sum(cfItems.filter(function (i) { return i.tipo === 'Venta'; }).map(function (i) { return n(i.mensual); }));
    var adm = por3(function (t) { return admMes * 12 * Math.pow(1 + gCF, t); });
    var ven = por3(function (t) { return venMes * 12 * Math.pow(1 + gCF, t); });

    // ---------- Inversión y depreciación lineal ----------
    var invItems = (d.invItems || []).filter(function (i) { return String(i.concepto || '').trim() !== '' || n(i.precioUnit) !== 0; }).map(function (i) {
      var monto = n(i.cantidad) * n(i.precioUnit), vida = n(i.vidaUtil);
      return { concepto: i.concepto, categoria: i.categoria, cantidad: n(i.cantidad), precioUnit: n(i.precioUnit), monto: monto, vida: vida,
        dep: por3(function (t) { return (vida > 0 && t + 1 <= vida) ? monto / vida : 0; }) };
    });
    var invFija = sum(invItems.map(function (i) { return i.monto; }));
    var dep = por3(function (t) { return sum(invItems.map(function (i) { return i.dep[t]; })); });
    var capTrabajo = mesesCT * (cv[0] + adm[0] + ven[0]) / 12; // egresos operativos de N meses (sin depreciación)
    var invTotal = invFija + capTrabajo;

    // ---------- Préstamo (cuota constante anual) ----------
    var P = n(f.prestamo), tea = n(f.tea);
    var plazo = P > 0 ? Math.min(3, Math.max(1, Math.round(n(f.plazo)))) : 0;
    var cuotaAnual = plazo === 0 ? 0 : (tea === 0 ? P / plazo : P * tea / (1 - Math.pow(1 + tea, -plazo)));
    var saldoIni = [], interes = [], cuota = [], amort = [], saldoFin = [], s = P;
    for (var t = 0; t < N; t++) {
      saldoIni.push(s);
      var it = s * tea, cu = (t + 1 <= plazo) ? cuotaAnual : 0, am = (t + 1 <= plazo) ? cu - it : 0;
      interes.push(it); cuota.push(cu); amort.push(am); s = s - am; if (Math.abs(s) < 1e-9) s = 0; saldoFin.push(s);
    }

    // ---------- Estado de resultados ----------
    var ebit = por3(function (t) { return margenContrib[t] - adm[t] - ven[t] - dep[t]; });
    var ebt = por3(function (t) { return ebit[t] - interes[t]; });
    var irFin = por3(function (t) { return Math.max(0, ebt[t]) * tIR; });
    var neta = por3(function (t) { return ebt[t] - irFin[t]; });
    var irEcon = por3(function (t) { return Math.max(0, ebit[t]) * tIR; });

    // ---------- Flujos ----------
    var recup = [0, 0, capTrabajo];
    var fce = [-invTotal].concat(por3(function (t) { return ebit[t] - irEcon[t] + dep[t] + recup[t]; }));
    var fcf = [-invTotal + P].concat(por3(function (t) { return neta[t] + dep[t] - amort[t] + recup[t]; }));
    var fceAcum = [], a = 0; fce.forEach(function (x) { a += x; fceAcum.push(a); });
    var pvInflows = sum(fce.slice(1).map(function (x, i) { return x / Math.pow(1 + cok, i + 1); }));
    var ind = {
      vanE: van(cok, fce), tirE: tir(fce), priE: pri(fce), bc: invTotal > 0 ? pvInflows / invTotal : null,
      vanF: van(cok, fcf), tirF: tir(fcf), priF: pri(fcf)
    };

    // ---------- Punto de equilibrio (económico, por año) ----------
    var pe = por3(function (t) {
      var U = unidades[t], cfop = adm[t] + ven[t] + dep[t];
      var mp = U > 0 ? sum(productos.map(function (p) { return p.unidades[t] * p.margen; })) / U : 0;
      var pp = U > 0 ? sum(productos.map(function (p) { return p.unidades[t] * p.precio; })) / U : 0;
      var peU = mp > 0 ? cfop / mp : null;
      var peS = peU === null ? null : peU * pp;
      return {
        costosFijos: cfop, margenPond: mp, precioProm: pp, unidades: peU, soles: peS,
        porProducto: productos.map(function (p) { return peU === null || U <= 0 ? null : peU * p.unidades[t] / U; }),
        demanda: U, margenSeg: (peU === null || U <= 0) ? null : (U - peU) / U
      };
    });
    // Datos para el grafico del año 1
    var grafPE = [];
    if (unidades[0] > 0) {
      var maxU = Math.max(unidades[0], pe[0].unidades || 0) * 1.4, cvProm = cv[0] / unidades[0];
      for (var k = 0; k <= 10; k++) {
        var u = maxU * k / 10;
        grafPE.push({ u: u, ingreso: u * pe[0].precioProm, costoTotal: pe[0].costosFijos + u * cvProm, costoFijo: pe[0].costosFijos });
      }
    }

    // ---------- Mercado ----------
    var tam = n(m.poblacion) * n(m.frecuencia);
    var sam = tam * n(m.cobertura) * n(m.disposicion) * n(m.interes);
    var som = sam * n(m.participacion);
    var capAnual = n(m.capacidadMensual) * 12;

    // ---------- Verificaciones de coherencia ----------
    var chk = [];
    function add(grupo, ok, texto, detalle) { chk.push({ grupo: grupo, ok: ok, texto: texto, detalle: detalle }); }
    var S = function (x) { return 'S/ ' + (Math.round(x * 100) / 100).toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 2 }); };
    productos.forEach(function (p) {
      if (p.precioMin > 0 && p.precioMax > 0)
        add('Precio', p.precio >= p.precioMin && p.precio <= p.precioMax, 'Precio de "' + p.nombre + '" dentro del rango de la competencia',
          'Precio ' + S(p.precio) + ' | rango ' + S(p.precioMin) + ' a ' + S(p.precioMax));
      else add('Precio', null, 'Precio de "' + p.nombre + '" frente a la competencia', 'Falta registrar el rango de precios de la competencia.');
      if (p.disposicion > 0)
        add('Precio', p.precio <= p.disposicion, 'Precio de "' + p.nombre + '" no supera la disposición a pagar', 'Precio ' + S(p.precio) + ' | disposición a pagar ' + S(p.disposicion));
      add('Precio', p.precio > p.cvu, 'Precio de "' + p.nombre + '" mayor al costo variable unitario', 'Precio ' + S(p.precio) + ' | costo variable ' + S(p.cvu));
      add('Costos', p.cvu > 0, 'Costos variables registrados para "' + p.nombre + '"', 'Costo variable unitario: ' + S(p.cvu));
    });
    add('Costos', (admMes + venMes) > 0, 'Costos fijos registrados', 'Costos fijos mensuales: ' + S(admMes + venMes));
    if (som > 0) add('Mercado', unidades[0] <= som, 'Demanda del año 1 no supera el mercado alcanzable (SOM)', 'Demanda ' + Math.round(unidades[0]) + ' | SOM ' + Math.round(som));
    else add('Mercado', null, 'Demanda del año 1 frente al mercado alcanzable (SOM)', 'Complete la sección de mercado.');
    if (capAnual > 0) add('Mercado', unidades[2] <= capAnual, 'Demanda del año 3 no supera la capacidad operativa', 'Demanda ' + Math.round(unidades[2]) + ' | capacidad anual ' + Math.round(capAnual));
    else add('Mercado', null, 'Demanda frente a la capacidad operativa', 'Registre la capacidad mensual.');
    add('Equilibrio', pe[0].unidades !== null && pe[0].unidades < unidades[0], 'Punto de equilibrio del año 1 menor que la demanda',
      pe[0].unidades === null ? 'No se puede calcular (margen de contribución no positivo).' : 'Equilibrio ' + Math.round(pe[0].unidades) + ' | demanda ' + Math.round(unidades[0]));
    add('Financiamiento', (n(f.aportePropio) + P) >= invTotal, 'Aporte propio + préstamo cubren la inversión total',
      'Fuentes ' + S(n(f.aportePropio) + P) + ' | inversión ' + S(invTotal));
    add('Rentabilidad', ind.vanE > 0, 'VAN económico positivo', 'VAN ' + S(ind.vanE));
    var evaluables = chk.filter(function (c) { return c.ok !== null; });

    return {
      cok: cok, tasaIR: tIR, productos: productos,
      totales: { unidades: unidades, ingresos: ingresos, cv: cv, margenContrib: margenContrib },
      cf: { admMes: admMes, venMes: venMes, adm: adm, ven: ven, dep: dep, total: por3(function (t) { return adm[t] + ven[t] + dep[t]; }) },
      inversion: { items: invItems, fija: invFija, capTrabajo: capTrabajo, total: invTotal },
      prestamo: { monto: P, tea: tea, plazo: plazo, cuotaAnual: cuotaAnual, saldoIni: saldoIni, interes: interes, cuota: cuota, amort: amort, saldoFin: saldoFin },
      eerr: { ingresos: ingresos, cv: cv, margenContrib: margenContrib, adm: adm, ven: ven, dep: dep, ebit: ebit, interes: interes, ebt: ebt, ir: irFin, neta: neta },
      flujos: { fce: fce, fcf: fcf, fceAcum: fceAcum, irEcon: irEcon, recup: recup },
      ind: ind, pe: pe, grafPE: grafPE,
      mercado: { tam: tam, sam: sam, som: som, capAnual: capAnual },
      verificaciones: chk, resumenVerif: { ok: evaluables.filter(function (c) { return c.ok; }).length, total: evaluables.length }
    };
  }

  var api = { calcular: calcular, van: van, tir: tir, pri: pri };
  if (typeof module !== 'undefined' && module.exports) module.exports = api; else root.MotorFinanciero = api;
})(typeof self !== 'undefined' ? self : this);
