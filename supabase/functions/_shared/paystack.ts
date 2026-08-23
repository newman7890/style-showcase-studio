const getEnvVal = (name: string) => Deno.env.get(name)?.trim();

export interface PaystackKeyConfig {
  secretKey: string;
  publicKey: string;
  sourceName: string;
}

export const getAllPaystackSecretKeys = (): PaystackKeyConfig[] => {
  const candidates: { secretName: string; publicName?: string }[] = [
    { secretName: "Paystack_Live_Secret_Key", publicName: "Paystack_Live_Public_Key" },
    { secretName: "PAYSTACK_SECRET_KEY", publicName: "PAYSTACK_PUBLIC_KEY" },
    { secretName: "Paystack_Test_Secret_Key", publicName: "Paystack_Test_Public_Key" },
    { secretName: "PAYSTACK_LIVE_SECRET_KEY", publicName: "PAYSTACK_LIVE_PUBLIC_KEY" },
  ];

  const results: PaystackKeyConfig[] = [];

  for (const c of candidates) {
    const val = getEnvVal(c.secretName);
    if (val && /^sk_(live|test)_/.test(val)) {
      const pubVal = (c.publicName && getEnvVal(c.publicName)) || getEnvVal("PAYSTACK_PUBLIC_KEY") || getEnvVal("Paystack_Live_Public_Key") || "";
      results.push({
        secretKey: val,
        publicKey: pubVal,
        sourceName: c.secretName,
      });
    }
  }

  // Also check any other Deno env vars starting with sk_
  for (const [key, value] of Object.entries(Deno.env.toObject())) {
    if (key.toLowerCase().includes("paystack") && key.toLowerCase().includes("secret")) {
      const trimmed = value.trim();
      if (/^sk_(live|test)_/.test(trimmed) && !results.some(r => r.secretKey === trimmed)) {
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

export const getPaystackKeys = (): PaystackKeyConfig => {
  const all = getAllPaystackSecretKeys();
  if (all.length === 0) {
    throw new Error("No valid Paystack secret key configured. Secret key must start with sk_live_ or sk_test_.");
  }
  // Prefer live key first
  const live = all.find(k => k.secretKey.startsWith("sk_live_"));
  if (live) return live;
  return all[0];
};

export const getPaystackSecretKey = (): string => {
  return getPaystackKeys().secretKey;
};

export const getPaystackPublicKey = (): string => {
  return getPaystackKeys().publicKey;
};
