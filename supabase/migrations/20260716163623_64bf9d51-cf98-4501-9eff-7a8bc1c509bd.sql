
-- 1. Extend seller_profiles with Amazon-parity fields
ALTER TABLE public.seller_profiles
  ADD COLUMN IF NOT EXISTS full_legal_name text,
  ADD COLUMN IF NOT EXISTS date_of_birth date,
  ADD COLUMN IF NOT EXISTS business_registration_number text,
  ADD COLUMN IF NOT EXISTS business_address text,
  ADD COLUMN IF NOT EXISTS business_type text,
  ADD COLUMN IF NOT EXISTS tax_id text,
  ADD COLUMN IF NOT EXISTS vat_number text,
  ADD COLUMN IF NOT EXISTS id_document_type text,
  ADD COLUMN IF NOT EXISTS id_document_number text,
  ADD COLUMN IF NOT EXISTS id_document_front_url text,
  ADD COLUMN IF NOT EXISTS id_document_back_url text,
  ADD COLUMN IF NOT EXISTS bank_name text,
  ADD COLUMN IF NOT EXISTS swift_bic text,
  ADD COLUMN IF NOT EXISTS selfie_url text,
  ADD COLUMN IF NOT EXISTS identity_verified_at timestamptz,
  ADD COLUMN IF NOT EXISTS proof_of_address_url text,
  ADD COLUMN IF NOT EXISTS proof_of_address_type text,
  ADD COLUMN IF NOT EXISTS proof_of_address_issued_on date,
  ADD COLUMN IF NOT EXISTS tax_form_type text,
  ADD COLUMN IF NOT EXISTS tax_form_url text,
  ADD COLUMN IF NOT EXISTS store_name text,
  ADD COLUMN IF NOT EXISTS store_logo_url text,
  ADD COLUMN IF NOT EXISTS store_description text,
  ADD COLUMN IF NOT EXISTS return_address text,
  ADD COLUMN IF NOT EXISTS email_verified_at timestamptz,
  ADD COLUMN IF NOT EXISTS phone_verified_at timestamptz;

-- Value constraints (nullable-safe)
ALTER TABLE public.seller_profiles
  DROP CONSTRAINT IF EXISTS seller_profiles_business_type_check,
  DROP CONSTRAINT IF EXISTS seller_profiles_id_document_type_check,
  DROP CONSTRAINT IF EXISTS seller_profiles_proof_of_address_type_check,
  DROP CONSTRAINT IF EXISTS seller_profiles_tax_form_type_check;

ALTER TABLE public.seller_profiles
  ADD CONSTRAINT seller_profiles_business_type_check
    CHECK (business_type IS NULL OR business_type IN ('sole_proprietor','llc','corporation','partnership','other')),
  ADD CONSTRAINT seller_profiles_id_document_type_check
    CHECK (id_document_type IS NULL OR id_document_type IN ('passport','national_id','drivers_license')),
  ADD CONSTRAINT seller_profiles_proof_of_address_type_check
    CHECK (proof_of_address_type IS NULL OR proof_of_address_type IN ('bank_statement','utility_bill','credit_card_statement','government_document')),
  ADD CONSTRAINT seller_profiles_tax_form_type_check
    CHECK (tax_form_type IS NULL OR tax_form_type IN ('w9','w8ben','other','none'));

-- 2. Extend protect_seller_profile_fields to freeze new admin/system managed fields
CREATE OR REPLACE FUNCTION public.protect_seller_profile_fields()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF public.has_role(auth.uid(), 'admin') THEN RETURN NEW; END IF;
  NEW.status := OLD.status;
  NEW.paystack_subaccount_code := OLD.paystack_subaccount_code;
  NEW.rejection_reason := OLD.rejection_reason;
  NEW.commission_override := OLD.commission_override;
  NEW.approved_at := OLD.approved_at;
  NEW.identity_verified_at := OLD.identity_verified_at;
  NEW.email_verified_at := OLD.email_verified_at;
  NEW.phone_verified_at := OLD.phone_verified_at;
  RETURN NEW;
END; $$;

-- 3. Seller compliance documents
CREATE TABLE IF NOT EXISTS public.seller_compliance_documents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  seller_profile_id uuid NOT NULL REFERENCES public.seller_profiles(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  doc_type text NOT NULL CHECK (doc_type IN ('safety_certificate','fda_approval','ce_certificate','cpc','msds_sds','brand_authorization','manufacturer_invoice','other')),
  doc_url text NOT NULL,
  notes text,
  uploaded_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.seller_compliance_documents TO authenticated;
GRANT ALL ON public.seller_compliance_documents TO service_role;

ALTER TABLE public.seller_compliance_documents ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Sellers manage own compliance docs"
  ON public.seller_compliance_documents
  FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Admins read all compliance docs"
  ON public.seller_compliance_documents
  FOR SELECT
  USING (public.has_role(auth.uid(), 'admin'));

-- 4. Seller billing authorizations (Paystack card-on-file references)
CREATE TABLE IF NOT EXISTS public.seller_billing_authorizations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  paystack_authorization_code text NOT NULL,
  card_brand text,
  last4 text,
  exp_month int,
  exp_year int,
  is_default boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.seller_billing_authorizations TO authenticated;
GRANT ALL ON public.seller_billing_authorizations TO service_role;

ALTER TABLE public.seller_billing_authorizations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Sellers manage own billing auths"
  ON public.seller_billing_authorizations
  FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Admins read billing auths"
  ON public.seller_billing_authorizations
  FOR SELECT
  USING (public.has_role(auth.uid(), 'admin'));

-- 5. Storage: let admins read every object in seller-verification (for review)
DROP POLICY IF EXISTS "Admins read seller-verification objects" ON storage.objects;
CREATE POLICY "Admins read seller-verification objects"
  ON storage.objects
  FOR SELECT
  USING (bucket_id = 'seller-verification' AND public.has_role(auth.uid(), 'admin'));
