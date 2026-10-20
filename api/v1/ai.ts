import type { VercelRequest, VercelResponse } from '@vercel/node';
import { handleAiChat } from './ai-chat';

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
  res.setHeader('Access-Control-Allow-Methods', 'POST,GET,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Requested-With, Accept');
  res.setHeader('Content-Type', 'application/json; charset=utf-8');

  if (req.method === 'OPTIONS') return res.status(200).end();

  // Normalize request body so downstream handlers receive an object
  req.body = parseRequestBody(req);

  const url = req.url || '';
  const queryAction = req.query?.action as string;
  const pathParts = url.split('?')[0].split('/');
  const lastPath = pathParts[pathParts.length - 1];
  const urlAction = lastPath === 'ai' ? '' : lastPath;
  const bodyAction = req.body?.action as string;

  let action = queryAction || urlAction || bodyAction;

  if (action) {
    action = action.toLowerCase().trim();
  }

  try {
    switch (action) {
      case 'ai-chat':
      case 'chat':
        return await handleAiChat(req, res);

      case 'ai-course-editor':
      case 'course-editor':
      case 'course_editor': {
        const { handleAiCourseEditor } = await import('../_ai/courseEditor');
        return await handleAiCourseEditor(req, res);
      }

      case 'analyze-message':
      case 'analyze':
      case 'message-analyzer': {
        const { handleAnalyzeMessage } = await import('../_ai/analyzeMessage');
        return await handleAnalyzeMessage(req, res);
      }

      case 'build-complete-course':
      case 'build-course':
      case 'build_course': {
        const { handleBuildCompleteCourse } = await import('../_ai/buildCourse');
        return await handleBuildCompleteCourse(req, res);
      }

      case 'generate-course-copy':
      case 'course-copy':
      case 'course_copy': {
        const { handleGenerateCourseCopy } = await import('../_ai/courseCopy');
        return await handleGenerateCourseCopy(req, res);
      }

      case 'generate-lesson':
      case 'lesson':
      case 'generate_lesson': {
        const { handleGenerateLesson } = await import('../_ai/generateLesson');
        return await handleGenerateLesson(req, res);
      }

      case 'refine-sales-copy':
      case 'refine-copy':
      case 'refine_copy': {
        const { handleRefineSalesCopy } = await import('../_ai/refineCopy');
        return await handleRefineSalesCopy(req, res);
      }

      default:
        // Default to ai-chat if body contains messages
        if (Array.isArray(req.body?.messages)) {
          return await handleAiChat(req, res);
        }
        return res.status(400).json({
          error: `Invalid or missing AI action: "${action}". Supported actions: ai-chat, ai-course-editor, analyze-message, build-complete-course, generate-course-copy, generate-lesson, refine-sales-copy.`
        });
    }
  } catch (error: any) {
    console.error(`[AI Router Error] Action "${action}":`, error);
    if (!res.headersSent) {
      return res.status(200).json({
        success: false,
        reply: null,
        message: "Victoria is currently preparing her consultation room. Please try asking again in just a moment! 💕",
        isHighDemand: true,
        details: error?.message || String(error || '')
      });
    }
  }
}
