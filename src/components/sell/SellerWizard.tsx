import { useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import { z } from "zod";
import { ChevronLeft, ChevronRight, Loader2, Upload, CheckCircle2, BookOpen, ShieldCheck, Award, MapPin, Truck, ExternalLink } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Progress } from "@/components/ui/progress";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { SellerDocumentationModal } from "./SellerDocumentationModal";

type Form = {
  // Step 1 - Personal / Account
  full_legal_name: string;
  date_of_birth: string;
  email: string;
  phone: string;
  address: string; // residential
  // Step 2 - Business
  business_type: string;
  business_name: string;
  business_registration_number: string;
  business_address: string;
  tax_id: string;
  vat_number: string;
  // Step 3 - Identity
  id_document_type: string;
  id_document_number: string;
  ghana_card_number: string; // reuse existing field for Ghana Card #
  proof_of_address_type: string;
  proof_of_address_issued_on: string;
  tax_form_type: string;
  // Step 4 - Payout (Bank OR Mobile Money)
  payout_method: "bank" | "momo";
  bank_name: string;
  account_name: string;
  account_number: string;
  bank_code: string;
  swift_bic: string;
  momo_provider: string;
  momo_number: string;
  momo_account_name: string;
  // Step 5 - Store & Fulfillment
  fulfillment_model: "direct_pickup" | "hub_dropoff";
  pickup_address: string;
  pickup_landmark: string;
  pickup_latitude: number | null;
  pickup_longitude: number | null;
  pickup_phone: string;
  pickup_google_maps_url: string;
  store_name: string;
  store_description: string;
  return_address: string;
  bio: string;
  agreed_terms: boolean;
  // Draft uploaded file paths (persisted on page refresh)
  draft_id_front_path: string;
  draft_id_back_path: string;
  draft_selfie_path: string;
  draft_proof_path: string;
  draft_tax_path: string;
  draft_store_logo_url: string;
};

const EMPTY: Form = {
  full_legal_name: "",
  date_of_birth: "",
  email: "",
  phone: "",
  address: "",
  business_type: "",
  business_name: "",
  business_registration_number: "",
  business_address: "",
  tax_id: "",
  vat_number: "",
  id_document_type: "",
  id_document_number: "",
  ghana_card_number: "",
  proof_of_address_type: "",
  proof_of_address_issued_on: "",
  tax_form_type: "none",
  payout_method: "bank",
  bank_name: "",
  account_name: "",
  account_number: "",
  bank_code: "",
  swift_bic: "",
  momo_provider: "",
  momo_number: "",
  momo_account_name: "",
  fulfillment_model: "direct_pickup",
  pickup_address: "",
  pickup_landmark: "",
  pickup_latitude: null,
  pickup_longitude: null,
  pickup_phone: "",
  pickup_google_maps_url: "",
  store_name: "",
  store_description: "",
  return_address: "",
  bio: "",
  agreed_terms: false,
  draft_id_front_path: "",
  draft_id_back_path: "",
  draft_selfie_path: "",
  draft_proof_path: "",
  draft_tax_path: "",
  draft_store_logo_url: "",
};

const stepSchemas = [
  z.object({
    full_legal_name: z.string().trim().min(2, "Required").max(120),
    date_of_birth: z.string().min(1, "Required"),
    email: z.string().trim().email("Invalid email").max(255),
    phone: z.string().trim().min(6, "Required").max(30),
    address: z.string().trim().min(4, "Required").max(300),
  }),
  z.object({
    business_type: z.enum(["sole_proprietor", "llc", "corporation", "partnership", "other"]).optional().or(z.literal("")),
    business_name: z.string().trim().min(2, "Required").max(120),
    business_registration_number: z.string().trim().max(60).optional().or(z.literal("")),
    business_address: z.string().trim().min(4, "Required").max(300),
    tax_id: z.string().trim().max(60).optional().or(z.literal("")),
    vat_number: z.string().trim().max(60).optional().or(z.literal("")),
  }),
  z.object({
    id_document_type: z.enum(["passport", "national_id", "drivers_license"], {
      errorMap: () => ({ message: "Select an ID type" }),
    }),
    id_document_number: z.string().trim().min(3, "Required").max(60),
    ghana_card_number: z
      .string()
      .trim()
      .regex(/^GHA-?\d{9}-?\d$/i, "Format: GHA-XXXXXXXXX-X"),
    proof_of_address_type: z.enum(
      ["bank_statement", "utility_bill", "credit_card_statement", "government_document"],
      { errorMap: () => ({ message: "Select a document type" }) }
    ).optional().or(z.literal("")),
    proof_of_address_issued_on: z.string().optional().or(z.literal("")),
    tax_form_type: z.enum(["w9", "w8ben", "other", "none"]).optional().or(z.literal("")),
  }),
  z.discriminatedUnion("payout_method", [
    z.object({
      payout_method: z.literal("bank"),
      bank_name: z.string().trim().min(2, "Required").max(120),
      account_name: z.string().trim().min(2, "Required").max(120),
      account_number: z.string().trim().min(4, "Required").max(40),
      bank_code: z.string().trim().min(2, "Required").max(20),
      swift_bic: z.string().trim().max(20).optional().or(z.literal("")),
    }),
    z.object({
      payout_method: z.literal("momo"),
      momo_provider: z.enum(["mtn", "vod", "atl"], {
        errorMap: () => ({ message: "Select a Mobile Money network" }),
      }),
      momo_number: z
        .string()
        .trim()
        .regex(/^0\d{9}$/, "Enter a 10-digit Ghana number, e.g. 024xxxxxxx"),
      momo_account_name: z.string().trim().min(2, "Required").max(120),
    }),
  ]),
  z.object({
    fulfillment_model: z.enum(["direct_pickup", "hub_dropoff"]).optional().default("direct_pickup"),
    pickup_address: z.string().trim().optional().or(z.literal("")),
    pickup_landmark: z.string().trim().optional().or(z.literal("")),
    pickup_latitude: z.number().nullable().optional(),
    pickup_longitude: z.number().nullable().optional(),
    pickup_phone: z.string().trim().optional().or(z.literal("")),
    pickup_google_maps_url: z.string().trim().optional().or(z.literal("")),
    store_name: z.string().trim().min(2, "Required").max(120),
    store_description: z.string().trim().min(10, "At least 10 chars").max(500),
    return_address: z.string().trim().optional().or(z.literal("")),
    bio: z.string().trim().max(500).optional().or(z.literal("")),
    agreed_terms: z.literal(true, {
      errorMap: () => ({ message: "Please read and accept the Seller Policy & Terms before submitting." }),
    }),
    draft_id_front_path: z.string().optional(),
    draft_id_back_path: z.string().optional(),
    draft_selfie_path: z.string().optional(),
    draft_proof_path: z.string().optional(),
    draft_tax_path: z.string().optional(),
    draft_store_logo_url: z.string().optional(),
  }),
];

type FileSlot =
  | "id_front"
  | "id_back"
  | "selfie"
  | "proof_of_address"
  | "tax_form"
  | "store_logo";

const MAX_FILE_MB = 8;

export default function SellerWizard() {
  const { user, refreshRoles } = useAuth();
  const { toast } = useToast();
  const [step, setStep] = useState(0);
  const [form, setForm] = useState<Form>(EMPTY);
  const [files, setFiles] = useState<Partial<Record<FileSlot, File>>>({});
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);

  const storageKey = user ? `seller-wizard-draft:${user.id}` : null;

  // Hydrate draft
  useEffect(() => {
    if (!storageKey) return;
    try {
      const raw = localStorage.getItem(storageKey);
      if (raw) {
        const parsed = JSON.parse(raw);
        setForm((f) => ({ ...f, ...parsed.form }));
        if (typeof parsed.step === "number") setStep(parsed.step);
      }
    } catch {}
    if (user?.email) setForm((f) => (f.email ? f : { ...f, email: user.email! }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [storageKey]);

  // Persist draft
  useEffect(() => {
    if (!storageKey) return;
    try {
      localStorage.setItem(storageKey, JSON.stringify({ form, step }));
    } catch {}
  }, [form, step, storageKey]);

  const totalSteps = 5;
  const progress = ((step + 1) / totalSteps) * 100;

  const set = <K extends keyof Form>(k: K, v: Form[K]) => setForm((f) => ({ ...f, [k]: v }));

  const uploadPrivate = async (file: File, name: string) => {
    const ext = file.name.split(".").pop() || "bin";
    const path = `${user!.id}/${name}-${Date.now()}.${ext}`;
    const { error } = await supabase.storage
      .from("seller-verification")
      .upload(path, file, { upsert: false, contentType: file.type });
    if (error) throw error;
    return path;
  };

  const uploadPublicLogo = async (file: File) => {
    const ext = file.name.split(".").pop() || "png";
    const path = `store-logos/${user!.id}/logo-${Date.now()}.${ext}`;
    const { error } = await supabase.storage
      .from("product-images")
      .upload(path, file, { upsert: false, contentType: file.type });
    if (error) throw error;
    const { data } = supabase.storage.from("product-images").getPublicUrl(path);
    return data.publicUrl;
  };

  const [uploadingSlots, setUploadingSlots] = useState<Record<string, boolean>>({});

  const setFile = async (slot: FileSlot, f: File | null) => {
    setFiles((prev) => ({ ...prev, [slot]: f ?? undefined }));
    if (!f || !user) return;

    setUploadingSlots((prev) => ({ ...prev, [slot]: true }));
    try {
      if (slot === "store_logo") {
        const url = await uploadPublicLogo(f);
        set("draft_store_logo_url", url);
      } else {
        const slotMap: Record<string, { name: string; key: keyof Form }> = {
          id_front: { name: "id-front", key: "draft_id_front_path" },
          id_back: { name: "id-back", key: "draft_id_back_path" },
          selfie: { name: "selfie", key: "draft_selfie_path" },
          proof_of_address: { name: "proof-of-address", key: "draft_proof_path" },
          tax_form: { name: "tax-form", key: "draft_tax_path" },
        };
        const config = slotMap[slot];
        if (config) {
          const path = await uploadPrivate(f, config.name);
          set(config.key, path as any);
        }
      }
      toast({
        title: "Photo Saved ☁️",
        description: "Uploaded and saved to draft. You won't lose it if you refresh!",
      });
    } catch (err: any) {
      console.error(`Auto-upload failed for ${slot}:`, err);
    } finally {
      setUploadingSlots((prev) => ({ ...prev, [slot]: false }));
    }
  };

  const validateStep = () => {
    const schema = stepSchemas[step];
    const parsed = schema.safeParse(form);
    if (parsed.success) {
      // Extra file requirements
      if (step === 2) {
        const errs: Record<string, string> = {};
        if (!files.id_front && !form.draft_id_front_path) errs.id_front = "Upload the front of your ID";
        if (form.id_document_type !== "passport" && !files.id_back && !form.draft_id_back_path)
          errs.id_back = "Upload the back of your ID";
        if (!files.selfie && !form.draft_selfie_path) errs.selfie = "Upload a clear selfie";
        if (form.proof_of_address_type && !files.proof_of_address && !form.draft_proof_path)
          errs.proof_of_address = "Upload a proof of address document";
        if (form.tax_form_type && form.tax_form_type !== "none" && !files.tax_form && !form.draft_tax_path)
          errs.tax_form = "Upload the selected tax form";
        for (const f of Object.values(files)) {
          if (f && f.size > MAX_FILE_MB * 1024 * 1024) {
            errs.file_size = `Each file must be under ${MAX_FILE_MB}MB`;
            break;
          }
        }
        if (Object.keys(errs).length) {
          setErrors(errs);
          return false;
        }
      }
      setErrors({});
      return true;
    }
    const errs: Record<string, string> = {};
    parsed.error.errors.forEach((e) => {
      if (e.path[0]) errs[e.path[0] as string] = e.message;
    });
    setErrors(errs);
    return false;
  };

  const next = () => {
    if (!validateStep()) return;
    setStep((s) => Math.min(s + 1, totalSteps - 1));
    window.scrollTo({ top: 0, behavior: "smooth" });
  };
  const back = () => {
    setErrors({});
    setStep((s) => Math.max(s - 1, 0));
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const submit = async () => {
    if (!validateStep()) return;
    if (!user) return;

    const missing: Record<string, string> = {};
    if (!files.id_front && !form.draft_id_front_path) missing.id_front = "Upload the front of your ID";
    if (form.id_document_type !== "passport" && !files.id_back && !form.draft_id_back_path)
      missing.id_back = "Upload the back of your ID";
    if (!files.selfie && !form.draft_selfie_path) missing.selfie = "Upload a clear selfie";
    if (form.proof_of_address_type && !files.proof_of_address && !form.draft_proof_path)
      missing.proof_of_address = "Upload a proof of address";
    if (form.tax_form_type && form.tax_form_type !== "none" && !files.tax_form && !form.draft_tax_path)
      missing.tax_form = "Upload the selected tax form";
    if (Object.keys(missing).length) {
      setErrors(missing);
      setStep(2);
      toast({
        title: "Missing Verification Documents",
        description: "Please attach the required verification documents before submitting.",
        variant: "destructive",
      });
      return;
    }

    setSubmitting(true);
    try {
      const idFront = files.id_front
        ? await uploadPrivate(files.id_front, "id-front")
        : form.draft_id_front_path || null;
      const idBack = files.id_back
        ? await uploadPrivate(files.id_back, "id-back")
        : form.draft_id_back_path || null;
      const selfie = files.selfie
        ? await uploadPrivate(files.selfie, "selfie")
        : form.draft_selfie_path || null;
      const poa = files.proof_of_address
        ? await uploadPrivate(files.proof_of_address, "proof-of-address")
        : form.draft_proof_path || null;
      const taxForm =
        files.tax_form && form.tax_form_type !== "none"
          ? await uploadPrivate(files.tax_form, "tax-form")
          : form.draft_tax_path || null;
      const storeLogo = files.store_logo
        ? await uploadPublicLogo(files.store_logo)
        : form.draft_store_logo_url || null;

      const insertPayload: Record<string, any> = {
        user_id: user.id,
        status: "pending",
        // legacy required fields
        business_name: form.business_name,
        email: form.email,
        phone: form.phone,
        address: form.address,
        ghana_card_number: form.ghana_card_number.toUpperCase(),
        ghana_card_image_url: idFront ?? "",
        bio: form.bio || form.store_description || null,
        // new fields
        full_legal_name: form.full_legal_name,
        date_of_birth: form.date_of_birth || null,
        business_type: form.business_type || null,
        business_registration_number: form.business_registration_number || null,
        business_address: form.business_address,
        tax_id: form.tax_id || null,
        vat_number: form.vat_number || null,
        id_document_type: form.id_document_type,
        id_document_number: form.id_document_number,
        id_document_front_url: idFront,
        id_document_back_url: idBack,
        selfie_url: selfie,
        proof_of_address_url: poa,
        proof_of_address_type: form.proof_of_address_type || null,
        proof_of_address_issued_on: form.proof_of_address_issued_on || null,
        tax_form_type: form.tax_form_type || "none",
        tax_form_url: taxForm,
        payout_method: form.payout_method,
        bank_name: form.payout_method === "bank" ? form.bank_name : null,
        account_name: form.payout_method === "bank" ? form.account_name : null,
        account_number: form.payout_method === "bank" ? form.account_number : null,
        bank_code: form.payout_method === "bank" ? form.bank_code : null,
        swift_bic: form.payout_method === "bank" ? form.swift_bic || null : null,
        momo_provider: form.payout_method === "momo" ? form.momo_provider : null,
        momo_number: form.payout_method === "momo" ? form.momo_number : null,
        momo_account_name: form.payout_method === "momo" ? form.momo_account_name : null,
        store_name: form.store_name,
        store_logo_url: storeLogo,
        store_description: form.store_description,
        return_address: form.return_address || null,
        fulfillment_model: form.fulfillment_model || "direct_pickup",
        pickup_address: form.pickup_address || form.business_address || form.address || null,
        pickup_landmark: form.pickup_landmark || null,
        pickup_latitude: form.pickup_latitude || null,
        pickup_longitude: form.pickup_longitude || null,
        pickup_phone: form.pickup_phone || form.phone || null,
        pickup_google_maps_url: form.pickup_google_maps_url || null,
      };

      let { error } = await supabase.from("seller_profiles").insert(insertPayload);

      // Fallback: If Supabase schema cache hasn't updated yet, retry without new fulfillment columns
      if (error && (error.message?.includes("fulfillment_model") || error.message?.includes("schema cache"))) {
        delete insertPayload.fulfillment_model;
        delete insertPayload.pickup_address;
        delete insertPayload.pickup_landmark;
        delete insertPayload.pickup_latitude;
        delete insertPayload.pickup_longitude;
        delete insertPayload.pickup_phone;
        delete insertPayload.pickup_google_maps_url;
        const retry = await supabase.from("seller_profiles").insert(insertPayload);
        error = retry.error;
      }

      if (error) throw error;

      if (storageKey) localStorage.removeItem(storageKey);
      toast({
        title: "Application submitted 📨",
        description: "An admin will review your application. You'll be notified once approved.",
      });
      await refreshRoles();
    } catch (err: any) {
      toast({ title: "Submission failed", description: err.message, variant: "destructive" });
    } finally {
      setSubmitting(false);
    }
  };

  const stepTitle = useMemo(
    () => ["Personal info", "Business details", "Identity verification", "Payout method", "Store setup"][step],
    [step],
  );

  return (
    <Card>
      <CardHeader>
        {/* Seller Documentation & Policy Top Banner */}
        <div className="mb-3 p-3 bg-gradient-to-r from-emerald-50 via-teal-50 to-green-50 dark:from-emerald-950/40 dark:to-teal-950/40 border border-emerald-200 dark:border-emerald-800/60 rounded-xl flex items-center justify-between gap-3 shadow-xs">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-8 h-8 rounded-lg bg-emerald-600 text-white flex items-center justify-center shrink-0 font-bold">
              <BookOpen className="w-4 h-4" />
            </div>
            <div className="min-w-0 text-left">
              <div className="text-xs font-bold text-emerald-900 dark:text-emerald-300 truncate">
                Seller Guide, Payouts & Policy
              </div>
              <div className="text-[11px] text-emerald-700 dark:text-emerald-400 truncate">
                10% commission, 24h payouts, seller policy & privacy
              </div>
            </div>
          </div>
          <SellerDocumentationModal
            trigger={
              <Button size="sm" variant="outline" className="h-8 px-2.5 text-xs border-emerald-300 text-emerald-800 hover:bg-emerald-100 dark:text-emerald-300 shrink-0 font-semibold">
                Read Guide
              </Button>
            }
          />
        </div>

        <div className="flex justify-between items-center mb-2">
          <span className="text-xs text-muted-foreground uppercase tracking-wide">
            Step {step + 1} of {totalSteps}
          </span>
          <span className="text-xs text-muted-foreground">{Math.round(progress)}%</span>
        </div>
        <Progress value={progress} />
        <CardTitle className="mt-3">{stepTitle}</CardTitle>
      </CardHeader>
      <CardContent>
        <motion.div
          key={step}
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.25 }}
          className="space-y-4"
        >
          {step === 0 && (
            <StepPersonal form={form} set={set} errors={errors} />
          )}
          {step === 1 && (
            <StepBusiness form={form} set={set} errors={errors} />
          )}
          {step === 2 && (
            <StepIdentity
              form={form}
              set={set}
              errors={errors}
              files={files}
              setFile={setFile}
              uploadingSlots={uploadingSlots}
            />
          )}
          {step === 3 && <StepBank form={form} set={set} errors={errors} />}
          {step === 4 && (
            <StepStore
              form={form}
              set={set}
              errors={errors}
              files={files}
              setFile={setFile}
              uploadingSlots={uploadingSlots}
            />
          )}
        </motion.div>

        <div className="flex justify-between gap-2 mt-6 pt-4 border-t">
          <Button variant="outline" onClick={back} disabled={step === 0 || submitting}>
            <ChevronLeft className="w-4 h-4 mr-1" /> Back
          </Button>
          {step < totalSteps - 1 ? (
            <Button onClick={next} disabled={submitting}>
              Next <ChevronRight className="w-4 h-4 ml-1" />
            </Button>
          ) : (
            <Button onClick={submit} disabled={submitting}>
              {submitting ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" /> Submitting...
                </>
              ) : (
                <>
                  <CheckCircle2 className="w-4 h-4 mr-2" /> Submit application
                </>
              )}
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

// ---------- Sub-components ----------

type StepProps = {
  form: Form;
  set: <K extends keyof Form>(k: K, v: Form[K]) => void;
  errors: Record<string, string>;
};

type FileStepProps = StepProps & {
  files: Partial<Record<FileSlot, File>>;
  setFile: (slot: FileSlot, f: File | null) => void;
  uploadingSlots: Record<string, boolean>;
};

function Err({ msg }: { msg?: string }) {
  return msg ? <p className="text-sm text-destructive mt-1">{msg}</p> : null;
}

function FileInput({
  slot,
  label,
  file,
  setFile,
  accept = "image/*,application/pdf",
  error,
  draftPath,
  isUploading,
}: {
  slot: FileSlot;
  label: string;
  file?: File;
  setFile: (slot: FileSlot, f: File | null) => void;
  accept?: string;
  error?: string;
  draftPath?: string;
  isUploading?: boolean;
}) {
  const hasSaved = !!draftPath;
  return (
    <div>
      <Label>{label}</Label>
      <label
        htmlFor={`file-${slot}`}
        className={`mt-1 flex flex-col items-center justify-center border-2 border-dashed rounded-lg p-4 cursor-pointer transition ${
          hasSaved && !file
            ? "border-emerald-300 bg-emerald-50/50 dark:bg-emerald-950/20 hover:bg-emerald-50"
            : "hover:bg-accent/50"
        }`}
      >
        {isUploading ? (
          <>
            <Loader2 className="w-5 h-5 text-primary animate-spin mb-1" />
            <span className="text-xs text-primary font-medium">Uploading to cloud…</span>
          </>
        ) : file ? (
          <>
            <CheckCircle2 className="w-5 h-5 text-emerald-600 mb-1" />
            <span className="text-sm text-emerald-700 text-center break-all font-medium">{file.name}</span>
            <span className="text-[10px] text-emerald-500 mt-0.5">☁️ Saved — won't be lost on refresh</span>
          </>
        ) : hasSaved ? (
          <>
            <CheckCircle2 className="w-5 h-5 text-emerald-600 mb-1" />
            <span className="text-xs text-emerald-700 font-medium">☁️ Previously uploaded & saved</span>
            <span className="text-[10px] text-muted-foreground mt-0.5">Tap to replace with a new file</span>
          </>
        ) : (
          <>
            <Upload className="w-5 h-5 text-muted-foreground mb-1" />
            <span className="text-sm text-muted-foreground text-center break-all">
              Tap to upload (max 8MB)
            </span>
          </>
        )}
        <input
          id={`file-${slot}`}
          type="file"
          accept={accept}
          className="hidden"
          onChange={(e) => setFile(slot, e.target.files?.[0] ?? null)}
        />
      </label>
      <Err msg={error} />
    </div>
  );
}

function StepPersonal({ form, set, errors }: StepProps) {
  return (
    <>
      <div>
        <Label>Full legal name</Label>
        <Input value={form.full_legal_name} onChange={(e) => set("full_legal_name", e.target.value)} />
        <Err msg={errors.full_legal_name} />
      </div>
      <div>
        <Label>Date of birth</Label>
        <Input type="date" value={form.date_of_birth} onChange={(e) => set("date_of_birth", e.target.value)} />
        <Err msg={errors.date_of_birth} />
      </div>
      <div>
        <Label>Contact email</Label>
        <Input type="email" value={form.email} onChange={(e) => set("email", e.target.value)} />
        <Err msg={errors.email} />
      </div>
      <div>
        <Label>Phone number</Label>
        <Input value={form.phone} onChange={(e) => set("phone", e.target.value)} placeholder="e.g. 024 000 0000" />
        <Err msg={errors.phone} />
      </div>
      <div>
        <Label>Residential address</Label>
        <Input value={form.address} onChange={(e) => set("address", e.target.value)} placeholder="House / street / city" />
        <Err msg={errors.address} />
      </div>
    </>
  );
}

function StepBusiness({ form, set, errors }: StepProps) {
  return (
    <>
      <div>
        <Label>Registered business name</Label>
        <Input value={form.business_name} onChange={(e) => set("business_name", e.target.value)} />
        <Err msg={errors.business_name} />
      </div>
      <div>
        <Label>Business address</Label>
        <Input value={form.business_address} onChange={(e) => set("business_address", e.target.value)} />
        <Err msg={errors.business_address} />
      </div>
    </>
  );
}

function StepIdentity({ form, set, errors, files, setFile, uploadingSlots }: FileStepProps) {
  return (
    <>
      <div>
        <Label>Government-issued ID type</Label>
        <Select value={form.id_document_type} onValueChange={(v) => set("id_document_type", v)}>
          <SelectTrigger><SelectValue placeholder="Select ID type" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="passport">Passport</SelectItem>
            <SelectItem value="national_id">National ID</SelectItem>
            <SelectItem value="drivers_license">Driver's license</SelectItem>
          </SelectContent>
        </Select>
        <Err msg={errors.id_document_type} />
      </div>
      <div>
        <Label>ID document number</Label>
        <Input value={form.id_document_number} onChange={(e) => set("id_document_number", e.target.value)} />
        <Err msg={errors.id_document_number} />
      </div>
      <div>
        <Label>Ghana Card number</Label>
        <Input
          value={form.ghana_card_number}
          onChange={(e) => set("ghana_card_number", e.target.value.toUpperCase())}
          placeholder="GHA-XXXXXXXXX-X"
        />
        <Err msg={errors.ghana_card_number} />
      </div>

      <div className="grid sm:grid-cols-2 gap-3">
        <FileInput
          slot="id_front"
          label="ID front photo"
          file={files.id_front}
          setFile={setFile}
          accept="image/*"
          error={errors.id_front}
          draftPath={form.draft_id_front_path}
          isUploading={uploadingSlots.id_front}
        />
        {form.id_document_type !== "passport" && (
          <FileInput
            slot="id_back"
            label="ID back photo"
            file={files.id_back}
            setFile={setFile}
            accept="image/*"
            error={errors.id_back}
            draftPath={form.draft_id_back_path}
            isUploading={uploadingSlots.id_back}
          />
        )}
      </div>

      <FileInput
        slot="selfie"
        label="Selfie holding your ID"
        file={files.selfie}
        setFile={setFile}
        accept="image/*"
        error={errors.selfie}
        draftPath={form.draft_selfie_path}
        isUploading={uploadingSlots.selfie}
      />

      <Err msg={errors.file_size} />
    </>
  );
}

function StepBank({ form, set, errors }: StepProps) {
  return (
    <>
      <div>
        <Label>How would you like to receive your payouts?</Label>
        <Select
          value={form.payout_method}
          onValueChange={(v) => set("payout_method", v as "bank" | "momo")}
        >
          <SelectTrigger><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="bank">Bank account</SelectItem>
            <SelectItem value="momo">Mobile Money (Ghana)</SelectItem>
          </SelectContent>
        </Select>
        <p className="text-xs text-muted-foreground mt-1">
          You can only choose one payout method. Contact support later to change it.
        </p>
      </div>

      {form.payout_method === "bank" ? (
        <>
          <div>
            <Label>Bank name</Label>
            <Input value={form.bank_name} onChange={(e) => set("bank_name", e.target.value)} />
            <Err msg={errors.bank_name} />
          </div>
          <div>
            <Label>Account holder name</Label>
            <Input value={form.account_name} onChange={(e) => set("account_name", e.target.value)} />
            <Err msg={errors.account_name} />
          </div>
          <div>
            <Label>Account number</Label>
            <Input value={form.account_number} onChange={(e) => set("account_number", e.target.value)} />
            <Err msg={errors.account_number} />
          </div>
          <div>
            <Label>Bank code (Ghana)</Label>
            <Input value={form.bank_code} onChange={(e) => set("bank_code", e.target.value)} placeholder="e.g. 070100" />
            <Err msg={errors.bank_code} />
          </div>
          <div>
            <Label>SWIFT / BIC (optional, for international transfers)</Label>
            <Input value={form.swift_bic} onChange={(e) => set("swift_bic", e.target.value)} />
          </div>
        </>
      ) : (
        <>
          <div>
            <Label>Mobile Money network</Label>
            <Select
              value={form.momo_provider}
              onValueChange={(v) => set("momo_provider", v)}
            >
              <SelectTrigger><SelectValue placeholder="Select network" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="mtn">MTN Mobile Money</SelectItem>
                <SelectItem value="vod">Telecel Cash</SelectItem>
                <SelectItem value="atl">AirtelTigo Money</SelectItem>
              </SelectContent>
            </Select>
            <Err msg={errors.momo_provider} />
          </div>
          <div>
            <Label>Mobile Money number</Label>
            <Input
              value={form.momo_number}
              onChange={(e) => set("momo_number", e.target.value)}
              placeholder="e.g. 024xxxxxxx"
              inputMode="numeric"
            />
            <Err msg={errors.momo_number} />
          </div>
          <div>
            <Label>Registered account name</Label>
            <Input
              value={form.momo_account_name}
              onChange={(e) => set("momo_account_name", e.target.value)}
              placeholder="Name as it appears on the wallet"
            />
            <Err msg={errors.momo_account_name} />
            <p className="text-xs text-muted-foreground mt-1">
              Must match the name registered with your Mobile Money wallet, or payouts will fail.
            </p>
          </div>
        </>
      )}
    </>
  );
}

function StepStore({ form, set, errors, files, setFile, uploadingSlots }: FileStepProps) {
  const [detectingGps, setDetectingGps] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    if (!form.pickup_address && (form.business_address || form.address)) {
      set("pickup_address", form.business_address || form.address);
    }
    if (!form.pickup_phone && form.phone) {
      set("pickup_phone", form.phone);
    }
  }, []);

  const handleDetectGps = () => {
    if (!navigator.geolocation) {
      toast({
        title: "GPS Not Supported",
        description: "Geolocation is not supported by your browser.",
        variant: "destructive",
      });
      return;
    }
    setDetectingGps(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        set("pickup_latitude", pos.coords.latitude);
        set("pickup_longitude", pos.coords.longitude);
        setDetectingGps(false);
        toast({
          title: "Live GPS Pickup Pin Saved! 📍",
          description: `Pinned location: ${pos.coords.latitude.toFixed(4)}°, ${pos.coords.longitude.toFixed(4)}°`,
        });
      },
      (err) => {
        setDetectingGps(false);
        toast({
          title: "GPS Permission Error",
          description: "Please allow location access in your browser to pin your pickup location.",
          variant: "destructive",
        });
      },
      { enableHighAccuracy: true }
    );
  };

  return (
    <>
      <div>
        <Label>Store name</Label>
        <Input value={form.store_name} onChange={(e) => set("store_name", e.target.value)} />
        <Err msg={errors.store_name} />
      </div>
      <div>
        <Label>Store description</Label>
        <Textarea
          value={form.store_description}
          onChange={(e) => set("store_description", e.target.value)}
          rows={3}
          maxLength={500}
          placeholder="Tell buyers what your store sells."
        />
        <Err msg={errors.store_description} />
      </div>

      {/* Delivery / Fulfillment Model Selection */}
      <div className="space-y-3 pt-2">
        <Label className="text-sm font-semibold flex items-center gap-1.5 text-primary">
          <Truck className="w-4 h-4" /> Order Delivery & Fulfillment Model
        </Label>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div
            onClick={() => set("fulfillment_model", "direct_pickup")}
            className={`p-3.5 rounded-xl border-2 cursor-pointer transition-all ${
              form.fulfillment_model === "direct_pickup"
                ? "border-primary bg-primary/5 dark:bg-primary/10 shadow-sm"
                : "border-border hover:border-muted-foreground/40 bg-card"
            }`}
          >
            <div className="flex items-center gap-2 font-medium text-sm">
              <span className="text-base">🛵</span> Direct Doorstep Pickup
            </div>
            <p className="text-xs text-muted-foreground mt-1 leading-relaxed">
              Riders pick up sold orders directly from your shop or home live GPS address. Recommended for all sellers.
            </p>
          </div>

          <div
            onClick={() => set("fulfillment_model", "hub_dropoff")}
            className={`p-3.5 rounded-xl border-2 cursor-pointer transition-all ${
              form.fulfillment_model === "hub_dropoff"
                ? "border-primary bg-primary/5 dark:bg-primary/10 shadow-sm"
                : "border-border hover:border-muted-foreground/40 bg-card"
            }`}
          >
            <div className="flex items-center gap-2 font-medium text-sm">
              <span className="text-base">🏢</span> Trades Point Hub Drop-Off
            </div>
            <p className="text-xs text-muted-foreground mt-1 leading-relaxed">
              You bring or drop off your sold items to a central Trades Point Hub within 24 hours of order placement.
            </p>
          </div>
        </div>
      </div>

      {/* Pickup Location Details (for Direct Doorstep Pickup) */}
      {form.fulfillment_model === "direct_pickup" && (
        <div className="p-4 rounded-xl border border-primary/20 bg-primary/5 space-y-3">
          <div className="flex items-center justify-between">
            <Label className="text-xs font-semibold text-primary flex items-center gap-1">
              <MapPin className="w-3.5 h-3.5" /> Seller Doorstep Pickup Address & Live GPS Pin
            </Label>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={handleDetectGps}
              disabled={detectingGps}
              className="h-7 text-xs gap-1.5 border-primary/40 text-primary hover:bg-primary/10"
            >
              {detectingGps ? <Loader2 className="w-3 h-3 animate-spin" /> : <MapPin className="w-3 h-3 text-primary" />}
              {detectingGps ? "Detecting..." : "Detect Live GPS"}
            </Button>
          </div>

          {form.pickup_latitude && form.pickup_longitude && (
            <div className="p-2 rounded-lg bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800 text-xs text-emerald-700 dark:text-emerald-300 flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-600" />
              <span>
                Live GPS Pinned: <strong>{form.pickup_latitude.toFixed(4)}° N, {form.pickup_longitude.toFixed(4)}° W</strong>
              </span>
            </div>
          )}

          <div>
            <Label className="text-xs">Pickup Street Address / Shop Name</Label>
            <Input
              value={form.pickup_address}
              onChange={(e) => set("pickup_address", e.target.value)}
              placeholder="e.g. Shop #12, Accra Central Market, or House 45, East Legon"
              className="text-xs"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <Label className="text-xs">Nearby Landmark</Label>
              <Input
                value={form.pickup_landmark}
                onChange={(e) => set("pickup_landmark", e.target.value)}
                placeholder="e.g. Opposite Shell Fuel Station"
                className="text-xs"
              />
            </div>
            <div>
              <Label className="text-xs">Pickup Contact Phone</Label>
              <Input
                value={form.pickup_phone}
                onChange={(e) => set("pickup_phone", e.target.value)}
                placeholder="e.g. 024xxxxxxx"
                className="text-xs"
              />
            </div>
          </div>

          <div>
            <div className="flex items-center justify-between mb-1">
              <Label className="text-xs">Google Maps / Live Location Link (Optional)</Label>
              {form.pickup_google_maps_url && (
                <a
                  href={form.pickup_google_maps_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-[10px] text-primary hover:underline flex items-center gap-1 font-medium"
                >
                  <ExternalLink className="w-3 h-3" /> Test Link
                </a>
              )}
            </div>
            <Input
              value={form.pickup_google_maps_url}
              onChange={(e) => {
                const val = e.target.value;
                set("pickup_google_maps_url", val);
                const match = val.match(/@(-?\d+\.\d+),(-?\d+\.\d+)/) || val.match(/q=(-?\d+\.\d+),(-?\d+\.\d+)/);
                if (match) {
                  set("pickup_latitude", parseFloat(match[1]));
                  set("pickup_longitude", parseFloat(match[2]));
                }
              }}
              placeholder="e.g. https://maps.app.goo.gl/... or paste Google Maps pin link"
              className="text-xs font-mono"
            />
            <p className="text-[10px] text-muted-foreground mt-1">
              Tip: Open Google Maps app → Tap your shop location → Tap "Share" → Copy link and paste here.
            </p>
          </div>
        </div>
      )}
      <div className="rounded-xl border border-emerald-200 bg-emerald-50/50 dark:bg-emerald-950/20 p-3.5 space-y-2 text-xs">
        <div className="flex items-start gap-2.5">
          <input
            type="checkbox"
            id="agree-seller-policy"
            checked={form.agreed_terms || false}
            onChange={(e) => set("agreed_terms", e.target.checked)}
            className="mt-0.5 h-4 w-4 rounded border-emerald-300 text-emerald-600 focus:ring-emerald-500 cursor-pointer shrink-0"
          />
          <label htmlFor="agree-seller-policy" className="text-gray-800 dark:text-gray-200 cursor-pointer">
            I have read and agree to the{" "}
            <SellerDocumentationModal
              trigger={
                <button type="button" className="text-emerald-700 dark:text-emerald-400 font-semibold underline hover:text-emerald-800 inline-flex items-center gap-1">
                  Seller Documentation, 10% Fee Policy, and Privacy Terms
                </button>
              }
            />.
          </label>
        </div>
        {errors.agreed_terms && (
          <p className="text-xs text-destructive font-medium pl-6.5">{errors.agreed_terms}</p>
        )}
      </div>

      <div className="rounded-lg border p-3 text-sm text-muted-foreground flex gap-2">
        <CheckCircle2 className="w-4 h-4 mt-0.5 shrink-0 text-primary" />
        <span>Submit to send your application for admin review. You'll be notified once approved.</span>
      </div>
    </>
  );
}
