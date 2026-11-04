/* ejemplo.js - Ejemplo didactico con datos FICTICIOS (no corresponde a ningun grupo ni dato real). */
(function (root) {
  'use strict';
  var EJEMPLO = {
    nombre: 'TallerBici AQP: mantenimiento de bicicletas a domicilio (EJEMPLO)',
    grupo: 'Grupo de ejemplo',
    integrantes: 'Integrante A; Integrante B; Integrante C',
    general: { cok: 0.20, tasaIR: 0.295, crecDemanda: 0.15, crecCostosFijos: 0.05, mesesCapTrabajo: 2 },
    productos: [
      { nombre: 'Mantenimiento básico', precioMin: 50, precioMax: 80, disposicionPago: 65, precio: 60, demanda1: 1500 },
      { nombre: 'Reparación completa', precioMin: 120, precioMax: 200, disposicionPago: 160, precio: 150, demanda1: 600 }
    ],
    cvItems: [
      { producto: 'Mantenimiento básico', concepto: 'Insumos de limpieza y lubricantes', cantidad: 1, costoUnit: 8 },
      { producto: 'Mantenimiento básico', concepto: 'Repuestos menores', cantidad: 1, costoUnit: 4 },
      { producto: 'Mantenimiento básico', concepto: 'Mano de obra técnica (hora)', cantidad: 1, costoUnit: 18 },
      { producto: 'Mantenimiento básico', concepto: 'Movilidad al domicilio', cantidad: 1, costoUnit: 5 },
      { producto: 'Reparación completa', concepto: 'Repuestos y piezas', cantidad: 1, costoUnit: 45 },
      { producto: 'Reparación completa', concepto: 'Mano de obra técnica (hora)', cantidad: 2, costoUnit: 20 },
      { producto: 'Reparación completa', concepto: 'Movilidad al domicilio', cantidad: 1, costoUnit: 5 }
    ],
    cfItems: [
      { concepto: 'Coordinador / administrador', tipo: 'Administrativo', mensual: 1800 },
      { concepto: 'Contabilidad y asesoría', tipo: 'Administrativo', mensual: 250 },
      { concepto: 'Servicios (luz, agua, internet)', tipo: 'Administrativo', mensual: 180 },
      { concepto: 'Herramientas digitales', tipo: 'Administrativo', mensual: 100 },
      { concepto: 'Alquiler de almacén', tipo: 'Administrativo', mensual: 700 },
      { concepto: 'Marketing digital', tipo: 'Venta', mensual: 600 },
      { concepto: 'Promotor de ventas', tipo: 'Venta', mensual: 900 }
    ],
    invItems: [
      { concepto: 'Laptop', categoria: 'Equipos', cantidad: 1, precioUnit: 2800, vidaUtil: 4 },
      { concepto: 'Herramientas y equipos de taller', categoria: 'Equipos', cantidad: 1, precioUnit: 3200, vidaUtil: 5 },
      { concepto: 'Módulo de almacenaje', categoria: 'Mobiliario', cantidad: 1, precioUnit: 1500, vidaUtil: 10 },
      { concepto: 'Branding y registro de marca', categoria: 'Intangibles', cantidad: 1, precioUnit: 1800, vidaUtil: 5 },
      { concepto: 'Constitución y licencias', categoria: 'Gastos preoperativos', cantidad: 1, precioUnit: 1500, vidaUtil: 5 }
    ],
    financ: { aportePropio: 25000, prestamo: 15000, tea: 0.24, plazo: 3 },
    mercado: { poblacion: 120000, frecuencia: 1.2, cobertura: 0.40, disposicion: 0.50, interes: 0.35, participacion: 0.22, capacidadMensual: 250 }
  };
  if (typeof module !== 'undefined' && module.exports) module.exports = EJEMPLO; else root.EJEMPLO_FINANCIERO = EJEMPLO;
})(typeof self !== 'undefined' ? self : this);
