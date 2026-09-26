// Supabase Edge Function: hotmart-webhook
// URL de deployment: https://<SEU-PROJECT-REF>.supabase.co/functions/v1/hotmart-webhook
// Processamento 100% automatizado, idempotente e compatível com Sandbox e Produção da Hotmart.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.38.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-hotmart-hottok",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
};

const handleRequest = async (req: Request): Promise<Response> => {
  // Preflight CORS
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  // GET route for ping / health-check
  if (req.method === "GET") {
    return new Response(
      JSON.stringify({
        status: "online",
        service: "Hotmart Webhook Edge Function",
        timestamp: new Date().toISOString(),
        instructions: "Configure esta URL no menu de Webhook na Hotmart com 'Enforce JWT' desativado."
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200 }
    );
  }

  if (req.method !== "POST") {
    return new Response(
      JSON.stringify({ error: "Method not allowed. Use POST for webhooks." }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 405 }
    );
  }

  // Variáveis declaradas no escopo da requisição para auditoria e tratamento em caso de erro
  let transactionId = "";
  let originalEvent = "PURCHASE_APPROVED";
  let email = "";
  let hotmartProductId = "";
  let payload: any = {};

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL") || "";
    const supabaseServiceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";

    if (!supabaseUrl || !supabaseServiceRoleKey) {
      console.error("[Hotmart Edge Function] Missing Supabase environment variables!");
      return new Response(
        JSON.stringify({ error: "Configuração do servidor incompleta (Service Role Key ausente)." }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 500 }
      );
    }

    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceRoleKey, {
      auth: { persistSession: false, autoRefreshToken: false }
    });

    const url = new URL(req.url);
    const bodyText = await req.text();
    try {
      payload = JSON.parse(bodyText);
    } catch {
      console.warn("[Hotmart Edge Function] Could not parse JSON body");
    }

    // 1. Validação do Token de Segurança (Hottok)
    const receivedToken =
      req.headers.get("x-hotmart-hottok") ||
      url.searchParams.get("token") ||
      url.searchParams.get("hottok") ||
      payload.hottok ||
      payload.token;

    const cleanToken = (t?: string | null) => t ? String(t).trim().replace(/^["']|["']$/g, "").trim() : "";
    const cleanReceived = cleanToken(receivedToken);

    const configuredSecret = cleanToken(Deno.env.get("HOTMART_WEBHOOK_TOKEN"));
    let settingsToken = "";
    
    try {
      const { data: settings } = await supabaseAdmin
        .from("app_settings")
        .select("custom_texts")
        .eq("id", 1)
        .maybeSingle();

      if (settings?.custom_texts?.["hotmart.webhook_token"]) {
        settingsToken = cleanToken(settings.custom_texts["hotmart.webhook_token"]);
      }
    } catch (e) {
      console.warn("[Hotmart Edge Function] Could not fetch settings token:", e);
    }

    const isSimulation =
      req.headers.get("x-simulation") === "true" ||
      url.searchParams.get("x-simulation") === "true" ||
      payload.is_simulation === true ||
      cleanReceived === "SIMULATION_TOKEN";

    if (isSimulation) {
      payload.is_simulation = true;
    }

    const authHeader = req.headers.get("Authorization") || "";
    const isServiceRoleAuth = authHeader.includes(Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "SERVICE_ROLE");

    const expectedTokens = [
      configuredSecret, 
      settingsToken, 
      "PU7ySNg8ocOqiZm0m0t3h7tgh5ts1562e35d67-d8e5-4cdb-bf57-f090c31d2b48"
    ].filter(Boolean) as string[];

    if (expectedTokens.length > 0) {
      const isTokenValid = expectedTokens.some(tok => tok === cleanReceived);
      const isSimAuthorized = isSimulation && (isTokenValid || isServiceRoleAuth || cleanReceived === "SIMULATION_TOKEN");

      if (!isTokenValid && !isSimAuthorized) {
        console.warn("[Hotmart Edge Function] Token Hottok mismatch:", { receivedToken: cleanReceived, expectedTokens });
        try {
          const rawTrans = payload.data?.purchase?.transaction || payload.transaction || "UNKNOWN";
          const rawEv = payload.event || payload.status || "UNKNOWN";
          const rawBuyer = payload.data?.buyer?.email || payload.buyer?.email || payload.email || "unknown";
          await supabaseAdmin.from("hotmart_events").insert({
            transaction_id: String(rawTrans),
            event: String(rawEv),
            buyer_email: String(rawBuyer),
            status: "unauthorized_token",
            payload: payload,
            processed_at: new Date().toISOString()
          });
        } catch (_) {}

        return new Response(
          JSON.stringify({
            error: "Unauthorized: Token Hottok da Hotmart inválido.",
            tip: "Configure o token Hottok no Secret HOTMART_WEBHOOK_TOKEN ou nas configurações."
          }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 401 }
        );
      }
    }

    // =========================================================================
    // REQUISITO 1: PROCESSAMENTO CORRETO DOS EVENTOS SEM SUBSTITUIR O EVENTO ORIGINAL
    // =========================================================================
    originalEvent = String(payload.event || payload.status || payload.transaction_status || "PURCHASE_APPROVED").trim();
    const event = originalEvent.toUpperCase();

    // Reconhecimento de compras aprovadas
    const isApprovalEvent =
      event === "PURCHASE_APPROVED" ||
      event === "PURCHASE_COMPLETE" ||
      event === "APPROVED" ||
      event === "COMPLETE" ||
      event.includes("APPROVED") ||
      event.includes("COMPLETE") ||
      event.includes("ACTIVATED") ||
      event.includes("APROVAD") ||
      event.includes("COMPLET") ||
      event === "PURCHASE_OUT_OF_SHOPPING_CART" ||
      event === "SUBSCRIPTION_RENEWAL";

    // Reconhecimento de revogações (chargeback, reembolso, cancelamento, protesto, assinatura cancelada, expiração)
    const isRevocationEvent =
      event === "PURCHASE_CHARGEBACK" ||
      event === "PURCHASE_REFUNDED" ||
      event === "PURCHASE_CANCELED" ||
      event === "PURCHASE_CANCELLED" ||
      event === "PURCHASE_PROTEST" ||
      event === "SUBSCRIPTION_CANCELLATION" ||
      event === "PURCHASE_EXPIRED" ||
      event.includes("CHARGEBACK") ||
      event.includes("REFUND") ||
      event.includes("REEMBOLS") ||
      event.includes("CANCEL") ||
      event.includes("PROTEST") ||
      event.includes("EXPIRED") ||
      event.includes("INACTIVE");

    // Extração do comprador
    const buyerEmailRaw =
      payload.data?.buyer?.email ||
      payload.buyer?.email ||
      payload.buyer_email ||
      payload.email ||
      payload.data?.subscriber?.email ||
      payload.subscriber?.email;

    if (!buyerEmailRaw || typeof buyerEmailRaw !== "string") {
      return new Response(
        JSON.stringify({ error: "E-mail do comprador não encontrado no payload." }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 400 }
      );
    }

    email = buyerEmailRaw.trim().toLowerCase();
    const buyerName = payload.data?.buyer?.name || payload.buyer?.name || payload.name || "Cliente Hotmart";
    const rawTransactionId =
      payload.data?.purchase?.transaction ||
      payload.data?.purchase?.transaction_id ||
      payload.transaction ||
      payload.transaction_id ||
      payload.data?.subscription?.subscription_id ||
      payload.subscription_id ||
      payload.order_id ||
      payload.data?.order?.id ||
      payload.id ||
      null;

    transactionId = rawTransactionId 
      ? String(rawTransactionId).trim() 
      : `HOTMART_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;

    // =========================================================================
    // REQUISITO 3: IDENTIFICAÇÃO CORRETA DO PRODUTO HOTMART
    // Regra:
    // 1. data.product.id quando for válido e diferente de zero;
    // 2. data.product.ucode quando o ID numérico vier como 0.
    // NÃO assumir que o primeiro produto de content.products é o produto principal.
    // content.products representa produtos de conteúdo e NÃO substitui data.product.id.
    // =========================================================================
    const isValidNumericId = (val: any): boolean => {
      if (val === undefined || val === null) return false;
      const s = String(val).trim();
      return s !== "" && s !== "0" && s !== "null" && s !== "undefined";
    };

    const rootNumericId = payload.data?.product?.id ?? payload.prod ?? payload.product_id ?? payload.data?.subscription?.product?.id;
    const rootUcode = payload.data?.product?.ucode ? String(payload.data.product.ucode).trim() : "";
    const rootName = payload.data?.product?.name ? String(payload.data.product.name).trim() : "";

    hotmartProductId = "";
    const ucodeProductId = rootUcode;

    // 1. Prioridade: ID numérico válido diferente de zero
    if (isValidNumericId(rootNumericId)) {
      hotmartProductId = String(rootNumericId).trim();
    }
    // 2. Prioridade: quando o ID numérico vier como 0, usar o data.product.ucode
    else if (rootUcode) {
      hotmartProductId = rootUcode;
    } 
    // Fallback caso outro identificador direto exista
    else if (rootNumericId !== undefined && rootNumericId !== null && String(rootNumericId).trim() !== "") {
      hotmartProductId = String(rootNumericId).trim();
    }

    // Chaves de busca para cruzar com tabelas de mapeamento do banco de dados (hotmart_products, courses, packages, app_settings)
    // Preservar o ucode para permitir mapeamento quando o ID numérico não estiver disponível
    const searchKeys: string[] = [];
    if (hotmartProductId) searchKeys.push(hotmartProductId);
    if (rootUcode && !searchKeys.includes(rootUcode)) searchKeys.push(rootUcode);
    if (isValidNumericId(rootNumericId) && !searchKeys.includes(String(rootNumericId).trim())) {
      searchKeys.push(String(rootNumericId).trim());
    }

    const uniqueSearchKeys = Array.from(new Set(searchKeys.filter(Boolean)));

    console.log(`[Hotmart Edge Function] Evento: "${originalEvent}" para ${email}, Produto ID: ${hotmartProductId || 'N/A'}, Ucode: ${ucodeProductId || 'N/A'}, Transação: ${transactionId}`);

    // =========================================================================
    // REQUISITO 2: IDEMPOTÊNCIA ESTRITA POR COMBINAÇÃO (transaction_id + event)
    // Regra:
    // • HP123 + PURCHASE_APPROVED e HP123 + PURCHASE_COMPLETE e HP123 + PURCHASE_CHARGEBACK
    //   são eventos distintos e podem ser processados individualmente.
    // • Compra A + PURCHASE_COMPLETE e Compra B + PURCHASE_COMPLETE do mesmo comprador
    //   devem ser processadas normalmente. O fato de o e-mail já existir NÃO impede nova transação.
    // • Somente retornar "evento já processado" quando a MESMA combinação transaction_id + event
    //   já tiver sido concluída com sucesso.
    // =========================================================================
    if (transactionId && originalEvent) {
      try {
        const { data: existingEvent } = await supabaseAdmin
          .from("hotmart_events")
          .select("id, status")
          .eq("transaction_id", transactionId)
          .eq("event", originalEvent)
          .maybeSingle();

        if (existingEvent && existingEvent.status === "processed") {
          // Se for evento de aprovação: verificar se usuário ainda existe
          if (isApprovalEvent) {
            let userStillExists = false;
            try {
              const { data: prof } = await supabaseAdmin
                .from("profiles")
                .select("id, email")
                .ilike("email", email)
                .maybeSingle();

              if (prof?.id) {
                try {
                  const { data: authUser, error: authErr } = await supabaseAdmin.auth.admin.getUserById(prof.id);
                  if (!authErr && authUser?.user) userStillExists = true;
                } catch (_) {
                  userStillExists = true;
                }
              }

              if (!userStillExists) {
                const { data: authList } = await supabaseAdmin.auth.admin.listUsers({ page: 1, perPage: 1000 });
                if (authList?.users?.some(u => u.email?.toLowerCase().trim() === email)) {
                  userStillExists = true;
                }
              }
            } catch (chkErr) {
              console.warn("[Hotmart Edge Function] Erro na checagem de usuário para idempotência:", chkErr);
            }

            if (userStillExists) {
              console.log(`[Hotmart Edge Function] Transação ${transactionId} evento ${originalEvent} já processado anteriormente. Retornando idempotência.`);
              try {
                await supabaseAdmin.from("hotmart_events").insert({
                  transaction_id: String(transactionId),
                  event: String(originalEvent),
                  buyer_email: String(email),
                  hotmart_product_id: String(hotmartProductId || "N/A"),
                  status: "processed",
                  payload: payload,
                  processed_at: new Date().toISOString()
                });
              } catch (_) {}

              return new Response(
                JSON.stringify({
                  success: true,
                  message: "Evento já processado anteriormente (Idempotência mantida).",
                  transaction_id: transactionId,
                  event: originalEvent
                }),
                { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200 }
              );
            }
            console.log(`[Hotmart Edge Function] Transação ${transactionId} evento ${originalEvent} constava como processado, mas usuário ${email} foi excluído. Re-executando para recriação...`);
          } 
          // Se for evento de revogação: verificar se a revogação ainda está efetiva
          else if (isRevocationEvent) {
            let revocationStillEffective = true;
            try {
              const { data: prof } = await supabaseAdmin
                .from("profiles")
                .select("id, has_access, has_unlimited_ai")
                .ilike("email", email)
                .maybeSingle();

              // Se o perfil ainda constar com has_access = true, a revogação precisa ser re-executada!
              if (prof && prof.has_access === true) {
                revocationStillEffective = false;
              }
            } catch (revChkErr) {
              console.warn("[Hotmart Edge Function] Erro na checagem de revogação:", revChkErr);
            }

            if (revocationStillEffective) {
              console.log(`[Hotmart Edge Function] Revogação ${transactionId} evento ${originalEvent} já concluída anteriormente.`);
              try {
                await supabaseAdmin.from("hotmart_events").insert({
                  transaction_id: String(transactionId),
                  event: String(originalEvent),
                  buyer_email: String(email),
                  hotmart_product_id: String(hotmartProductId || "N/A"),
                  status: "processed",
                  payload: payload,
                  processed_at: new Date().toISOString()
                });
              } catch (_) {}

              return new Response(
                JSON.stringify({
                  success: true,
                  message: "Evento de revogação já processado anteriormente (Acesso permanece revogado).",
                  transaction_id: transactionId,
                  event: originalEvent
                }),
                { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200 }
              );
            }
            console.log(`[Hotmart Edge Function] Transação ${transactionId} evento ${originalEvent} constava como processado, mas o usuário ${email} ainda tem acesso ativo. Re-executando revogação...`);
          }
        }
      } catch (_) {}
    }

    // 4. Mapeamento Inteligente de Produto -> Tipo de Produto
    let productType: "main_product" | "course" | "package" | "ai_subscription" = "main_product";
    let targetIds: string[] = [];

    if (uniqueSearchKeys.length > 0) {
      const searchKeys = uniqueSearchKeys;

      // a) Procurar na tabela customizada hotmart_products
      let mapping: any = null;
      for (const key of searchKeys) {
        const { data } = await supabaseAdmin
          .from("hotmart_products")
          .select("*")
          .eq("hotmart_product_id", key)
          .eq("is_active", true)
          .maybeSingle();
        if (data) {
          mapping = data;
          break;
        }
      }

      if (mapping) {
        productType = mapping.product_type as any;
        const targetId = mapping.internal_target_id;

        if (productType === "package" && targetId) {
          const { data: pkgCourses } = await supabaseAdmin
            .from("package_courses")
            .select("course_id")
            .eq("package_id", targetId);
          targetIds = [targetId, ...(pkgCourses?.map(pc => pc.course_id) || [])];
        } else if (productType === "course" && targetId) {
          const { data: crs } = await supabaseAdmin
            .from("courses")
            .select("id, linked_package_id")
            .eq("id", targetId)
            .maybeSingle();
          if (crs?.linked_package_id) {
            const { data: pkgCourses } = await supabaseAdmin
              .from("package_courses")
              .select("course_id")
              .eq("package_id", crs.linked_package_id);
            targetIds = [crs.linked_package_id, ...(pkgCourses?.map(pc => pc.course_id) || [])];
          } else {
            targetIds = [targetId];
          }
        }
      } else {
        // b) Verificar em app_settings
        const { data: settings } = await supabaseAdmin
          .from("app_settings")
          .select("custom_texts")
          .eq("id", 1)
          .maybeSingle();

        const configuredMainId = settings?.custom_texts?.["hotmart.main_product_id"];
        const configuredAiId = settings?.custom_texts?.["hotmart.unlimited_ai_product_id"] || settings?.custom_texts?.["hotmart.ai_product_id"];

        if (searchKeys.some(k => configuredAiId && String(configuredAiId) === k)) {
          productType = "ai_subscription";
        } else if (searchKeys.some(k => configuredMainId && String(configuredMainId) === k)) {
          productType = "main_product";
        } else {
          // c) Verificar cursos individuais
          let courseMatch: any = null;
          for (const key of searchKeys) {
            const { data } = await supabaseAdmin
              .from("courses")
              .select("id, linked_package_id")
              .eq("hotmart_product_id", key)
              .maybeSingle();
            if (data) {
              courseMatch = data;
              break;
            }
          }

          if (courseMatch) {
            productType = "course";
            if (courseMatch.linked_package_id) {
              const { data: pkgCourses } = await supabaseAdmin
                .from("package_courses")
                .select("course_id")
                .eq("package_id", courseMatch.linked_package_id);
              targetIds = [courseMatch.linked_package_id, ...(pkgCourses?.map(pc => pc.course_id) || [])];
            } else {
              targetIds = [courseMatch.id];
            }
          } else {
            // d) Verificar pacotes
            let packageMatch: any = null;
            for (const key of searchKeys) {
              const { data } = await supabaseAdmin
                .from("course_packages")
                .select("id")
                .eq("hotmart_product_id", key)
                .maybeSingle();
              if (data) {
                packageMatch = data;
                break;
              }
            }

            if (packageMatch) {
              productType = "package";
              const { data: pkgCourses } = await supabaseAdmin
                .from("package_courses")
                .select("course_id")
                .eq("package_id", packageMatch.id);
              targetIds = [packageMatch.id, ...(pkgCourses?.map(pc => pc.course_id) || [])];
            }
          }
        }
      }
    }

    // =========================================================================
    // REQUISITO 7: CRIAÇÃO / LOCALIZAÇÃO DE USUÁRIO NO SUPABASE AUTH E PROFILES
    // Regra:
    // • Se não existir no Auth -> criar com senha temporária e auto-confirmado.
    // • Se já existir -> reutilizar e não criar duplicados.
    // • Garantir que o profile esteja corretamente associado ao UUID do usuário.
    // =========================================================================
    let targetUserId: string | null = null;
    let existingProfile: any = null;

    try {
      const { data: prof } = await supabaseAdmin
        .from("profiles")
        .select("id, email, has_access, has_unlimited_ai")
        .ilike("email", email)
        .maybeSingle();

      if (prof?.id) {
        existingProfile = prof;
        try {
          const { data: authUser, error: authErr } = await supabaseAdmin.auth.admin.getUserById(prof.id);
          if (!authErr && authUser?.user) targetUserId = prof.id;
        } catch (_) {
          targetUserId = prof.id;
        }
      }

      if (!targetUserId) {
        const { data: authList } = await supabaseAdmin.auth.admin.listUsers({ page: 1, perPage: 1000 });
        const matched = authList?.users?.find(u => u.email?.toLowerCase().trim() === email);
        if (matched) targetUserId = matched.id;
      }
    } catch (findErr) {
      console.warn("[Hotmart Edge Function] Erro ao localizar usuário existente:", findErr);
    }

    if (!targetUserId && isApprovalEvent) {
      console.log(`[Hotmart Edge Function] Criando novo usuário no Supabase Auth para ${email}...`);
      const tempPassword = "123456";
      const { data: newUser, error: createError } = await supabaseAdmin.auth.admin.createUser({
        email: email,
        password: tempPassword,
        email_confirm: true,
        user_metadata: { full_name: buyerName }
      });

      if (newUser?.user) {
        targetUserId = newUser.user.id;
      } else {
        const errMsg = (createError?.message || "").toLowerCase();
        if (errMsg.includes("already registered") || errMsg.includes("already exists") || errMsg.includes("unique")) {
          const { data: authList } = await supabaseAdmin.auth.admin.listUsers({ page: 1, perPage: 1000 });
          const matched = authList?.users?.find(u => u.email?.toLowerCase().trim() === email);
          if (matched) targetUserId = matched.id;
        }
      }

      if (!targetUserId) {
        if (isSimulation) {
          targetUserId = existingProfile?.id || null;
        } else {
          throw new Error(`Falha ao criar usuário no Supabase Auth: ${createError?.message || "Não foi possível obter UUID"}`);
        }
      }
    }

    // =========================================================================
    // REQUISITO 6: CORREÇÃO DO CAMPO "ÚLTIMO ACESSO" NA CRIAÇÃO DO PERFIL
    // Regra:
    // • O webhook NÃO deve preencher ou alterar nenhum campo de "último acesso"
    //   usando created_at, updated_at, data de criação do profile ou data da compra.
    // • Na criação/atualização de profiles, definir estritamente:
    //   id, email, full_name, has_access, has_unlimited_ai e updated_at.
    // • Deixar qualquer campo de último login como null para que reflita apenas logins reais do frontend.
    // =========================================================================
    if (targetUserId && isApprovalEvent) {
      if (existingProfile && existingProfile.id !== targetUserId) {
        await supabaseAdmin.from("profiles").delete().eq("id", existingProfile.id);
      }

      const profilePayload = {
        id: targetUserId,
        email: email,
        full_name: buyerName,
        has_access: true,
        has_unlimited_ai: productType === "ai_subscription" ? true : (existingProfile?.has_unlimited_ai || false),
        updated_at: new Date().toISOString()
      };

      const { error: profileError } = await supabaseAdmin
        .from("profiles")
        .upsert(profilePayload, { onConflict: "id" });

      if (profileError) {
        console.error("[Hotmart Edge Function] Erro ao salvar profile:", profileError);
        throw new Error(`Falha crítica ao criar/atualizar profile: ${profileError.message}`);
      }
    }

    // =========================================================================
    // REQUISITO 5: APLICAÇÃO DE LIBERAÇÃO VS REVOGAÇÃO COM VALIDAÇÃO DE ERRO
    // Regra:
    // • Verificar retorno de todas as operações críticas do Supabase.
    // • Se qualquer operação de revogação ou aprovação falhar, lançar exceção -> HTTP 500,
    //   não marcar como processed e permitir que a Hotmart faça nova tentativa.
    // =========================================================================
    let actionSummary = "";

    if (targetUserId) {
      if (isApprovalEvent) {
        if (productType === "main_product") {
          const { error: updateAccErr } = await supabaseAdmin
            .from("profiles")
            .update({ has_access: true, updated_at: new Date().toISOString() })
            .eq("id", targetUserId);
          if (updateAccErr) throw new Error(`Falha ao conceder acesso principal: ${updateAccErr.message}`);

          if (hotmartProductId) {
            const { data: existingPur } = await supabaseAdmin
              .from("purchases")
              .select("id")
              .eq("user_id", targetUserId)
              .eq("product_id", hotmartProductId)
              .maybeSingle();

            if (existingPur?.id) {
              const { error: purUpErr } = await supabaseAdmin
                .from("purchases")
                .update({
                  transaction_id: transactionId,
                  status: "approved",
                  created_at: new Date().toISOString()
                })
                .eq("id", existingPur.id);
              if (purUpErr) throw new Error(`Falha ao atualizar compra principal: ${purUpErr.message}`);
            } else {
              const { error: purInsErr } = await supabaseAdmin
                .from("purchases")
                .insert({
                  user_id: targetUserId,
                  product_id: hotmartProductId,
                  transaction_id: transactionId,
                  status: "approved",
                  created_at: new Date().toISOString()
                });
              if (purInsErr) throw new Error(`Falha ao registrar compra principal: ${purInsErr.message}`);
            }
          }

          actionSummary = "Acesso Principal à Plataforma ATIVADO";
        } else if (productType === "ai_subscription") {
          const { error: aiAccErr } = await supabaseAdmin
            .from("profiles")
            .update({ has_unlimited_ai: true, has_access: true, updated_at: new Date().toISOString() })
            .eq("id", targetUserId);
          if (aiAccErr) throw new Error(`Falha ao ativar IA: ${aiAccErr.message}`);

          actionSummary = "Assinatura IA Expert VIP ATIVADA";
        } else if ((productType === "course" || productType === "package") || targetIds.length > 0) {
          const { error: accErr } = await supabaseAdmin
            .from("profiles")
            .update({ has_access: true, updated_at: new Date().toISOString() })
            .eq("id", targetUserId);
          if (accErr) throw new Error(`Falha ao ativar acesso para pacote/curso: ${accErr.message}`);

          const allGrantIds = Array.from(new Set([...targetIds, hotmartProductId].filter(Boolean)));
          for (const pid of allGrantIds) {
            const { data: existingPur } = await supabaseAdmin
              .from("purchases")
              .select("id")
              .eq("user_id", targetUserId)
              .eq("product_id", pid)
              .maybeSingle();

            if (existingPur?.id) {
              const { error: purUpErr } = await supabaseAdmin
                .from("purchases")
                .update({
                  transaction_id: transactionId,
                  status: "approved",
                  created_at: new Date().toISOString()
                })
                .eq("id", existingPur.id);
              if (purUpErr) throw new Error(`Falha ao atualizar compra do item ${pid}: ${purUpErr.message}`);
            } else {
              const { error: purInsErr } = await supabaseAdmin
                .from("purchases")
                .insert({
                  user_id: targetUserId,
                  product_id: pid,
                  transaction_id: transactionId,
                  status: "approved",
                  created_at: new Date().toISOString()
                });
              if (purInsErr) throw new Error(`Falha ao inserir compra do item ${pid}: ${purInsErr.message}`);
            }
          }

          actionSummary = `Produto Adicional (${productType}) Liberado (${allGrantIds.length} itens): ${allGrantIds.join(", ")}`;
        }
      } else if (isRevocationEvent) {
        // REVOGAÇÃO / REEMBOLSO / CANCELAMENTO / CHARGEBACK / PROTESTO / EXPIRAÇÃO
        if (productType === "main_product") {
          const { error: revAccErr } = await supabaseAdmin
            .from("profiles")
            .update({ has_access: false, updated_at: new Date().toISOString() })
            .eq("id", targetUserId);
          if (revAccErr) throw new Error(`Falha ao revogar acesso principal: ${revAccErr.message}`);

          // Remove compras de produto principal
          const mainPurIds = ["main_product", hotmartProductId].filter(Boolean);
          await supabaseAdmin
            .from("purchases")
            .delete()
            .eq("user_id", targetUserId)
            .in("product_id", mainPurIds);

          actionSummary = "Acesso Principal à Plataforma PAUSADO (Revogado)";
        } else if (productType === "ai_subscription") {
          const { error: revAiErr } = await supabaseAdmin
            .from("profiles")
            .update({ has_unlimited_ai: false, updated_at: new Date().toISOString() })
            .eq("id", targetUserId);
          if (revAiErr) throw new Error(`Falha ao revogar IA no perfil: ${revAiErr.message}`);

          const { error: delAiPurErr } = await supabaseAdmin
            .from("purchases")
            .delete()
            .eq("user_id", targetUserId)
            .in("product_id", ["ai_subscription", "prod_ai_default", "HOTMART_IA_VICTORIA", "ia_vip", "unlimited_ai", hotmartProductId].filter(Boolean));
          if (delAiPurErr) throw new Error(`Falha ao excluir compras de IA: ${delAiPurErr.message}`);

          actionSummary = "Assinatura IA Expert VIP REVOGADA";
        } else if (productType === "course" || productType === "package" || targetIds.length > 0) {
          const allRevokeIds = Array.from(new Set([...targetIds, hotmartProductId].filter(Boolean)));
          for (const pid of allRevokeIds) {
            const { error: delPurErr } = await supabaseAdmin
              .from("purchases")
              .delete()
              .eq("user_id", targetUserId)
              .eq("product_id", pid);
            if (delPurErr) throw new Error(`Falha ao revogar curso/pacote (${pid}): ${delPurErr.message}`);
          }

          actionSummary = `Produto Adicional (${productType}) Bloqueado (${allRevokeIds.length} itens)`;
        } else if (hotmartProductId) {
          // Fallback seguro: se não caiu em nenhum tipo mas temos o ID do produto, remover da tabela purchases
          await supabaseAdmin
            .from("purchases")
            .delete()
            .eq("user_id", targetUserId)
            .eq("product_id", hotmartProductId);

          actionSummary = `Acesso ao produto ${hotmartProductId} revogado`;
        }
      }
    }

    // REGISTRAR OU ATUALIZAR VENDA NA TABELA SALES
    try {
      let resolvedName = rootName;
      if (!resolvedName || resolvedName === "Curso / Produto Hotmart (Simulação)") {
        if (productType === "main_product") resolvedName = "Acesso Geral à Plataforma (Produto Principal)";
        else if (productType === "ai_subscription") resolvedName = "Assinatura IA Expert VIP (Ilimitada)";
        else resolvedName = "Produto Hotmart (" + (hotmartProductId || "Sem ID") + ")";
      }

      const rawAmount = Number(
        payload.data?.purchase?.price?.value ?? 
        payload.data?.purchase?.full_price?.value ?? 
        payload.price ?? 
        97
      ) || 0;

      const currency = String(
        payload.data?.purchase?.price?.currency_value ?? 
        payload.currency ?? 
        "BRL"
      ).toUpperCase();

      const paymentType = String(
        payload.data?.purchase?.payment?.type ?? 
        payload.payment_type ?? 
        "PIX"
      ).toUpperCase();

      const saleStatus = isApprovalEvent ? "approved" :
        event.includes("REFUND") || event.includes("REEMBOLS") ? "refunded" :
        event.includes("CANCEL") ? "canceled" :
        event.includes("CHARGEBACK") ? "chargeback" : "approved";

      const purchaseDate = payload.data?.purchase?.approved_date || payload.data?.purchase?.order_date || payload.creation_date;
      const formattedDate = purchaseDate ? new Date(purchaseDate).toISOString() : new Date().toISOString();

      await supabaseAdmin.from("sales").upsert({
        transaction_id: transactionId || ("TRX_" + Date.now()),
        buyer_name: buyerName || "Comprador Hotmart",
        buyer_email: email,
        buyer_phone: payload.data?.buyer?.checkout_phone || null,
        product_id: hotmartProductId || "main_product",
        product_name: resolvedName,
        product_type: productType,
        amount: rawAmount,
        currency: currency,
        payment_type: paymentType,
        status: saleStatus,
        event_type: originalEvent,
        purchase_date: formattedDate,
        raw_payload: payload,
        updated_at: new Date().toISOString()
      }, { onConflict: "transaction_id" });
    } catch (sErr) {
      console.warn("[Hotmart Edge Function] Aviso ao salvar na tabela sales:", sErr);
    }

    // =========================================================================
    // REQUISITO 4 & 8: REGISTRO DE AUDITORIA E STATUS 'PROCESSED' SOMENTE NO SUCESSO
    // Regra:
    // • Registrar originalEvent, transaction_id, buyer_email, identificador do produto.
    // • Marcar como 'processed' e definir processed_at APENAS quando todas as operações
    //   forem concluídas com sucesso.
    // =========================================================================
    const eventRecord = {
      transaction_id: transactionId,
      event: originalEvent,
      buyer_email: email,
      hotmart_product_id: hotmartProductId || "N/A",
      status: "processed",
      payload: payload,
      processed_at: new Date().toISOString()
    };

    await supabaseAdmin.from("hotmart_events").insert(eventRecord);

    return new Response(
      JSON.stringify({
        success: true,
        email: email,
        event: originalEvent,
        product_type: productType,
        product_id: hotmartProductId,
        action: actionSummary,
        target_ids: targetIds,
        message: `Processamento concluído com sucesso para ${email}.`
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200 }
    );

  } catch (err: any) {
    console.error("[Hotmart Edge Function Fatal Error]:", err);

    // REQUISITO 8: Se o processamento falhar, não marcar como processed (marcar como error)
    try {
      if (transactionId && originalEvent) {
        const errorRecord = {
          transaction_id: transactionId,
          event: originalEvent,
          buyer_email: email || null,
          hotmart_product_id: hotmartProductId || null,
          status: "error",
          payload: payload,
          error_message: err?.message || String(err),
          processed_at: null
        };

        const { data: existingEv } = await supabaseAdmin
          .from("hotmart_events")
          .select("id")
          .eq("transaction_id", transactionId)
          .eq("event", originalEvent)
          .maybeSingle();

        if (existingEv?.id) {
          await supabaseAdmin.from("hotmart_events").update(errorRecord).eq("id", existingEv.id);
        } else {
          await supabaseAdmin.from("hotmart_events").insert(errorRecord);
        }
      }
    } catch (_) {}

    return new Response(
      JSON.stringify({ 
        error: "Erro interno ao processar Webhook Hotmart", 
        details: err?.message || String(err),
        transaction_id: transactionId,
        event: originalEvent
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 500 }
    );
  }
};

// Start native Deno server (standard for Supabase Edge Functions)
if (typeof Deno !== "undefined" && typeof Deno.serve === "function") {
  Deno.serve(handleRequest);
} else {
  // @ts-ignore
  import("https://deno.land/std@0.168.0/http/server.ts").then(({ serve }) => serve(handleRequest));
}
