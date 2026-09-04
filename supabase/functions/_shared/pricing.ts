import { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";

export interface AuthoritativePriceResult {
  itemsTotal: number;
  deliveryFee: number;
  discountAmount: number;
  totalAmount: number;
  items: Array<{
    product_id: string;
    quantity: number;
    price: number;
    selected_color?: any;
    selected_size?: any;
  }>;
}

/**
 * Calculates server-authoritative checkout totals, verifying:
 * 1. Exact catalog product prices and positive integer quantities (>0)
 * 2. Database-backed delivery fee based on shipping region/city/town via resolve_delivery_fee
 * 3. Server-validated discount coupon codes via validate_discount_code
 * 
 * Never trusts client-supplied prices, delivery fees, or discount amounts.
 */
export async function calculateAuthoritativeCheckoutTotal(
  supabase: SupabaseClient,
  checkoutDetails: {
    shipping_region: string;
    shipping_city: string;
    shipping_town?: string | null;
    discount_code?: string | null;
    items: Array<{
      product_id: string;
      quantity: number;
      selected_color?: any;
      selected_size?: any;
    }>;
  }
): Promise<AuthoritativePriceResult> {
  const items = checkoutDetails.items || [];
  if (!Array.isArray(items) || items.length === 0) {
    throw new Error("At least one item is required for checkout");
  }

  // 1. Verify item quantities and fetch catalog prices
  const productIds = items.map((i) => i.product_id).filter(Boolean);
  if (productIds.length === 0) {
    throw new Error("Invalid product IDs provided");
  }

  const { data: dbProducts, error: prodErr } = await supabase
    .from("products")
    .select("id, price, stock, name")
    .in("id", productIds);

  if (prodErr || !dbProducts) {
    throw new Error("Could not fetch product catalog prices");
  }

  const productMap = new Map(dbProducts.map((p) => [p.id, p]));
  let itemsTotal = 0;
  const verifiedItems = [];

  for (const item of items) {
    const rawQty = Number(item.quantity);
    if (!Number.isInteger(rawQty) || rawQty <= 0) {
      throw new Error("Order item quantity must be a positive whole number (at least 1)");
    }
    const qty = Math.min(100, rawQty);

    const prod = productMap.get(item.product_id);
    if (!prod) {
      throw new Error(`Product ${item.product_id} was not found in the active catalog`);
    }

    const unitPrice = Number(prod.price);
    if (!Number.isFinite(unitPrice) || unitPrice <= 0) {
      throw new Error(`Invalid price for product ${prod.name}`);
    }

    itemsTotal += unitPrice * qty;
    verifiedItems.push({
      product_id: item.product_id,
      quantity: qty,
      price: unitPrice,
      selected_color: item.selected_color || null,
      selected_size: item.selected_size || null,
    });
  }

  // 2. Authoritative Delivery Fee from database
  let serverDeliveryFee = 0;
  try {
    const { data: feeRes } = await supabase.rpc("resolve_delivery_fee", {
      _region: checkoutDetails.shipping_region || "Greater Accra",
      _city: checkoutDetails.shipping_city || "Accra",
      _town: checkoutDetails.shipping_town || null,
    });

    if (typeof feeRes === "number") {
      serverDeliveryFee = feeRes;
    } else if (feeRes !== null && !isNaN(Number(feeRes))) {
      serverDeliveryFee = Number(feeRes);
    }
  } catch (feeErr) {
    console.warn("Could not call resolve_delivery_fee, falling back to 0:", feeErr);
  }

  // 3. Authoritative Discount Validation from database
  let serverDiscountAmount = 0;
  if (checkoutDetails.discount_code && checkoutDetails.discount_code.trim()) {
    try {
      const { data: discountRes } = await supabase.rpc("validate_discount_code", {
        _code: checkoutDetails.discount_code.trim(),
        _order_amount: itemsTotal,
      });

      if (discountRes && Array.isArray(discountRes) && discountRes.length > 0) {
        const d = discountRes[0];
        if (d.is_valid && Number(d.discount_amount) > 0) {
          serverDiscountAmount = Math.min(itemsTotal, Number(d.discount_amount));
        }
      } else if (discountRes && discountRes.is_valid && Number(discountRes.discount_amount) > 0) {
        serverDiscountAmount = Math.min(itemsTotal, Number(discountRes.discount_amount));
      }
    } catch (discErr) {
      console.warn("Discount validation notice:", discErr);
    }
  }

  const computedTotal = Math.max(0.1, Number((itemsTotal + serverDeliveryFee - serverDiscountAmount).toFixed(2)));

  return {
    itemsTotal,
    deliveryFee: serverDeliveryFee,
    discountAmount: serverDiscountAmount,
    totalAmount: computedTotal,
    items: verifiedItems,
  };
}
