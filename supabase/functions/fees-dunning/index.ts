import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface Fee {
  id: string;
  driver_id: string;
  amount: number;
  status: "not_requested" | "pending" | "paid" | "canceled" | "expired";
  initial_due_date: string;
  payment_due_date: string | null;
  profiles?: {
    full_name: string;
    phone: string | null;
  };
}

Deno.serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const now = new Date();
    const startOfToday = new Date(now);
    startOfToday.setHours(0, 0, 0, 0);
    const endOfToday = new Date(now);
    endOfToday.setHours(23, 59, 59, 999);
    const tomorrowStart = new Date(startOfToday);
    tomorrowStart.setDate(tomorrowStart.getDate() + 1);
    const tomorrowEnd = new Date(endOfToday);
    tomorrowEnd.setDate(tomorrowEnd.getDate() + 1);

    console.log(`[${now.toISOString()}] Iniciando processo de cobrança de taxas`);

    // 1) Marcar vencidos automaticamente
    // Fees pending que passaram do prazo para pagamento
    const { data: expiredPaymentFees, error: expirePaymentError } = await supabase
      .from("fee_payments")
      .update({ status: "expired" })
      .lt("payment_due_date", startOfToday.toISOString())
      .eq("status", "pending")
      .not("payment_due_date", "is", null)
      .select();

    if (expirePaymentError) {
      console.error("Erro ao marcar fees de pagamento como expirados:", expirePaymentError);
    } else {
      console.log(`Marcados ${expiredPaymentFees?.length || 0} fees de pagamento como expirados`);
    }

    // Fees not_requested que passaram do prazo inicial para solicitar
    const { data: expiredRequestFees, error: expireRequestError } = await supabase
      .from("fee_payments")
      .update({ status: "expired" })
      .lt("initial_due_date", startOfToday.toISOString())
      .eq("status", "not_requested")
      .select();

    if (expireRequestError) {
      console.error("Erro ao marcar fees de solicitação como expirados:", expireRequestError);
    } else {
      console.log(`Marcados ${expiredRequestFees?.length || 0} fees de solicitação como expirados`);
    }

    // 2) Buscar fees para notificações D-1, D, D+
    // Para fees pendentes de pagamento
    
    // D-1 (vence amanhã)
    const { data: paymentD1, error: d1Error } = await supabase
      .from("fee_payments")
      .select(`
        *,
        profiles (
          full_name,
          phone
        )
      `)
      .gte("payment_due_date", tomorrowStart.toISOString())
      .lte("payment_due_date", tomorrowEnd.toISOString())
      .eq("status", "pending")
      .not("payment_due_date", "is", null);

    // D (vence hoje)
    const { data: paymentD, error: dError } = await supabase
      .from("fee_payments")
      .select(`
        *,
        profiles (
          full_name,
          phone
        )
      `)
      .gte("payment_due_date", startOfToday.toISOString())
      .lte("payment_due_date", endOfToday.toISOString())
      .eq("status", "pending")
      .not("payment_due_date", "is", null);

    // D+ (já vencidos)
    const { data: paymentDPlus, error: dPlusError } = await supabase
      .from("fee_payments")
      .select(`
        *,
        profiles (
          full_name,
          phone
        )
      `)
      .lt("payment_due_date", startOfToday.toISOString())
      .in("status", ["pending", "expired"])
      .not("payment_due_date", "is", null);

    // Para fees pendentes de solicitação inicial
    
    // D-1 para solicitar (vence amanhã)
    const { data: requestD1, error: reqD1Error } = await supabase
      .from("fee_payments")
      .select(`
        *,
        profiles (
          full_name,
          phone
        )
      `)
      .gte("initial_due_date", tomorrowStart.toISOString())
      .lte("initial_due_date", tomorrowEnd.toISOString())
      .eq("status", "not_requested");

    // D para solicitar (vence hoje)
    const { data: requestD, error: reqDError } = await supabase
      .from("fee_payments")
      .select(`
        *,
        profiles (
          full_name,
          phone
        )
      `)
      .gte("initial_due_date", startOfToday.toISOString())
      .lte("initial_due_date", endOfToday.toISOString())
      .eq("status", "not_requested");

    // D+ para solicitar (já vencidos)
    const { data: requestDPlus, error: reqDPlusError } = await supabase
      .from("fee_payments")
      .select(`
        *,
        profiles (
          full_name,
          phone
        )
      `)
      .lt("initial_due_date", startOfToday.toISOString())
      .in("status", ["not_requested", "expired"]);

    // 3) Inserir notificações
    const notifications = [];

    // Notificações para pagamento
    if (paymentD1?.length) {
      for (const fee of paymentD1) {
        notifications.push({
          user_id: fee.driver_id,
          title: "Taxa vence amanhã - Pagamento",
          body: `Sua taxa de R$ ${fee.amount} vence amanhã. Efetue o pagamento para evitar pendências.`,
          meta: { 
            fee_id: fee.id, 
            amount: fee.amount, 
            due_date: fee.payment_due_date, 
            type: "payment_d1" 
          },
        });
      }
    }

    if (paymentD?.length) {
      for (const fee of paymentD) {
        notifications.push({
          user_id: fee.driver_id,
          title: "Taxa vence hoje - Pagamento",
          body: `Sua taxa de R$ ${fee.amount} vence hoje. Efetue o pagamento urgentemente.`,
          meta: { 
            fee_id: fee.id, 
            amount: fee.amount, 
            due_date: fee.payment_due_date, 
            type: "payment_d" 
          },
        });
      }
    }

    if (paymentDPlus?.length) {
      for (const fee of paymentDPlus) {
        notifications.push({
          user_id: fee.driver_id,
          title: "Taxa vencida - Pagamento",
          body: `Sua taxa de R$ ${fee.amount} está vencida. Entre em contato com o administrador para regularizar.`,
          meta: { 
            fee_id: fee.id, 
            amount: fee.amount, 
            due_date: fee.payment_due_date, 
            type: "payment_overdue" 
          },
        });
      }
    }

    // Notificações para solicitação inicial
    if (requestD1?.length) {
      for (const fee of requestD1) {
        notifications.push({
          user_id: fee.driver_id,
          title: "Prazo para solicitar taxa vence amanhã",
          body: `Você tem até amanhã para solicitar o pagamento da sua taxa. Acesse o app para fazer a solicitação.`,
          meta: { 
            fee_id: fee.id, 
            due_date: fee.initial_due_date, 
            type: "request_d1" 
          },
        });
      }
    }

    if (requestD?.length) {
      for (const fee of requestD) {
        notifications.push({
          user_id: fee.driver_id,
          title: "Último dia para solicitar taxa",
          body: `Hoje é o último dia para solicitar o pagamento da sua taxa. Acesse o app urgentemente.`,
          meta: { 
            fee_id: fee.id, 
            due_date: fee.initial_due_date, 
            type: "request_d" 
          },
        });
      }
    }

    if (requestDPlus?.length) {
      for (const fee of requestDPlus) {
        notifications.push({
          user_id: fee.driver_id,
          title: "Prazo para solicitar taxa expirado",
          body: `O prazo para solicitar o pagamento da taxa expirou. Entre em contato com o administrador.`,
          meta: { 
            fee_id: fee.id, 
            due_date: fee.initial_due_date, 
            type: "request_overdue" 
          },
        });
      }
    }

    // Inserir notificações se existir tabela de notificações
    if (notifications.length > 0) {
      const { error: notifError } = await supabase
        .from("notifications")
        .insert(notifications);

      if (notifError) {
        console.error("Erro ao inserir notificações:", notifError);
      } else {
        console.log(`Inseridas ${notifications.length} notificações`);
      }
    }

    const result = {
      timestamp: now.toISOString(),
      expired_payment_fees: expiredPaymentFees?.length || 0,
      expired_request_fees: expiredRequestFees?.length || 0,
      notifications: {
        payment_d1: paymentD1?.length || 0,
        payment_d: paymentD?.length || 0,
        payment_overdue: paymentDPlus?.length || 0,
        request_d1: requestD1?.length || 0,
        request_d: requestD?.length || 0,
        request_overdue: requestDPlus?.length || 0,
        total_sent: notifications.length
      }
    };

    console.log("Resultado do processamento:", result);

    return new Response(JSON.stringify(result), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error("Erro no processamento de cobrança de taxas:", error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});