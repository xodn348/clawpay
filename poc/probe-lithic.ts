const apiKeyFromEnv = process.env.LITHIC_API_KEY;
const BASE_URL = "https://sandbox.lithic.com/v1";

if (!apiKeyFromEnv) {
  throw new Error("LITHIC_API_KEY is required in environment");
}
const API_KEY = apiKeyFromEnv;

type JsonRecord = Record<string, unknown>;

async function request(path: string, init?: RequestInit): Promise<{ status: number; body: JsonRecord }> {
  const res = await fetch(`${BASE_URL}${path}`, {
    ...init,
    headers: {
      Authorization: API_KEY,
      "Content-Type": "application/json",
      ...(init?.headers ?? {}),
    },
  });

  let body: JsonRecord = {};
  try {
    body = (await res.json()) as JsonRecord;
  } catch {
    body = { parse_error: "Response was not valid JSON" };
  }

  return { status: res.status, body };
}

async function probe(): Promise<void> {
  const createPayload = {
    type: "SINGLE_USE",
    spend_limit: 100,
    spend_limit_duration: "TRANSACTION",
  };

  const createRes = await request("/cards", {
    method: "POST",
    body: JSON.stringify(createPayload),
  });

  console.log("CREATE /v1/cards status:", createRes.status);
  console.log("CREATE /v1/cards body:", JSON.stringify(createRes.body, null, 2));

  const token = createRes.body.token as string | undefined;
  if (!token) {
    console.log("No card token returned. Stopping probe.");
    return;
  }

  console.log("PAN on creation:", (createRes.body.pan as string | undefined) ?? "NOT PRESENT");
  console.log("CVV on creation:", (createRes.body.cvv as string | undefined) ?? "NOT PRESENT");
  console.log("exp_month on creation:", (createRes.body.exp_month as string | undefined) ?? "NOT PRESENT");
  console.log("exp_year on creation:", (createRes.body.exp_year as string | undefined) ?? "NOT PRESENT");

  const getCardRes = await request(`/cards/${token}`);
  console.log("GET /v1/cards/{token} status:", getCardRes.status);
  console.log("GET /v1/cards/{token} body:", JSON.stringify(getCardRes.body, null, 2));
  console.log("PAN on GET card:", (getCardRes.body.pan as string | undefined) ?? "NOT PRESENT");
  console.log("CVV on GET card:", (getCardRes.body.cvv as string | undefined) ?? "NOT PRESENT");
  console.log("exp_month on GET card:", (getCardRes.body.exp_month as string | undefined) ?? "NOT PRESENT");
  console.log("exp_year on GET card:", (getCardRes.body.exp_year as string | undefined) ?? "NOT PRESENT");

  const sensitiveRes = await request(`/cards/${token}/sensitive-details`);
  console.log("GET /v1/cards/{token}/sensitive-details status:", sensitiveRes.status);
  console.log(
    "GET /v1/cards/{token}/sensitive-details body:",
    JSON.stringify(sensitiveRes.body, null, 2),
  );
  console.log("PAN on sensitive-details:", (sensitiveRes.body.pan as string | undefined) ?? "NOT PRESENT");
  console.log("CVV on sensitive-details:", (sensitiveRes.body.cvv as string | undefined) ?? "NOT PRESENT");
  console.log(
    "exp_month on sensitive-details:",
    (sensitiveRes.body.exp_month as string | undefined) ?? "NOT PRESENT",
  );
  console.log(
    "exp_year on sensitive-details:",
    (sensitiveRes.body.exp_year as string | undefined) ?? "NOT PRESENT",
  );

  const closeRes = await request(`/cards/${token}`, {
    method: "PATCH",
    body: JSON.stringify({ state: "CLOSED" }),
  });
  console.log("PATCH /v1/cards/{token} close status:", closeRes.status);
  console.log("PATCH /v1/cards/{token} close body:", JSON.stringify(closeRes.body, null, 2));
}

probe().catch((err: unknown) => {
  console.error("Probe failed:", err);
  process.exitCode = 1;
});
