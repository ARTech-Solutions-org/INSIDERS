// Vercel serverless entry point (plain JavaScript — no TypeScript compilation needed).
// The real app is bundled by vercel-build (esbuild) into _vercel_build/vercel.mjs.
export default async function handler(req, res) {
  const { default: app } = await import('../_vercel_build/vercel.mjs');
  return app(req, res);
}
