// Shared exact block schemas, tone profiles, and post-generation normalizer
// strictly aligned with src/components/BlockLessonViewer.tsx and src/types/lms.ts

export const LESSON_BLOCK_SCHEMAS_PROMPT = `EXACT RENDERER-COMPATIBLE BLOCK SCHEMAS (FOLLOW FIELD NAMES STRICTLY):
Every block object MUST include: "id" (unique string), "type" (one of the exact strings below), "title" (concise title), "description" (1-sentence purpose).

1. "text" — Masterclass teaching article (Rich HTML):
   {
     "id": "blk_1",
     "type": "text",
     "title": "Mechanism & Strategic Framework",
     "description": "Why this pattern occurs and how to shift it",
     "content": "<h3>Clear Section Title</h3><p>Deep, concrete explanation with real mechanisms...</p><div class='p-4 bg-emerald-500/10 border-l-4 border-emerald-400 rounded-r-2xl my-4 text-emerald-200'><strong>Strategic Rule:</strong> Actionable rule here.</div><h4>Real-World Application</h4><ul><li><strong>Concrete Example / Script:</strong> Exact wording or tactic...</li></ul>"
   }

2. "comparison" — Contrast Common Flawed Mistake vs. Strategic Protocol (2–3 items):
   {
     "id": "blk_2",
     "type": "comparison",
     "title": "Reactive Trap vs. Calibrated Execution",
     "description": "Spot the subtle mistake and replace it immediately",
     "items": [
       {
         "id": "cmp_1",
         "title": "Specific Situation Name",
         "before_text": "Exact flawed habit or script people use under pressure...",
         "after_text": "Exact calibrated response or behavior with rationale..."
       }
     ]
   }

3. "simulator" — High-stakes interactive decision tree (1–2 realistic scenarios):
   {
     "id": "blk_3",
     "type": "simulator",
     "title": "Decision Simulator: [Specific Situation]",
     "description": "Choose your move and see the downstream consequence",
     "items": [
       {
         "id": "sim_1",
         "title": "Detailed realistic scenario setup with specific context and stakes...",
         "options": [
           "Option A: Tempting reactive mistake (realistic, not cartoonish)",
           "Option B: Optimal strategic move",
           "Option C: Over-passive or avoidant trap"
         ],
         "consequences": {
           "0": "❌ Why Option A backfires psychologically/practically and what happens next.",
           "1": "✅ Why Option B works and preserves leverage/clarity.",
           "2": "⚠️ Why Option C creates ambiguity or missed momentum."
         }
       }
     ]
   }

4. "readiness_evaluator" — Scored self-diagnostic / calculator (DO NOT use type "calculator"; ALWAYS use "readiness_evaluator"):
   {
     "id": "blk_4",
     "type": "readiness_evaluator",
     "title": "Diagnostic Scorecard",
     "description": "Check all statements that are currently true for you",
     "items": [
       { "id": "re_1", "title": "Specific observable behavior or readiness indicator", "weight": 25 },
       { "id": "re_2", "title": "Second specific indicator", "weight": 25 },
       { "id": "re_3", "title": "Third specific indicator", "weight": 25 },
       { "id": "re_4", "title": "Fourth specific indicator", "weight": 25 }
     ],
     "result_tiers": [
       { "min_score": 0, "max_score": 49, "title": "Tier 1 Name", "recommendation": "Specific corrective action for low scores." },
       { "min_score": 50, "max_score": 79, "title": "Tier 2 Name", "recommendation": "Targeted refinement for intermediate scores." },
       { "min_score": 80, "max_score": 100, "title": "Tier 3 Name", "recommendation": "Advancement protocol for high readiness." }
     ]
   }

5. "checklist" or "action_plan" — Step-by-step tactical implementation (3–5 concrete items):
   {
     "id": "blk_5",
     "type": "action_plan",
     "title": "Immediate Execution Protocol",
     "description": "Complete each step in sequence",
     "items": [
       {
         "id": "act_1",
         "title": "Step 1: Concrete Action Verb + Deliverable",
         "description": "Exact HOW and WHY to execute this step in under 10 minutes.",
         "category": "Phase 1",
         "required": true
       }
     ]
   }

6. "timeline" — Chronological progression or phased roadmap:
   {
     "id": "blk_6",
     "type": "timeline",
     "title": "Phased Rollout Roadmap",
     "description": "What to execute across each timeframe",
     "items": [
       { "id": "tl_1", "day": "Days 1–3", "title": "Phase Title", "description": "Concrete milestone and focus." }
     ]
   }

7. "tracker" — Interactive daily habit/streak counter (ONLY include when tracking days/habits adds genuine value; tailor label & milestones to the EXACT lesson topic!):
   {
     "id": "blk_7",
     "type": "tracker",
     "title": "Topic-Specific Streak Tracker",
     "description": "Track your consecutive days of applying this protocol",
     "tracker_label": "Topic-Specific Consistency Streak",
     "tracker_target_days": 21,
     "tracker_milestones": [
       { "day": 1, "title": "Day 1 Milestone", "reward_badge": "🛡️" },
       { "day": 7, "title": "1 Week Milestone", "reward_badge": "🔥" },
       { "day": 14, "title": "2 Weeks Milestone", "reward_badge": "⚡" },
       { "day": 21, "title": "Mastery Milestone", "reward_badge": "👑" }
     ]
   }

8. "ai_analyzer" — Live student text/message analyzer (ONLY when analyzing incoming messages, scripts, or communication makes sense):
   {
     "id": "blk_8",
     "type": "ai_analyzer",
     "title": "Real-Time Communication Diagnostic",
     "description": "Paste a real message or draft to evaluate subtext and alignment",
     "instructions": "Paste the exact message you received or plan to send:",
     "placeholder": "Paste text here for instant diagnostic...",
     "analyzer_type": "temperature",
     "analyzer_criteria": "Domain-specific evaluation criteria for emotional tone, intent, and boundaries."
   }

9. "chart" — Visual progression/impact curve (Recharts):
   {
     "id": "blk_9",
     "type": "chart",
     "title": "Expected Progression Curve",
     "description": "Visual trajectory over consistent practice",
     "items": [
       { "id": "ch_1", "title": "Week 1", "day": "Week 1", "weight": 20 },
       { "id": "ch_2", "title": "Week 2", "day": "Week 2", "weight": 45 },
       { "id": "ch_3", "title": "Week 3", "day": "Week 3", "weight": 75 },
       { "id": "ch_4", "title": "Week 4", "day": "Week 4", "weight": 95 }
     ]
   }

10. "quiz" — Knowledge check with explanatory feedback (2–3 questions):
    {
      "id": "blk_10",
      "type": "quiz",
      "title": "Mastery Verification Quiz",
      "description": "Verify your grasp of the core distinction",
      "items": [
        {
          "id": "qz_1",
          "title": "Specific scenario-based question?",
          "options": ["Plausible misconception", "Correct principle-backed answer", "Common reactive error"],
          "correct_option_index": 1,
          "explanation": "Concise rationale explaining why option 2 holds and why the others fail."
        }
      ]
    }

11. "reflection" — Guided executive coaching journal prompt:
    {
      "id": "blk_11",
      "type": "reflection",
      "title": "Personal Integration Prompt",
      "description": "Apply this lesson to your real life right now",
      "instructions": "Specific, thought-provoking coaching prompt tied to today's lesson...",
      "placeholder": "Write your concrete situation and next move here..."
    }`;

export const TONE_DIRECTIVES: Record<string, string> = {
  authoritative_empathetic:
    'Voice: Calm, high-trust senior mentor. Validate the student’s lived friction without pity, pair deep emotional attunement with crisp, boundaried strategic clarity.',
  empathetic_persuasive:
    'Voice: Warm, deeply understanding guide who articulates unspoken pain accurately and builds confident momentum toward tangible relief.',
  authority_medical:
    'Voice: Evidence-based clinical & behavioral specialist. Ground every principle in clear neurobiology, psychology, or observable behavioral science—calm, reassuring, zero hype.',
  scientific:
    'Voice: Analytical, research-grounded educator. Explain root mechanisms, cause-and-effect loops, and measurable variables clearly.',
  direct_action:
    'Voice: Sharp, pragmatic tactician. Short sentences, zero fluff, concrete scripts, immediate checklists, and decisive execution.',
};

export function resolveLanguageName(lang?: string): string {
  const map: Record<string, string> = {
    en: 'American English (en-US)',
    'en-US': 'American English (en-US)',
    'pt-BR': 'Portuguese (Brazil)',
    pt: 'Portuguese (Brazil)',
    es: 'Spanish',
    fr: 'French',
    de: 'German',
    it: 'Italian',
  };
  if (!lang) return 'American English (en-US)';
  return map[lang] || map[lang.split('-')[0]] || 'American English (en-US)';
}

export function normalizeLessonBlocks(rawBlocks: any[], blockPrefix = 'blk'): any[] {
  if (!Array.isArray(rawBlocks)) return [];

  return rawBlocks
    .filter((b) => b && typeof b === 'object')
    .map((b: any, bIdx: number) => {
      const id = b.id || `${blockPrefix}_${Date.now()}_${bIdx}`;
      let type = String(b.type || 'text').toLowerCase().trim();

      // Map unsupported alias 'calculator' -> 'readiness_evaluator' (supported by BlockLessonViewer)
      if (type === 'calculator') {
        type = 'readiness_evaluator';
      }

      const normalized: any = {
        ...b,
        id,
        type,
        title: b.title || `Block ${bIdx + 1}`,
        description: b.description || '',
      };

      // Normalize simulator aliases (e.g. scenario_text + choices -> items)
      if (type === 'simulator') {
        let items = Array.isArray(b.items) ? b.items : [];
        if (items.length === 0 && (Array.isArray(b.choices) || b.scenario_text)) {
          const choices = Array.isArray(b.choices) ? b.choices : [];
          const consequences: Record<string, string> = {};
          const options = choices.map((ch: any, cIdx: number) => {
            if (ch?.feedback) consequences[String(cIdx)] = ch.feedback;
            return ch?.label || ch?.text || ch?.title || `Option ${cIdx + 1}`;
          });
          items = [
            {
              id: `sim_item_${bIdx}_0`,
              title: b.scenario_text || b.title || 'Scenario',
              options,
              consequences,
            },
          ];
        }
        normalized.items = items.map((it: any, itIdx: number) => ({
          ...it,
          id: it.id || `sim_${bIdx}_${itIdx}`,
          title: it.title || it.question || it.scenario || `Scenario ${itIdx + 1}`,
          options: Array.isArray(it.options) ? it.options : [],
          consequences: it.consequences || {},
        }));
      }

      // Normalize readiness_evaluator aliases (questions/tiers -> items/result_tiers)
      else if (type === 'readiness_evaluator') {
        const rawItems = Array.isArray(b.items)
          ? b.items
          : Array.isArray(b.questions)
          ? b.questions
          : [];
        normalized.items = rawItems.map((it: any, itIdx: number) => ({
          ...it,
          id: it.id || `re_${bIdx}_${itIdx}`,
          title: it.title || it.statement || it.text || `Criterion ${itIdx + 1}`,
          weight: typeof it.weight === 'number' ? it.weight : 25,
        }));

        const rawTiers = Array.isArray(b.result_tiers)
          ? b.result_tiers
          : Array.isArray(b.tiers)
          ? b.tiers
          : undefined;
        if (rawTiers) {
          normalized.result_tiers = rawTiers.map((t: any, tIdx: number) => ({
            min_score: typeof t.min_score === 'number' ? t.min_score : tIdx * 34,
            max_score: typeof t.max_score === 'number' ? t.max_score : (tIdx + 1) * 34,
            title: t.title || `Level ${tIdx + 1}`,
            recommendation: t.recommendation || t.diagnosis || '',
          }));
        }
      }

      // Normalize checklist / action_plan / exercise aliases (checklist_items/steps -> items)
      else if (type === 'checklist' || type === 'action_plan' || type === 'exercise') {
        const rawItems = Array.isArray(b.items)
          ? b.items
          : Array.isArray(b.checklist_items)
          ? b.checklist_items
          : Array.isArray(b.steps)
          ? b.steps
          : [];
        normalized.items = rawItems.map((it: any, itIdx: number) => {
          if (typeof it === 'string') {
            return {
              id: `chk_${bIdx}_${itIdx}`,
              title: it,
              description: '',
              category: 'Action',
              required: true,
            };
          }
          return {
            ...it,
            id: it.id || `chk_${bIdx}_${itIdx}`,
            title: it.title || it.text || it.label || `Step ${itIdx + 1}`,
            description: it.description || '',
            category: it.category || '',
            required: it.required !== false,
          };
        });
      }

      // Normalize quiz items
      else if (type === 'quiz') {
        const rawItems = Array.isArray(b.items)
          ? b.items
          : Array.isArray(b.questions)
          ? b.questions
          : [];
        normalized.items = rawItems.map((it: any, itIdx: number) => ({
          ...it,
          id: it.id || `qz_${bIdx}_${itIdx}`,
          title: it.title || it.question || `Question ${itIdx + 1}`,
          options: Array.isArray(it.options) ? it.options : [],
          correct_option_index: typeof it.correct_option_index === 'number' ? it.correct_option_index : 0,
          explanation: it.explanation || '',
        }));
      }

      // Generic items normalization for comparison / timeline / chart
      else if (Array.isArray(b.items)) {
        normalized.items = b.items.map((it: any, itIdx: number) => ({
          ...it,
          id: it.id || `item_${bIdx}_${itIdx}`,
          title: it.title || `Item ${itIdx + 1}`,
          description: it.description || '',
          category: it.category || '',
          day: it.day || '',
          required: it.required !== false,
          weight: typeof it.weight === 'number' ? it.weight : 10,
          before_text: it.before_text || '',
          after_text: it.after_text || '',
        }));
      }

      // Normalize ai_analyzer fields
      if (type === 'ai_analyzer') {
        normalized.instructions = b.instructions || b.description || '';
        normalized.placeholder = b.placeholder || b.analyzer_placeholder || '';
        normalized.analyzer_type = b.analyzer_type || 'temperature';
        normalized.analyzer_criteria = b.analyzer_criteria || '';
      }

      // Normalize tracker fields
      if (type === 'tracker') {
        normalized.tracker_label = b.tracker_label || b.title || 'Progress Tracker';
        normalized.tracker_target_days = Number(b.tracker_target_days) || 21;
        normalized.tracker_milestones = Array.isArray(b.tracker_milestones) ? b.tracker_milestones : undefined;
      }

      return normalized;
    });
}
