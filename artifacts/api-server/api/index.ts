// Vercel serverless entry point.
// @vercel/node wraps this exported Express app as a serverless function.
// We do NOT call app.listen() here — Vercel handles that internally.
import app from '../src/app';

export default app;
