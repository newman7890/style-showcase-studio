import { useEffect, useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { Package, Tag, Loader2, X, Smartphone, CreditCard, AlertTriangle, MapPin, CheckCircle2, Bookmark } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { useCart } from "@/hooks/useCart";
import { useOrders } from "@/hooks/useOrders";
import { useAuth } from "@/hooks/useAuth";
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

const getFunctionErrorMessage = async (error: any) => {
  if (!error) return null;
  try {
    if (error.context && typeof error.context.json === "function") {
      const body = await error.context.json();
      return body?.userMessage || body?.error || body?.message || null;
    }
  } catch {}
  return error?.message || null;
};
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
    shipping_address: "", shipping_city: "", shipping_region: "", shipping_town: "",
  });

  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>("mtn_momo");
  const [momoNumber, setMomoNumber] = useState("");
  const [momoDialogOpen, setMomoDialogOpen] = useState(false);
  const [momoDialogMode, setMomoDialogMode] = useState<MomoDialogMode>("waiting");
  const [momoDialogTitle, setMomoDialogTitle] = useState("Approve on your phone");
  const [momoStatusText, setMomoStatusText] = useState(DEFAULT_MOMO_PROMPT_TEXT);
  const [momoDialogHint, setMomoDialogHint] = useState<string | null>(null);
  const [momoInlineFeedback, setMomoInlineFeedback] = useState<{ title: string; description: string } | null>(null);
  const [momoReference, setMomoReference] = useState<string | null>(null);
  const [momoOrderId, setMomoOrderId] = useState<string | null>(null);
  const [otpValue, setOtpValue] = useState("");
  const [otpSubmitting, setOtpSubmitting] = useState(false);
  const [deliveryFees, setDeliveryFees] = useState<Array<{ region: string; city: string | null; town: string | null; fee: number; is_default: boolean }>>([]);

  const { user } = useAuth();
  const [savedAddresses, setSavedAddresses] = useState<Array<{
    id: string;
    label: string;
    name?: string;
    email?: string;
    phone?: string;
    address: string;
    city: string;
    region: string;
    town?: string;
  }>>([]);

  useEffect(() => {
    supabase
      .from("delivery_fees")
      .select("region, city, town, fee, is_default")
      .eq("is_active", true)
      .then(({ data }) => {
        if (data) setDeliveryFees(data as any);
      });
  }, []);

  useEffect(() => {
    const options: Array<{
      id: string;
      label: string;
      name?: string;
      email?: string;
      phone?: string;
      address: string;
      city: string;
      region: string;
      town?: string;
    }> = [];

    // 1. Load addresses from localStorage saved addresses
    try {
      const stored = localStorage.getItem("tp_saved_addresses");
      if (stored) {
        const parsed = JSON.parse(stored);
        if (Array.isArray(parsed)) {
          parsed.forEach((a: any) => {
            options.push({
              id: a.id || String(Math.random()),
              label: a.label || "Saved Address",
              name: user?.user_metadata?.full_name || "",
              email: user?.email || "",
              phone: a.phone || "",
              address: a.address || "",
              city: a.city || "",
              region: a.region || "",
              town: a.town || "",
            });
          });
        }
      }
    } catch {}

    // 2. Load latest order shipping details if user is signed in
    if (user) {
      supabase
        .from("orders")
        .select("shipping_name, shipping_email, shipping_phone, shipping_address, shipping_city, shipping_region")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false })
        .limit(1)
        .then(({ data }) => {
          if (data && data[0]) {
            const pastOrder = data[0];
            const pastOption = {
              id: "past-order-last",
              label: "Recent Order Address",
              name: pastOrder.shipping_name || "",
              email: pastOrder.shipping_email || user.email || "",
              phone: pastOrder.shipping_phone || "",
              address: pastOrder.shipping_address || "",
              city: pastOrder.shipping_city || "",
              region: pastOrder.shipping_region || "",
            };

            if (!options.some((o) => o.address.toLowerCase() === pastOption.address.toLowerCase())) {
              options.unshift(pastOption);
            }

            // Auto-fill formData if currently empty
            setFormData((prev) => ({
              shipping_name: prev.shipping_name || pastOrder.shipping_name || user?.user_metadata?.full_name || "",
              shipping_email: prev.shipping_email || pastOrder.shipping_email || user?.email || "",
              shipping_phone: prev.shipping_phone || pastOrder.shipping_phone || "",
              shipping_address: prev.shipping_address || pastOrder.shipping_address || (options[0]?.address || ""),
              shipping_city: prev.shipping_city || pastOrder.shipping_city || (options[0]?.city || ""),
              shipping_region: prev.shipping_region || pastOrder.shipping_region || (options[0]?.region || ""),
              shipping_town: prev.shipping_town || "",
            }));
          } else if (options.length > 0) {
            setFormData((prev) => ({
              shipping_name: prev.shipping_name || user?.user_metadata?.full_name || "",
              shipping_email: prev.shipping_email || user?.email || "",
              shipping_phone: prev.shipping_phone || options[0].phone || "",
              shipping_address: prev.shipping_address || options[0].address || "",
              shipping_city: prev.shipping_city || options[0].city || "",
              shipping_region: prev.shipping_region || options[0].region || "",
              shipping_town: prev.shipping_town || options[0].town || "",
            }));
          } else if (user) {
            setFormData((prev) => ({
              ...prev,
              shipping_name: prev.shipping_name || user.user_metadata?.full_name || "",
              shipping_email: prev.shipping_email || user.email || "",
            }));
          }
          setSavedAddresses(options);
        });
    } else {
      setSavedAddresses(options);
      if (options.length > 0) {
        setFormData((prev) => ({
          ...prev,
          shipping_address: prev.shipping_address || options[0].address || "",
          shipping_city: prev.shipping_city || options[0].city || "",
          shipping_region: prev.shipping_region || options[0].region || "",
        }));
      }
    }
  }, [user]);

  const selectSavedAddress = (addr: {
    id: string;
    label: string;
    name?: string;
    email?: string;
    phone?: string;
    address: string;
    city: string;
    region: string;
    town?: string;
  }) => {
    setFormData((prev) => ({
      ...prev,
      shipping_name: addr.name || prev.shipping_name,
      shipping_email: addr.email || prev.shipping_email,
      shipping_phone: addr.phone || prev.shipping_phone,
      shipping_address: addr.address,
      shipping_city: addr.city,
      shipping_region: addr.region,
      shipping_town: addr.town || "",
    }));
    toast.success(`Loaded address: ${addr.label}`);
  };

  const availableTowns = useMemo(() => {
    if (!formData.shipping_region) return [];
    const reg = formData.shipping_region.trim().toLowerCase();
    const city = formData.shipping_city ? formData.shipping_city.trim().toLowerCase() : "";
    const set = new Set<string>();
    deliveryFees.forEach((f) => {
      if (f.region.trim().toLowerCase() === reg && f.town && f.town.trim()) {
        if (!city || !f.city || f.city.trim().toLowerCase() === city) {
          set.add(f.town.trim());
        }
      }
    });
    return Array.from(set).sort();
  }, [deliveryFees, formData.shipping_region, formData.shipping_city]);

  // Fee resolution with fallback: exact town → city → region → default
  const deliveryFee = (() => {
    if (!formData.shipping_region) return 0;
    const region = formData.shipping_region.trim().toLowerCase();
    const city = formData.shipping_city.trim().toLowerCase();
    const town = formData.shipping_town.trim().toLowerCase();

    // 1. Exact town + city + region match
    if (town && city) {
      const townCityMatch = deliveryFees.find(
        (f) =>
          f.region.trim().toLowerCase() === region &&
          f.city && f.city.trim().toLowerCase() === city &&
          f.town && f.town.trim().toLowerCase() === town
      );
      if (townCityMatch) return Number(townCityMatch.fee);
    }
    // 2. Exact town + region match (no city set on fee row)
    if (town) {
      const townMatch = deliveryFees.find(
        (f) =>
          f.region.trim().toLowerCase() === region &&
          f.town && f.town.trim().toLowerCase() === town
      );
      if (townMatch) return Number(townMatch.fee);
    }
    // 3. Exact city + region match (no town set on fee row)
    if (city) {
      const cityMatch = deliveryFees.find(
        (f) =>
          f.region.trim().toLowerCase() === region &&
          f.city && f.city.trim().toLowerCase() === city &&
          (!f.town || !f.town.trim())
      );
      if (cityMatch) return Number(cityMatch.fee);
    }
    // 4. Region-only match (no city or town set)
    const regionOnly = deliveryFees.find(
      (f) =>
        f.region.trim().toLowerCase() === region &&
        (!f.city || !f.city.trim()) &&
        (!f.town || !f.town.trim())
    );
    if (regionOnly) return Number(regionOnly.fee);
    // 5. Any region match
    const anyRegion = deliveryFees.find((f) => f.region.trim().toLowerCase() === region);
    if (anyRegion) return Number(anyRegion.fee);
    // 6. Default fallback row
    const defaultRow = deliveryFees.find((f) => f.is_default);
    return defaultRow ? Number(defaultRow.fee) : 0;
  })();

  const deliverySource = (() => {
    if (!formData.shipping_region) return null;
    const region = formData.shipping_region.trim().toLowerCase();
    const city = formData.shipping_city.trim().toLowerCase();
    const town = formData.shipping_town.trim().toLowerCase();
    if (town && deliveryFees.some((f) => f.region.trim().toLowerCase() === region && f.town && f.town.trim().toLowerCase() === town)) return "town";
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

    if (error instanceof Error) {
      if (/failed to fetch|load failed|networkerror/i.test(error.message)) {
        return "Network connection issue. Please check your internet connection and try again.";
      }
      return error.message;
    }

    return null;
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

    // Auto-save address for future shopping trips
    try {
      const stored = localStorage.getItem("tp_saved_addresses");
      const existing = stored ? JSON.parse(stored) : [];
      const newAddr = {
        id: String(Date.now()),
        label: formData.shipping_address,
        phone: formData.shipping_phone,
        address: formData.shipping_address,
        city: formData.shipping_city,
        region: formData.shipping_region,
        town: formData.shipping_town,
        isDefault: existing.length === 0,
      };
      if (!existing.some((e: any) => e.address?.toLowerCase() === formData.shipping_address.toLowerCase())) {
        localStorage.setItem("tp_saved_addresses", JSON.stringify([newAddr, ...existing]));
      }
    } catch {}

    setSubmitting(true);
    try {
      const orderItems = cartItems.map((item) => ({
        product_id: item.product_id,
        quantity: item.quantity,
        price: item.products.price,
        selected_color: (item as any).selected_color || null,
        selected_size: (item as any).selected_size || null,
      }));

      const checkoutDetails = {
        shipping_name: formData.shipping_name,
        shipping_email: formData.shipping_email,
        shipping_phone: formData.shipping_phone,
        shipping_address: formData.shipping_address,
        shipping_city: formData.shipping_city,
        shipping_region: formData.shipping_region,
        shipping_town: formData.shipping_town || null,
        delivery_fee: deliveryFee,
        discount_code: appliedDiscount?.code || null,
        discount_amount: appliedDiscount?.amount || null,
        items: orderItems,
      };

      // Initialize Paystack directly without pre-creating any database record
      const callbackUrl = `${window.location.origin}/payment/callback`;
      const { data, error } = await supabase.functions.invoke("initialize-payment", {
        body: {
          email: formData.shipping_email,
          amount: finalTotal,
          paymentMethod,
          mobileNumber: momoNumber || formData.shipping_phone,
          callbackUrl,
          checkoutDetails,
        },
      });

      if (error || data?.error) {
        const msg = data?.error || (await getFunctionErrorMessage(error));
        toast.error(msg || "Could not initialize Paystack payment.");
        setSubmitting(false);
        return;
      }

      console.log("initialize-payment response data:", JSON.stringify(data));

      // 1. Try inline popup — publicKey + reference is all we need
      if (data?.publicKey && data?.reference && (window as any).PaystackPop) {
        try {
          const popupConfig: Record<string, any> = {
            key: data.publicKey,
            email: formData.shipping_email,
            amount: Math.round(finalTotal * 100),
            currency: "GHS",
            ref: data.reference,
            channels: data.channels || ["card", "mobile_money"],
            callback: (response: any) => {
              const paidReference = response?.reference ?? data.reference;
              window.location.href = `${callbackUrl}?reference=${paidReference}`;
            },
            onClose: () => {
              setSubmitting(false);
              toast.info("Payment cancelled. No order was placed.");
            },
          };

          const handler = (window as any).PaystackPop.setup(popupConfig);
          handler.openIframe();
          return;
        } catch (popupError) {
          console.error("Paystack inline popup failed, using redirect fallback:", popupError);
        }
      }

      // 2. Fallback: Redirect to Paystack's hosted checkout page if popup is blocked
      const redirectUrl = data?.authorizationUrl || data?.authorization_url;
      if (redirectUrl) {
        window.location.href = redirectUrl;
        return;
      }

      console.error("Payment initialization: no redirect URL or popup available. Full response:", data);
      toast.error("Payment initialization failed. Please try again.");
      setSubmitting(false);
    } catch (error: any) {
      console.error("Error placing order:", error);
      const rawMsg = error?.message || "";
      if (/failed to fetch|load failed|networkerror/i.test(rawMsg)) {
        toast.error("Network connection issue. Please check your internet connection and try again.");
      } else {
        toast.error(rawMsg || "Payment initialization failed. Please try again.");
      }
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

                {/* Saved Addresses Selector */}
                {savedAddresses.length > 0 && (
                  <div className="p-4 rounded-xl border border-primary/20 bg-primary/5 space-y-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2 text-primary font-bold text-xs">
                        <MapPin className="w-4 h-4" />
                        <span>Use Saved Delivery Address</span>
                      </div>
                      <Link to="/profile/address" className="text-[10px] text-primary hover:underline font-semibold flex items-center gap-1">
                        <Bookmark className="w-3 h-3" /> Manage Addresses
                      </Link>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      {savedAddresses.map((addr) => {
                        const isSelected =
                          formData.shipping_address === addr.address &&
                          formData.shipping_region === addr.region;

                        return (
                          <button
                            key={addr.id}
                            type="button"
                            onClick={() => selectSavedAddress(addr)}
                            className={`p-3 rounded-lg border text-left transition-all relative ${
                              isSelected
                                ? "border-primary bg-background shadow-xs ring-1 ring-primary"
                                : "border-border/80 bg-background/80 hover:bg-background"
                            }`}
                          >
                            <div className="flex items-center justify-between">
                              <span className="text-xs font-bold text-foreground truncate pr-2">{addr.label}</span>
                              {isSelected && <CheckCircle2 className="w-3.5 h-3.5 text-primary shrink-0" />}
                            </div>
                            <p className="text-[11px] text-muted-foreground mt-0.5 line-clamp-1">{addr.address}</p>
                            <p className="text-[10px] text-muted-foreground/80 font-medium">
                              {addr.city}, {addr.region}
                            </p>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}

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
                        className="mt-1.5 rounded-none border-border bg-transparent h-12 focus:ring-0 focus:border-foreground" placeholder="City (e.g., Accra, Kumasi)" />
                    </div>
                    <div className="md:col-span-2">
                      <Label htmlFor="shipping_town" className="text-xs uppercase tracking-wider text-muted-foreground">
                        Town / Sub-Area {availableTowns.length > 0 ? `(${availableTowns.length} towns registered)` : "(Optional)"}
                      </Label>
                      <Input
                        id="shipping_town"
                        name="shipping_town"
                        list="available-towns-list"
                        value={formData.shipping_town}
                        onChange={handleChange}
                        className="mt-1.5 rounded-none border-border bg-transparent h-12 focus:ring-0 focus:border-foreground"
                        placeholder="e.g. East Legon, Osu, Madina, Spintex, Pokuase..."
                      />
                      <datalist id="available-towns-list">
                        {availableTowns.map((townName) => (
                          <option key={townName} value={townName} />
                        ))}
                      </datalist>
                    </div>
                    <div className="md:col-span-2">
                      <Label htmlFor="shipping_address" className="text-xs uppercase tracking-wider text-muted-foreground">{t("streetAddress")}</Label>
                      <Input id="shipping_address" name="shipping_address" value={formData.shipping_address} onChange={handleChange} required
                        className="mt-1.5 rounded-none border-border bg-transparent h-12 focus:ring-0 focus:border-foreground" placeholder="Address" />
                    </div>
                  </div>
                </section>

                {/* Payment Method Selector */}
                <section className="space-y-4">
                  <div>
                    <h2 className="text-lg font-semibold mb-1">Payment Method</h2>
                    <p className="text-xs text-muted-foreground">Select your preferred payment channel on Paystack</p>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {/* Mobile Money Card */}
                    <button
                      type="button"
                      onClick={() => setPaymentMethod("mtn_momo")}
                      className={`p-4 border text-left rounded-xl transition-all flex flex-col justify-between relative ${
                        paymentMethod !== "bank_card"
                          ? "border-primary bg-primary/5 ring-1 ring-primary shadow-xs"
                          : "border-border bg-card hover:bg-secondary/40"
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2 font-bold text-sm">
                          <Smartphone className="w-4 h-4 text-primary" />
                          <span>Mobile Money</span>
                        </div>
                        {paymentMethod !== "bank_card" && <CheckCircle2 className="w-4 h-4 text-primary" />}
                      </div>
                      <p className="text-xs text-muted-foreground mt-2">
                        MTN MoMo, Telecel Cash, AirtelTigo Money
                      </p>
                      <div className="flex items-center gap-1.5 mt-3 pt-2 border-t border-border/50 text-[10px] font-semibold text-muted-foreground">
                        <span className="bg-amber-500/10 text-amber-600 px-1.5 py-0.5 rounded">MTN</span>
                        <span className="bg-red-500/10 text-red-600 px-1.5 py-0.5 rounded">Telecel</span>
                        <span className="bg-blue-500/10 text-blue-600 px-1.5 py-0.5 rounded">AT</span>
                      </div>
                    </button>

                    {/* Bank Card */}
                    <button
                      type="button"
                      onClick={() => setPaymentMethod("bank_card")}
                      className={`p-4 border text-left rounded-xl transition-all flex flex-col justify-between relative ${
                        paymentMethod === "bank_card"
                          ? "border-primary bg-primary/5 ring-1 ring-primary shadow-xs"
                          : "border-border bg-card hover:bg-secondary/40"
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2 font-bold text-sm">
                          <CreditCard className="w-4 h-4 text-primary" />
                          <span>Debit / Credit Card</span>
                        </div>
                        {paymentMethod === "bank_card" && <CheckCircle2 className="w-4 h-4 text-primary" />}
                      </div>
                      <p className="text-xs text-muted-foreground mt-2">
                        Visa, Mastercard, Verve & GhIPSS Cards
                      </p>
                      <div className="flex items-center gap-1.5 mt-3 pt-2 border-t border-border/50 text-[10px] font-semibold text-muted-foreground">
                        <span className="bg-blue-600/10 text-blue-600 px-1.5 py-0.5 rounded">Visa</span>
                        <span className="bg-orange-600/10 text-orange-600 px-1.5 py-0.5 rounded">Mastercard</span>
                      </div>
                    </button>
                  </div>



                  <div className="flex items-center gap-3 p-3.5 border border-border bg-secondary/20 rounded-xl">
                    <span className="text-lg leading-none">🔒</span>
                    <div>
                      <p className="text-xs font-semibold text-foreground">Encrypted Paystack Gateway</p>
                      <p className="text-[11px] text-muted-foreground mt-0.5">
                        Your payment is processed securely via Paystack. Trades Point never stores your PIN or card digits.
                      </p>
                    </div>
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
                        {!(item.selected_color as any)?.isGiftCard ? (
                          <p className="text-xs text-muted-foreground mt-1">Quantity: {item.quantity}</p>
                        ) : (
                          <div className="mt-1 text-xs text-muted-foreground">
                            <p>To: {(item.selected_color as any).recipientName} ({(item.selected_color as any).recipientEmail})</p>
                            <span className="inline-block mt-1 px-2 py-0.5 bg-secondary rounded text-foreground font-medium">Digital Item</span>
                          </div>
                        )}
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
                        ? `GH₵${deliveryFee.toFixed(2)}`
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
              <div className="border border-border bg-secondary/30 px-4 py-3 text-xs text-muted-foreground space-y-1.5">
                <p className="font-medium text-foreground">{momoDialogHint}</p>
                <div className="text-[11px] text-muted-foreground pt-1 border-t space-y-1">
                  <p>📲 <strong>Telecel (Vodafone):</strong> Dial <code className="bg-muted px-1 rounded font-mono">*110#</code> &rarr; Option 4 (Make Payment) &rarr; Option 1 (Generate Voucher) to get your 6-digit code.</p>
                  <p>📲 <strong>MTN / AirtelTigo:</strong> Check your SMS inbox or wait a few seconds for the provider code.</p>
                </div>
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
