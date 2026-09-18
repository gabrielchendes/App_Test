import { VercelRequest, VercelResponse } from '@vercel/node';
import fs from 'fs';
import path from 'path';
import { createClient } from '@supabase/supabase-js';

const DATA_DIR = path.join(process.cwd(), 'data');
const TESTIMONIALS_FILE = path.join(DATA_DIR, 'testimonials.json');

const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || '';
const supabaseAnonKey = process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY || '';
const supabase = (supabaseUrl && supabaseAnonKey) 
  ? createClient(supabaseUrl, supabaseAnonKey, { auth: { persistSession: false } }) 
  : null;

export interface TestimonialItem {
  id: string;
  user_name: string;
  user_email?: string;
  user_avatar?: string;
  course_id?: string;
  course_title?: string;
  rating: number;
  headline?: string;
  content: string;
  image_url?: string;
  status: 'pending' | 'approved' | 'rejected';
  is_read: boolean;
  consent: boolean;
  created_at: string;
  approved_at?: string;
}

const INITIAL_SEED_TESTIMONIALS: TestimonialItem[] = [
  {
    id: 'seed-story-1',
    user_name: 'Camila Mendonça',
    user_email: 'camila.m@example.com',
    user_avatar: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=300&q=80',
    course_title: 'Maternidade Plena',
    rating: 5,
    headline: 'Found complete peace and confidence in my daily routine',
    content: 'This program was a turning point for me. Before joining, I was feeling completely overwhelmed and doubting myself as a mother every single day. The lessons gave me practical tools, emotional clarity, and a supportive perspective that transformed our home. Truly grateful to have found this space!',
    status: 'approved',
    is_read: true,
    consent: true,
    created_at: '2026-09-12T14:30:00Z'
  },
  {
    id: 'seed-story-2',
    user_name: 'Beatriz Vasconcelos',
    user_email: 'beatriz.v@example.com',
    user_avatar: 'https://images.unsplash.com/photo-1544005313-94ddf0286df2?auto=format&fit=crop&w=300&q=80',
    course_title: 'Desenvolvimento Infantil & Afeto',
    rating: 5,
    headline: 'The clarity and practical guidance made all the difference',
    content: 'Every lesson felt like it was made specifically for what I was going through. The scientific backing combined with warm, empathetic delivery is unlike anything else. Seeing my baby thrive while feeling calm and grounded myself is priceless. Thank you so much!',
    status: 'approved',
    is_read: true,
    consent: true,
    created_at: '2026-09-08T10:15:00Z'
  },
  {
    id: 'seed-story-3',
    user_name: 'Juliana Rocha',
    user_email: 'juliana.r@example.com',
    user_avatar: 'https://images.unsplash.com/photo-1517841905240-472988babdf9?auto=format&fit=crop&w=300&q=80',
    course_title: 'Cuidado & Bem-Estar da Mulher',
    rating: 5,
    headline: 'I reconnected with myself while being the best mother I can be',
    content: 'As women, we often put ourselves last. This experience reminded me that caring for myself is essential to caring for my family. The community, the expert guidance, and the step-by-step videos gave me back my energy and enthusiasm. Recommending this to all mothers I know!',
    status: 'approved',
    is_read: true,
    consent: true,
    created_at: '2026-09-02T18:40:00Z'
  }
];

function ensureDataFile(): TestimonialItem[] {
  try {
    if (!fs.existsSync(DATA_DIR)) {
      fs.mkdirSync(DATA_DIR, { recursive: true });
    }
    if (!fs.existsSync(TESTIMONIALS_FILE)) {
      fs.writeFileSync(TESTIMONIALS_FILE, JSON.stringify(INITIAL_SEED_TESTIMONIALS, null, 2), 'utf-8');
      return [...INITIAL_SEED_TESTIMONIALS];
    }
    const content = fs.readFileSync(TESTIMONIALS_FILE, 'utf-8');
    if (!content.trim()) {
      fs.writeFileSync(TESTIMONIALS_FILE, JSON.stringify(INITIAL_SEED_TESTIMONIALS, null, 2), 'utf-8');
      return [...INITIAL_SEED_TESTIMONIALS];
    }
    const parsed = JSON.parse(content);
    return Array.isArray(parsed) ? parsed : [...INITIAL_SEED_TESTIMONIALS];
  } catch (err) {
    console.error('[Testimonials API] File read error, using seeds:', err);
    return [...INITIAL_SEED_TESTIMONIALS];
  }
}

function saveToFile(items: TestimonialItem[]): void {
  try {
    if (!fs.existsSync(DATA_DIR)) {
      fs.mkdirSync(DATA_DIR, { recursive: true });
    }
    fs.writeFileSync(TESTIMONIALS_FILE, JSON.stringify(items, null, 2), 'utf-8');
  } catch (err) {
    console.error('[Testimonials API] Error saving to file:', err);
  }
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  const items = ensureDataFile();

  if (req.method === 'GET') {
    const statusQuery = req.query.status as string | undefined;
    const allQuery = req.query.all as string | undefined;

    // Filter by status if requested (e.g. status=approved for student page)
    if (statusQuery) {
      const filtered = items.filter(item => {
        if (item.status !== statusQuery) return false;
        // Never share testimonials where consent was not granted publicly
        if (statusQuery === 'approved' && item.consent === false) return false;
        return true;
      });
      return res.status(200).json(filtered);
    }

    // Default or all=true returns all testimonials (for Admin Panel)
    return res.status(200).json(items);
  }

  if (req.method === 'POST') {
    const { action, testimonial, id, status, is_read } = req.body || {};

    // 1. Create a new testimonial
    if (action === 'create' || (!action && testimonial)) {
      const newTestimonial: TestimonialItem = {
        id: testimonial.id || ('t_' + Date.now() + '_' + Math.random().toString(36).substring(2, 7)),
        user_name: testimonial.user_name || 'Anonymous',
        user_email: testimonial.user_email || undefined,
        user_avatar: testimonial.user_avatar || undefined,
        course_id: testimonial.course_id || undefined,
        course_title: testimonial.course_title || 'General',
        rating: Number(testimonial.rating) || 5,
        headline: testimonial.headline || undefined,
        content: testimonial.content || '',
        image_url: testimonial.image_url || undefined,
        status: testimonial.status || 'pending',
        is_read: testimonial.is_read !== undefined ? testimonial.is_read : false,
        consent: testimonial.consent !== undefined ? testimonial.consent : true,
        created_at: testimonial.created_at || new Date().toISOString()
      };

      // Add to top of list
      items.unshift(newTestimonial);
      saveToFile(items);

      // Attempt Supabase insert if table exists
      if (supabase) {
        try {
          await supabase.from('testimonials').insert(newTestimonial);
        } catch (e) {
          // ignore table not found
        }
      }

      return res.status(201).json({ success: true, item: newTestimonial });
    }

    // 2. Update testimonial content / details
    if (action === 'update') {
      const updated = req.body.testimonial || {};
      const targetId = updated.id || id || req.body.id;
      const index = items.findIndex(t => t.id === targetId);
      if (index === -1) {
        return res.status(404).json({ error: 'Testimonial not found' });
      }

      items[index] = {
        ...items[index],
        user_name: updated.user_name !== undefined ? updated.user_name : items[index].user_name,
        user_email: updated.user_email !== undefined ? updated.user_email : items[index].user_email,
        user_avatar: updated.user_avatar !== undefined ? updated.user_avatar : items[index].user_avatar,
        course_title: updated.course_title !== undefined ? updated.course_title : items[index].course_title,
        rating: Number(updated.rating) || items[index].rating,
        headline: updated.headline !== undefined ? updated.headline : items[index].headline,
        content: updated.content !== undefined ? updated.content : items[index].content,
        image_url: updated.image_url !== undefined ? updated.image_url : items[index].image_url,
        status: updated.status || items[index].status,
        consent: updated.consent !== undefined ? Boolean(updated.consent) : items[index].consent,
        is_read: updated.is_read !== undefined ? Boolean(updated.is_read) : items[index].is_read
      };

      if (items[index].status === 'approved' && !items[index].approved_at) {
        items[index].approved_at = new Date().toISOString();
      }

      saveToFile(items);

      if (supabase) {
        try {
          await supabase.from('testimonials').update(items[index]).eq('id', targetId);
        } catch (e) {}
      }

      return res.status(200).json({ success: true, item: items[index] });
    }

    // 3. Reorder testimonials (Admin custom ordering)
    if (action === 'reorder') {
      const { orderedIds } = req.body;
      if (Array.isArray(orderedIds) && orderedIds.length > 0) {
        const idMap = new Map(items.map(t => [t.id, t]));
        const reordered: TestimonialItem[] = [];

        orderedIds.forEach(targetId => {
          const item = idMap.get(targetId);
          if (item) {
            reordered.push(item);
            idMap.delete(targetId);
          }
        });

        // Add any remaining items that weren't in orderedIds
        idMap.forEach(remaining => {
          reordered.push(remaining);
        });

        items.length = 0;
        items.push(...reordered);
        saveToFile(items);

        return res.status(200).json({ success: true, count: items.length });
      }
      return res.status(400).json({ error: 'Missing or invalid orderedIds array' });
    }

    // 4. Update status (approve / reject / set pending)
    if (action === 'update-status' || status) {
      const targetId = id || req.body.id;
      const targetStatus = (status || req.body.status) as 'pending' | 'approved' | 'rejected';

      const index = items.findIndex(t => t.id === targetId);
      if (index === -1) {
        return res.status(404).json({ error: 'Testimonial not found' });
      }

      items[index].status = targetStatus;
      if (targetStatus === 'approved') {
        items[index].approved_at = new Date().toISOString();
      }
      saveToFile(items);

      if (supabase) {
        try {
          await supabase.from('testimonials').update({ status: targetStatus }).eq('id', targetId);
        } catch (e) {}
      }

      return res.status(200).json({ success: true, item: items[index] });
    }

    // 3. Mark read / unread
    if (action === 'mark-read' || is_read !== undefined) {
      const targetId = id || req.body.id;
      const targetRead = is_read !== undefined ? is_read : true;

      const index = items.findIndex(t => t.id === targetId);
      if (index !== -1) {
        items[index].is_read = targetRead;
        saveToFile(items);

        if (supabase) {
          try {
            await supabase.from('testimonials').update({ is_read: targetRead }).eq('id', targetId);
          } catch (e) {}
        }
      }

      return res.status(200).json({ success: true });
    }

    // 4. Delete testimonial
    if (action === 'delete') {
      const targetId = id || req.body.id;
      const filtered = items.filter(t => t.id !== targetId);
      saveToFile(filtered);

      if (supabase) {
        try {
          await supabase.from('testimonials').delete().eq('id', targetId);
        } catch (e) {}
      }

      return res.status(200).json({ success: true });
    }

    return res.status(400).json({ error: 'Unknown action' });
  }

  if (req.method === 'DELETE') {
    const targetId = (req.query.id as string) || req.body?.id;
    if (!targetId) {
      return res.status(400).json({ error: 'Missing ID' });
    }
    const filtered = items.filter(t => t.id !== targetId);
    saveToFile(filtered);

    if (supabase) {
      try {
        await supabase.from('testimonials').delete().eq('id', targetId);
      } catch (e) {}
    }

    return res.status(200).json({ success: true });
  }

  return res.status(405).json({ error: 'Method not allowed' });
}
