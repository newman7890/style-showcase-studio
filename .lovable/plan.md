# Amazon-parity seller onboarding

Rebuild `/sell` as a multi-step wizard that captures the full Amazon-style data set, store all documents in a private bucket, and expand the admin Sellers tab to review every field and document. Business registration is required for every seller (no individual path).

## 1. Database changes (one migration)

Extend `public.seller_profiles` with the new fields. All uploads are stored as private storage paths in the existing `seller-verification` bucket (namespaced per user).

**New columns on `seller_profiles`:**

Personal
- `full_legal_name text`
- `date_of_birth date`

Business (all required)
- `business_registration_number text`
- `business_address text`
- `business_type text` — enum-like: `sole_proprietor | llc | corporation | partnership | other`
- `tax_id text` (TIN)
- `vat_number text` (nullable)

Government ID
- `id_document_type text` — `passport | national_id | drivers_license`
- `id_document_number text`
- `id_document_front_url text`
- `id_document_back_url text` (nullable, required for national ID / license)

Bank (extend existing)
- `bank_name text`
- `swift_bic text` (nullable)
- (existing `bank_code`, `account_number`, `account_name` kept)

Identity verification
- `selfie_url text`
- `identity_verified_at timestamptz` (admin sets on approval)

Proof of address
- `proof_of_address_url text`
- `proof_of_address_type text` — `bank_statement | utility_bill | credit_card_statement | government_document`
- `proof_of_address_issued_on date`

Tax forms
- `tax_form_type text` — `w9 | w8ben | other | none`
- `tax_form_url text` (nullable)

Store setup
- `store_name text`
- `store_logo_url text`
- `store_description text`
- `return_address text`

Verification flags (admin/system-managed, protected by existing `protect_seller_profile_fields` trigger — extend the trigger to also protect these):
- `email_verified_at timestamptz`
- `phone_verified_at timestamptz`

Compliance documents (per-seller, brand-level) — new table:
- `public.seller_compliance_documents(id, seller_profile_id fk, doc_type text, doc_url text, notes text, uploaded_at)`
  - `doc_type` values: `safety_certificate | fda_approval | ce_certificate | cpc | msds_sds | brand_authorization | manufacturer_invoice | other`
  - RLS: seller can insert/select/delete their own; admin can select all; standard grants.

Card-on-file for seller fees: store only a Paystack authorization reference (no PAN), so a new small table:
- `public.seller_billing_authorizations(id, user_id fk, paystack_authorization_code text, card_brand text, last4 text, exp_month int, exp_year int, is_default bool, created_at)`
  - RLS: seller manages own; admin can read; standard grants. (Wiring the actual Paystack tokenization call can be a follow-up — schema + admin visibility land now.)

Extend the `protect_seller_profile_fields` trigger to also freeze `identity_verified_at`, `email_verified_at`, `phone_verified_at` for non-admins.

## 2. Storage layout

Reuse the existing private `seller-verification` bucket. Paths, all under `{user_id}/…`:

```text
{uid}/id-front-*.jpg
{uid}/id-back-*.jpg
{uid}/selfie-*.jpg
{uid}/proof-of-address-*.pdf|jpg
{uid}/tax-form-*.pdf
{uid}/store-logo-*.png       ← also mirrored to public via signed URL for storefront
{uid}/compliance/{docId}-*.pdf
```

Storage RLS already limits insert/select to `auth.uid()::text = (storage.foldername(name))[1]`; extend policies so admins can `select` any object in the bucket (for review).

Store logo needs public display on the storefront. Two options — we'll upload the logo to the existing **public** `product-images` bucket under `store-logos/{uid}/…` and keep the URL on the profile; everything else stays private.

## 3. Frontend — `/sell` becomes a 5-step wizard

New component tree:

```text
src/pages/Sell.tsx                     (host + status screens, unchanged shell)
src/components/sell/SellerWizard.tsx   (stepper + navigation + submit)
src/components/sell/steps/
  Step1Account.tsx        Full legal name, DOB, email, phone, residential address
  Step2Business.tsx       Business type, name, reg #, business address, TIN, VAT
  Step3Identity.tsx       ID type/number, ID front + back upload, selfie upload,
                          proof-of-address type/date + upload, tax form type + upload
  Step4Bank.tsx           Bank name, account holder, account number, SWIFT/routing,
                          Ghana bank code (existing)
  Step5Store.tsx          Store name, logo upload, description, return address, review + submit
```

Wizard behaviour:
- Progress bar at top ("Step X of 5"), Back / Next buttons, per-step Zod validation.
- Draft persisted to `localStorage` per user id so refresh doesn't lose data.
- All uploads happen on submit (single `insert` into `seller_profiles`), with sequential uploads and clear per-file error toasts. `status` remains `pending`.
- After submit, the same "Application under review" card is shown as today.

## 4. Admin dashboard — expanded review UI

`src/components/admin/SellerApprovalsManagement.tsx` gets a new "Review" dialog opened from each pending card, organised into tabs:

1. **Personal** — full legal name, DOB, email (with verified badge), phone (with verified badge), residential address.
2. **Business** — type, name, reg #, business address, TIN, VAT.
3. **Identity** — ID type + number, thumbnails of ID front/back, selfie thumbnail; each opens a signed-URL viewer. Proof of address (type, issue date, doc link). Tax form (type + link). Button "Mark identity verified" sets `identity_verified_at`.
4. **Bank** — bank name, account holder, account number, SWIFT/routing, Ghana bank code.
5. **Store** — store name, logo, description, return address.
6. **Compliance** — list of uploaded compliance docs with links (empty state OK).
7. **Billing** — card-on-file rows (brand • last4 • exp), or "Not added" empty state.

The list view keeps the compact summary card already added, plus a new **"Review full application"** button that opens the tabbed dialog. Approve / Reject / Suspend actions stay where they are.

All document links use short-lived signed URLs generated on demand from the client via `supabase.storage.from('seller-verification').createSignedUrl(path, 300)`.

## 5. Out of scope for this turn (call out to user)

To keep this shippable in one pass, these land as schema + admin visibility only, with the actual integration as a follow-up:
- **Live video verification** — no third-party KYC provider wired; admin uses the uploaded selfie + ID for manual review. We can add Persona / Veriff later.
- **Card-on-file tokenization** — schema + admin view ship now; the Paystack "add card" flow (charge ₵1 to tokenize, store `authorization_code`) is a follow-up wiring task.
- **Per-product compliance uploads at listing time** — sellers can upload brand/category compliance docs on their profile now; gating specific product categories on specific doc types is a follow-up on the product form.

## Technical notes

- Migration adds columns as nullable to avoid breaking existing pending rows; app-level Zod enforces required-on-submit for new applications.
- Extend `protect_seller_profile_fields` trigger to freeze the new admin-managed timestamps.
- Add storage RLS policy: `create policy "admins read seller-verification" on storage.objects for select using (bucket_id = 'seller-verification' and public.has_role(auth.uid(), 'admin'))`.
- No changes to `SellerProtectedRoute` — approval gate is unchanged.
- Types regen after migration; wizard + admin UI code lands after the migration is approved.

## Deliverables order

1. Migration (schema + trigger + storage policy + new tables + grants).
2. Wizard files under `src/components/sell/`.
3. `src/pages/Sell.tsx` swapped to render `<SellerWizard />`.
4. Admin review dialog in `SellerApprovalsManagement.tsx`.
