import type { VercelRequest, VercelResponse } from '@vercel/node';
import { handleAiChat } from '../_ai/chat';

// Vercel serverless execution limit
export const maxDuration = 10;

export default async function handler(req: VercelRequest, res: VercelResponse) {
  return handleAiChat(req, res);
}
