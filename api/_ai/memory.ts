export interface UserMemoryProfile {
  userId?: string;
  userName?: string;
  partnerName?: string | null;
  relationshipStatus?: string | null;
  facts: string[];
  topics: string[];
  recentAdvice: string[];
  lastUpdated: string;
}

export function formatMemoryForPrompt(memory: UserMemoryProfile | null): string {
  if (!memory) return '';

  const parts: string[] = [];
  if (memory.userName) parts.push(`Student Name: ${memory.userName}`);
  if (memory.partnerName) parts.push(`Partner Name: ${memory.partnerName}`);
  if (memory.relationshipStatus) parts.push(`Relationship Status: ${memory.relationshipStatus}`);

  if (Array.isArray(memory.facts) && memory.facts.length > 0) {
    parts.push(`Known Student Facts:\n- ${memory.facts.slice(-6).join('\n- ')}`);
  }

  if (Array.isArray(memory.topics) && memory.topics.length > 0) {
    parts.push(`Key Consultation Themes Discussed: ${memory.topics.slice(-5).join(', ')}`);
  }

  if (Array.isArray(memory.recentAdvice) && memory.recentAdvice.length > 0) {
    parts.push(`Recent Advice Previously Provided:\n- ${memory.recentAdvice.slice(-3).join('\n- ')}`);
  }

  if (parts.length === 0) return '';

  return `\n\n--- STUDENT FACT PROFILE & CONSULTATION MEMORY ---\n${parts.join('\n')}\n(Consultation continuity instructions: Use this memory context seamlessly. Do NOT repeatedly ask the student for details that are already documented here.)\n-------------------------------------------------`;
}

export function extractAndMergeMemory(
  currentMemory: UserMemoryProfile | null,
  userMsg: string,
  botReply: string,
  userName?: string
): UserMemoryProfile {
  const mem: UserMemoryProfile = currentMemory || {
    facts: [],
    topics: [],
    recentAdvice: [],
    lastUpdated: new Date().toISOString()
  };

  if (userName && !mem.userName) {
    mem.userName = userName;
  }

  const combined = `${userMsg} ${botReply}`;
  const lowerUser = userMsg.toLowerCase();
  const lowerCombined = combined.toLowerCase();

// 1. Detect Partner Name
  const partnerRegex = /(?:husband|wife|boyfriend|girlfriend|partner|fiancé|fiancee|spouse|namorado|namorada|esposo|esposa|marido)\s+(?:is\s+|named\s+|called\s+)?([A-Z][a-z]+)/i;
  const pMatch = userMsg.match(partnerRegex);
  if (pMatch && pMatch[1]) {
    const candidateName = pMatch[1].trim();
    // Filter out common false positives
    const stopWords = ['my', 'the', 'our', 'his', 'her', 'we', 'he', 'she', 'so', 'and', 'but', 'when', 'if', 'not', 'him', 'them'];
    if (!stopWords.includes(candidateName.toLowerCase())) {
      mem.partnerName = candidateName;
      const fact = `Partner: ${candidateName}`;
      if (!mem.facts.some(f => f.toLowerCase().includes(candidateName.toLowerCase()))) {
        mem.facts.push(fact);
      }
    }
  }

  // 2. Detect Relationship Status / Stage
  if (!mem.relationshipStatus) {
    if (lowerCombined.includes('married') || lowerCombined.includes('husband') || lowerCombined.includes('wife') || lowerCombined.includes('casad')) {
      mem.relationshipStatus = 'Married';
    } else if (lowerCombined.includes('engaged') || lowerCombined.includes('fiancé') || lowerCombined.includes('noiv')) {
      mem.relationshipStatus = 'Engaged';
    } else if (lowerCombined.includes('long distance') || lowerCombined.includes('distância')) {
      mem.relationshipStatus = 'Long Distance Relationship';
    } else if (lowerCombined.includes('dating') || lowerCombined.includes('boyfriend') || lowerCombined.includes('girlfriend') || lowerCombined.includes('namor')) {
      mem.relationshipStatus = 'Dating';
    } else if (lowerCombined.includes('broke up') || lowerCombined.includes('breakup') || lowerCombined.includes('separated') || lowerCombined.includes('divorce') || lowerCombined.includes('término')) {
      mem.relationshipStatus = 'Breakup / Separation Recovery';
    }
  }

  // 3. Detect Duration of Relationship
  const durationMatch = userMsg.match(/(?:together|married|dating|been\s+with\s+him|been\s+with\s+her)\s+(?:for\s+)?(\d+\s+(?:years?|months?|anos?|meses?))/i);
  if (durationMatch && durationMatch[1]) {
    const durFact = `Relationship Duration: ${durationMatch[1]}`;
    if (!mem.facts.some(f => f.toLowerCase().includes('duration'))) {
      mem.facts.push(durFact);
    }
  }

  // 4. Detect Children / Family
  const kidsMatch = userMsg.match(/(?:have|got)\s+(\d+|a|an|two|three)\s+(?:kids?|children|son|daughter|filhos?|filha|filho)/i);
  if (kidsMatch) {
    const kidsFact = `Family: Has children / family context`;
    if (!mem.facts.some(f => f.toLowerCase().includes('family') || f.toLowerCase().includes('children'))) {
      mem.facts.push(kidsFact);
    }
  }

  // 5. Detect Living Together
  if (lowerUser.includes('live together') || lowerUser.includes('living together') || lowerUser.includes('moved in together') || lowerUser.includes('moramos juntos')) {
    if (!mem.facts.some(f => f.toLowerCase().includes('living together'))) {
      mem.facts.push('Living together');
    }
  }

  // 6. Detect Core Consultation Themes
  const topicCatalog: Record<string, string[]> = {
    'Communication & Misunderstandings': ['communication', 'misunderstanding', 'talk', 'listen', 'conversar', 'comunicação', 'shut down'],
    'Trust & Rebuilding Fidelity': ['trust', 'cheat', 'affair', 'loyalty', 'confiança', 'traição', 'suspicious'],
    'Emotional Intimacy & Affection': ['intimacy', 'affection', 'cold', 'disconnected', 'intimidade', 'afeto', 'distant', 'love language'],
    'Conflict Resolution & Arguments': ['argument', 'fight', 'yelling', 'defensive', 'briga', 'discussão', 'criticism'],
    'Healthy Boundaries & Space': ['boundary', 'boundaries', 'smothering', 'independence', 'limites', 'space'],
    'Future Commitment & Goals': ['commitment', 'future', 'moving in', 'marriage', 'compromisso', 'goals']
  };

  for (const [topicName, keywords] of Object.entries(topicCatalog)) {
    if (keywords.some(k => lowerCombined.includes(k)) && !mem.topics.includes(topicName)) {
      mem.topics.push(topicName);
    }
  }

  // Keep topics capped at 5
  if (mem.topics.length > 5) {
    mem.topics = mem.topics.slice(-5);
  }

  // 7. Summarize Advice Highlight (1 sentence from Victoria's response)
  if (botReply && botReply.length > 30) {
    // Find first substantive actionable sentence
    const cleanSentences = botReply
      .replace(/\r?\n+/g, ' ')
      .split(/(?<=[.!?])\s+/)
      .map(s => s.trim())
      .filter(s => s.length > 25 && s.length < 140 && !s.startsWith('Hello') && !s.startsWith("I'm"));

    const adviceSnippet = cleanSentences[0] || botReply.slice(0, 110) + '...';
    if (!mem.recentAdvice.includes(adviceSnippet)) {
      mem.recentAdvice.push(adviceSnippet);
      if (mem.recentAdvice.length > 3) {
        mem.recentAdvice = mem.recentAdvice.slice(-3);
      }
    }
  }

  // Keep facts deduplicated and capped at 8
  mem.facts = [...new Set(mem.facts)].slice(-8);
  mem.lastUpdated = new Date().toISOString();

  return mem;
}

function normalizeIdentifiers(userIdentifier: string | string[]): string[] {
  if (Array.isArray(userIdentifier)) {
    return Array.from(new Set(userIdentifier.map(id => (id || '').trim().toLowerCase()).filter(Boolean)));
  }
  if (!userIdentifier) return [];
  return [userIdentifier.trim().toLowerCase()];
}

export async function saveChatMessageToDb(
  supabaseClient: any,
  userIdentifier: string | string[],
  message: { role: string; content: string; id?: string; timestamp?: string },
  fallbackClient?: any
): Promise<void> {
  const ids = normalizeIdentifiers(userIdentifier);
  if (ids.length === 0) return;
  const primaryId = ids[0];
  const emailId = ids.find(id => id.includes('@')) || primaryId;
  const msgId = message.id || `msg_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
  const nowIso = new Date().toISOString();

  const insertMessage = async (client: any) => {
    return await client.from('ai_chat_messages').insert({
      id: msgId,
      user_id: primaryId,
      user_email: emailId,
      role: message.role,
      content: message.content,
      timestamp: message.timestamp || new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      created_at: nowIso
    });
  };

  try {
    const res = await insertMessage(supabaseClient);
    if (res?.error && (res.error.code === '401' || res.error.message?.includes('Unregistered API key')) && fallbackClient) {
      await insertMessage(fallbackClient);
    }
  } catch (err) {
    if (fallbackClient) {
      try {
        await insertMessage(fallbackClient);
      } catch (fbErr) {
        console.warn('[AI Memory] Error saving chat message:', fbErr);
      }
    } else {
      console.warn('[AI Memory] Error saving chat message:', err);
    }
  }
}

export async function loadChatMessagesFromDb(
  supabaseClient: any,
  userIdentifier: string | string[],
  fallbackClient?: any
): Promise<Array<{ id: string; role: 'user' | 'assistant'; content: string; timestamp: string }>> {
  const ids = normalizeIdentifiers(userIdentifier);
  if (ids.length === 0) return [];

  const queryMessages = async (client: any) => {
    let q = client.from('ai_chat_messages').select('id, role, content, timestamp, created_at');
    if (ids.length === 1) {
      q = q.or(`user_id.eq.${ids[0]},user_email.eq.${ids[0]}`);
    } else {
      const inList = ids.join(',');
      q = q.or(`user_id.in.(${inList}),user_email.in.(${inList})`);
    }
    return await q.order('created_at', { ascending: true }).limit(100);
  };

  try {
    let res = await queryMessages(supabaseClient);
    if ((res?.error || !res?.data) && fallbackClient) {
      res = await queryMessages(fallbackClient);
    }

    if (!res?.error && Array.isArray(res?.data)) {
      return res.data.map((row: any) => ({
        id: String(row.id),
        role: row.role === 'assistant' ? 'assistant' : 'user',
        content: String(row.content),
        timestamp: String(
          row.timestamp ||
          new Date(row.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
        )
      }));
    }
    return [];
  } catch (err) {
    if (fallbackClient) {
      try {
        const res = await queryMessages(fallbackClient);
        if (Array.isArray(res?.data)) {
          return res.data.map((row: any) => ({
            id: String(row.id),
            role: row.role === 'assistant' ? 'assistant' : 'user',
            content: String(row.content),
            timestamp: String(
              row.timestamp ||
              new Date(row.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
            )
          }));
        }
      } catch (_) {}
    }
    console.warn('[AI Memory] Error loading messages from ai_chat_messages:', err);
    return [];
  }
}

export async function saveUserMemoryToDb(
  supabaseClient: any,
  userIdentifier: string | string[],
  memory: UserMemoryProfile,
  fallbackClient?: any
): Promise<void> {
  const ids = normalizeIdentifiers(userIdentifier);
  if (ids.length === 0) return;
  const primaryId = ids[0];
  const emailId = ids.find(id => id.includes('@')) || primaryId;
  const nowIso = new Date().toISOString();

  const upsertMemory = async (client: any) => {
    return await client.from('ai_user_memory').upsert({
      user_id: primaryId,
      user_email: emailId,
      user_name: memory.userName || null,
      partner_name: memory.partnerName || null,
      relationship_status: memory.relationshipStatus || null,
      facts: memory.facts || [],
      topics: memory.topics || [],
      recent_advice: memory.recentAdvice || [],
      last_updated: nowIso
    }, { onConflict: 'user_id' });
  };

  try {
    const res = await upsertMemory(supabaseClient);
    if (res?.error && (res.error.code === '401' || res.error.message?.includes('Unregistered API key')) && fallbackClient) {
      await upsertMemory(fallbackClient);
    }
  } catch (err) {
    if (fallbackClient) {
      try {
        await upsertMemory(fallbackClient);
      } catch (fbErr) {
        console.warn('[AI Memory] Error saving user memory:', fbErr);
      }
    } else {
      console.warn('[AI Memory] Error saving user memory:', err);
    }
  }
}

export async function loadUserMemoryFromDb(
  supabaseClient: any,
  userIdentifier: string | string[],
  fallbackClient?: any
): Promise<UserMemoryProfile | null> {
  const ids = normalizeIdentifiers(userIdentifier);
  if (ids.length === 0) return null;

  const queryMemory = async (client: any) => {
    let q = client.from('ai_user_memory').select('*');
    if (ids.length === 1) {
      q = q.or(`user_id.eq.${ids[0]},user_email.eq.${ids[0]}`);
    } else {
      const inList = ids.join(',');
      q = q.or(`user_id.in.(${inList}),user_email.in.(${inList})`);
    }
    return await q.limit(1).maybeSingle();
  };

  try {
    let res = await queryMemory(supabaseClient);
    if ((res?.error || !res?.data) && fallbackClient) {
      res = await queryMemory(fallbackClient);
    }

    if (!res?.error && res?.data) {
      const row = res.data;
      return {
        userId: row.user_id,
        userName: row.user_name,
        partnerName: row.partner_name,
        relationshipStatus: row.relationship_status,
        facts: Array.isArray(row.facts) ? row.facts : [],
        topics: Array.isArray(row.topics) ? row.topics : [],
        recentAdvice: Array.isArray(row.recent_advice) ? row.recent_advice : [],
        lastUpdated: row.last_updated || new Date().toISOString()
      };
    }
    return null;
  } catch (err) {
    if (fallbackClient) {
      try {
        const res = await queryMemory(fallbackClient);
        if (res?.data) {
          const row = res.data;
          return {
            userId: row.user_id,
            userName: row.user_name,
            partnerName: row.partner_name,
            relationshipStatus: row.relationship_status,
            facts: Array.isArray(row.facts) ? row.facts : [],
            topics: Array.isArray(row.topics) ? row.topics : [],
            recentAdvice: Array.isArray(row.recent_advice) ? row.recent_advice : [],
            lastUpdated: row.last_updated || new Date().toISOString()
          };
        }
      } catch (_) {}
    }
    console.warn('[AI Memory] Error loading user memory:', err);
    return null;
  }
}
