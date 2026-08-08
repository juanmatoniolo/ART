const normalize = (value = '') =>
  String(value)
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]/g, '');

// Mapa: clave normalizada -> ruta del archivo
const imageMap = {
  // ASOCIART
  'asociart': '/img-art/ASOCIART.png',

  // COMFYE / CONFYE
  'comfye': '/img-art/COMFYE.png',
  'confye': '/img-art/COMFYE.png',
  'comyfe': '/img-art/COMFYE.png',

  // FED. PATRONAL
  'federacionpatronalap': '/img-art/FEDPATRONAL-AP.png',
  'fedpatronalap': '/img-art/FEDPATRONAL-AP.png',
  'fedpatronal': '/img-art/FEDPATRONAL-AP.png',
  'federacionpatronalart': '/img-art/FPART.png',
  'fedpatronalart': '/img-art/FPART.png',
  'fpart': '/img-art/FPART.png',

  // IAPS - específicos primero
  'iapsap': '/img-art/IAPS-AP.png',        // Para "IAPS AP" (Accidentes Personales)
  'iapsart': '/img-art/IAPSART.png',       // Para "IAPS ART"
  'iapser': '/img-art/IAPS-AP.png',        // IAPSER SEGUROS (normalmente es AP)
  'iapsseguros': '/img-art/IAPS-AP.png',
  'iaps': '/img-art/IAPSART.png',          // genérico IAPS, pero con menor prioridad

  // LA SEGUNDA
  'lasegundaart': '/img-art/LASEGUNDAART.png',
  'lasegunda': '/img-art/LASEGUNDA.webp',
  'lasegundaap': '/img-art/LASEGUNDA.png',

  // MEDICAL WORK
  'medicalwork': '/img-art/MEDICARWOR.png',
  'medicarwork': '/img-art/MEDICARWOR.png',
  'medicarwor': '/img-art/MEDICARWOR.png',

  // VICTORIA (archivo renombrado a VICOTRIA-ART.png)
  'victoriaart': '/img-art/VICOTRIA-ART.png',
  'victoriaseguro': '/img-art/VICOTRIA-ART.png',
  'victoriaseguros': '/img-art/VICOTRIA-ART.png',
  'victoria': '/img-art/VICOTRIA-ART.png',

  // RECONQUISTA (archivo renombrado a RECONQUISTA-ART.png)
  'reconquista': '/img-art/RECONQUISTA-ART.png',
  'reconquistaart': '/img-art/RECONQUISTA-ART.png',
};

// Función que prioriza claves más largas (específicas)
const getArtImage = (artName) => {
  if (typeof window === 'undefined') return '/img-art/default.webp';

  const raw = String(artName || '').trim();
  if (!raw || raw.toLowerCase() === 'sinart') {
    return '/img-art/default.webp';
  }

  const normalized = normalize(raw);

  // 1. Coincidencia exacta
  if (imageMap[normalized]) {
    return imageMap[normalized];
  }

  // 2. Coincidencia por inclusión, ordenando las claves por longitud descendente
  const sortedKeys = Object.keys(imageMap).sort((a, b) => b.length - a.length);
  for (const key of sortedKeys) {
    if (normalized.includes(key) || key.includes(normalized)) {
      return imageMap[key];
    }
  }

  console.warn('Logo no mapeado:', { artName: raw, normalized });
  return '/img-art/default.webp';
};

export default getArtImage;