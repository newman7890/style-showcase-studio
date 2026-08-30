const cleanKeyString = (raw: string): string => {
  if (!raw) return "";
  let val = raw.trim();
  while ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
    val = val.slice(1, -1).trim();
  }
  if (val.includes("=")) {
    val = val.split("=").pop()?.trim() || val;
  }
  while ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
    val = val.slice(1, -1).trim();
  }
  return val;
};

const getEnvVal = (name: string): string => {
  return cleanKeyString(Deno.env.get(name) || "");
};

const isValidSecretKey = (key: string): boolean => {
  if (!key) return false;
  const trimmed = cleanKeyString(key);
  // Only accept live Paystack secret keys (must start with sk_live_)
  return trimmed.startsWith("sk_live_");
};

export interface PaystackKeyConfig {
  secretKey: string;
  publicKey: string;
  sourceName: string;
}

export const getAllPaystackSecretKeys = (): PaystackKeyConfig[] => {
  const candidates: { secretName: string; publicName?: string }[] = [
    { secretName: "PAYSTACK_SECRET_KEY", publicName: "PAYSTACK_PUBLIC_KEY" },
    { secretName: "Paystack_Live_Secret_Key", publicName: "Paystack_Live_Public_Key" },
    { secretName: "PAYSTACK_LIVE_SECRET_KEY", publicName: "PAYSTACK_LIVE_PUBLIC_KEY" },
    // Test key entry removed – live mode only
  ];

  const results: PaystackKeyConfig[] = [];

  for (const c of candidates) {
    const val = getEnvVal(c.secretName);
    if (isValidSecretKey(val)) {
      const pubVal = (c.publicName && getEnvVal(c.publicName)) || getEnvVal("PAYSTACK_PUBLIC_KEY") || getEnvVal("Paystack_Live_Public_Key") || "";
      results.push({
        secretKey: val,
        publicKey: pubVal,
        sourceName: c.secretName,
      });
    }
  }

  for (const [key, value] of Object.entries(Deno.env.toObject())) {
    if (key.toLowerCase().includes("paystack") && key.toLowerCase().includes("secret")) {
      let trimmed = value.trim();
      if ((trimmed.startsWith('"') && trimmed.endsWith('"')) || (trimmed.startsWith("'") && trimmed.endsWith("'"))) {
        trimmed = trimmed.slice(1, -1).trim();
      }
      if (isValidSecretKey(trimmed) && !results.some(r => r.secretKey === trimmed)) {
        results.push({
          secretKey: trimmed,
          publicKey: getEnvVal("PAYSTACK_PUBLIC_KEY") || getEnvVal("Paystack_Live_Public_Key") || "",
          sourceName: key,
        });
      }
    }
  }

  return results;
};

export const getAllPaystackSecretKeysAsync = async (): Promise<PaystackKeyConfig[]> => {
  const results = getAllPaystackSecretKeys();

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    if (supabaseUrl && serviceRoleKey) {
      const client = createClient(supabaseUrl, serviceRoleKey);
      const { data } = await client
        .from("platform_settings")
        .select("paystack_secret_key, paystack_public_key")
        .eq("id", 1)
        .maybeSingle();

      if (data?.paystack_secret_key) {
        const secKey = cleanKeyString(String(data.paystack_secret_key));
        const pubKey = cleanKeyString(String(data.paystack_public_key || ""));
        if (isValidSecretKey(secKey) && !results.some(r => r.secretKey === secKey)) {
          results.unshift({
            secretKey: secKey,
            publicKey: pubKey,
            sourceName: "platform_settings (database)",
          });
        } else if (!isValidSecretKey(secKey)) {
          console.warn(`platform_settings paystack_secret_key is invalid format (must start with sk_live_ or sk_test_). Got: '${secKey.substring(0, 8)}...'`);
        }
      }
    }
  } catch (e) {
    console.warn("Could not query platform_settings for paystack keys:", e);
  }

  console.log(`getAllPaystackSecretKeysAsync: found ${results.length} valid key(s): ${results.map(r => r.sourceName).join(", ") || "none"}`);
  return results;
};

export const getPaystackKeys = (): PaystackKeyConfig => {
  const all = getAllPaystackSecretKeys();
  if (all.length === 0) {
    const rawVal = Deno.env.get("PAYSTACK_SECRET_KEY") || Deno.env.get("Paystack_Live_Secret_Key") || "NOT_SET";
    const preview = rawVal === "NOT_SET" ? "NOT_SET" : `'${rawVal.substring(0, 10)}...'`;
    throw new Error(`No valid Paystack secret key found. Checked PAYSTACK_SECRET_KEY (Value: ${preview}). Key must start with sk_live_ or sk_test_.`);
  }
  const primary = all.find(k => k.sourceName === "PAYSTACK_SECRET_KEY");
  if (primary) return primary;
  const live = all.find(k => k.secretKey.startsWith("sk_live_"));
  if (live) return live;
  return all[0];
};

export const getPaystackKeysAsync = async (): Promise<PaystackKeyConfig> => {
  const all = await getAllPaystackSecretKeysAsync();
  if (all.length === 0) {
    const rawVal = Deno.env.get("PAYSTACK_SECRET_KEY") || Deno.env.get("Paystack_Live_Secret_Key") || "NOT_SET";
    const preview = rawVal === "NOT_SET" ? "NOT_SET" : `'${rawVal.substring(0, 10)}...'`;
    throw new Error(`No valid Paystack secret key found in environment or database platform_settings. Checked PAYSTACK_SECRET_KEY (Value: ${preview}). Key must start with sk_live_ or sk_test_.`);
  }
  const dbKey = all.find(k => k.sourceName === "platform_settings (database)");
  if (dbKey) return dbKey;
  const primary = all.find(k => k.sourceName === "PAYSTACK_SECRET_KEY");
  if (primary) return primary;
  const live = all.find(k => k.secretKey.startsWith("sk_live_"));
  if (live) return live;
  return all[0];
};

export const getPaystackSecretKey = (): string => {
  return getPaystackKeys().secretKey;
};

export const getPaystackSecretKeyAsync = async (): Promise<string> => {
  const k = await getPaystackKeysAsync();
  return k.secretKey;
};

export const getPaystackPublicKey = (): string => {
  return getPaystackKeys().publicKey;
};
