// Satu fungsi serverless untuk semua endpoint /api/*.
import { tanganiApi } from '../lib/app.js';

export default function handler(req, res) {
  return tanganiApi(req, res);
}
