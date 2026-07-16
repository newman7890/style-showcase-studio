import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { Package, Tag, Loader2, X, Smartphone, CreditCard, AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { useCart } from "@/hooks/useCart";
import { useOrders } from "@/hooks/useOrders";
import { Link } from "react-router-dom";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useLanguage } from "@/contexts/LanguageContext";
import { Header } from "@/components/Header";
import { BottomNav } from "@/components/BottomNav";

type PaymentMethod = "mtn_momo" | "telecel_cash" | "tigo_cash" | "bank_card";
type MomoDialogMode = "waiting" | "error" | "otp";
type MomoFunctionResult = {
  success?: boolean;
  reference?: string;
  status?: string;
  display_text?: string;
  promptSent?: boolean;
  awaitingAction?: boolean;
  completed?: boolean;
  requiresOtp?: boolean;
  userMessage?: string;
  friendlyError?: string;
  errorCode?: string;
};

const MOMO_PROVIDERS: Record<Exclude<PaymentMethod, "bank_card">, "mtn" | "vod" | "atl"> = {
  mtn_momo: "mtn",
  telecel_cash: "vod",
  tigo_cash: "atl",
};

const GHANA_REGIONS = [
  "Greater Accra", "Ashanti", "Western", "Central", "Eastern", "Volta",
  "Northern", "Upper East", "Upper West", "Bono", "Bono East", "Ahafo",
  "Oti", "Savannah", "North East", "Western North",
];

const DEFAULT_MOMO_PROMPT_TEXT = "Check your phone and enter your Mobile Money PIN to authorize this payment.";


const Checkout = () => {
  const navigate = useNavigate();
  const { t } = useLanguage();
  const { cartItems, total, clearCart } = useCart();
  const { createOrder } = useOrders();
  const [submitting, setSubmitting] = useState(false);
  const [discountCode, setDiscountCode] = useState("");
  const [discountLoading, setDiscountLoading] = useState(false);
  const [appliedDiscount, setAppliedDiscount] = useState<{
    code: string; type: string; value: number; amount: number;
  } | null>(null);

  const [formData, setFormData] = useState({
    shipping_name: "", shipping_email: "", shipping_phone: "",
    shipping_address: "", shipping_city: "", shipping_region: "",
  });

  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>("mtn_momo");
  const [momoNumber, setMomoNumber] = useState("");
  const [momoDialogOpen, setMomoDialogOpen] = useState(false);
  const [momoDialogMode, setMomoDialogMode] = useState<MomoDialogMode>("waiting");
  const [momoDialogTitle, setMomoDialogTitle] = useState("Approve on your phone");
  const [momoStatusText, setMomoStatusText] = useState<string>(DEFAULT_MOMO_PROMPT_TEXT);
  const [momoDialogHint, setMomoDialogHint] = useState<string | null>(null);
  const [momoInlineFeedback, setMomoInlineFeedback] = useState<{ title: string; description: string } | null>(null);
  const [momoReference, setMomoReference] = useState<string | null>(null);
  const [momoOrderId, setMomoOrderId] = useState<string | null>(null);
  const [otpValue, setOtpValue] = useState("");
  const [otpSubmitting, setOtpSubmitting] = useState(false);
  const [deliveryFees, setDeliveryFees] = useState<Array<{ region: string; city: string | null; fee: number; is_default: boolean }>>([]);

  useEffect(() => {
    supabase
      .from("delivery_fees")
      .select("region, city, fee, is_default")
      .eq("is_active", true)
      .then(({ data }) => {
        if (data) setDeliveryFees(data as Array<{ region: string; city: string | null; fee: number; is_default: boolean }>);
      });
  }, []);

  // Fee resolution with fallback: exact city → region → default
  const deliveryFee = (() => {
    if (!formData.shipping_region) return 0;
    const region = formData.shipping_region.trim().toLowerCase();
    const city = formData.shipping_city.trim().toLowerCase();

    // 1. Exact city + region match
    if (city) {
      const cityMatch = deliveryFees.find(
        (f) => f.region.trim().toLowerCase() === region && f.city && f.city.trim().toLowerCase() === city
      );
      if (cityMatch) return Number(cityMatch.fee);
    }
    // 2. Region-only match (no city set on the row)
    const regionOnly = deliveryFees.find(
      (f) => f.region.trim().toLowerCase() === region && (!f.city || !f.city.trim())
    );
    if (regionOnly) return Number(regionOnly.fee);
    // 3. Any region match
    const anyRegion = deliveryFees.find((f) => f.region.trim().toLowerCase() === region);
    if (anyRegion) return Number(anyRegion.fee);
    // 4. Default fallback row
    const defaultRow = deliveryFees.find((f) => f.is_default);
    return defaultRow ? Number(defaultRow.fee) : 0;
  })();

  const deliverySource = (() => {
    if (!formData.shipping_region) return null;
    const region = formData.shipping_region.trim().toLowerCase();
    const city = formData.shipping_city.trim().toLowerCase();
    if (city && deliveryFees.some((f) => f.region.trim().toLowerCase() === region && f.city && f.city.trim().toLowerCase() === city)) return "city";
    if (deliveryFees.some((f) => f.region.trim().toLowerCase() === region)) return "region";
    if (deliveryFees.some((f) => f.is_default)) return "default";
    return null;
  })();

  const resetMomoFeedback = () => {
    setMomoDialogMode("waiting");
    setMomoDialogTitle("Approve on your phone");
    setMomoStatusText(DEFAULT_MOMO_PROMPT_TEXT);
    setMomoDialogHint(null);
    setMomoInlineFeedback(null);
    setOtpValue("");
  };

  const showMomoWaitingState = (description: string, hint?: string | null) => {
    setMomoDialogMode("waiting");
    setMomoDialogTitle("Approve on your phone");
    setMomoStatusText(description);
    setMomoDialogHint(hint ?? null);
    setMomoInlineFeedback(null);
    setMomoDialogOpen(true);
  };

  const showMomoErrorState = (title: string, description: string, hint?: string) => {
    setMomoDialogMode("error");
    setMomoDialogTitle(title);
    setMomoStatusText(description);
    setMomoDialogHint(hint ?? "Check the wallet number, keep your phone online, and try again.");
    setMomoInlineFeedback({ title, description });
    setMomoDialogOpen(true);
  };

  const showMomoOtpState = (description: string, hint?: string | null) => {
    setMomoDialogMode("otp");
    setMomoDialogTitle("Enter the OTP sent to your phone");
    setMomoStatusText(description);
    setMomoDialogHint(hint ?? "Your network sent a one-time code by SMS. Enter it here so we can trigger the wallet PIN prompt.");
    setMomoInlineFeedback(null);
    setMomoDialogOpen(true);
  };

  const handleSubmitOtp = async () => {
    const code = otpValue.trim();
    if (!momoReference) {
      showMomoErrorState("Missing reference", "We lost track of this payment. Please retry.");
      return;
    }
    if (!/^[A-Za-z0-9]{3,12}$/.test(code)) {
      toast.error("Enter the OTP code exactly as it was sent to your phone.");
      return;
    }
    setOtpSubmitting(true);
    try {
      const { data, error } = await supabase.functions.invoke("submit-momo-otp", {
        body: { reference: momoReference, otp: code },
      });
      if (error) {
        const message = await getFunctionErrorMessage(error);
        showMomoErrorState(
          "OTP not accepted",
          message || "We couldn't submit the OTP. Please request a new code and try again.",
          "Double-check the code, or retry the payment to receive a fresh OTP."
        );
        return;
      }
      const result = (data || {}) as MomoFunctionResult;
      if (!result.success) {
        showMomoErrorState(
          "OTP not accepted",
          result.userMessage || "The OTP was rejected by your provider.",
          "Retry the payment to receive a fresh code."
        );
        return;
      }
      setOtpValue("");
      showMomoWaitingState(
        result.userMessage || "OTP accepted. Check your phone for the Mobile Money PIN prompt.",
        "Approve the request on your phone. We'll confirm automatically here."
      );
      if (momoOrderId && momoReference) {
        void pollMomoStatus(momoReference, momoOrderId);
      }
    } catch (err) {
      console.error("OTP submit error:", err);
      showMomoErrorState("Couldn't submit OTP", "Something went wrong while submitting your OTP. Please try again.");
    } finally {
      setOtpSubmitting(false);
    }
  };

  const getFunctionErrorMessage = async (error: unknown) => {
    if (error && typeof error === "object" && "context" in error) {
      const response = (error as { context?: Response }).context;
      if (response && typeof response.json === "function") {
        try {
          const payload = await response.json();
          if (payload && typeof payload === "object") {
            const result = payload as { userMessage?: unknown; error?: unknown; message?: unknown };
            if (typeof result.userMessage === "string" && result.userMessage.trim()) return result.userMessage;
            if (typeof result.error === "string" && result.error.trim()) return result.error;
            if (typeof result.message === "string" && result.message.trim()) return result.message;
          }
        } catch {
          // ignore JSON parse errors from function responses
        }
      }
    }

    return error instanceof Error ? error.message : null;
  };

  

  const applyDiscountCode = async () => {
    if (!discountCode.trim()) { toast.error("Please enter a discount code"); return; }
    setDiscountLoading(true);
    try {
      const { data, error } = await supabase.rpc("validate_discount_code", {
        _code: discountCode.toUpperCase(),
        _order_amount: total,
      });
      if (error) throw error;
      const row = Array.isArray(data) ? data[0] : data;
      if (!row || !row.is_valid) {
        toast.error(row?.message || "Invalid discount code");
        return;
      }
      const discountAmount = row.discount_type === "percentage"
        ? (total * Number(row.discount_value)) / 100
        : Number(row.discount_value);
      setAppliedDiscount({
        code: row.code,
        type: row.discount_type,
        value: Number(row.discount_value),
        amount: discountAmount,
      });
      toast.success(`Discount applied: ${row.discount_type === "percentage" ? `${row.discount_value}% off` : `GH₵${row.discount_value} off`}`);
    } catch (error) {
      console.error("Error applying discount:", error);
      toast.error("Failed to apply discount code");
    } finally { setDiscountLoading(false); }
  };

  const removeDiscount = () => { setAppliedDiscount(null); setDiscountCode(""); };
  const subtotalAfterDiscount = appliedDiscount ? total - appliedDiscount.amount : total;
  const finalTotal = subtotalAfterDiscount + deliveryFee;
  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const pollMomoStatus = async (reference: string, orderId: string) => {
    const start = Date.now();
    const TIMEOUT_MS = 3 * 60 * 1000;
    while (Date.now() - start < TIMEOUT_MS) {
      await new Promise((r) => setTimeout(r, 4000));
      try {
        const { data: s, error: statusError } = await supabase.functions.invoke("check-charge-status", {
          body: { reference },
        });
        if (statusError) {
          const message = await getFunctionErrorMessage(statusError);
          showMomoErrorState(
            "We couldn't confirm the phone prompt",
            message || "We couldn't confirm the mobile money request with the network.",
            "Please wait a few seconds and retry. If it keeps happening, use another payment method."
          );
          setSubmitting(false);
          return;
        }

        const statusResult = (s || {}) as MomoFunctionResult;
        const status = statusResult.status;

        if (status === "success") {
          await supabase.functions.invoke("verify-payment", { body: { reference } });
          await clearCart();
          setMomoDialogOpen(false);
          resetMomoFeedback();
          toast.success("Payment approved!");
          navigate(`/order-confirmation/${orderId}`);
          return;
        }

        if (statusResult.requiresOtp || status === "send_otp" || statusResult.errorCode === "OTP_REQUIRED") {
          showMomoOtpState(
            statusResult.userMessage || statusResult.display_text || "Your provider sent an OTP to your phone. Enter the code to continue."
          );
          // stop polling — wait for user to submit OTP, which will resume polling
          return;
        }

        if (!statusResult.promptSent || statusResult.errorCode === "PROMPT_NOT_SENT") {
          showMomoErrorState(
            "Phone prompt not sent",
            statusResult.userMessage || "The network did not send the Mobile Money approval prompt to your phone.",
            "Confirm the number is your wallet number, keep your phone connected, then try again."
          );
          setSubmitting(false);
          return;
        }

        if (status === "failed" || status === "abandoned") {
          const { data: verifyData } = await supabase.functions.invoke("verify-payment", { body: { reference } });
          const verifyMessage = (verifyData as { friendlyError?: string } | null)?.friendlyError;
          showMomoErrorState(
            "Payment not completed",
            statusResult.userMessage || verifyMessage || "The mobile money charge was not approved.",
            "Please check for a prompt on your phone, then try again or choose card instead."
          );
          setSubmitting(false);
          return;
        }

        if (status === "pending" || status === "ongoing" || status === "pay_offline") {
          showMomoWaitingState(
            statusResult.userMessage || statusResult.display_text || "Still waiting for you to approve on your phone…",
            "If you still see no prompt after a few seconds, cancel and try again with the same wallet number."
          );
        }
      } catch (err) {
        console.error("Polling error:", err);
        showMomoErrorState(
          "We couldn't track the payment",
          "The mobile money request was started, but we lost connection while checking its status.",
          "Please wait a moment and retry."
        );
        setSubmitting(false);
        return;
      }
    }

    showMomoErrorState(
      "Payment timed out",
      "We waited for the mobile money approval, but no confirmation came back in time.",
      "If you never received a prompt, retry the payment. If you received it late, check that you did not get charged twice before retrying."
    );
    setSubmitting(false);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (cartItems.length === 0) { toast.error("Your cart is empty"); return; }
    if (!formData.shipping_name || !formData.shipping_email || !formData.shipping_phone || !formData.shipping_address || !formData.shipping_city || !formData.shipping_region) {
      toast.error("Please fill in all shipping fields"); return;
    }
    const isMomo = paymentMethod !== "bank_card";
    resetMomoFeedback();
    if (isMomo) {
      const digits = momoNumber.replace(/\D/g, "");
      if (!(digits.length === 10 || digits.length === 9 || digits.length === 12)) {
        toast.error("Enter a valid Ghana mobile money number"); return;
      }
    }

    setSubmitting(true);
    try {
      const orderItems = cartItems.map((item) => ({ product_id: item.product_id, quantity: item.quantity, price: item.products.price }));
      const orderId = await createOrder({
        total_amount: finalTotal, shipping_name: formData.shipping_name, shipping_email: formData.shipping_email,
        shipping_phone: formData.shipping_phone, shipping_address: formData.shipping_address, shipping_city: formData.shipping_city,
        shipping_region: formData.shipping_region, payment_method: paymentMethod,
        discount_code: appliedDiscount?.code || null, discount_amount: appliedDiscount?.amount || null,
        delivery_fee: deliveryFee,
      }, orderItems);
      if (!orderId) { setSubmitting(false); return; }

      // Mobile Money: direct charge so the PIN prompt fires on the phone
      if (isMomo) {
        const provider = MOMO_PROVIDERS[paymentMethod as Exclude<PaymentMethod, "bank_card">];
        const { data: chargeData, error: chargeError } = await supabase.functions.invoke("charge-momo", {
          body: {
            orderId,
            email: formData.shipping_email,
            amount: finalTotal,
            provider,
            mobileNumber: momoNumber,
          },
        });
        if (chargeError) {
          const message = await getFunctionErrorMessage(chargeError);
          showMomoErrorState(
            "Couldn't start Mobile Money payment",
            message || "We couldn't start the mobile money charge.",
            "Please confirm the wallet number and try again."
          );
          setSubmitting(false);
          return;
        }

        const chargeResult = (chargeData || {}) as MomoFunctionResult;
        if (chargeResult.reference) {
          setMomoReference(chargeResult.reference);
          setMomoOrderId(orderId);
        }

        if (chargeResult.requiresOtp || chargeResult.status === "send_otp") {
          if (!chargeResult.reference) {
            showMomoErrorState("Couldn't start Mobile Money payment", "Missing payment reference. Please try again.");
            setSubmitting(false);
            return;
          }
          showMomoOtpState(
            chargeResult.userMessage || chargeResult.display_text || "Your provider sent an OTP to your phone. Enter the code to continue."
          );
          return;
        }

        if (!chargeResult.success || !chargeResult.reference) {
          showMomoErrorState(
            chargeResult.errorCode === "PROMPT_NOT_SENT" ? "Phone prompt not sent" : "Couldn't start Mobile Money payment",
            chargeResult.userMessage || chargeResult.friendlyError || "We couldn't start the mobile money charge.",
            chargeResult.errorCode === "PROMPT_NOT_SENT"
              ? "Check that the number is active for Mobile Money and try again."
              : "Please verify the wallet number or use another payment method."
          );
          setSubmitting(false);
          return;
        }

        showMomoWaitingState(
          chargeResult.display_text || chargeResult.userMessage || "Check your phone — a prompt has been sent. Enter your Mobile Money PIN to authorize this payment.",
          chargeResult.awaitingAction ? "Approve the request on your phone. We’ll confirm automatically here." : null
        );
        void pollMomoStatus(chargeResult.reference, orderId);
        return;
      }

      // Card: existing Paystack Inline flow
      const callbackUrl = `${window.location.origin}/payment/callback`;
      const { data, error } = await supabase.functions.invoke("initialize-payment", {
        body: { orderId, email: formData.shipping_email, amount: finalTotal, paymentMethod: "bank_card", callbackUrl },
      });
      if (error) throw error;

      if (data.accessCode && (window as any).PaystackPop && data.publicKey) {
        try {
          const handler = (window as any).PaystackPop.setup({
            key: data.publicKey,
            email: formData.shipping_email,
            amount: Math.round(finalTotal * 100),
            currency: "GHS",
            ref: data.reference,
            channels: data.channels,
            callback: (response: any) => {
              const paidReference = response?.reference ?? data.reference;
              void (async () => {
                try {
                  const { data: verifyData, error: verifyError } = await supabase.functions.invoke(
                    "verify-payment",
                    { body: { reference: paidReference } }
                  );
                  if (verifyError) throw verifyError;
                  if (verifyData?.success) {
                    await clearCart();
                    navigate(`/order-confirmation/${verifyData.orderId}`);
                    toast.success("Payment approved!");
                  } else {
                    toast.error(verifyData?.friendlyError || "Payment verification failed.");
                    navigate("/orders");
                  }
                } catch (err) {
                  console.error("Verification error:", err);
                  toast.error("Payment verification failed.");
                  navigate(`/payment/callback?reference=${paidReference}`);
                }
              })();
            },
            onClose: () => {
              toast.error("Payment cancelled.");
              void supabase.functions.invoke("verify-payment", { body: { reference: data.reference } });
              setSubmitting(false);
            },
          });
          handler.openIframe(); return;
        } catch (popupError) {
          console.error("Paystack popup initialization failed:", popupError);
          if (data.authorizationUrl) { window.location.href = data.authorizationUrl; return; }
          throw popupError;
        }
      } else if (data.authorizationUrl) { window.location.href = data.authorizationUrl; return; }
      else { throw new Error("Failed to initialize payment"); }
    } catch (error) {
      console.error("Error placing order:", error);
      const msg = error instanceof Error ? error.message : "Payment initialization failed. Please try again.";
      toast.error(msg);
      setSubmitting(false);
    }
  };

  if (cartItems.length === 0) {
    return (
      <>
        <Header />
        <main className="min-h-screen pt-16 pb-20">
          <div className="container mx-auto px-4 py-12 max-w-7xl flex flex-col items-center justify-center min-h-[60vh]">
            <Package className="w-16 h-16 text-muted-foreground mb-4" />
            <h2 className="text-xl font-semibold mb-2">Your cart is empty</h2>
            <p className="text-muted-foreground mb-6">Add items to your cart before checking out</p>
            <Link to="/products">
              <Button size="lg" className="rounded-none bg-foreground text-background hover:bg-foreground/90">Continue Shopping</Button>
            </Link>
          </div>
        </main>
        <BottomNav />
      </>
    );
  }

  return (
    <>
      <Header />
      <main className="min-h-screen pt-16 pb-20">
        <div className="container mx-auto px-4 py-8 md:py-12 max-w-7xl">
          <motion.h1
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            className="text-4xl md:text-5xl font-bold tracking-tight mb-10"
            style={{ fontStyle: "italic" }}
          >
            CHECKOUT
          </motion.h1>

          <div className="grid grid-cols-1 lg:grid-cols-5 gap-10 lg:gap-16">
            {/* Left Column: Forms */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="lg:col-span-3"
            >
              <form onSubmit={handleSubmit} className="space-y-10">
                {/* Personal Information */}
                <section>
                  <h2 className="text-lg font-semibold mb-1">Information</h2>
                  <p className="text-sm text-muted-foreground mb-6">Personal Information</p>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <Label htmlFor="shipping_name" className="text-xs uppercase tracking-wider text-muted-foreground">{t("fullName")}</Label>
                      <Input id="shipping_name" name="shipping_name" value={formData.shipping_name} onChange={handleChange} required
                        className="mt-1.5 rounded-none border-border bg-transparent h-12 focus:ring-0 focus:border-foreground" placeholder="Full name" />
                    </div>
                    <div>
                      <Label htmlFor="shipping_email" className="text-xs uppercase tracking-wider text-muted-foreground">{t("email")}</Label>
                      <Input id="shipping_email" name="shipping_email" type="email" value={formData.shipping_email} onChange={handleChange} required
                        className="mt-1.5 rounded-none border-border bg-transparent h-12 focus:ring-0 focus:border-foreground" placeholder="Email" />
                    </div>
                    <div>
                      <Label htmlFor="shipping_phone" className="text-xs uppercase tracking-wider text-muted-foreground">{t("phoneNumber")}</Label>
                      <Input id="shipping_phone" name="shipping_phone" type="tel" value={formData.shipping_phone} onChange={handleChange} required
                        className="mt-1.5 rounded-none border-border bg-transparent h-12 focus:ring-0 focus:border-foreground" placeholder="e.g., 0244123456" />
                    </div>
                  </div>
                </section>

                {/* Shipping Information */}
                <section>
                  <h2 className="text-lg font-semibold mb-1">Shipping Information</h2>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
                    <div>
                      <Label htmlFor="shipping_region" className="text-xs uppercase tracking-wider text-muted-foreground">{t("region")}</Label>
                      <select id="shipping_region" name="shipping_region" value={formData.shipping_region} onChange={handleChange} required
                        className="mt-1.5 w-full h-12 rounded-none border border-border bg-transparent px-3 text-sm focus:outline-none focus:border-foreground">
                        <option value="">{t("selectRegion")}</option>
                        {GHANA_REGIONS.map((region) => (<option key={region} value={region}>{region}</option>))}
                      </select>
                    </div>
                    <div>
                      <Label htmlFor="shipping_city" className="text-xs uppercase tracking-wider text-muted-foreground">{t("city")}</Label>
                      <Input id="shipping_city" name="shipping_city" value={formData.shipping_city} onChange={handleChange} required
                        className="mt-1.5 rounded-none border-border bg-transparent h-12 focus:ring-0 focus:border-foreground" placeholder="City" />
                    </div>
                    <div className="md:col-span-2">
                      <Label htmlFor="shipping_address" className="text-xs uppercase tracking-wider text-muted-foreground">{t("streetAddress")}</Label>
                      <Input id="shipping_address" name="shipping_address" value={formData.shipping_address} onChange={handleChange} required
                        className="mt-1.5 rounded-none border-border bg-transparent h-12 focus:ring-0 focus:border-foreground" placeholder="Address" />
                    </div>
                  </div>
                </section>

                {/* Payment Method */}
                <section>
                  <h2 className="text-lg font-semibold mb-1">Payment Method</h2>
                  <p className="text-sm text-muted-foreground mb-4">Choose how you want to pay</p>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                    {([
                      { id: "mtn_momo", label: "MTN MoMo" },
                      { id: "telecel_cash", label: "Telecel Cash" },
                      { id: "tigo_cash", label: "AT Money" },
                      { id: "bank_card", label: "Card" },
                    ] as { id: PaymentMethod; label: string }[]).map((m) => {
                      const active = paymentMethod === m.id;
                      return (
                        <button
                          type="button"
                          key={m.id}
                          onClick={() => {
                            setPaymentMethod(m.id);
                            resetMomoFeedback();
                          }}
                          className={`flex items-center justify-center gap-2 h-12 px-3 border text-xs uppercase tracking-wider transition-colors ${
                            active
                              ? "border-foreground bg-foreground text-background"
                              : "border-border bg-transparent text-foreground hover:border-foreground"
                          }`}
                        >
                          {m.id === "bank_card" ? <CreditCard className="w-4 h-4" /> : <Smartphone className="w-4 h-4" />}
                          {m.label}
                        </button>
                      );
                    })}
                  </div>

                  {paymentMethod !== "bank_card" && (
                    <div className="mt-4">
                      <Label htmlFor="momo_number" className="text-xs uppercase tracking-wider text-muted-foreground">
                        Mobile Money Number
                      </Label>
                      <Input
                        id="momo_number"
                        name="momo_number"
                        type="tel"
                        inputMode="numeric"
                        value={momoNumber}
                        onChange={(e) => setMomoNumber(e.target.value)}
                        placeholder="e.g. 0244123456"
                        className="mt-1.5 rounded-none border-border bg-transparent h-12 focus:ring-0 focus:border-foreground"
                      />
                      <p className="text-xs text-muted-foreground mt-2">
                        A prompt will be sent to this number. Enter your Mobile Money PIN on your phone to authorize.
                      </p>
                      {momoInlineFeedback && (
                        <div className="mt-3 flex items-start gap-3 border border-destructive/30 bg-destructive/10 px-3 py-3 text-sm text-foreground">
                          <AlertTriangle className="mt-0.5 h-4 w-4 text-destructive" />
                          <div className="space-y-1">
                            <p className="font-medium">{momoInlineFeedback.title}</p>
                            <p className="text-xs text-muted-foreground">{momoInlineFeedback.description}</p>
                          </div>
                        </div>
                      )}
                    </div>
                  )}

                  <div className="mt-4 flex items-start gap-3 p-3 border border-border bg-secondary/30">
                    <span className="text-base leading-none mt-0.5">🔒</span>
                    <p className="text-xs text-muted-foreground">
                      Payments are processed securely by Paystack.
                    </p>
                  </div>
                </section>


                <Button
                  type="submit"
                  disabled={submitting}
                  className="w-full h-14 rounded-none bg-foreground text-background hover:bg-foreground/90 text-sm uppercase tracking-widest font-medium"
                >
                  {submitting ? <Loader2 className="w-5 h-5 animate-spin" /> : `Pay & Place Order — GH₵${finalTotal.toFixed(2)}`}
                </Button>

                <p className="text-xs text-center text-muted-foreground">
                  By placing this order, you agree to our Terms of Service and Privacy Policy
                </p>
              </form>
            </motion.div>

            {/* Right Column: Shopping Bag Summary */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.15 }}
              className="lg:col-span-2"
            >
              <div className="lg:sticky lg:top-24">
                <h2 className="text-lg font-semibold mb-6">
                  Shopping Bag ({cartItems.reduce((s, i) => s + i.quantity, 0)})
                </h2>

                <div className="space-y-6">
                  {cartItems.map((item) => (
                    <div key={item.id} className="flex gap-4">
                      <div className="w-20 h-24 bg-secondary rounded-lg overflow-hidden flex-shrink-0">
                        <img src={item.products.image} alt={item.products.name} className="w-full h-full object-cover" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex justify-between items-start">
                          <h3 className="font-semibold text-sm">{item.products.name}</h3>
                          <span className="font-semibold text-sm ml-2 flex-shrink-0">
                            GH₵{(item.products.price * item.quantity).toFixed(2)}
                          </span>
                        </div>
                        <p className="text-xs text-muted-foreground mt-1">{item.products.category}</p>
                        <p className="text-xs text-muted-foreground">Quantity: {item.quantity}</p>
                      </div>
                    </div>
                  ))}
                </div>

                {/* Promo Code */}
                <div className="mt-8 pt-6 border-t border-border">
                  {appliedDiscount ? (
                    <div className="flex items-center justify-between bg-secondary/50 p-3">
                      <div className="flex items-center gap-2">
                        <Tag className="w-4 h-4" />
                        <span className="text-sm font-medium">{appliedDiscount.code}</span>
                        <span className="text-xs text-muted-foreground">
                          ({appliedDiscount.type === "percentage" ? `${appliedDiscount.value}%` : `GH₵${appliedDiscount.value}`} off)
                        </span>
                      </div>
                      <button onClick={removeDiscount} className="text-muted-foreground hover:text-foreground"><X className="w-4 h-4" /></button>
                    </div>
                  ) : (
                    <div className="flex gap-2">
                      <Input
                        placeholder="Promocode"
                        value={discountCode}
                        onChange={(e) => setDiscountCode(e.target.value.toUpperCase())}
                        className="flex-1 rounded-none border-border bg-transparent h-11 text-sm"
                      />
                      <Button type="button" variant="outline" onClick={applyDiscountCode} disabled={discountLoading}
                        className="rounded-none h-11 px-6 uppercase text-xs tracking-wider border-foreground text-foreground hover:bg-foreground hover:text-background">
                        {discountLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : "Apply"}
                      </Button>
                    </div>
                  )}
                </div>

                {/* Totals */}
                <div className="mt-6 space-y-3 pt-4 border-t border-border">
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">
                      Delivery {formData.shipping_region ? `(${formData.shipping_region})` : ""}
                      {deliverySource === "default" && (
                        <span className="ml-1 text-[10px] uppercase tracking-wider text-muted-foreground/70">(default)</span>
                      )}
                      {deliverySource === "city" && (
                        <span className="ml-1 text-[10px] uppercase tracking-wider text-primary">(city rate)</span>
                      )}
                    </span>
                    <span>
                      {formData.shipping_region
                        ? deliveryFee > 0
                          ? `GH₵${deliveryFee.toFixed(2)}`
                          : "Free"
                        : "Select region"}
                    </span>
                  </div>
                  {appliedDiscount && (
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">Discount</span>
                      <span>-GH₵{appliedDiscount.amount.toFixed(2)}</span>
                    </div>
                  )}
                  <div className="flex justify-between text-lg font-semibold pt-3 border-t border-border">
                    <span>Total:</span>
                    <span>GH₵{finalTotal.toFixed(2)}</span>
                  </div>
                </div>
              </div>
            </motion.div>
          </div>
        </div>
      </main>
      <BottomNav />

      <Dialog open={momoDialogOpen} onOpenChange={(open) => { if (!open && submitting && (momoDialogMode === "waiting" || momoDialogMode === "otp")) return; setMomoDialogOpen(open); }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              {momoDialogMode === "waiting" && <Smartphone className="w-5 h-5" />}
              {momoDialogMode === "otp" && <Smartphone className="w-5 h-5" />}
              {momoDialogMode === "error" && <AlertTriangle className="w-5 h-5 text-destructive" />}
              {momoDialogTitle}
            </DialogTitle>
            <DialogDescription>{momoStatusText}</DialogDescription>
          </DialogHeader>
          {momoDialogMode === "waiting" && (
            <>
              <div className="flex items-center justify-center py-6">
                <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
              </div>
              <p className="text-xs text-center text-muted-foreground">
                {momoDialogHint || "Don't close this window. We'll confirm automatically once you approve."}
              </p>
            </>
          )}
          {momoDialogMode === "otp" && (
            <div className="space-y-4">
              <div className="border border-border bg-secondary/30 px-4 py-3 text-xs text-muted-foreground">
                {momoDialogHint}
              </div>
              <div className="space-y-2">
                <Label htmlFor="momo-otp" className="text-xs uppercase tracking-wider">OTP code</Label>
                <Input
                  id="momo-otp"
                  inputMode="numeric"
                  autoComplete="one-time-code"
                  value={otpValue}
                  onChange={(e) => setOtpValue(e.target.value.replace(/\s/g, ""))}
                  placeholder="Enter the code from your SMS"
                  className="rounded-none h-11 text-center tracking-widest"
                  maxLength={12}
                  disabled={otpSubmitting}
                />
              </div>
              <Button
                type="button"
                className="w-full rounded-none bg-foreground text-background hover:bg-foreground/90"
                onClick={handleSubmitOtp}
                disabled={otpSubmitting || otpValue.trim().length < 3}
              >
                {otpSubmitting ? <Loader2 className="w-4 h-4 animate-spin" /> : "Submit OTP"}
              </Button>
              <button
                type="button"
                onClick={() => { setMomoDialogOpen(false); setSubmitting(false); }}
                className="w-full text-xs text-muted-foreground hover:text-foreground underline"
              >
                Cancel payment
              </button>
            </div>
          )}
          {momoDialogMode === "error" && (
            <div className="space-y-4">
              <div className="border border-border bg-secondary/30 px-4 py-3 text-sm text-muted-foreground">
                {momoDialogHint}
              </div>
              <Button
                type="button"
                variant="outline"
                className="w-full rounded-none"
                onClick={() => setMomoDialogOpen(false)}
              >
                Close
              </Button>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
};

export default Checkout;
