import React from 'react';

// ──────────────────────────────────────────────────────────────────
// PrintCierreCaja — ticket térmico de cierre de jornada (80mm).
//
// Estructura:
//   DRIP BURGER                  (DOUBLE_SIZE, center)
//   ============================
//   CIERRE DE JORNADA            (DOUBLE_SIZE, center)
//   28/06/2026                   (BOLD, center)
//   ============================
//   Apertura: 19:00              (BOLD)
//   Cierre:   23:45              (BOLD)
//   Admin:    bruno              (si hay)
//   ----------------------------
//   PEDIDOS                      (BOLD label)
//   Activos:           23
//   Cancelados:        2
//   Monto cancelados:  $24.000
//   ----------------------------
//   COBROS                       (BOLD label)
//   Efectivo:          $52.300
//   Transferencia:     $18.500
//   Mercado Pago:      $24.700
//   ----------------------------
//   MOVIMIENTOS DE CAJA          (BOLD label)
//   Fondo inicial:     $5.000
//   Ingresos manuales: $1.200
//   Egresos manuales:  -$3.500
//   ============================
//   EFECTIVO ESPERADO  $55.000   (DOUBLE_HEIGHT, BOLD)
//   ENTREGADO          $55.000   (DOUBLE_HEIGHT, BOLD)
//   ----------------------------
//   CUADRE             $0        (DOUBLE_SIZE; verde si 0, rojo si distinto)
//   ============================
//   TOTAL FACTURADO:   $95.500
//
//   Gracias!
// ──────────────────────────────────────────────────────────────────

const WIDTH = 32;
const SEP_EQ = '='.repeat(WIDTH);
const SEP_DASH = '-'.repeat(WIDTH);

const fmtPrice = (n) => '$' + Math.round(Number(n) || 0).toLocaleString('es-AR');

const Row = ({ label, value, bold }) => (
  <div className={'ticket-row' + (bold ? ' ticket-bold' : '')}>
    <span>{label}</span>
    <span className="tabular-nums">{value}</span>
  </div>
);

const PrintCierreCaja = ({ data }) => {
  if (!data) return null;

  const {
    fecha,
    horaApertura,
    horaCierre,
    adminNombre,
    totalPedidos,
    pedidosCancelados,
    montoCancelados,
    cobrosEfectivo,
    cobrosTransferenciaBancaria,
    cobrosMercadopago,
    fondoInicial,
    ingresosManuales,
    egresosManuales,
    efectivoEsperado,
    montoCierre,
    cuadre,
    totalFacturado,
  } = data;

  const fechaTxt = (() => {
    try {
      if (!fecha) return new Date().toLocaleDateString('es-AR');
      const d = new Date(fecha);
      if (Number.isNaN(d.getTime())) return String(fecha);
      return d.toLocaleDateString('es-AR');
    } catch { return String(fecha || ''); }
  })();

  const cuadreOk = Math.abs(Number(cuadre) || 0) < 1; // tolerancia 1 peso

  return (
    <div>
      {/* HEADER */}
      <div className="ticket-center ticket-double">DRIP BURGER</div>
      <div className="ticket-sep">{SEP_EQ}</div>
      <div className="ticket-center ticket-double">CIERRE DE JORNADA</div>
      <div className="ticket-center ticket-bold">{fechaTxt}</div>
      <div className="ticket-sep">{SEP_EQ}</div>

      {/* META */}
      {horaApertura && <Row label="Apertura:" value={horaApertura} bold />}
      {horaCierre && <Row label="Cierre:" value={horaCierre} bold />}
      {adminNombre && <Row label="Admin:" value={adminNombre} />}
      <div className="ticket-sep">{SEP_DASH}</div>

      {/* PEDIDOS */}
      <div className="ticket-bold">PEDIDOS</div>
      <Row label="Activos:" value={totalPedidos ?? 0} />
      <Row label="Cancelados:" value={pedidosCancelados ?? 0} />
      {Number(montoCancelados) > 0 && (
        <Row label="Monto cancelados:" value={fmtPrice(montoCancelados)} />
      )}
      <div className="ticket-sep">{SEP_DASH}</div>

      {/* COBROS */}
      <div className="ticket-bold">COBROS</div>
      <Row label="Efectivo:" value={fmtPrice(cobrosEfectivo)} />
      {Number(cobrosTransferenciaBancaria) > 0 && (
        <Row label="Transferencia:" value={fmtPrice(cobrosTransferenciaBancaria)} />
      )}
      {Number(cobrosMercadopago) > 0 && (
        <Row label="Mercado Pago:" value={fmtPrice(cobrosMercadopago)} />
      )}
      <div className="ticket-sep">{SEP_DASH}</div>

      {/* MOVIMIENTOS DE CAJA */}
      <div className="ticket-bold">MOVIMIENTOS DE CAJA</div>
      <Row label="Fondo inicial:" value={fmtPrice(fondoInicial)} />
      {Number(ingresosManuales) > 0 && (
        <Row label="Ingresos manuales:" value={fmtPrice(ingresosManuales)} />
      )}
      {Number(egresosManuales) > 0 && (
        <Row label="Egresos manuales:" value={'-' + fmtPrice(egresosManuales)} />
      )}
      <div className="ticket-sep">{SEP_EQ}</div>

      {/* RESUMEN EFECTIVO */}
      <div className="ticket-row ticket-double-height">
        <span>EFECTIVO ESPERADO</span>
        <span className="tabular-nums">{fmtPrice(efectivoEsperado)}</span>
      </div>
      <div className="ticket-row ticket-double-height">
        <span>ENTREGADO</span>
        <span className="tabular-nums">{fmtPrice(montoCierre)}</span>
      </div>
      <div className="ticket-sep">{SEP_DASH}</div>

      {/* CUADRE */}
      <div className="ticket-row ticket-double">
        <span>CUADRE</span>
        <span className="tabular-nums">
          {cuadreOk ? '$0 OK' : (Number(cuadre) > 0 ? '+' + fmtPrice(cuadre) : fmtPrice(cuadre))}
        </span>
      </div>
      <div className="ticket-sep">{SEP_EQ}</div>

      {/* TOTAL */}
      <Row label="TOTAL FACTURADO:" value={fmtPrice(totalFacturado)} bold />

      <br />
      <div className="ticket-center">Gracias por el laburo!</div>
      <div className="ticket-spacer" />
    </div>
  );
};

export default PrintCierreCaja;
