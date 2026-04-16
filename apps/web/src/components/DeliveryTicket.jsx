import React, { useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { MEDALLION_LABELS, FORMA_PAGO, PAYMENT_STATUS } from '@/lib/orderConstants';

const fmtPrice = (n) =>
  new Intl.NumberFormat('es-AR', {
    style: 'currency',
    currency: 'ARS',
    maximumFractionDigits: 0,
  }).format(n || 0);

const formatDateTimeAr = (iso) => {
  if (!iso) return '';
  try {
    const d = new Date(iso);
    const ar = new Date(
      d.getTime() + (-3 * 60 * 60 * 1000) - d.getTimezoneOffset() * 60 * 1000
    );
    const dd = String(ar.getDate()).padStart(2, '0');
    const mm = String(ar.getMonth() + 1).padStart(2, '0');
    const yyyy = ar.getFullYear();
    const hh = String(ar.getHours()).padStart(2, '0');
    const min = String(ar.getMinutes()).padStart(2, '0');
    return `${dd}/${mm}/${yyyy} · ${hh}:${min}`;
  } catch (e) {
    return '';
  }
};

const STYLE_ID = 'delivery-ticket-style';
const PORTAL_ID = 'delivery-ticket-print';

const PRINT_CSS = `
@media screen {
  #${PORTAL_ID} { display: none; }
}

@media print {
  @page {
    size: 80mm 297mm;
    margin: 0;
  }
  html, body {
    width: 80mm !important;
    max-width: 80mm !important;
    height: 297mm !important;
    max-height: 297mm !important;
    margin: 0 !important;
    padding: 0 !important;
    background: #fff !important;
    overflow: hidden !important;
  }
  body > *:not(#${PORTAL_ID}):not(#${STYLE_ID}) {
    display: none !important;
  }
  #${PORTAL_ID} {
    display: block !important;
    position: static !important;
    width: 80mm !important;
    max-width: 80mm !important;
    box-sizing: border-box !important;
    margin: 0 !important;
    padding: 2mm !important;
    background: #fff !important;
    color: #000 !important;
    font-family: "Courier New", Courier, monospace !important;
    page-break-inside: avoid !important;
    page-break-before: avoid !important;
    page-break-after: avoid !important;
    break-inside: avoid !important;
  }
  #${PORTAL_ID} * {
    color: #000 !important;
    background: transparent !important;
    box-shadow: none !important;
    text-shadow: none !important;
    page-break-inside: avoid !important;
    break-inside: avoid !important;
    break-before: avoid !important;
    break-after: avoid !important;
  }
}

#${PORTAL_ID} {
  font-family: "Courier New", Courier, monospace;
  font-size: 9pt;
  line-height: 1.25;
  color: #000;
  background: #fff;
}
#${PORTAL_ID} .dt-brand {
  font-size: 14pt;
  font-weight: 900;
  text-align: center;
  letter-spacing: 0.04em;
  line-height: 1;
  margin: 0 0 1pt;
}
#${PORTAL_ID} .dt-divider-heavy {
  border: 0;
  border-top: 2px solid #000;
  margin: 2pt 0;
  height: 0;
}
#${PORTAL_ID} .dt-divider-light {
  border: 0;
  border-top: 1px dashed #000;
  margin: 2pt 0;
  height: 0;
}
#${PORTAL_ID} .dt-meta {
  font-size: 8.5pt;
  line-height: 1.25;
}
#${PORTAL_ID} .dt-block { margin: 2pt 0; }
#${PORTAL_ID} .dt-customer-name {
  font-size: 12pt;
  font-weight: 900;
  text-transform: uppercase;
  line-height: 1.1;
  word-wrap: break-word;
}
#${PORTAL_ID} .dt-phone {
  font-size: 9pt;
  font-weight: 700;
  margin-top: 1pt;
}
#${PORTAL_ID} .dt-address-label {
  font-size: 7.5pt;
  font-weight: 900;
  text-transform: uppercase;
  margin-top: 2pt;
  letter-spacing: 0.1em;
}
#${PORTAL_ID} .dt-address {
  font-size: 14pt;
  font-weight: 900;
  text-transform: uppercase;
  line-height: 1.1;
  margin-top: 0;
  word-wrap: break-word;
}
#${PORTAL_ID} .dt-item {
  display: flex;
  justify-content: space-between;
  gap: 4pt;
  margin: 1pt 0;
  font-size: 9pt;
  line-height: 1.2;
}
#${PORTAL_ID} .dt-item-name { font-weight: 700; flex: 1; }
#${PORTAL_ID} .dt-item-price {
  font-weight: 700;
  white-space: nowrap;
  font-variant-numeric: tabular-nums;
}
#${PORTAL_ID} .dt-totals-row {
  display: flex;
  justify-content: space-between;
  font-size: 9pt;
  margin: 1pt 0;
}
#${PORTAL_ID} .dt-total-row {
  display: flex;
  justify-content: space-between;
  font-size: 12pt;
  font-weight: 900;
  margin: 2pt 0 1pt;
}
#${PORTAL_ID} .dt-payment-frame {
  border: 2px solid #000;
  padding: 4pt;
  text-align: center;
  margin: 4pt 0 2pt;
}
#${PORTAL_ID} .dt-payment-headline {
  font-size: 13pt;
  font-weight: 900;
  line-height: 1.1;
  letter-spacing: 0.02em;
  word-wrap: break-word;
}
#${PORTAL_ID} .dt-payment-method {
  font-size: 10pt;
  font-weight: 900;
  text-transform: uppercase;
  margin-top: 2pt;
  letter-spacing: 0.1em;
}
`;

// Inyecta el <style> y el div portal una sola vez en document.body como hijos
// directos, para que el selector `body > *:not(#delivery-ticket-print)` del
// @media print pueda ocultar todo lo demás sin ambigüedad.
const ensureDomNodes = () => {
  if (typeof document === 'undefined') return null;
  let styleNode = document.getElementById(STYLE_ID);
  if (!styleNode) {
    styleNode = document.createElement('style');
    styleNode.id = STYLE_ID;
    styleNode.textContent = PRINT_CSS;
    document.head.appendChild(styleNode);
  }
  let portalNode = document.getElementById(PORTAL_ID);
  if (!portalNode) {
    portalNode = document.createElement('div');
    portalNode.id = PORTAL_ID;
    document.body.appendChild(portalNode);
  }
  return portalNode;
};

const DeliveryTicket = ({ order }) => {
  const portalRef = useRef(null);

  if (portalRef.current === null) {
    portalRef.current = ensureDomNodes();
  }

  useEffect(() => {
    return () => {
      const node = document.getElementById(PORTAL_ID);
      if (node) node.innerHTML = '';
    };
  }, []);

  if (!order || !portalRef.current) return null;

  const items = order.items || [];
  const shipping = order.precio_envio_snapshot || 0;
  const itemsTotal = items.reduce(
    (sum, item) => sum + (item.price || 0) * (item.quantity || 0),
    0
  );
  const total = order.totalAmount || itemsTotal + shipping;

  const paymentMethod = order.paymentMethod || order.forma_pago || '';
  const isCash = paymentMethod === FORMA_PAGO.CASH;
  const isTransfer = paymentMethod === FORMA_PAGO.TRANSFER;
  const isPaid = order.paymentStatus === PAYMENT_STATUS.PAID;

  let paymentHeadline;
  if (isCash && !isPaid) {
    paymentHeadline = `>>> COBRAR ${fmtPrice(total)} <<<`;
  } else if (isCash && isPaid) {
    paymentHeadline = '>>> YA COBRADO <<<';
  } else if (isTransfer) {
    paymentHeadline = '>>> PAGADO <<<';
  } else {
    paymentHeadline = isPaid ? '>>> PAGADO <<<' : `>>> COBRAR ${fmtPrice(total)} <<<`;
  }
  const paymentMethodLabel = (paymentMethod || '—').toUpperCase();

  const renderItem = (item, idx) => {
    const qty = item.quantity || 1;
    const hasPatty = item.hasMedallions !== false && item.pattyCount;
    const pattyLabel = hasPatty
      ? ` · ${MEDALLION_LABELS[item.pattyCount] || `${item.pattyCount}p`}${
          item.pattyCount > 1 ? ' MEDALLONES' : ' MEDALLÓN'
        }`
      : '';
    const lineTotal = (item.price || 0) * qty;
    return (
      <div key={idx} className="dt-item">
        <div className="dt-item-name">
          {qty}× {(item.productName || '').toUpperCase()}
          {pattyLabel}
        </div>
        <div className="dt-item-price">{fmtPrice(lineTotal)}</div>
      </div>
    );
  };

  const ticketContent = (
    <>
      <div className="dt-brand">DRIP BURGER</div>
      <hr className="dt-divider-heavy" />

      <div className="dt-meta">
        <div style={{ fontWeight: 900 }}>
          #{order.orderNumber || order.id}
        </div>
        <div>
          {formatDateTimeAr(order.created)}
          {order.deliveryTimeSlot && (
            <> · Entrega <strong>{order.deliveryTimeSlot}</strong></>
          )}
        </div>
      </div>

      <hr className="dt-divider-heavy" />

      <div className="dt-block">
        <div className="dt-customer-name">{order.customerName || '—'}</div>
        {order.customerPhone && (
          <div className="dt-phone">Tel: {order.customerPhone}</div>
        )}
        <div className="dt-address-label">Dirección</div>
        <div className="dt-address">{order.customerAddress || '—'}</div>
      </div>

      <hr className="dt-divider-heavy" />

      <div className="dt-block">
        {items.length === 0 ? (
          <div className="dt-meta">Sin ítems</div>
        ) : (
          items.map(renderItem)
        )}

        <hr className="dt-divider-light" />
        <div className="dt-totals-row">
          <span>Subtotal:</span>
          <span style={{ fontVariantNumeric: 'tabular-nums' }}>
            {fmtPrice(itemsTotal)}
          </span>
        </div>
        <div className="dt-totals-row">
          <span>Envío:</span>
          <span style={{ fontVariantNumeric: 'tabular-nums' }}>
            {fmtPrice(shipping)}
          </span>
        </div>
        <hr className="dt-divider-light" />
        <div className="dt-total-row">
          <span>TOTAL:</span>
          <span style={{ fontVariantNumeric: 'tabular-nums' }}>
            {fmtPrice(total)}
          </span>
        </div>
      </div>

      <div className="dt-payment-frame">
        <div className="dt-payment-headline">{paymentHeadline}</div>
        <div className="dt-payment-method">{paymentMethodLabel}</div>
      </div>
    </>
  );

  return createPortal(ticketContent, portalRef.current);
};

export default DeliveryTicket;
