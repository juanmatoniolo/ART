/** @type {import('next').NextConfig} */
const nextConfig = {
  // Las firmas viven fuera de public/ (datos sensibles): se incluyen solo en la
  // función de la API que las entrega con sesión y rol (src/app/api/firmas).
  outputFileTracingIncludes: {
    "/api/firmas/[archivo]": ["./src/private/firmas/**/*"],
  },
};

export default nextConfig;
