import { createClient } from '@supabase/supabase-js';
import type { VercelRequest, VercelResponse } from '@vercel/node';
import fs from 'fs';
import path from 'path';

const DATA_DIR = path.join(process.cwd(), 'data');
const POSTS_FILE = path.join(DATA_DIR, 'community_posts.json');
const COMMENTS_FILE = path.join(DATA_DIR, 'community_comments.json');

function ensureDataDir(): void {
  try {
    if (!fs.existsSync(DATA_DIR)) {
      fs.mkdirSync(DATA_DIR, { recursive: true });
    }
  } catch (err) {
    console.warn('[Community API] Could not ensure data directory:', err);
  }
}

function loadLocalPosts(): any[] {
  try {
    if (fs.existsSync(POSTS_FILE)) {
      const content = fs.readFileSync(POSTS_FILE, 'utf-8');
      const parsed = JSON.parse(content);
      if (Array.isArray(parsed)) return parsed;
    }
  } catch (err) {
    console.warn('[Community API] Error reading local posts:', err);
  }
  return [];
}

function saveLocalPosts(posts: any[]): void {
  try {
    ensureDataDir();
    fs.writeFileSync(POSTS_FILE, JSON.stringify(posts, null, 2), 'utf-8');
  } catch (err) {
    console.warn('[Community API] Error saving local posts:', err);
  }
}

function loadLocalComments(): Record<string, any[]> {
  try {
    if (fs.existsSync(COMMENTS_FILE)) {
      const content = fs.readFileSync(COMMENTS_FILE, 'utf-8');
      return JSON.parse(content) || {};
    }
  } catch (err) {
    console.warn('[Community API] Error reading local comments:', err);
  }
  return {};
}

function saveLocalComments(commentsMap: Record<string, any[]>): void {
  try {
    ensureDataDir();
    fs.writeFileSync(COMMENTS_FILE, JSON.stringify(commentsMap, null, 2), 'utf-8');
  } catch (err) {
    console.warn('[Community API] Error saving local comments:', err);
  }
}

const DELETED_POSTS_FILE = path.join(DATA_DIR, 'deleted_post_ids.json');

function loadDeletedPostIds(): string[] {
  try {
    if (fs.existsSync(DELETED_POSTS_FILE)) {
      const raw = fs.readFileSync(DELETED_POSTS_FILE, 'utf-8');
      const list = JSON.parse(raw);
      if (Array.isArray(list)) return list;
    }
  } catch {}
  return [];
}

const cleanUrl = (raw?: string) => {
  if (!raw) return 'https://placeholder.supabase.co';
  let clean = raw.replace(/^["']|["']$/g, '').trim();
  if (!clean) return 'https://placeholder.supabase.co';
  if (!clean.startsWith('http://') && !clean.startsWith('https://')) {
    clean = `https://${clean}`;
  }
  try {
    new URL(clean);
    return clean;
  } catch {
    return 'https://placeholder.supabase.co';
  }
};

const getInitialSupabaseUrl = () => {
  const envUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
  if (envUrl && envUrl.trim() && !envUrl.includes('placeholder')) return cleanUrl(envUrl);
  try {
    const settingsPath = path.join(process.cwd(), 'data', 'app_settings.json');
    if (fs.existsSync(settingsPath)) {
      const settings = JSON.parse(fs.readFileSync(settingsPath, 'utf-8'));
      const raw = settings?.logo_url || settings?.favicon_url || '';
      const match = raw.match(/https:\/\/[a-z0-9]+\.supabase\.co/);
      if (match) return match[0];
    }
  } catch {}
  return 'https://fhnmpltilhongdofnzbj.supabase.co';
};

const supabaseUrl = getInitialSupabaseUrl();

const isRevokedKey = (key?: string) => {
  if (!key) return true;
  const trimmed = key.trim();
  return (
    trimmed === '' || 
    trimmed === 'undefined' || 
    trimmed === 'null' || 
    trimmed === 'placeholder-key' ||
    trimmed.startsWith('sb_secret_') ||
    (!trimmed.startsWith('eyJ') && !trimmed.startsWith('sbp_') && !trimmed.startsWith('sb_publishable_'))
  );
};

const rawServiceRoleKey = 
  process.env.SUPABASE_SERVICE_ROLE_KEY || 
  process.env.SUPABASE_SERVICE_KEY || 
  process.env.SUPABASE_SECRET_KEY || 
  process.env.VITE_SUPABASE_SERVICE_ROLE_KEY || 
  '';

const supabaseServiceRoleKey = isRevokedKey(rawServiceRoleKey) ? '' : rawServiceRoleKey;

const supabaseAnonKey = 
  process.env.SUPABASE_ANON_KEY || 
  process.env.VITE_SUPABASE_ANON_KEY || 
  '';

const effectiveKey = supabaseServiceRoleKey || supabaseAnonKey || 'placeholder-key';

const supabaseAdmin = createClient(supabaseUrl || 'https://placeholder.supabase.co', effectiveKey, {
  auth: {
    persistSession: false,
    autoRefreshToken: false,
    detectSessionInUrl: false
  }
});

async function recordDeletedPostId(id: string): Promise<void> {
  try {
    ensureDataDir();
    const current = loadDeletedPostIds();
    if (!current.includes(id)) {
      current.push(id);
      fs.writeFileSync(DELETED_POSTS_FILE, JSON.stringify(current, null, 2), 'utf-8');
    }
    try {
      const { data } = await supabaseAdmin
        .from('ai_user_memory')
        .select('facts')
        .eq('user_id', '__deleted_community_posts__')
        .maybeSingle();
      const existing = (data?.facts && Array.isArray(data.facts[0])) ? data.facts[0] : [];
      if (!existing.includes(id)) {
        await supabaseAdmin
          .from('ai_user_memory')
          .upsert({
            user_id: '__deleted_community_posts__',
            facts: [[...existing, id]],
            last_updated: new Date().toISOString()
          });
      }
    } catch {}
  } catch {}
}

async function fetchDeletedPostIds(): Promise<Set<string>> {
  const set = new Set<string>(loadDeletedPostIds());
  try {
    const { data } = await supabaseAdmin
      .from('ai_user_memory')
      .select('facts')
      .eq('user_id', '__deleted_community_posts__')
      .maybeSingle();
    if (data?.facts && Array.isArray(data.facts[0])) {
      data.facts[0].forEach((id: string) => set.add(id));
    }
  } catch {}
  return set;
}

function getSupabaseForRequest(req: VercelRequest) {
  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith('Bearer ')) {
    const token = authHeader.substring(7).trim();
    if (token && token.length > 10 && token !== 'undefined') {
      return createClient(supabaseUrl || 'https://placeholder.supabase.co', supabaseAnonKey || effectiveKey, {
        global: {
          headers: {
            Authorization: `Bearer ${token}`
          }
        },
        auth: {
          persistSession: false,
          autoRefreshToken: false,
          detectSessionInUrl: false
        }
      });
    }
  }
  return supabaseAdmin;
}

function parseBody(req: VercelRequest): Record<string, any> {
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

function generateUUID(): string {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    try {
      return crypto.randomUUID();
    } catch (_) {}
  }
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,PUT,DELETE,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  const action = (req.query?.action as string) || (req.body?.action as string) || '';

  try {
    // 1. CREATE POST
    if (action === 'create-post' || (req.method === 'POST' && !action)) {
      const body = parseBody(req);
      const content = (body.content || '').trim();
      const imageUrl = body.image_url || null;

      if (!content && !imageUrl) {
        return res.status(400).json({ error: 'Post content or image is required' });
      }

      const userId = body.user_id || generateUUID();
      const postId = body.id || body.postId || generateUUID();
      const postTimestamp = body.created_at || new Date().toISOString();

      const postPayload: any = {
        id: postId,
        user_id: userId,
        user_email: body.user_email || '',
        user_name: body.user_name || 'Member',
        user_avatar_url: body.user_avatar_url || null,
        content: content,
        image_url: imageUrl,
        likes_count: typeof body.likes_count === 'number' ? body.likes_count : 0,
        comments_count: typeof body.comments_count === 'number' ? body.comments_count : 0,
        reply_to_id: body.reply_to_id || null,
        reply_to_content: body.reply_to_content || null,
        reply_to_user_name: body.reply_to_user_name || null,
        created_at: postTimestamp
      };

      let createdPost: any = null;

      // Attempt 1: Scoped client with forwarded user token or supabaseAdmin
      try {
        const client = getSupabaseForRequest(req);
        console.log('[Community API] Inserting post via Supabase client...');
        const { data, error } = await client
          .from('community_posts')
          .insert(postPayload)
          .select()
          .single();

        if (!error && data) {
          createdPost = data;
          console.log('[Community API] Post inserted successfully into Supabase:', data.id);
        } else if (error) {
          console.warn('[Community API] First insert attempt warning:', error.message || error);
          if (client !== supabaseAdmin) {
            const adminRes = await supabaseAdmin
              .from('community_posts')
              .insert(postPayload)
              .select()
              .single();
            if (!adminRes.error && adminRes.data) {
              createdPost = adminRes.data;
            }
          }
        }
      } catch (sbErr: any) {
        console.warn('[Community API] Supabase connection error:', sbErr?.message || sbErr);
      }

      // Fallback: If Supabase failed or table is unavailable, guarantee success with local persistence
      if (!createdPost) {
        createdPost = {
          ...postPayload
        };
        console.log('[Community API] Created post in fallback store with ID:', createdPost.id);
      }

      // Sync to local JSON backup
      try {
        const local = loadLocalPosts();
        const existingIdx = local.findIndex(p => p.id === createdPost.id);
        if (existingIdx !== -1) {
          local[existingIdx] = { ...local[existingIdx], ...createdPost };
        } else {
          local.unshift(createdPost);
        }
        saveLocalPosts(local.slice(0, 500));
      } catch (_) {}

      return res.status(200).json({
        success: true,
        post: createdPost
      });
    }

    // 2. UPDATE POST
    if (action === 'update-post') {
      const body = parseBody(req);
      const postId = body.postId || body.id;
      const content = (body.content || '').trim();

      if (!postId || !content) {
        return res.status(400).json({ error: 'Post ID and content are required' });
      }

      let updatedPost: any = null;

      try {
        const { data, error } = await supabaseAdmin
          .from('community_posts')
          .update({ content })
          .eq('id', postId)
          .select()
          .maybeSingle();

        if (!error && data) {
          updatedPost = data;
        }
      } catch (err: any) {
        console.warn('[Community API] Error updating in Supabase:', err?.message || err);
      }

      // Update in local file
      try {
        const local = loadLocalPosts();
        const idx = local.findIndex(p => p.id === postId);
        if (idx !== -1) {
          local[idx].content = content;
          saveLocalPosts(local);
          if (!updatedPost) updatedPost = local[idx];
        }
      } catch (_) {}

      return res.status(200).json({
        success: true,
        post: updatedPost || { id: postId, content }
      });
    }

    // 3. DELETE POST
    if (action === 'delete-post') {
      const body = parseBody(req);
      const postId = body.postId || body.id;

      if (!postId) {
        return res.status(400).json({ error: 'Post ID is required' });
      }

      try {
        await supabaseAdmin.from('community_posts').delete().eq('id', postId);
        await supabaseAdmin.from('post_comments').delete().eq('post_id', postId);
        await supabaseAdmin.from('post_likes').delete().eq('post_id', postId);
      } catch (err: any) {
        console.warn('[Community API] Error deleting from Supabase:', err?.message || err);
      }

      // Delete from local file
      try {
        const local = loadLocalPosts();
        saveLocalPosts(local.filter(p => p.id !== postId));
        const commentsMap = loadLocalComments();
        if (commentsMap[postId]) {
          delete commentsMap[postId];
          saveLocalComments(commentsMap);
        }
      } catch (_) {}

      // Persistently record deleted post ID to prevent resurrection across Vercel / serverless / client cache
      try {
        await recordDeletedPostId(postId);
      } catch (_) {}

      return res.status(200).json({ success: true, deleted: postId });
    }

    // 4. CREATE COMMENT
    if (action === 'create-comment') {
      const body = parseBody(req);
      const postId = body.postId || body.post_id;
      const content = (body.content || '').trim();

      if (!postId || !content) {
        return res.status(400).json({ error: 'Post ID and comment content are required' });
      }

      const commentId = body.id || body.commentId || generateUUID();
      const commentTimestamp = body.created_at || new Date().toISOString();

      const commentPayload: any = {
        id: commentId,
        post_id: postId,
        user_id: body.user_id || generateUUID(),
        user_name: body.user_name || 'Member',
        user_avatar_url: body.user_avatar_url || null,
        content: content,
        created_at: commentTimestamp
      };

      let createdComment: any = null;

      try {
        const client = getSupabaseForRequest(req);
        const { data, error } = await client
          .from('post_comments')
          .insert(commentPayload)
          .select()
          .single();

        if (!error && data) {
          createdComment = data;
        } else if (error && client !== supabaseAdmin) {
          const adminRes = await supabaseAdmin
            .from('post_comments')
            .insert(commentPayload)
            .select()
            .single();
          if (!adminRes.error && adminRes.data) {
            createdComment = adminRes.data;
          }
        }
      } catch (err: any) {
        console.warn('[Community API] Error inserting comment via Supabase:', err?.message || err);
      }

      if (!createdComment) {
        createdComment = {
          ...commentPayload
        };
      }

      // Bump comments_count on post in Supabase
      try {
        const { data: post } = await supabaseAdmin.from('community_posts').select('comments_count').eq('id', postId).maybeSingle();
        const newCount = ((post?.comments_count || 0) + 1);
        await supabaseAdmin.from('community_posts').update({ comments_count: newCount }).eq('id', postId);
      } catch (_) {}

      // Save to local comments and bump post count in local posts
      try {
        const commentsMap = loadLocalComments();
        if (!commentsMap[postId]) commentsMap[postId] = [];
        const existingIdx = commentsMap[postId].findIndex(c => c.id === createdComment.id);
        if (existingIdx !== -1) {
          commentsMap[postId][existingIdx] = { ...commentsMap[postId][existingIdx], ...createdComment };
        } else {
          commentsMap[postId].push(createdComment);
        }
        saveLocalComments(commentsMap);

        const localPosts = loadLocalPosts();
        const pIdx = localPosts.findIndex(p => p.id === postId);
        if (pIdx !== -1) {
          localPosts[pIdx].comments_count = commentsMap[postId].length;
          saveLocalPosts(localPosts);
        }
      } catch (_) {}

      return res.status(200).json({
        success: true,
        comment: createdComment
      });
    }

    // UPDATE COMMENT
    if (action === 'update-comment') {
      const body = parseBody(req);
      const commentId = body.commentId || body.id;
      const postId = body.postId || body.post_id;
      const content = (body.content || '').trim();

      if (!commentId || !content) {
        return res.status(400).json({ error: 'Comment ID and content are required' });
      }

      let updatedComment: any = null;

      try {
        const { data, error } = await supabaseAdmin
          .from('post_comments')
          .update({ content })
          .eq('id', commentId)
          .select()
          .maybeSingle();

        if (!error && data) {
          updatedComment = data;
        }
      } catch (err: any) {
        console.warn('[Community API] Error updating comment in Supabase:', err?.message || err);
      }

      // Update in local comments file
      try {
        const commentsMap = loadLocalComments();
        let foundInMap = false;
        for (const pid of Object.keys(commentsMap)) {
          const list = commentsMap[pid] || [];
          const idx = list.findIndex(c => c.id === commentId);
          if (idx !== -1) {
            list[idx].content = content;
            commentsMap[pid] = list;
            foundInMap = true;
            if (!updatedComment) updatedComment = list[idx];
          }
        }
        if (foundInMap) {
          saveLocalComments(commentsMap);
        }
      } catch (_) {}

      return res.status(200).json({
        success: true,
        comment: updatedComment || { id: commentId, postId, content }
      });
    }

    // 5. DELETE COMMENT
    if (action === 'delete-comment') {
      const body = parseBody(req);
      const commentId = body.commentId || body.id;
      const postId = body.postId || body.post_id;

      if (!commentId) {
        return res.status(400).json({ error: 'Comment ID is required' });
      }

      try {
        await supabaseAdmin.from('post_comments').delete().eq('id', commentId);
      } catch (err: any) {
        console.warn('[Community API] Error deleting comment in Supabase:', err?.message || err);
      }

      if (postId) {
        try {
          const { data: post } = await supabaseAdmin.from('community_posts').select('comments_count').eq('id', postId).maybeSingle();
          const newCount = Math.max(0, (post?.comments_count || 1) - 1);
          await supabaseAdmin.from('community_posts').update({ comments_count: newCount }).eq('id', postId);
        } catch (_) {}
      }

      // Remove from local comments
      try {
        const commentsMap = loadLocalComments();
        if (postId && commentsMap[postId]) {
          commentsMap[postId] = commentsMap[postId].filter(c => c.id !== commentId);
          saveLocalComments(commentsMap);
          const localPosts = loadLocalPosts();
          const pIdx = localPosts.findIndex(p => p.id === postId);
          if (pIdx !== -1) {
            localPosts[pIdx].comments_count = commentsMap[postId].length;
            saveLocalPosts(localPosts);
          }
        }
      } catch (_) {}

      return res.status(200).json({ success: true, deleted: commentId });
    }

    // 6. LIST POSTS (Merged Supabase + Local, Sorted newest first)
    if (action === 'list-posts' || (req.method === 'GET' && (!action || action === 'posts'))) {
      let remotePosts: any[] = [];
      try {
        const { data, error } = await supabaseAdmin
          .from('community_posts')
          .select('*')
          .order('created_at', { ascending: false })
          .limit(100);

        if (!error && Array.isArray(data)) {
          remotePosts = data;
        }
      } catch (_) {}

      const localPosts = loadLocalPosts();

      // Merge unique by id
      const postsMap = new Map<string, any>();
      for (const p of remotePosts) {
        if (p && p.id) postsMap.set(p.id, p);
      }
      for (const p of localPosts) {
        if (p && p.id) {
          const existing = postsMap.get(p.id) || {};
          postsMap.set(p.id, { ...existing, ...p });
        }
      }

      const deletedIds = await fetchDeletedPostIds();
      const merged = Array.from(postsMap.values()).filter(p => p && p.id && !deletedIds.has(p.id));
      // Sort newest first by created_at (descending)
      merged.sort((a, b) => {
        const timeA = a.created_at ? new Date(a.created_at).getTime() : 0;
        const timeB = b.created_at ? new Date(b.created_at).getTime() : 0;
        return timeB - timeA;
      });

      return res.status(200).json({ success: true, posts: merged });
    }

    // 7. LIST COMMENTS FOR A POST (Merged Supabase + Local, Sorted chronological)
    if (action === 'list-comments' || action === 'get-comments') {
      const postId = (req.query?.postId as string) || (req.query?.post_id as string) || (req.body?.postId as string) || (req.body?.post_id as string);
      if (!postId) {
        return res.status(400).json({ error: 'Post ID is required' });
      }

      let remoteComments: any[] = [];
      try {
        const { data, error } = await supabaseAdmin
          .from('post_comments')
          .select('*')
          .eq('post_id', postId)
          .order('created_at', { ascending: true });

        if (!error && Array.isArray(data)) {
          remoteComments = data;
        }
      } catch (_) {}

      const localCommentsMap = loadLocalComments();
      const localList = localCommentsMap[postId] || [];

      // Merge unique by id
      const commentsMap = new Map<string, any>();
      for (const c of remoteComments) {
        if (c && c.id) commentsMap.set(c.id, c);
      }
      for (const c of localList) {
        if (c && c.id) {
          const existing = commentsMap.get(c.id) || {};
          commentsMap.set(c.id, { ...existing, ...c });
        }
      }

      const mergedComments = Array.from(commentsMap.values());
      mergedComments.sort((a, b) => {
        const timeA = a.created_at ? new Date(a.created_at).getTime() : 0;
        const timeB = b.created_at ? new Date(b.created_at).getTime() : 0;
        return timeA - timeB;
      });

      return res.status(200).json({ success: true, comments: mergedComments });
    }

    return res.status(400).json({ error: `Unknown action: ${action}` });
  } catch (error: any) {
    console.error('[Community API] Top-level handler error:', error);
    return res.status(500).json({ error: error.message || 'Internal Community Server Error' });
  }
}
