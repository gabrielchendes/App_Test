import { GoogleGenAI, Type } from '@google/genai';
import type { VercelRequest, VercelResponse } from '@vercel/node';
import { safeParseAiJson } from '../_utils/parseAiJson';
import { generateContentWithRetry } from '../_utils/geminiCallWithRetry';
import { getGeminiApiKey } from './chat';

let aiInstance: GoogleGenAI | null = null;
let lastApiKey = '';

function getAiClient(): GoogleGenAI {
  const apiKey = getGeminiApiKey();
  if (!apiKey) {
    throw new Error('GEMINI_API_KEY environment variable is missing or empty');
  }
  if (!aiInstance || lastApiKey !== apiKey) {
    lastApiKey = apiKey;
    aiInstance = new GoogleGenAI({
      apiKey,
      httpOptions: {
        headers: {
          'User-Agent': 'aistudio-build',
        },
      },
    });
  }
  return aiInstance;
}

// Helper to generate realistic female portraits from randomuser.me (IDs 1-95)
export const getRandomWomanAvatar = (seed?: number): string => {
  const num = seed !== undefined ? ((Math.abs(seed) % 95) + 1) : (Math.floor(Math.random() * 95) + 1);
  return `https://randomuser.me/api/portraits/women/${num}.jpg`;
};

// Curated pool of high-quality, realistic female portrait photos from randomuser.me
export const REALISTIC_AVATARS = [
  1, 2, 3, 5, 9, 12, 17, 21, 24, 28, 32, 36, 44, 47, 50, 54, 60, 65, 68, 72, 76, 79, 82, 86, 89, 92, 95
].map(id => `https://randomuser.me/api/portraits/women/${id}.jpg`);

function extractStudentName(prompt: string, language: string, defaultName?: string): string {
  const isEn = language === 'en';
  const isEs = language === 'es';
  const blacklist = new Set([
    'student', 'aluna', 'estudiante', 'asking', 'posting', 'sharing', 'feeling', 'wondering', 
    'trying', 'after', 'when', 'depois', 'quando', 'desabafo', 'duvida', 'insegura', 'comemorando',
    'apliquei', 'applied', 'querendo', 'preciso', 'precisa', 'needs', 'left', 'sent'
  ]);

  const explicitMatch = prompt.match(/(?:named|chamada|llamada|nome|name)\s*:?\s*([A-Z][a-zà-ú]+(?:\s+[A-Z][a-zà-ú]+)?)/);
  if (explicitMatch && explicitMatch[1]) {
    const candidate = explicitMatch[1].trim();
    if (candidate.length > 2 && !blacklist.has(candidate.toLowerCase())) {
      return candidate;
    }
  }

  const roleMatch = prompt.match(/(?:aluna|student|estudiante)\s+([A-Z][a-zà-ú]+(?:\s+[A-Z][a-zà-ú]+)?)/);
  if (roleMatch && roleMatch[1]) {
    const candidate = roleMatch[1].trim();
    if (candidate.length > 2 && !blacklist.has(candidate.toLowerCase())) {
      return candidate;
    }
  }

  if (defaultName) return defaultName;
  return isEn ? 'Emily Watson' : (isEs ? 'Valentina Morales' : 'Juliana Silveira');
}

function generateSmartFallbackTestimonial(prompt: string, courseTitle: string, _tone: string, language: string = 'en') {
  const isEn = language === 'en';
  const isEs = language === 'es';
  const detectedName = extractStudentName(prompt, language, isEn ? 'Sarah Miller' : (isEs ? 'Sofía Rodríguez' : 'Juliana Silveira'));

  const avatar = getRandomWomanAvatar(Math.floor(Math.random() * 95) + 1);
  const emailDomain = isEn ? '@student.com' : (isEs ? '@alumna.com' : '@aluna.com');
  const course = courseTitle || (isEn ? 'General' : (isEs ? 'General' : 'Geral'));

  let headline: string;
  let content: string;

  if (isEn) {
    headline = 'Our connection was completely rekindled when I had almost lost hope';
    content = `I felt compelled to come here and share my story because what happened truly feels like a miracle. We were living almost like two strangers under the same roof—no warmth, no communication, and a distance that hurt every single day. I used to cry privately thinking the love was gone.\n\nWhen I began applying the emotional triggers taught in the lessons and shifted my internal posture, everything transformed. I initially thought it would take months, but in less than two weeks he started reaching out, hugging me spontaneously, and genuinely asking about my day. Today we are talking and laughing just like when we first started dating. Eternal gratitude for this program!`;
  } else if (isEs) {
    headline = 'Nuestra conexión renació cuando ya no tenía esperanzas';
    content = `Necesitaba venir aquí a dejar mi testimonio porque lo que me pasó parece un milagro. Vivíamos casi como dos desconocidos bajo el mismo techo, sin cariño, sin diálogo y con un distanciamiento que dolía todos los días.\n\nCuando comencé a aplicar los desencadenantes emocionales enseñados en las clases y cambié mi postura interna, todo dio un giro. En menos de dos semanas comenzó a buscarme, a abrazarme espontáneamente y a interesarse por mi día. ¡Gratitud eterna por este método!`;
  } else {
    headline = 'Nossa conexão renasceu quando eu já não tinha mais esperanças';
    content = `Eu precisava vir aqui deixar meu relato porque o que aconteceu comigo parece um milagre. Estávamos vivendo praticamente como dois estranhos sob o mesmo teto, sem carinho, sem diálogo e com um distanciamento que doía todos os dias. Eu já chorava escondida achando que o amor tinha acabado.\n\nQuando comecei a aplicar os gatilhos ensinados nas aulas e mudei minha postura emocional, tudo virou. No começo achei que demoraria meses, mas em menos de duas semanas ele começou a me procurar, me abraçar espontaneamente e puxar assunto. Hoje estamos conversando como no início do nosso namoro. Gratidão eterna por este método!`;
  }

  return [{
    id: `ai-test-${Date.now()}-1`,
    user_name: detectedName,
    user_avatar: avatar,
    user_email: `${detectedName.toLowerCase().replace(/[^a-z0-9]/g, '')}${emailDomain}`,
    course_title: course,
    rating: 5,
    headline,
    content,
    status: 'approved',
    consent: true,
    is_read: true,
    created_at: new Date().toISOString()
  }];
}

function generateSmartFallbackCommunity(prompt: string, _tone: string, countComments: number, language: string = 'en') {
  const isEn = language === 'en';
  const isEs = language === 'es';
  const authorName = extractStudentName(prompt, language, isEn ? 'Emily Watson' : (isEs ? 'Valentina Morales' : 'Camila Mendes'));

  const postAvatar = getRandomWomanAvatar(Math.floor(Math.random() * 95) + 1);

  const peerNames = isEn 
    ? ['Ashley Davies', 'Jessica Miller', 'Chloe Bennett', 'Hannah Brooks']
    : (isEs 
      ? ['Camila Sánchez', 'Mariana Torres', 'Lucía Herrera', 'Daniela Vega']
      : ['Beatriz Lima', 'Mariana Costa', 'Renata Souza', 'Larissa Duarte']);

  const peerComments = isEn
    ? [
        'Breathe deeply and do not send another text! The biggest mistake during this stage is showing anxiety. Remember the lesson on giving him space to process the trigger. Trust the process, you got this!',
        'The exact same thing happened to me last week! My heart was racing and I wanted so badly to reach out, but I held my ground. Later that afternoon he sent a long, sweet voice note explaining everything. Hold on to your peace!',
        'Proud of you for taking action! His silence right now isn\'t lack of interest—his brain is just processing your new high-value energy. You are in control of your emotional space now! ❤️',
        'This community support means the world. Stay strong and please come back and update us on how it goes!'
      ]
    : (isEs
      ? [
          '¡Amiga, respira hondo y no le envíes ningún mensaje! El mayor error en esta etapa es demostrar ansiedad. Recuerda la clase sobre darle tiempo para procesar el disparador. ¡Confía en el proceso!',
          '¡Me pasó exactamente lo mismo la semana pasada! Tenía el corazón en la mano con ganas de escribirle, pero resistí. Al final de la tarde me mandó un audio larguísimo disculpándose y muy cariñoso. ¡Calma!',
          '¡Felicitaciones por aplicarlo! Su silencio ahora no es desinterés, su mente está entendiendo tu nueva postura. ¡Tú tienes el control ahora! ❤️',
          'Chicas, este apoyo en la comunidad hace toda la diferencia. ¡Sigue firme y cuéntanos pronto cómo te fue!'
        ]
      : [
          'Amiga, respira fundo e não manda mais nenhuma mensagem! O maior erro nessa fase é demonstrar ansiedade. Lembra da aula sobre o tempo dele processar o gatilho? Confia no processo que vai dar certo!',
          'Aconteceu exatamente isso comigo semana passada! Eu fiquei com o coração na mão querendo mandar mensagem, mas segurei. No final da tarde ele me mandou um áudio enorme se explicando e super carinhoso. Segura a ansiedade!',
          'Parabéns por estar aplicando, amiga! O silêncio dele agora não é desinteresse, é o cérebro dele tentando entender a sua nova postura. Você está no controle da sua energia agora! ❤️',
          'Meninas, esse apoio aqui na comunidade faz toda a diferença. Continue firme e depois volta aqui para nos contar a resposta dele!'
        ]);

  const comments = Array.from({ length: countComments }).map((_, i) => ({
    id: `ai-comm-fb-${Date.now()}-${i + 1}`,
    user_name: peerNames[i % peerNames.length],
    user_avatar_url: getRandomWomanAvatar((i * 19 + 7 + Math.floor(Math.random() * 20)) % 95 + 1),
    content: peerComments[i % peerComments.length]
  }));

  let postContent: string;
  if (prompt.trim().length > 30) {
    postContent = prompt.trim();
  } else if (isEn) {
    postContent = 'Girls, I really need to share this with you and get some advice from anyone who has been through it... I applied the method and I am already seeing the first signs, but I still get nervous butterflies in my stomach. How did you handle the anxiety during the first few days?';
  } else if (isEs) {
    postContent = 'Chicas, necesito compartir esto con ustedes y pedir la opinión de quien ya haya pasado por esto... Apliqué el método y estoy notando los primeros cambios, pero me dan nervios. ¿Cómo manejaron la ansiedad en los primeros días?';
  } else {
    postContent = 'Meninas, preciso compartilhar com vocês e pedir a opinião de quem já passou por isso... Apliquei o método e estou percebendo os primeiros sinais, mas bate aquele friozinho na barriga. Como vocês lidaram com a ansiedade nos primeiros dias?';
  }

  return [{
    id: `ai-thread-${Date.now()}-1`,
    post: {
      user_name: authorName,
      user_avatar_url: postAvatar,
      content: postContent
    },
    comments
  }];
}

export async function handleGenerateSocialContent(req: VercelRequest, res: VercelResponse) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  try {
    const {
      mode = 'testimonial', // 'testimonial' | 'community'
      prompt = '',
      language = 'en', // 'en' | 'pt' | 'es' (default English as requested)
      tone = 'emotional', // 'emotional' | 'spontaneous' | 'overcoming' | 'victory' | 'supportive'
      course_title = 'General',
      num_comments = 2,
      variations = 1
    } = req.body || {};

    if (!prompt || typeof prompt !== 'string' || !prompt.trim()) {
      return res.status(400).json({ error: 'The prompt/draft text is required.' });
    }

    const ai = getAiClient();

    const isEn = language === 'en';
    const isEs = language === 'es';

    if (mode === 'testimonial') {
      const systemInstruction = isEn
        ? `You are an elite expert in Social Proof, Relationship Psychology, and Storytelling for high-converting Women's Coaching Programs and Premium Communities.
Your mission is to transform raw notes from the administrator into a genuine, deeply moving, authentic student testimonial.

MANDATORY RULES:
1. STRICT LANGUAGE REQUIREMENT: Write 100% in natural, fluent, warm American/British English.
2. DO NOT sound like an ad or corporate PR. Real women use heartfelt personal reflections, genuine relief, realistic everyday details, and occasional conversational warmth.
3. Use an authentic English female full name (e.g., Sarah Miller, Emily Watson, Jessica Miller, Ashley Davies, Chloe Bennett).
4. Deposition structure:
   - Initial emotional pain or disconnection (relatable, sincere).
   - The turning point after applying the coaching advice/trigger.
   - The concrete positive reaction from the partner and the current feeling of love/peace.
   - Sincere gratitude.
5. Generate:
   - "user_name": Authentic English female full name.
   - "headline": Compelling headline (4-10 words) capturing the transformation.
   - "content": Full testimonial narrative (2-4 fluid paragraphs).
   - "rating": 5 (integer).
   - "course_title": "${course_title || 'General'}".
Strictly return JSON matching the schema.`
        : (isEs
          ? `Eres una experta mundial en Prueba Social y Psicología de Relaciones Femeninas.
Tu misión es transformar notas brutas en un testimonio de alumna auténtico, emotivo y humano en ESPAÑOL.
Usa nombres femeninos hispanos auténticos (ej. Sofía Rodríguez, Valentina Morales).
Retorna estrictamente JSON en el esquema especificado.`
          : `Você é um especialista mundial em Social Proof, Neuro-Copywriting e Psicologia de Relacionamentos Femininos para Infoprodutos e Comunidades Premium.
Sua missão é transformar um rascunho ou ideia bruta enviada pelo administrador em um depoimento de aluna extremamente convincente, emocionante, humano e natural em PORTUGUÊS.
Gere nome e sobrenome feminino brasileiro autêntico.
Retorne estritamente JSON no schema especificado.`);

      const userPrompt = isEn
        ? `ADMINISTRATOR'S ROUGH NOTES / DRAFT:
"""
${prompt.trim()}
"""

Tone: ${tone}
Course / Program: ${course_title || 'General'}
Generate ${Math.min(Math.max(1, Number(variations) || 1), 3)} distinct variation(s) of this testimonial strictly in English.`
        : `RASCUNHO DO ADMINISTRADOR:
"""
${prompt.trim()}
"""

Tom desejado: ${tone}
Curso / Contexto: ${course_title || 'Geral'}
Gere ${Math.min(Math.max(1, Number(variations) || 1), 3)} variação(ões) deste depoimento no idioma ${language}.`;

      const responseSchema = {
        type: Type.OBJECT,
        properties: {
          items: {
            type: Type.ARRAY,
            description: 'List of generated testimonials ready for approval',
            items: {
              type: Type.OBJECT,
              properties: {
                user_name: { type: Type.STRING, description: 'Full name of the female student' },
                headline: { type: Type.STRING, description: 'Catchy, emotional testimonial headline' },
                content: { type: Type.STRING, description: 'Complete narrative testimonial text' },
                rating: { type: Type.INTEGER, description: 'Rating score (1 to 5, default 5)' },
                course_title: { type: Type.STRING, description: 'Name of the course or product' },
                user_avatar: { type: Type.STRING, description: 'Optional avatar URL' }
              },
              required: ['user_name', 'headline', 'content', 'rating', 'course_title']
            }
          }
        },
        required: ['items']
      };

      let items: any[] = [];
      try {
        const result = await generateContentWithRetry({
          ai,
          candidateModels: ['gemini-3.1-flash-lite', 'gemini-3.8-flash'],
          contents: [userPrompt],
          config: {
            systemInstruction,
            responseMimeType: 'application/json',
            responseSchema,
            temperature: 0.8
          },
          perCallTimeoutMs: 14000,
          totalBudgetMs: 25000,
          maxAttemptsPerModel: 1,
          logPrefix: '[AI Social - Testimonial]'
        });

        const parsed = safeParseAiJson<{ items: any[] }>(result.text, { items: [] });
        items = (parsed.items || []).map((item, idx) => {
          const avatar = item.user_avatar && item.user_avatar.startsWith('http')
            ? item.user_avatar
            : getRandomWomanAvatar(idx * 23 + Math.floor(Math.random() * 50));

          const fallbackStudentName = isEn ? 'Verified Student' : (isEs ? 'Alumna Verificada' : 'Aluna Verificada');
          const studentName = item.user_name || fallbackStudentName;

          return {
            id: `ai-test-${Date.now()}-${idx + 1}`,
            user_name: studentName,
            user_avatar: avatar,
            user_email: `${studentName.toLowerCase().replace(/[^a-z0-9]/g, '')}${isEn ? '@student.com' : '@membro.com'}`,
            course_title: item.course_title || course_title || (isEn ? 'General' : 'Geral'),
            rating: Number(item.rating) || 5,
            headline: item.headline || (isEn ? 'Incredible Transformation' : 'Transformação Incrível'),
            content: item.content || prompt,
            status: 'approved',
            consent: true,
            is_read: true,
            created_at: new Date().toISOString()
          };
        });

        if (!items || items.length === 0) {
          items = generateSmartFallbackTestimonial(prompt, course_title, tone, language);
        }
      } catch (geminiErr: any) {
        console.warn('[AI Social] High demand fallback triggered:', geminiErr?.message || geminiErr);
        items = generateSmartFallbackTestimonial(prompt, course_title, tone, language);
      }

      return res.status(200).json({
        success: true,
        mode: 'testimonial',
        items
      });
    }

    if (mode === 'community') {
      const countComments = Math.min(Math.max(1, Number(num_comments) || 2), 4);
      
      const systemInstruction = isEn
        ? `You are a Community Manager and Psychologist specialized in Female Communities and Relationship Dynamics.
Your mission is to transform the administrator's notes into a vibrant, 100% natural community conversation thread in ENGLISH:
1. One main post written by a female member sharing a real vulnerability, question, breakthrough, or experience.
2. A sequence of ${countComments} authentic, supportive replies from other female members offering encouragement, personal validation, and practical tips.

CRITICAL GUIDELINES:
- LANGUAGE: Write exclusively in fluent, natural English.
- Avoid robotic or marketing language. It must feel like real women in an exclusive supportive sisterhood.
- Give each commenter a distinct English female name and persona (e.g. Ashley Davies, Jessica Miller, Chloe Bennett, Hannah Brooks).
- Strictly return JSON conforming to the schema.`
        : (isEs
          ? `Eres una Community Manager especializada en Comunidades Femeninas.
Crea un hilo vibrante en ESPAÑOL con un post principal y ${countComments} comentarios realistas de otras alumnas.
Usa nombres femeninos hispanos auténticos y lenguaje cercano.`
          : `Você é um Community Manager e Psicólogo especialista em Dinâmica de Comunidades Femininas e Relacionamentos.
Sua missão é transformar um rascunho de ideia em um tópico vibrante e realista da Comunidade em PORTUGUÊS:
1. Uma publicação principal feita por uma aluna de forma 100% natural e humana.
2. Uma sequência de ${countComments} comentários/respostas realistas de outras alunas ou membros.
Retorne estritamente JSON no schema especificado.`);

      const userPrompt = isEn
        ? `ADMINISTRATOR'S DRAFT FOR COMMUNITY POST:
"""
${prompt.trim()}
"""

Tone: ${tone}
Number of peer reply comments to generate: ${countComments}
Generate ${Math.min(Math.max(1, Number(variations) || 1), 3)} variation(s) of this complete thread strictly in English.`
        : `RASCUNHO DO ADMINISTRADOR PARA A COMUNIDADE:
"""
${prompt.trim()}
"""

Tom desejado: ${tone}
Quantidade de comentários de apoio: ${countComments}
Gere ${Math.min(Math.max(1, Number(variations) || 1), 3)} variação(ões) deste tópico completo no idioma ${language}.`;

      const responseSchema = {
        type: Type.OBJECT,
        properties: {
          items: {
            type: Type.ARRAY,
            description: 'List of community threads',
            items: {
              type: Type.OBJECT,
              properties: {
                post: {
                  type: Type.OBJECT,
                  properties: {
                    user_name: { type: Type.STRING, description: 'Name of the author of the post' },
                    content: { type: Type.STRING, description: 'Text of the main community post' },
                    user_avatar_url: { type: Type.STRING, description: 'Avatar URL' }
                  },
                  required: ['user_name', 'content']
                },
                comments: {
                  type: Type.ARRAY,
                  description: 'List of peer replies/comments',
                  items: {
                    type: Type.OBJECT,
                    properties: {
                      user_name: { type: Type.STRING, description: 'Name of the commenter' },
                      content: { type: Type.STRING, description: 'Text of the reply comment' },
                      user_avatar_url: { type: Type.STRING, description: 'Avatar URL' }
                    },
                    required: ['user_name', 'content']
                  }
                }
              },
              required: ['post', 'comments']
            }
          }
        },
        required: ['items']
      };

      let items: any[] = [];
      try {
        const result = await generateContentWithRetry({
          ai,
          candidateModels: ['gemini-3.1-flash-lite', 'gemini-3.8-flash'],
          contents: [userPrompt],
          config: {
            systemInstruction,
            responseMimeType: 'application/json',
            responseSchema,
            temperature: 0.85
          },
          perCallTimeoutMs: 14000,
          totalBudgetMs: 25000,
          maxAttemptsPerModel: 1,
          logPrefix: '[AI Social - Community]'
        });

        const parsed = safeParseAiJson<{ items: any[] }>(result.text, { items: [] });
        let avatarCounter = 0;

        items = (parsed.items || []).map((thread, threadIdx) => {
          const postAuthorAvatar = thread.post?.user_avatar_url && thread.post.user_avatar_url.startsWith('http')
            ? thread.post.user_avatar_url
            : getRandomWomanAvatar(threadIdx * 31 + Math.floor(Math.random() * 50));

          const defaultAuthor = isEn ? 'Member' : (isEs ? 'Alumna' : 'Aluna');

          const enrichedComments = (thread.comments || []).map((comm: any) => {
            const commAvatar = comm.user_avatar_url && comm.user_avatar_url.startsWith('http')
              ? comm.user_avatar_url
              : getRandomWomanAvatar((threadIdx * 30 + (avatarCounter++) * 17 + Math.floor(Math.random() * 20)) % 95 + 1);

            return {
              id: `ai-comm-${Date.now()}-${avatarCounter}`,
              user_name: comm.user_name || defaultAuthor,
              user_avatar_url: commAvatar,
              content: comm.content || ''
            };
          });

          return {
            id: `ai-thread-${Date.now()}-${threadIdx + 1}`,
            post: {
              user_name: thread.post?.user_name || defaultAuthor,
              user_avatar_url: postAuthorAvatar,
              content: thread.post?.content || prompt
            },
            comments: enrichedComments
          };
        });

        if (!items || items.length === 0) {
          items = generateSmartFallbackCommunity(prompt, tone, countComments, language);
        }
      } catch (geminiErr: any) {
        console.warn('[AI Social] High demand community fallback triggered:', geminiErr?.message || geminiErr);
        items = generateSmartFallbackCommunity(prompt, tone, countComments, language);
      }

      return res.status(200).json({
        success: true,
        mode: 'community',
        items
      });
    }

    return res.status(400).json({ error: `Invalid mode: ${mode}. Use 'testimonial' or 'community'.` });
  } catch (error: any) {
    console.error('[AI Social Error]', error);
    return res.status(500).json({
      error: error.message || 'Error generating AI social content'
    });
  }
}
