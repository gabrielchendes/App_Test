import type { VercelRequest, VercelResponse } from '@vercel/node';
import fs from 'fs';
import path from 'path';

const supabaseUrl = 
  process.env.SUPABASE_URL || 
  process.env.VITE_SUPABASE_URL || 
  '';

const supabaseAnonKey = 
  process.env.SUPABASE_ANON_KEY || 
  process.env.VITE_SUPABASE_ANON_KEY || 
  '';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  try {
    let localOverride: any = {};
    try {
      const settingsPath = path.join(process.cwd(), 'data', 'app_settings.json');
      if (fs.existsSync(settingsPath)) {
        localOverride = JSON.parse(fs.readFileSync(settingsPath, 'utf-8'));
      }
    } catch (e) {
      console.warn('[Vercel Settings API] Error reading local settings file:', e);
    }

    let dbSettings: any = {};
    if (supabaseUrl && supabaseAnonKey) {
      try {
        const resp = await fetch(`${supabaseUrl}/rest/v1/app_settings?id=eq.1&limit=1`, {
          headers: {
            apikey: supabaseAnonKey,
            Authorization: `Bearer ${supabaseAnonKey}`
          },
          signal: AbortSignal.timeout(4000)
        });
        if (resp.ok) {
          const data = await resp.json();
          if (data?.[0]) {
            dbSettings = data[0];
          }
        }
      } catch (err) {
        console.warn('[Vercel Settings API] Note fetching remote settings:', err);
      }
    }

    const merged = {
      ...dbSettings,
      ...localOverride,
      custom_texts: {
        ...(dbSettings.custom_texts || {}),
        ...(localOverride.custom_texts || {})
      }
    };

    if (merged.favicon_url && merged.favicon_url.includes('LogoMT.png')) {
      merged.favicon_url = merged.favicon_url.replace('LogoMT.png', 'LogoMTiPhone.png');
    }
    if (merged.custom_texts?.['config.favicon_url'] && merged.custom_texts['config.favicon_url'].includes('LogoMT.png')) {
      merged.custom_texts['config.favicon_url'] = merged.custom_texts['config.favicon_url'].replace('LogoMT.png', 'LogoMTiPhone.png');
    }
    if (merged.custom_texts?.['auth.platform_name'] !== undefined) {
      merged.login_platform_name = merged.custom_texts['auth.platform_name'];
    }

    res.setHeader('Cache-Control', 'no-cache, must-revalidate');
    return res.status(200).json(merged);
  } catch (error: any) {
    return res.status(500).json({ error: error.message || 'Internal server error' });
  }
}
