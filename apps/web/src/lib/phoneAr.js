// Normalizador de teléfonos argentinos para WhatsApp.
// Idéntico al de apps/api/src/services/whatsappService.js.
// Output: 13 dígitos en formato `549` + área (2-4) + número (8-6) = 10 dígitos.
//
// Acepta cualquier formato de input común: con/sin +54, con/sin 9, con/sin 0,
// con/sin "15" móvil legacy, con espacios/guiones/paréntesis.

export const normalizePhone = (phone) => {
  if (!phone) return '';

  let digits = String(phone).replace(/[^0-9]/g, '');

  let hasCountryCode = false;
  if (digits.startsWith('54')) {
    digits = digits.slice(2);
    hasCountryCode = true;
  }

  // El "9" móvil de WhatsApp se inserta al final, así que si vino lo sacamos
  // para evitar duplicar.
  if (hasCountryCode && digits.startsWith('9')) {
    digits = digits.slice(1);
  }

  // Strip 0 inicial (interurbano viejo).
  if (digits.startsWith('0')) {
    digits = digits.slice(1);
  }

  // Strip "15" móvil legacy: si después del código de área aparece "15"
  // y queda un número de 10 dígitos al sacarlo, lo removemos.
  const areaLengths = [2, 3, 4];
  for (const al of areaLengths) {
    if (
      digits.length >= al + 2 &&
      digits.substr(al, 2) === '15' &&
      digits.length - 2 >= 10
    ) {
      digits = digits.slice(0, al) + digits.slice(al + 2);
      break;
    }
  }

  return `549${digits}`;
};

// Validación: AR mobile WA format = 549 + 10 dígitos = 13 chars total
export const isValidPhone = (normalized) =>
  /^549\d{10}$/.test(normalized || '');

// Formato de preview legible: +54 9 342 555 1234
// Ajusta para áreas de 2/3/4 dígitos comunes.
export const formatPreview = (normalized) => {
  if (!normalized || !normalized.startsWith('549')) return '';
  const rest = normalized.slice(3); // 10 dígitos esperados
  if (rest.length < 6) return `+54 9 ${rest}`;

  // Heurística de área:
  //   3 dígitos para la mayoría de provincias (342 Santa Fe, 343 Paraná, etc.)
  //   2 dígitos para CABA (11)
  //   4 dígitos en algunos partidos (2241 Chascomús, etc.)
  let area, num;
  if (rest.startsWith('11')) {
    area = rest.slice(0, 2);
    num = rest.slice(2);
  } else {
    area = rest.slice(0, 3);
    num = rest.slice(3);
  }

  // Número en bloques de 3-4-X según largo
  const part1 = num.slice(0, num.length - 4);
  const part2 = num.slice(num.length - 4);
  return `+54 9 ${area} ${part1}${part2 ? ' ' + part2 : ''}`.trim();
};
