const PAYSTACK_SECRET_ENV_NAMES = [
  "PAYSTACK_SECRET_KEY",
  "Paystack_Live_Secret_Key",
  "Paystack_Test_Secret_Key",
];

export const getPaystackSecretKey = () => {
  const invalidConfiguredNames: string[] = [];

  for (const name of PAYSTACK_SECRET_ENV_NAMES) {
    const value = Deno.env.get(name)?.trim();
    if (!value) continue;

    if (/^sk_(live|test)_/.test(value)) {
      return value;
    }

    invalidConfiguredNames.push(name);
  }

  if (invalidConfiguredNames.length > 0) {
    throw new Error(
      `Paystack secret key is invalid. Use a secret key starting with sk_live_ or sk_test_ for ${invalidConfiguredNames.join(", ")}.`
    );
  }

  throw new Error("Paystack secret key not configured");
};
