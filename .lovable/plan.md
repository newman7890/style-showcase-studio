
# Multi-Vendor Marketplace Conversion

Transform the current single-vendor store into a marketplace where sellers register, submit products for approval, and receive automatic payouts via Paystack split payments while you take a platform commission.

## Roles & flows

- **Buyer** — default role on signup. Browses, buys, tracks orders (unchanged experience).
- **Seller** — opts in via a "Become a seller" application. Stays `pending` until you approve. Once approved, gets a Seller Dashboard to create/edit products, view their orders, and see payouts.
- **Admin (you)** — approves sellers, approves each product submission, sets the global commission %, views all orders/sellers, can suspend anyone.

```text
Signup ──► Buyer (auto)
             │
             └─► Apply as seller ──► pending ──► [admin approve] ──► Seller
                                                                       │
                                                        Create product ──► pending ──► [admin approve] ──► Live
```

## What gets built

### 1. Data model (new + changes)
- `app_role` enum gains `seller`.
- `seller_profiles` — one row per seller: `user_id`, `business_name`, `phone`, `bank_code`, `account_number`, `paystack_subaccount_code`, `status` (pending/approved/suspended/rejected), `rejection_reason`, `commission_override` (nullable — falls back to global).
- `products` gains `seller_id`, `status` (pending/approved/rejected/hidden), `rejection_reason`. Existing products get backfilled to your admin user + approved.
- `order_items` gains `seller_id`, `unit_price`, `commission_amount`, `seller_earnings` snapshotted at purchase time so payout math is stable even if prices/commission change later.
- `platform_settings` — single-row table holding `default_commission_percent` (editable in admin).
- `payout_ledger` — per order_item record of amount owed / paid to each seller (populated by Paystack webhook).

### 2. Row-Level Security
- Sellers can `SELECT/INSERT/UPDATE` only their own `seller_profiles` and only their own products (and only while `status != approved` for edits that touch price/stock, to prevent post-approval tampering — or a re-approval flag).
- Sellers can `SELECT` `order_items` where `seller_id = auth.uid()` and the parent order via a security-definer function (no cross-seller leakage).
- Buyers unchanged. Admin bypasses via `has_role(auth.uid(), 'admin')`.
- Public storefront only sees `products.status = 'approved'` AND seller `status = 'approved'`.

### 3. Paystack split payments
- On seller approval (or when they submit bank details), an edge function `create-seller-subaccount` calls Paystack's Subaccount API and stores the returned `subaccount_code`.
- `initialize-payment` edge function is updated: for single-seller carts it passes `subaccount` + `bearer=account` so Paystack auto-splits (seller gets net, you get commission). For multi-seller carts it uses Paystack's `split_code` (a dynamic split created per order). Commission % is read server-side from `platform_settings` / seller override — never trusted from client.
- `paystack-webhook` records payout amounts into `payout_ledger` when the charge succeeds.

### 4. UI additions
- `/sell` landing + application form ("Become a seller").
- `/seller` dashboard (protected by `seller` role + approved status): product list, add/edit product form, orders table filtered to their items, earnings summary, bank details form.
- Admin dashboard gets 3 new tabs: **Seller Applications**, **Product Approvals**, **Platform Settings** (commission %).
- Product detail page shows seller name + link to their storefront `/seller/:id`.
- Header/profile menu gains a "Seller" entry for approved sellers.

### 5. Notifications
- Seller application approved/rejected → in-app + email.
- Product approved/rejected → in-app + email.
- New order containing your item → seller notification.

## Out of scope for this pass
- Seller ratings/reviews (product reviews stay as-is).
- Seller-to-buyer messaging.
- Refund flow (still admin-handled via existing order status).
- Multi-currency payouts (Paystack GH₵ only, matches current setup).

## Technical notes
- Backfill: assign all existing products to your admin user with `status='approved'` and mark you as an approved seller so nothing breaks.
- `has_role(user, 'seller')` reused in RLS; new security-definer helpers `is_approved_seller(uuid)` and `get_seller_id_for_order_item(uuid)` avoid recursive policies.
- Paystack subaccount + split creation lives entirely in edge functions using `PAYSTACK_SECRET_KEY` — no client-side calls that could tamper with commission.
- Existing `enforce_order_pricing` trigger extended to snapshot `unit_price`, `commission_amount`, `seller_earnings` on order_items at insert time using server-authoritative values.
- Migration order: enum → tables → grants → RLS → policies → triggers → backfill.

## Rollout plan (implementation order)
1. Schema migration + backfill (single migration, awaits your approval).
2. Seller application UI + admin approval tab.
3. Seller dashboard (products CRUD with approval workflow) + admin product approvals tab.
4. Paystack subaccount edge function + bank-details form.
5. Split-payment wiring in `initialize-payment` + webhook payout ledger.
6. Storefront filtering (only approved products/sellers) + seller storefront page.
7. Notifications for seller/product state changes.

Approve this plan and I'll start with step 1 (the migration).
