// lib/artImages.js

const normalize = (value = '') =>
  String(value)
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]/g, '');

// Mapa: clave normalizada -> ruta del archivo (relativa desde public)
const imageMap = {
  // ASOCIART
  'asociart': '/img-art/ASOCIART.png',

  // COMFYE / CONFYE
  'comfye': '/img-art/COMFYE.png',
  'confye': '/img-art/COMFYE.png',
  'comyfe': '/img-art/COMFYE.png',

  // FED. PATRONAL AP
  'federacionpatronalap': '/img-art/FEDPATRONAL-AP.png',
  'fedpatronalap': '/img-art/FEDPATRONAL-AP.png',
  'fedpatronal': '/img-art/FEDPATRONAL-AP.png',

  // FED. PATRONAL ART (FPART)
  'federacionpatronalart': '/img-art/FPART.png',
  'fedpatronalart': '/img-art/FPART.png',
  'fpart': '/img-art/FPART.png',

  // IAPS ART (la ART propiamente dicha)
  'iapsart': '/img-art/IAPSART.png',

  // IAPS AP (accidentes personales)
  'iaps': '/img-art/IAPS-AP.png',
  'iapser': '/img-art/IAPS-AP.png',
  'iapsseguros': '/img-art/IAPS-AP.png',

  // LA SEGUNDA ART
  'lasegundaart': '/img-art/LASEGUNDAART.png',

  // LA SEGUNDA AP
  'lasegunda': '/img-art/LASEGUNDA.webp', // o .png
  'lasegundaap': '/img-art/LASEGUNDA.png',

  // MEDICAL WORK
  'medicalwork': '/img-art/MEDICARWOR.png',
  'medicarwork': '/img-art/MEDICARWOR.png',
  'medicarwor': '/img-art/MEDICARWOR.png',

  // VICTORIA (archivo renombrado a VICOTRIA-ART.png o victoriaart.png)
  'victoriaart': '/img-art/victoriaart.png',
  'victoriaseguro': '/img-art/victoriaart.png',
  'victoriaseguros': '/img-art/victoriaart.png',
  'victoria': '/img-art/victoriaart.png',

  // RECONQUISTA (archivo renombrado a RECONQUISTA-ART.png)
  'reconquista': '/img-art/RECONQUISTA-ART.png',
  'reconquistaart': '/img-art/RECONQUISTA-ART.png',
};

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

  // 2. Coincidencia por inclusión
  for (const [key, path] of Object.entries(imageMap)) {
    if (normalized.includes(key) || key.includes(normalized)) {
      return path;
    }
  }

  console.warn('Logo no mapeado:', { artName: raw, normalized });
  return '/img-art/default.webp';
};

export default getArtImage;