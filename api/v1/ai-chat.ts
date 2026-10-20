import type { VercelRequest, VercelResponse } from '@vercel/node';
import { handleAiChat } from '../_ai/chat';

function parseRequestBody(req: VercelRequest): Record<string, any> {
  let body = req.body;
  if (!body) return {};
  if (typeof body === 'string') {
    try {
      return JSON.parse(body);
    } catch {
      return {};
    }
  }
  if (Buffer.isBuffer(body)) {
    try {
      return JSON.parse(body.toString('utf8'));
    } catch {
      return {};
    }
  }
  return typeof body === 'object' ? body : {};
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Requested-With, Accept');
  res.setHeader('Content-Type', 'application/json; charset=utf-8');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  // Normalize request body for POST requests
  if (req.method === 'POST') {
    req.body = parseRequestBody(req);
  }

  try {
    return await handleAiChat(req, res);
  } catch (err: any) {
    console.error('[AI Chat Handler Uncaught Error]:', err?.message || err);
    if (!res.headersSent) {
      return res.status(200).json({
        success: false,
        reply: null,
        message: "Victoria is currently preparing her consultation room. Please try asking again in just a moment! 💕",
        isHighDemand: true,
        details: err?.message || String(err || '')
      });
    }
  }
}
