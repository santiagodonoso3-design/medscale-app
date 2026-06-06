const ACCESS_TOKEN = process.env.MP_ACCESS_TOKEN_TEST;

if (!ACCESS_TOKEN) {
  console.error("Falta MP_ACCESS_TOKEN_TEST en el entorno.");
  process.exit(1);
}

const BACK_URL = "https://app.medscale.app/billing/success";

const planes = [
  { tier: "STARTER", reason: "MedScale Starter", amount: 119000 },
  { tier: "GROWTH",  reason: "MedScale Growth",  amount: 319000 },
  { tier: "SCALE",   reason: "MedScale Scale",   amount: 599000 },
];

for (const plan of planes) {
  const res = await fetch("https://api.mercadopago.com/preapproval_plan", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${ACCESS_TOKEN}`,
    },
    body: JSON.stringify({
      reason: plan.reason,
      auto_recurring: {
        frequency: 1,
        frequency_type: "months",
        transaction_amount: plan.amount,
        currency_id: "COP",
      },
      back_url: BACK_URL,
      payment_methods_allowed: {
        payment_types: [{ id: "credit_card" }, { id: "debit_card" }],
      },
    }),
  });

  const data = await res.json();

  if (!res.ok) {
    console.error(`ERROR creando ${plan.tier}:`, JSON.stringify(data, null, 2));
    continue;
  }

  console.log(`MP_PLAN_${plan.tier}=${data.id}`);
}
