// Detección local de zona de envío para Coronda, Santa Fe.
// Sin APIs externas — parseo por nombre de calle + rango de altura.
//
// Rectángulo del casco céntrico:
//   Norte: General López      Sur: Hipólito Yrigoyen
//   Oeste: Lisandro de la Torre   Este: Av. Héctor López
//
// Dentro del rectángulo:
//   Calles HORIZONTALES (E-O): altura 1000 (Av. H. López) → 1900 (L. de la Torre)
//   Calles VERTICALES  (N-S): altura 1300 (Gral. López)   → 2400 (H. Yrigoyen)

export const STREETS_CORONDA = {
  horizontales: [
    'general lopez', // límite norte
    'saavedra',
    'eva peron',
    'falucho',
    'pringles',
    '9 de julio',
    '25 de mayo',
    'san martin',
    'san jeronimo',
    'moreno',
    'mitre',
    'italia',
    'fray m esquiu',
    'fray mamerto esquiu',
    'hipolito yrigoyen', // límite sur
    'hipolito irigoyen',
    'yrigoyen',
    'irigoyen',
    'almafuerte',
    'cervantes',
  ],
  verticales: [
    'lisandro de la torre', // límite oeste
    'sarah zabala',
    'luciano molinas',
    'chizzini melo',
    'santo tome',
    'maciel',
    'almte brown',
    'almirante brown',
    'brown',
    'arocena',
    'bv orono',
    'bulevar orono',
    'orono',
    'belgrano',
    'guemes',
    'garay',
    'juan de garay',
    'sarmiento',
    'rivadavia',
    'alberdi',
    'derqui',
    'av hector lopez', // límite este
    'hector lopez',
    'lopez',
  ],
};

export const RANGO_HORIZONTAL = { min: 1000, max: 1900 };
export const RANGO_VERTICAL = { min: 1300, max: 2400 };

export function normalizarDireccion(direccion) {
  if (!direccion || typeof direccion !== 'string') return null;

  let texto = direccion
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[.,]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  texto = texto.replace(/^(av|avenida|calle|pje|pasaje|bv|bulevar)\s+/i, '');

  const matchAltura = texto.match(/\b(\d{2,4})\b/);
  const altura = matchAltura ? parseInt(matchAltura[1], 10) : null;

  const nombreCalle = texto.replace(/\b\d+\b/g, '').replace(/\s+/g, ' ').trim();

  return { nombreCalle, altura };
}

export function determinarZona(direccion) {
  const parsed = normalizarDireccion(direccion);
  if (!parsed || !parsed.nombreCalle || !parsed.altura) {
    return 'alejada';
  }

  const { nombreCalle, altura } = parsed;

  const matchCalle = (lista) =>
    lista.some((c) => nombreCalle.includes(c) || c.includes(nombreCalle));

  if (matchCalle(STREETS_CORONDA.horizontales)) {
    return altura >= RANGO_HORIZONTAL.min && altura <= RANGO_HORIZONTAL.max
      ? 'centro'
      : 'alejada';
  }

  if (matchCalle(STREETS_CORONDA.verticales)) {
    return altura >= RANGO_VERTICAL.min && altura <= RANGO_VERTICAL.max
      ? 'centro'
      : 'alejada';
  }

  return 'alejada';
}
