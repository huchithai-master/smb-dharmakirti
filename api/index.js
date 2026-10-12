// Satu fungsi serverless untuk semua endpoint /api/* (lihat rewrites di vercel.json).
import { tanganiApi } from '../lib/app.js';

export default function handler(req, res) {
  return tanganiApi(req, res);
}
