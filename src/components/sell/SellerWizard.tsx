import { useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import { z } from "zod";
import { ChevronLeft, ChevronRight, Loader2, Upload, CheckCircle2 } from "lucide-react";
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
  // Step 5 - Store
  store_name: string;
  store_description: string;
  return_address: string;
  bio: string;
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
  store_name: "",
  store_description: "",
  return_address: "",
  bio: "",
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
    business_type: z.enum(["sole_proprietor", "llc", "corporation", "partnership", "other"], {
      errorMap: () => ({ message: "Select a business type" }),
    }),
    business_name: z.string().trim().min(2, "Required").max(120),
    business_registration_number: z.string().trim().min(2, "Required").max(60),
    business_address: z.string().trim().min(4, "Required").max(300),
    tax_id: z.string().trim().min(3, "Required").max(60),
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
      { errorMap: () => ({ message: "Select a document type" }) },
    ),
    proof_of_address_issued_on: z.string().min(1, "Required"),
    tax_form_type: z.enum(["w9", "w8ben", "other", "none"]),
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
    store_name: z.string().trim().min(2, "Required").max(120),
    store_description: z.string().trim().min(10, "At least 10 chars").max(500),
    return_address: z.string().trim().min(4, "Required").max(300),
    bio: z.string().trim().max(500).optional().or(z.literal("")),
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

  const validateStep = () => {
    const schema = stepSchemas[step];
    const parsed = schema.safeParse(form);
    if (parsed.success) {
      // Extra file requirements
      if (step === 2) {
        const errs: Record<string, string> = {};
        if (!files.id_front) errs.id_front = "Upload the front of your ID";
        if (form.id_document_type !== "passport" && !files.id_back)
          errs.id_back = "Upload the back of your ID";
        if (!files.selfie) errs.selfie = "Upload a clear selfie";
        if (!files.proof_of_address) errs.proof_of_address = "Upload a proof of address";
        if (form.tax_form_type !== "none" && !files.tax_form)
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

  const uploadPrivate = async (file: File, name: string) => {
    const ext = file.name.split(".").pop() || "bin";
    const path = `${user!.id}/${name}-${Date.now()}.${ext}`;
    const { error } = await supabase.storage
      .from("seller-verification")
      .upload(path, file, { upsert: true, contentType: file.type });
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

  const submit = async () => {
    if (!validateStep()) return;
    if (!user) return;

    // Re-check identity uploads — files aren't persisted in the localStorage
    // draft, so a page refresh can leave the form on step 4/5 with no files.
    // Without this check the application would be submitted with null image URLs.
    const missing: Record<string, string> = {};
    if (!files.id_front) missing.id_front = "Upload the front of your ID";
    if (form.id_document_type !== "passport" && !files.id_back)
      missing.id_back = "Upload the back of your ID";
    if (!files.selfie) missing.selfie = "Upload a clear selfie";
    if (!files.proof_of_address)
      missing.proof_of_address = "Upload a proof of address";
    if (form.tax_form_type !== "none" && !files.tax_form)
      missing.tax_form = "Upload the selected tax form";
    if (Object.keys(missing).length) {
      setErrors(missing);
      setStep(2);
      toast({
        title: "Please re-upload your documents",
        description:
          "Your uploaded files were cleared (likely by a page refresh). Please re-attach them before submitting.",
        variant: "destructive",
      });
      return;
    }

    setSubmitting(true);
    try {
      const idFront = files.id_front ? await uploadPrivate(files.id_front, "id-front") : null;
      const idBack = files.id_back ? await uploadPrivate(files.id_back, "id-back") : null;
      const selfie = files.selfie ? await uploadPrivate(files.selfie, "selfie") : null;
      const poa = files.proof_of_address
        ? await uploadPrivate(files.proof_of_address, "proof-of-address")
        : null;
      const taxForm =
        files.tax_form && form.tax_form_type !== "none"
          ? await uploadPrivate(files.tax_form, "tax-form")
          : null;
      const storeLogo = files.store_logo ? await uploadPublicLogo(files.store_logo) : null;

      const { error } = await supabase.from("seller_profiles").insert({
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
        date_of_birth: form.date_of_birth,
        business_type: form.business_type,
        business_registration_number: form.business_registration_number,
        business_address: form.business_address,
        tax_id: form.tax_id,
        vat_number: form.vat_number || null,
        id_document_type: form.id_document_type,
        id_document_number: form.id_document_number,
        id_document_front_url: idFront,
        id_document_back_url: idBack,
        selfie_url: selfie,
        proof_of_address_url: poa,
        proof_of_address_type: form.proof_of_address_type,
        proof_of_address_issued_on: form.proof_of_address_issued_on,
        tax_form_type: form.tax_form_type,
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
        return_address: form.return_address,
      } as any);
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
              setFile={(slot, f) => setFiles((prev) => ({ ...prev, [slot]: f }))}
            />
          )}
          {step === 3 && <StepBank form={form} set={set} errors={errors} />}
          {step === 4 && (
            <StepStore
              form={form}
              set={set}
              errors={errors}
              files={files}
              setFile={(slot, f) => setFiles((prev) => ({ ...prev, [slot]: f }))}
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
}: {
  slot: FileSlot;
  label: string;
  file?: File;
  setFile: (slot: FileSlot, f: File | null) => void;
  accept?: string;
  error?: string;
}) {
  return (
    <div>
      <Label>{label}</Label>
      <label
        htmlFor={`file-${slot}`}
        className="mt-1 flex flex-col items-center justify-center border-2 border-dashed rounded-lg p-4 cursor-pointer hover:bg-accent/50 transition"
      >
        <Upload className="w-5 h-5 text-muted-foreground mb-1" />
        <span className="text-sm text-muted-foreground text-center break-all">
          {file ? file.name : "Tap to upload (max 8MB)"}
        </span>
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
        <Label>Business type</Label>
        <Select value={form.business_type} onValueChange={(v) => set("business_type", v)}>
          <SelectTrigger><SelectValue placeholder="Select business type" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="sole_proprietor">Sole proprietor</SelectItem>
            <SelectItem value="llc">LLC</SelectItem>
            <SelectItem value="corporation">Corporation</SelectItem>
            <SelectItem value="partnership">Partnership</SelectItem>
            <SelectItem value="other">Other</SelectItem>
          </SelectContent>
        </Select>
        <Err msg={errors.business_type} />
      </div>
      <div>
        <Label>Registered business name</Label>
        <Input value={form.business_name} onChange={(e) => set("business_name", e.target.value)} />
        <Err msg={errors.business_name} />
      </div>
      <div>
        <Label>Business registration number</Label>
        <Input value={form.business_registration_number} onChange={(e) => set("business_registration_number", e.target.value)} />
        <Err msg={errors.business_registration_number} />
      </div>
      <div>
        <Label>Business address</Label>
        <Input value={form.business_address} onChange={(e) => set("business_address", e.target.value)} />
        <Err msg={errors.business_address} />
      </div>
      <div>
        <Label>Tax identification number (TIN)</Label>
        <Input value={form.tax_id} onChange={(e) => set("tax_id", e.target.value)} />
        <Err msg={errors.tax_id} />
      </div>
      <div>
        <Label>VAT number (optional)</Label>
        <Input value={form.vat_number} onChange={(e) => set("vat_number", e.target.value)} />
      </div>
    </>
  );
}

function StepIdentity({ form, set, errors, files, setFile }: FileStepProps) {
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
        />
        {form.id_document_type !== "passport" && (
          <FileInput
            slot="id_back"
            label="ID back photo"
            file={files.id_back}
            setFile={setFile}
            accept="image/*"
            error={errors.id_back}
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
      />

      <div className="rounded-md border p-3 space-y-3">
        <div className="text-xs font-medium text-muted-foreground uppercase">Proof of address</div>
        <div>
          <Label>Document type</Label>
          <Select
            value={form.proof_of_address_type}
            onValueChange={(v) => set("proof_of_address_type", v)}
          >
            <SelectTrigger><SelectValue placeholder="Select document type" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="bank_statement">Bank statement</SelectItem>
              <SelectItem value="utility_bill">Utility bill</SelectItem>
              <SelectItem value="credit_card_statement">Credit card statement</SelectItem>
              <SelectItem value="government_document">Government document</SelectItem>
            </SelectContent>
          </Select>
          <Err msg={errors.proof_of_address_type} />
        </div>
        <div>
          <Label>Issue date (must be within last 90 days)</Label>
          <Input
            type="date"
            value={form.proof_of_address_issued_on}
            onChange={(e) => set("proof_of_address_issued_on", e.target.value)}
          />
          <Err msg={errors.proof_of_address_issued_on} />
        </div>
        <FileInput
          slot="proof_of_address"
          label="Upload document"
          file={files.proof_of_address}
          setFile={setFile}
          error={errors.proof_of_address}
        />
      </div>

      <div className="rounded-md border p-3 space-y-3">
        <div className="text-xs font-medium text-muted-foreground uppercase">Tax form</div>
        <div>
          <Label>Form type</Label>
          <Select value={form.tax_form_type} onValueChange={(v) => set("tax_form_type", v)}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="none">Not applicable</SelectItem>
              <SelectItem value="w9">W-9 (US persons)</SelectItem>
              <SelectItem value="w8ben">W-8BEN (non-US persons)</SelectItem>
              <SelectItem value="other">Other</SelectItem>
            </SelectContent>
          </Select>
        </div>
        {form.tax_form_type !== "none" && (
          <FileInput
            slot="tax_form"
            label="Upload tax form"
            file={files.tax_form}
            setFile={setFile}
            error={errors.tax_form}
          />
        )}
      </div>

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

function StepStore({ form, set, errors, files, setFile }: FileStepProps) {
  return (
    <>
      <div>
        <Label>Store name</Label>
        <Input value={form.store_name} onChange={(e) => set("store_name", e.target.value)} />
        <Err msg={errors.store_name} />
      </div>
      <FileInput
        slot="store_logo"
        label="Store logo (optional)"
        file={files.store_logo}
        setFile={setFile}
        accept="image/*"
      />
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
      <div>
        <Label>Return address</Label>
        <Input value={form.return_address} onChange={(e) => set("return_address", e.target.value)} placeholder="Where buyers should return items" />
        <Err msg={errors.return_address} />
      </div>
      <div>
        <Label>Short bio (optional, shown on your profile)</Label>
        <Textarea value={form.bio} onChange={(e) => set("bio", e.target.value)} rows={2} maxLength={500} />
      </div>
      <div className="rounded-lg border p-3 text-sm text-muted-foreground flex gap-2">
        <CheckCircle2 className="w-4 h-4 mt-0.5 shrink-0 text-primary" />
        <span>Submit to send your application for admin review. You'll be notified once approved.</span>
      </div>
    </>
  );
}
