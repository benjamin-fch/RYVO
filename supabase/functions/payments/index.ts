// =====================================================================
//  RYVO · fonction serveur « payments » (Supabase Edge Function)
//  Achat de gemmes par carte via Stripe Checkout.
//
//   POST …/functions/v1/payments/checkout  ← le site (joueur connecté) : renvoie l'adresse de paiement Stripe
//   POST …/functions/v1/payments/webhook   ← Stripe : crédite les gemmes quand le paiement est confirmé
//
//  Secrets à définir dans Supabase (Edge Functions → Secrets) :
//   STRIPE_SECRET_KEY      clé secrète Stripe (sk_live_… ou sk_test_…)
//   STRIPE_WEBHOOK_SECRET  secret de signature du webhook (whsec_…)
//   SITE_URL               adresse du jeu, ex. https://benjamin-fch.github.io/RYVO/
//  SUPABASE_URL et SUPABASE_SERVICE_ROLE_KEY sont fournis automatiquement par Supabase.
//
//  Sécurité : le prix et le nombre de gemmes viennent de la base (jamais du navigateur),
//  le webhook vérifie la signature Stripe, et un même paiement ne peut être crédité qu'une fois.
// =====================================================================
import Stripe from "npm:stripe@17.7.0";
import { createClient } from "npm:@supabase/supabase-js@2.49.1";

const env = (k: string): string => {
  const v = Deno.env.get(k);
  if (!v) throw new Error(`Secret manquant : ${k}`);
  return v;
};
// STRIPE_HOST sert uniquement aux tests locaux (faux serveur Stripe) ; ne pas le définir en production.
const testHost = Deno.env.get("STRIPE_HOST");
const stripe = new Stripe(env("STRIPE_SECRET_KEY"), {
  httpClient: Stripe.createFetchHttpClient(),
  ...(testHost ? { host: new URL(testHost).hostname, port: Number(new URL(testHost).port), protocol: "http" as const } : {}),
});
const db = createClient(env("SUPABASE_URL"), env("SUPABASE_SERVICE_ROLE_KEY"), { auth: { persistSession: false, autoRefreshToken: false } });
const SITE = env("SITE_URL").replace(/\/?$/, "/");
const cors = {
  "Access-Control-Allow-Origin": new URL(SITE).origin,
  "Access-Control-Allow-Headers": "authorization, apikey, content-type, x-client-info",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Vary": "Origin",
};
const json = (body: unknown, status = 200, headers: Record<string, string> = {}) =>
  new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json", ...headers } });
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

Deno.serve(async (req) => {
  const path = new URL(req.url).pathname;
  try {
    if (path.endsWith("/checkout")) return await checkout(req);
    if (path.endsWith("/webhook")) return await webhook(req);
    return json({ error: "not_found" }, 404);
  } catch (e) {
    console.error(e);
    return json({ error: "server_error" }, 500, path.endsWith("/checkout") ? cors : {});
  }
});

async function checkout(req: Request): Promise<Response> {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "POST") return json({ error: "method_not_allowed" }, 405, cors);

  // qui achète : on vérifie la session du joueur auprès de Supabase
  const token = (req.headers.get("authorization") || "").replace(/^Bearer\s+/i, "");
  const { data: auth, error: authErr } = await db.auth.getUser(token);
  const user = auth?.user;
  if (authErr || !user) return json({ error: "not_authenticated" }, 401, cors);

  const body = await req.json().catch(() => ({}));
  // le joueur a coché « livraison immédiate, je renonce à mon droit de rétractation »
  if (body.waiver !== true) return json({ error: "waiver_required" }, 400, cors);
  const { data: pack, error: packErr } = await db.rpc("shop_pack", { p_id: String(body.pack || "") });
  if (packErr) throw packErr;
  if (!pack) return json({ error: "unknown_pack" }, 400, cors);

  const en = body.lang === "en";
  const session = await stripe.checkout.sessions.create({
    mode: "payment",
    line_items: [{
      quantity: 1,
      price_data: {
        currency: "eur",
        unit_amount: pack.cents,
        product_data: {
          name: en ? `${pack.gems} RYVO gems` : `${pack.gems} gemmes RYVO`,
          description: en ? "Virtual currency for RYVO cosmetics. No gameplay advantage." : "Monnaie virtuelle pour les cosmétiques RYVO. Aucun avantage en jeu.",
        },
      },
    }],
    client_reference_id: user.id,
    customer_email: user.email || undefined,
    metadata: { user_id: user.id, pack_id: pack.id, gems: String(pack.gems), waiver_at: new Date().toISOString() },
    payment_intent_data: { metadata: { user_id: user.id, pack_id: pack.id } },
    locale: en ? "en" : "fr",
    custom_text: {
      submit: {
        message: en
          ? "Gems are delivered immediately: by paying, you waive your 14-day right of withdrawal."
          : "Les gemmes sont livrées immédiatement : en payant, tu renonces à ton droit de rétractation de 14 jours.",
      },
    },
    success_url: `${SITE}?achat=ok`,
    cancel_url: `${SITE}?achat=annule`,
  });
  return json({ url: session.url }, 200, cors);
}

async function webhook(req: Request): Promise<Response> {
  if (req.method !== "POST") return json({ error: "method_not_allowed" }, 405);
  const raw = await req.text();
  let event: Stripe.Event;
  try {
    event = await stripe.webhooks.constructEventAsync(raw, req.headers.get("stripe-signature") || "", env("STRIPE_WEBHOOK_SECRET"),
      undefined, Stripe.createSubtleCryptoProvider());
  } catch (_e) {
    return json({ error: "bad_signature" }, 400);
  }

  if (event.type === "checkout.session.completed" || event.type === "checkout.session.async_payment_succeeded") {
    const s = event.data.object as Stripe.Checkout.Session;
    if (s.payment_status !== "paid") return json({ received: true, waiting: s.payment_status });
    const uid = s.metadata?.user_id || s.client_reference_id || "";
    const { data, error } = await db.rpc("credit_purchase", {
      p_session: s.id,
      p_user: UUID.test(uid) ? uid : null,
      p_pack: s.metadata?.pack_id || "",
      p_amount: s.amount_total ?? 0,
      p_currency: s.currency || "",
      p_intent: typeof s.payment_intent === "string" ? s.payment_intent : s.payment_intent?.id ?? null,
    });
    if (error) { console.error(error); return json({ error: "database" }, 500); } // Stripe réessaiera
    return json({ received: true, result: data });
  }

  if (event.type === "charge.refunded") {
    const c = event.data.object as Stripe.Charge;
    const pi = typeof c.payment_intent === "string" ? c.payment_intent : c.payment_intent?.id;
    if (pi && c.refunded) {
      const { error } = await db.rpc("refund_purchase", { p_intent: pi });
      if (error) { console.error(error); return json({ error: "database" }, 500); }
    }
  }
  return json({ received: true });
}
