import { createClient } from '@supabase/supabase-js';

// Type definitions for request/response (eliminates dependency on @vercel/node for Supabase/Deno compatibility)
export interface VercelRequest {
  method?: string;
  headers: Record<string, string | string[] | undefined> | any;
  query?: Record<string, string | string[] | undefined> | any;
  body?: any;
  [key: string]: any;
}

export interface VercelResponse {
  status: (code: number) => VercelResponse;
  json: (data: any) => any;
  end: () => any;
  setHeader: (name: string, value: string) => any;
  [key: string]: any;
}

declare const Deno: any;

const getEnvVar = (key: string): string => {
  if (typeof process !== 'undefined' && process?.env && process.env[key]) {
    return process.env[key] || '';
  }
  if (typeof Deno !== 'undefined' && typeof Deno.env?.get === 'function') {
    try {
      return Deno.env.get(key) || '';
    } catch {
      return '';
    }
  }
  return '';
};

const supabaseUrl = 
  getEnvVar('SUPABASE_URL') || 
  getEnvVar('VITE_SUPABASE_URL') || 
  '';

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
  getEnvVar('SUPABASE_SERVICE_ROLE_KEY') || 
  getEnvVar('SUPABASE_SERVICE_KEY') || 
  getEnvVar('SUPABASE_SECRET_KEY') || 
  getEnvVar('VITE_SUPABASE_SERVICE_ROLE_KEY') || 
  '';

const supabaseServiceRoleKey = isRevokedKey(rawServiceRoleKey) ? '' : rawServiceRoleKey;

const supabaseAnonKey = 
  getEnvVar('SUPABASE_ANON_KEY') || 
  getEnvVar('VITE_SUPABASE_ANON_KEY') || 
  '';

const supabaseAdmin = createClient(supabaseUrl || 'https://placeholder.supabase.co', supabaseServiceRoleKey || supabaseAnonKey || 'placeholder-key', {
  auth: {
    persistSession: false,
    autoRefreshToken: false,
    detectSessionInUrl: false
  }
});

async function getAppSettingsSafe() {
  try {
    const { data, error } = await supabaseAdmin
      .from('app_settings')
      .select('custom_texts')
      .eq('id', 1)
      .maybeSingle();

    if (!error && data) return data;

    if (supabaseAnonKey) {
      const anonClient = createClient(supabaseUrl || 'https://placeholder.supabase.co', supabaseAnonKey);
      const { data: anonData } = await anonClient
        .from('app_settings')
        .select('custom_texts')
        .eq('id', 1)
        .maybeSingle();
      if (anonData) return anonData;
    }
    return data || null;
  } catch {
    if (supabaseAnonKey) {
      try {
        const anonClient = createClient(supabaseUrl || 'https://placeholder.supabase.co', supabaseAnonKey);
        const { data: anonData } = await anonClient
          .from('app_settings')
          .select('custom_texts')
          .eq('id', 1)
          .maybeSingle();
        return anonData || null;
      } catch {}
    }
    return null;
  }
}

export async function processHotmartWebhookPayload(payload: any) {
  // 1. Extrair informações do comprador e evento
  const eventRaw = payload.event || payload.status || payload.transaction_status || 'PURCHASE_APPROVED';
  const event = String(eventRaw).toUpperCase();

  const buyerEmailRaw = 
    payload.data?.buyer?.email || 
    payload.buyer?.email || 
    payload.buyer_email || 
    payload.email || 
    payload.data?.subscriber?.email ||
    payload.subscriber?.email;

  if (!buyerEmailRaw || typeof buyerEmailRaw !== 'string') {
    throw new Error('E-mail do comprador não encontrado no payload da Hotmart.');
  }

  const email = buyerEmailRaw.trim().toLowerCase();
  const buyerName = payload.data?.buyer?.name || payload.buyer?.name || payload.name || 'Aluna Hotmart';
  const transactionId = payload.data?.purchase?.transaction || payload.transaction || payload.prod || ('HOTMART_' + Date.now());
  const numericProductId = payload.data?.product?.id ?? payload.prod ?? payload.product_id ?? payload.data?.subscription?.product?.id;
  const ucodeProductId = payload.data?.product?.ucode;

  let hotmartProductId = "";
  if (numericProductId !== undefined && numericProductId !== null && String(numericProductId).trim() !== "" && String(numericProductId).trim() !== "0") {
    hotmartProductId = String(numericProductId).trim();
  } else if (ucodeProductId && String(ucodeProductId).trim() !== "") {
    hotmartProductId = String(ucodeProductId).trim();
  } else if (numericProductId !== undefined && numericProductId !== null && String(numericProductId).trim() !== "") {
    hotmartProductId = String(numericProductId).trim();
  }

  console.log(`[Hotmart Webhook API] Processing event "${event}" for email "${email}", Product ID: ${hotmartProductId || '0 (Sandbox)'}`);

  // 2. IDEMPOTÊNCIA: Verificar se evento já foi processado
  // 2. Idempotência Inteligente: Verificar se já foi processado E se usuário ainda existe
  if (transactionId && event && !payload.is_simulation) {
    try {
      const { data: existingEvent } = await supabaseAdmin
        .from('hotmart_events')
        .select('id, status')
        .eq('transaction_id', transactionId)
        .eq('event', event)
        .maybeSingle();

      if (existingEvent && existingEvent.status === 'processed') {
        let userStillExists = false;
        try {
          const { data: prof } = await supabaseAdmin
            .from('profiles')
            .select('id, email')
            .ilike('email', email)
            .maybeSingle();

          if (prof?.id) {
            try {
              const { data: authUser, error: authErr } = await supabaseAdmin.auth.admin.getUserById(prof.id);
              if (!authErr && authUser?.user) {
                userStillExists = true;
              }
            } catch (_) {
              userStillExists = true;
            }
          }

          if (!userStillExists) {
            try {
              const { data: authList } = await supabaseAdmin.auth.admin.listUsers();
              const foundInAuth = authList?.users?.find((u: any) => u.email?.toLowerCase().trim() === email.toLowerCase().trim());
              if (foundInAuth) {
                userStillExists = true;
              }
            } catch (_) {}
          }
        } catch (chkErr) {}

        if (userStillExists) {
          return {
            success: true,
            message: 'Evento já processado anteriormente e usuário já existe (Idempotência mantida).',
            transaction_id: transactionId,
            event: event
          };
        }
        console.log(`[Hotmart Webhook API] Evento ${event} (${transactionId}) constava como processado, mas usuário ${email} não existe no Supabase. Reprocessando...`);
      }
    } catch (e) {
      // Tabela hotmart_events pode ainda não ter sido criada
    }
  }

  // 3. Mapeamento do Produto
  let productType: 'main_product' | 'course' | 'package' | 'ai_subscription' = 'main_product';
  let internalTargetId: string | null = null;
  let configuredMainId = '';
  let configuredAiId = '';

  const { data: settings } = await supabaseAdmin
    .from('app_settings')
    .select('custom_texts')
    .eq('id', 1)
    .maybeSingle();

  configuredMainId = settings?.custom_texts?.['hotmart.main_product_id'] || settings?.custom_texts?.['main_course_hotmart_id'] || '';
  configuredAiId = settings?.custom_texts?.['hotmart.unlimited_ai_product_id'] || settings?.custom_texts?.['hotmart.ai_product_id'] || '';

  if (hotmartProductId) {
    try {
      // Check explicit mapping table
      const { data: mapping } = await supabaseAdmin
        .from('hotmart_products')
        .select('*')
        .eq('hotmart_product_id', hotmartProductId)
        .eq('is_active', true)
        .maybeSingle();

      if (mapping) {
        productType = mapping.product_type as any;
        internalTargetId = mapping.internal_target_id;
      } else {
        const catalogList = Array.isArray(settings?.custom_texts?.hotmart_products_catalog) 
          ? settings.custom_texts.hotmart_products_catalog 
          : [];
        const catalogMatch = catalogList.find(
          (p: any) => String(p.hotmart_product_id).trim() === hotmartProductId.trim() && p.is_active !== false
        );

        if (catalogMatch) {
          productType = catalogMatch.product_type as any;
          internalTargetId = catalogMatch.internal_target_id || null;
        } else {
          const productName = (
            payload.data?.product?.name || 
            payload.product_name || 
            payload.prod_name || 
            payload.data?.subscription?.plan?.name || 
            ''
          ).toString().toLowerCase();

          // Check Main Product ID FIRST to strictly avoid treating main course purchases as AI!
          if (configuredMainId && String(configuredMainId).trim() === String(hotmartProductId).trim()) {
            productType = 'main_product';
          } else if (
            (configuredAiId && String(configuredAiId).trim() === String(hotmartProductId).trim()) ||
            ['ai_subscription', 'prod_ai_default', 'hotmart_ia_victoria'].includes(hotmartProductId.toLowerCase())
          ) {
            productType = 'ai_subscription';
          } else {
            // Check courses/packages tables
            const { data: courseMatch } = await supabaseAdmin
              .from('courses')
              .select('id')
              .eq('hotmart_product_id', hotmartProductId)
              .maybeSingle();

            if (courseMatch) {
              productType = 'course';
              internalTargetId = courseMatch.id;
            } else {
              const { data: packageMatch } = await supabaseAdmin
                .from('course_packages')
                .select('id')
                .eq('hotmart_product_id', hotmartProductId)
                .maybeSingle();

              if (packageMatch) {
                productType = 'package';
                internalTargetId = packageMatch.id;
              } else if (
                // Strict regex keyword match for AI — avoid matching 'ia' inside words like 'extraordinária'
                /\b(ia\s*expert|chat\s*ia|ia\s*ilimitad|inteligencia\s*artificial|ia\s*victoria|victoria\s*ia)\b/i.test(productName) ||
                productName === 'ia' ||
                productName === 'ai'
              ) {
                productType = 'ai_subscription';
              }
            }
          }
        }
      }
    } catch (e) {
      console.warn('[Hotmart Webhook API] Mapping lookup warning:', e);
    }
  }

  // 4. Determinar aprovação vs revogação
  const isApprovalEvent = 
    event.includes('APPROVED') || 
    event.includes('COMPLETE') || 
    event.includes('ACTIVATED') || 
    event.includes('APROVAD') || 
    event.includes('COMPLET') || 
    event === 'PURCHASE_OUT_OF_SHOPPING_CART' ||
    event === 'SUBSCRIPTION_RENEWAL';

  const isRevocationEvent = 
    event.includes('REFUNDED') || 
    event.includes('CANCELED') || 
    event.includes('CANCELLED') || 
    event.includes('CHARGEBACK') || 
    event.includes('EXPIRED') || 
    event.includes('REEMBOLS') || 
    event.includes('INACTIVE');

  // 5. User lookup e criação/recriação
  let targetUserId: string | null = null;
  let existingProfile: any = null;

  try {
    const { data: prof } = await supabaseAdmin
      .from('profiles')
      .select('id, email, has_access, has_unlimited_ai')
      .ilike('email', email)
      .maybeSingle();

    if (prof?.id) {
      existingProfile = prof;
      try {
        const { data: authUser, error: authErr } = await supabaseAdmin.auth.admin.getUserById(prof.id);
        if (!authErr && authUser?.user) {
          targetUserId = prof.id;
        }
      } catch (_) {
        targetUserId = prof.id;
      }
    }

    if (!targetUserId && email) {
      try {
        const { data: authList } = await supabaseAdmin.auth.admin.listUsers();
        const foundAuth = authList?.users?.find((u: any) => u.email && u.email.toLowerCase().trim() === email.toLowerCase().trim());
        if (foundAuth) {
          targetUserId = foundAuth.id;
        }
      } catch (e) {
        console.warn('[Hotmart Webhook API] Auth user lookup error:', e);
      }
    }
  } catch (err) {}

  if (!targetUserId && isApprovalEvent) {
    try {
      const tempPassword = '123456';
      const { data: newUser, error: createError } = await supabaseAdmin.auth.admin.createUser({
        email: email,
        password: tempPassword,
        email_confirm: true,
        user_metadata: { full_name: buyerName }
      });

      if (newUser?.user) {
        targetUserId = newUser.user.id;
      } else {
        const errMsg = (createError?.message || '').toLowerCase();
        if (errMsg.includes('already registered') || errMsg.includes('already exists') || errMsg.includes('unique')) {
          const { data: authList } = await supabaseAdmin.auth.admin.listUsers();
          const found = authList?.users?.find((u: any) => u.email && u.email.toLowerCase().trim() === email.toLowerCase().trim());
          if (found) targetUserId = found.id;
        }
      }
    } catch (err: any) {
      console.warn('[Hotmart Webhook API] Auto-user creation error:', err.message);
    }

    // Se falhar ao criar o usuário, lançar erro para não registrar como processado (exceto se for simulação)
    if (!targetUserId) {
      if (payload.is_simulation || payload.data?.is_simulation) {
        targetUserId = existingProfile?.id || null;
      } else {
        throw new Error(`Falha ao criar usuário no Supabase Auth para ${email}. Não será marcado como processed.`);
      }
    }
  }

  // Garantir profile sincronizado
  if (targetUserId && isApprovalEvent) {
    try {
      if (existingProfile && existingProfile.id !== targetUserId) {
        await supabaseAdmin.from('profiles').delete().eq('id', existingProfile.id);
      }

      await supabaseAdmin.from('profiles').upsert({
        id: targetUserId,
        email: email,
        full_name: buyerName,
        has_access: true,
        has_unlimited_ai: productType === 'ai_subscription' ? true : (existingProfile?.has_unlimited_ai || false),
        updated_at: new Date().toISOString()
      }, { onConflict: 'id' });
    } catch (profErr) {
      console.warn('[Hotmart Webhook API] Profile upsert notice:', profErr);
    }
  }

  // 6. Executar liberação ou revogação
  let actionSummary = '';
  const aiProductIdsToDelete = Array.from(new Set([
    'ai_subscription',
    'prod_ai_default',
    'HOTMART_IA_VICTORIA',
    'hotmart_ia_victoria',
    'ia_vip',
    'IA_VIP',
    'unlimited_ai',
    'ai_unlimited',
    ...(hotmartProductId ? [String(hotmartProductId)] : []),
    ...(configuredAiId ? [String(configuredAiId)] : [])
  ].filter(Boolean)));

  if (isApprovalEvent) {
    if (productType === 'main_product') {
      if (targetUserId) {
        await supabaseAdmin
          .from('profiles')
          .update({ has_access: true, updated_at: new Date().toISOString() })
          .eq('id', targetUserId);
      }
      await supabaseAdmin
        .from('profiles')
        .update({ has_access: true, updated_at: new Date().toISOString() })
        .ilike('email', email);

      actionSummary = 'Acesso Principal à Plataforma ATIVADO';
    } else if (productType === 'ai_subscription') {
      if (targetUserId) {
        await supabaseAdmin
          .from('profiles')
          .update({ has_unlimited_ai: true, has_access: true, updated_at: new Date().toISOString() })
          .eq('id', targetUserId);
      }
      await supabaseAdmin
        .from('profiles')
        .update({ has_unlimited_ai: true, has_access: true, updated_at: new Date().toISOString() })
        .ilike('email', email);

      if (targetUserId) {
        await supabaseAdmin.from('purchases').upsert({
          user_id: targetUserId,
          product_id: 'ai_subscription',
          created_at: new Date().toISOString()
        }, { onConflict: 'user_id,product_id' as any });
      }

      actionSummary = 'Assinatura IA Expert VIP ATIVADA';
    } else if ((productType === 'course' || productType === 'package') && internalTargetId && targetUserId) {
      await supabaseAdmin
        .from('profiles')
        .update({ has_access: true, updated_at: new Date().toISOString() })
        .eq('id', targetUserId);

      await supabaseAdmin.from('purchases').upsert({
        user_id: targetUserId,
        product_id: internalTargetId,
        created_at: new Date().toISOString()
      }, { onConflict: 'user_id,product_id' as any });

      actionSummary = `Produto Adicional (${productType}) Liberado: ${internalTargetId}`;
    }
  } else if (isRevocationEvent) {
    if (productType === 'main_product') {
      if (targetUserId) {
        await supabaseAdmin
          .from('profiles')
          .update({ has_access: false, updated_at: new Date().toISOString() })
          .eq('id', targetUserId);
      }
      await supabaseAdmin
        .from('profiles')
        .update({ has_access: false, updated_at: new Date().toISOString() })
        .ilike('email', email);

      actionSummary = 'Acesso Principal à Plataforma PAUSADO (Histórico Preservado)';
    } else if (productType === 'ai_subscription') {
      if (targetUserId) {
        await supabaseAdmin
          .from('profiles')
          .update({ has_unlimited_ai: false, updated_at: new Date().toISOString() })
          .eq('id', targetUserId);

        await supabaseAdmin
          .from('purchases')
          .delete()
          .eq('user_id', targetUserId)
          .in('product_id', aiProductIdsToDelete);
      }

      await supabaseAdmin
        .from('profiles')
        .update({ has_unlimited_ai: false, updated_at: new Date().toISOString() })
        .ilike('email', email);

      actionSummary = 'Assinatura IA Expert VIP REVOGADA';
    } else if ((productType === 'course' || productType === 'package') && internalTargetId) {
      if (targetUserId) {
        await supabaseAdmin
          .from('purchases')
          .delete()
          .eq('user_id', targetUserId)
          .eq('product_id', internalTargetId);
      }

      actionSummary = `Produto Adicional (${productType}) Bloqueado: ${internalTargetId}`;
    }
  }

  // 7. Salvar ou atualizar log de eventos e vendas
  try {
    const eventRecord = {
      transaction_id: transactionId,
      event: event,
      buyer_email: email,
      hotmart_product_id: hotmartProductId || null,
      status: 'processed',
      payload: payload,
      processed_at: new Date().toISOString()
    };

    const { data: existingEv } = await supabaseAdmin
      .from('hotmart_events')
      .select('id')
      .eq('transaction_id', transactionId)
      .eq('event', event)
      .maybeSingle();

    if (existingEv?.id) {
      await supabaseAdmin.from('hotmart_events').update(eventRecord).eq('id', existingEv.id);
    } else {
      await supabaseAdmin.from('hotmart_events').insert(eventRecord);
    }
  } catch (e) {}

  try {
    let resolvedName = payload.data?.product?.name;
    if (!resolvedName || resolvedName.includes('(Simulação)')) {
      if (productType === 'main_product') resolvedName = 'Acesso Geral à Plataforma (Produto Principal)';
      else if (productType === 'ai_subscription') resolvedName = 'Assinatura IA Expert VIP (Ilimitada)';
      else resolvedName = 'Produto Hotmart (' + (hotmartProductId || configuredMainId || 'Sem ID') + ')';
    }

    const rawAmount = Number(
      payload.data?.purchase?.price?.value ?? 
      payload.data?.purchase?.full_price?.value ?? 
      payload.price ?? 
      97
    ) || 0;

    const saleStatus = isApprovalEvent ? 'approved' :
      event.includes('REFUND') || event.includes('REEMBOLS') ? 'refunded' :
      event.includes('CANCEL') ? 'canceled' : 'approved';

    await supabaseAdmin.from('sales').upsert({
      transaction_id: transactionId || ('TRX_' + Date.now()),
      buyer_name: buyerName || 'Comprador Hotmart',
      buyer_email: email,
      buyer_phone: payload.data?.buyer?.checkout_phone || null,
      product_id: hotmartProductId || configuredMainId || 'main_product',
      product_name: resolvedName,
      product_type: productType,
      amount: rawAmount,
      currency: 'BRL',
      payment_type: 'PIX',
      status: saleStatus,
      event_type: event,
      purchase_date: new Date().toISOString(),
      raw_payload: payload,
      updated_at: new Date().toISOString()
    }, { onConflict: 'transaction_id' });
  } catch (e) {}

  return {
    success: true,
    email: email,
    event: event,
    product_type: productType,
    action: actionSummary,
    message: `Status atualizado com sucesso para ${email}.`
  };
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // CORS Headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Hotmart-Hottok');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method === 'GET') {
    return res.status(200).json({
      status: 'online',
      service: 'Hotmart Webhook API (Automação de Produtos & Assinaturas)',
      timestamp: new Date().toISOString(),
      instructions: 'Configure esta URL no menu de Webhook da Hotmart para liberação automática de alunos.'
    });
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed. Use POST for webhooks.' });
  }

  try {
    const payload = req.body || {};
    console.log('[Hotmart Webhook API] Payload received:', JSON.stringify(payload));

    // Token validation
    const receivedToken = 
      (req.headers['x-hotmart-hottok'] as string) || 
      (req.query?.token as string) || 
      (req.query?.hottok as string) || 
      payload.hottok || 
      payload.token;

    const cleanToken = (t?: any) => t ? String(t).trim().replace(/^["']|["']$/g, '').trim() : '';
    const cleanReceived = cleanToken(receivedToken);

    const envToken = cleanToken(getEnvVar('HOTMART_WEBHOOK_TOKEN'));
    let settingsToken: string | null = null;
    
    try {
      const settings = await getAppSettingsSafe();
      if (settings?.custom_texts?.['hotmart.webhook_token']) {
        settingsToken = cleanToken(settings.custom_texts['hotmart.webhook_token']);
      }
    } catch {}

    const isSimulation = 
      req.headers['x-simulation'] === 'true' || 
      (req.query && req.query['x-simulation'] === 'true') ||
      payload.is_simulation === true || 
      cleanReceived === 'SIMULATION_TOKEN';

    if (isSimulation) {
      payload.is_simulation = true;
    }

    const validTokens = [envToken, settingsToken].filter(Boolean) as string[];

    if (validTokens.length > 0) {
      const isTokenValid = validTokens.some(tok => tok === cleanReceived);
      const isSimAuthorized = isSimulation;

      if (!isTokenValid && !isSimAuthorized) {
        return res.status(401).json({ 
          error: 'Unauthorized: Invalid Hotmart Token (hottok)',
          tip: 'Configure o token Hottok idêntico no painel da Hotmart e nas configurações do sistema.' 
        });
      }
    }

    const result = await processHotmartWebhookPayload(payload);
    return res.status(200).json(result);

  } catch (err: any) {
    console.error('[Hotmart Webhook API Error]:', err);
    return res.status(500).json({
      error: 'Internal error processing Hotmart webhook',
      details: err.message
    });
  }
}

// Suporte nativo caso seja implantado diretamente como Supabase Edge Function (Deno Runtime)
if (typeof Deno !== 'undefined' && typeof Deno.serve === 'function') {
  Deno.serve(async (req: Request) => {
    const corsHeaders = {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET,POST,OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Hotmart-Hottok',
    };

    if (req.method === 'OPTIONS') {
      return new Response('ok', { headers: corsHeaders });
    }

    if (req.method === 'GET') {
      return new Response(
        JSON.stringify({
          status: 'online',
          service: 'Hotmart Webhook API (Automação de Produtos & Assinaturas)',
          timestamp: new Date().toISOString(),
          instructions: 'Configure esta URL no menu de Webhook da Hotmart para liberação automática de alunos.'
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
      );
    }

    if (req.method !== 'POST') {
      return new Response(
        JSON.stringify({ error: 'Method not allowed. Use POST for webhooks.' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 405 }
      );
    }

    try {
      const url = new URL(req.url);
      const bodyText = await req.text();
      let payload: any = {};
      try {
        payload = JSON.parse(bodyText);
      } catch {
        payload = {};
      }

      const receivedToken =
        req.headers.get('x-hotmart-hottok') ||
        url.searchParams.get('token') ||
        url.searchParams.get('hottok') ||
        payload.hottok ||
        payload.token;

      const cleanToken = (t?: any) => t ? String(t).trim().replace(/^["']|["']$/g, '').trim() : '';
      const cleanReceived = cleanToken(receivedToken);

      const envToken = cleanToken(getEnvVar('HOTMART_WEBHOOK_TOKEN'));
      let settingsToken: string | null = null;
      try {
        const settings = await getAppSettingsSafe();
        if (settings?.custom_texts?.['hotmart.webhook_token']) {
          settingsToken = cleanToken(settings.custom_texts['hotmart.webhook_token']);
        }
      } catch {}

      const isSimulation =
        req.headers.get('x-simulation') === 'true' ||
        url.searchParams.get('x-simulation') === 'true' ||
        payload.is_simulation === true ||
        cleanReceived === 'SIMULATION_TOKEN';

      if (isSimulation) {
        payload.is_simulation = true;
      }

      const validTokens = [envToken, settingsToken].filter(Boolean) as string[];

      if (validTokens.length > 0) {
        const isTokenValid = validTokens.some(tok => tok === cleanReceived);
        if (!isTokenValid && !isSimulation) {
          return new Response(
            JSON.stringify({
              error: 'Unauthorized: Invalid Hotmart Token (hottok)',
              tip: 'Configure o token Hottok idêntico no painel da Hotmart e nas configurações do sistema.'
            }),
            { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 401 }
          );
        }
      }

      const result = await processHotmartWebhookPayload(payload);
      return new Response(
        JSON.stringify(result),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
      );
    } catch (err: any) {
      console.error('[Hotmart Webhook Deno Error]:', err);
      return new Response(
        JSON.stringify({
          error: 'Internal error processing Hotmart webhook',
          details: err.message
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
      );
    }
  });
}
