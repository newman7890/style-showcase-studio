import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import {
  BookOpen,
  DollarSign,
  ShieldCheck,
  FileText,
  CheckCircle2,
  Lock,
  Percent,
  Clock,
  Building2,
  Smartphone,
  HelpCircle,
  Award,
} from "lucide-react";

interface SellerDocumentationModalProps {
  trigger?: React.ReactNode;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
}

export function SellerDocumentationModal({
  trigger,
  open: externalOpen,
  onOpenChange: externalOnOpenChange,
}: SellerDocumentationModalProps) {
  const [internalOpen, setInternalOpen] = useState(false);

  const isControlled = externalOpen !== undefined;
  const isOpen = isControlled ? externalOpen : internalOpen;
  const setIsOpen = (val: boolean) => {
    if (isControlled && externalOnOpenChange) {
      externalOnOpenChange(val);
    } else {
      setInternalOpen(val);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      {trigger && <DialogTrigger asChild>{trigger}</DialogTrigger>}
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto p-4 sm:p-6">
        <DialogHeader className="border-b pb-4">
          <div className="flex items-center gap-2">
            <Badge className="bg-emerald-600 hover:bg-emerald-700 text-white gap-1 px-2.5 py-0.5 text-xs">
              <Award className="w-3.5 h-3.5" /> Trades Point Partner
            </Badge>
          </div>
          <DialogTitle className="text-xl sm:text-2xl font-bold flex items-center gap-2 mt-2">
            <BookOpen className="w-6 h-6 text-primary shrink-0" />
            Seller Account Guide, Payouts & Policies
          </DialogTitle>
          <p className="text-xs sm:text-sm text-muted-foreground mt-1">
            Read all details about registering your store, seller payouts, our 10% platform fee, seller terms, and privacy policy before joining.
          </p>
        </DialogHeader>

        <Tabs defaultValue="payouts" className="mt-4 space-y-4">
          <TabsList className="grid grid-cols-2 sm:grid-cols-4 h-auto p-1 bg-muted rounded-xl gap-1">
            <TabsTrigger value="payouts" className="text-xs py-2 gap-1.5">
              <DollarSign className="w-3.5 h-3.5 text-emerald-600" /> Payouts & 10% Fee
            </TabsTrigger>
            <TabsTrigger value="register" className="text-xs py-2 gap-1.5">
              <HelpCircle className="w-3.5 h-3.5 text-blue-600" /> Registration Guide
            </TabsTrigger>
            <TabsTrigger value="terms" className="text-xs py-2 gap-1.5">
              <FileText className="w-3.5 h-3.5 text-amber-600" /> Seller Policy
            </TabsTrigger>
            <TabsTrigger value="privacy" className="text-xs py-2 gap-1.5">
              <ShieldCheck className="w-3.5 h-3.5 text-purple-600" /> Privacy & Security
            </TabsTrigger>
          </TabsList>

          {/* TAB 1: PAYOUTS & 10% FEE */}
          <TabsContent value="payouts" className="space-y-4">
            <div className="bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800/50 rounded-xl p-4 space-y-3">
              <div className="flex items-center gap-2">
                <Percent className="w-5 h-5 text-emerald-600 shrink-0" />
                <h3 className="font-bold text-base text-emerald-900 dark:text-emerald-300">
                  Transparent 10% Platform Commission Fee
                </h3>
              </div>
              <p className="text-xs sm:text-sm text-emerald-800 dark:text-emerald-400">
                Trades Point charges a simple <strong>10% commission fee</strong> only when you successfully sell an item. There are no registration fees, no monthly subscriptions, and no hidden charges!
              </p>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-1">
                <div className="bg-white dark:bg-card p-3 rounded-lg border text-center">
                  <span className="text-[10px] text-muted-foreground uppercase font-semibold block">Registration Fee</span>
                  <span className="text-lg font-extrabold text-emerald-600">GH₵ 0.00 (FREE)</span>
                </div>
                <div className="bg-white dark:bg-card p-3 rounded-lg border text-center">
                  <span className="text-[10px] text-muted-foreground uppercase font-semibold block">Monthly Fee</span>
                  <span className="text-lg font-extrabold text-emerald-600">GH₵ 0.00 (FREE)</span>
                </div>
                <div className="bg-white dark:bg-card p-3 rounded-lg border text-center">
                  <span className="text-[10px] text-muted-foreground uppercase font-semibold block">Seller Net Earnings</span>
                  <span className="text-lg font-extrabold text-primary">90% of Sale</span>
                </div>
              </div>
            </div>

            <div className="border rounded-xl p-4 space-y-3 bg-card">
              <h4 className="font-semibold text-sm flex items-center gap-2">
                <Clock className="w-4 h-4 text-primary" /> How & When You Get Paid
              </h4>
              <p className="text-xs text-muted-foreground">
                When a customer buys your product on Trades Point, your funds are securely processed and transferred directly into your registered payout wallet:
              </p>

              <div className="space-y-2 pt-1 text-xs">
                <div className="p-3 bg-muted/60 rounded-lg flex items-start gap-2.5">
                  <Smartphone className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                  <div>
                    <strong className="text-foreground">Mobile Money Payouts (MTN, Telecel, AirtelTigo)</strong>
                    <p className="text-muted-foreground mt-0.5">
                      Earnings are transferred directly into your MoMo account within <strong>24 hours (Next Business Day)</strong> after payment confirmation.
                    </p>
                  </div>
                </div>

                <div className="p-3 bg-muted/60 rounded-lg flex items-start gap-2.5">
                  <Building2 className="w-4 h-4 text-blue-600 shrink-0 mt-0.5" />
                  <div>
                    <strong className="text-foreground">Bank Account Direct Deposits</strong>
                    <p className="text-muted-foreground mt-0.5">
                      Bank transfers settle into your registered Ghana bank account within <strong>24–48 hours</strong>.
                    </p>
                  </div>
                </div>

                <div className="p-3 bg-muted/60 rounded-lg flex items-start gap-2.5">
                  <CheckCircle2 className="w-4 h-4 text-purple-600 shrink-0 mt-0.5" />
                  <div>
                    <strong className="text-foreground">Hub Drop-off Verification</strong>
                    <p className="text-muted-foreground mt-0.5">
                      Once you deliver sold items to any official Trades Point Hub, your earnings move to <em>"Paid Out"</em> in your seller dashboard.
                    </p>
                  </div>
                </div>
              </div>
            </div>

            {/* Example Breakdown */}
            <div className="border rounded-xl p-4 space-y-2 text-xs bg-gray-50/50">
              <h5 className="font-semibold text-gray-900 flex items-center gap-1.5">
                <DollarSign className="w-3.5 h-3.5 text-emerald-600" /> Real-World Example:
              </h5>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-1">
                <div className="p-2 bg-white rounded border">
                  <span className="text-gray-500 text-[10px] block">Customer Pays</span>
                  <span className="font-bold text-gray-900">GH₵ 100.00</span>
                </div>
                <div className="p-2 bg-white rounded border">
                  <span className="text-gray-500 text-[10px] block">Platform Fee (10%)</span>
                  <span className="font-bold text-amber-600">- GH₵ 10.00</span>
                </div>
                <div className="p-2 bg-white rounded border">
                  <span className="text-gray-500 text-[10px] block">Your Net Earnings (90%)</span>
                  <span className="font-bold text-emerald-600">GH₵ 90.00</span>
                </div>
                <div className="p-2 bg-white rounded border">
                  <span className="text-gray-500 text-[10px] block">Payout Time</span>
                  <span className="font-bold text-blue-600">Within 24 Hours</span>
                </div>
              </div>
            </div>
          </TabsContent>

          {/* TAB 2: REGISTRATION GUIDE */}
          <TabsContent value="register" className="space-y-4">
            <div className="border rounded-xl p-4 space-y-3 bg-card">
              <h4 className="font-semibold text-sm text-foreground">
                5-Step Simple Registration Process
              </h4>
              <p className="text-xs text-muted-foreground">
                Follow these 5 easy steps to register your business and get your store verified:
              </p>

              <div className="space-y-3 pt-2 text-xs">
                <div className="flex gap-3">
                  <div className="w-6 h-6 rounded-full bg-primary text-primary-foreground font-bold flex items-center justify-center shrink-0 text-xs">
                    1
                  </div>
                  <div>
                    <strong className="text-foreground">Personal Information</strong>
                    <p className="text-muted-foreground mt-0.5">
                      Provide your legal name, date of birth, contact email, phone number, and residential address.
                    </p>
                  </div>
                </div>

                <div className="flex gap-3">
                  <div className="w-6 h-6 rounded-full bg-primary text-primary-foreground font-bold flex items-center justify-center shrink-0 text-xs">
                    2
                  </div>
                  <div>
                    <strong className="text-foreground">Business Details</strong>
                    <p className="text-muted-foreground mt-0.5">
                      Enter your store's registered business name and physical shop or warehouse address.
                    </p>
                  </div>
                </div>

                <div className="flex gap-3">
                  <div className="w-6 h-6 rounded-full bg-primary text-primary-foreground font-bold flex items-center justify-center shrink-0 text-xs">
                    3
                  </div>
                  <div>
                    <strong className="text-foreground">Ghana Card Identity Verification</strong>
                    <p className="text-muted-foreground mt-0.5">
                      Enter your Ghana Card number and upload clear photos of your Ghana Card ID (front, back) and a selfie.
                    </p>
                  </div>
                </div>

                <div className="flex gap-3">
                  <div className="w-6 h-6 rounded-full bg-primary text-primary-foreground font-bold flex items-center justify-center shrink-0 text-xs">
                    4
                  </div>
                  <div>
                    <strong className="text-foreground">Payout Account Setup</strong>
                    <p className="text-muted-foreground mt-0.5">
                      Provide your Mobile Money number (MTN, Telecel, AirtelTigo) or Bank account details where you want your payouts sent.
                    </p>
                  </div>
                </div>

                <div className="flex gap-3">
                  <div className="w-6 h-6 rounded-full bg-primary text-primary-foreground font-bold flex items-center justify-center shrink-0 text-xs">
                    5
                  </div>
                  <div>
                    <strong className="text-foreground">Store Setup & Submission</strong>
                    <p className="text-muted-foreground mt-0.5">
                      Add your store name, description, and bio, then submit. Admin verification usually takes under 24 hours!
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </TabsContent>

          {/* TAB 3: SELLER POLICY */}
          <TabsContent value="terms" className="space-y-4">
            <div className="border rounded-xl p-4 space-y-3 bg-card text-xs">
              <h4 className="font-semibold text-sm text-foreground flex items-center gap-2">
                <FileText className="w-4 h-4 text-amber-600" /> Trades Point Seller Operating Policy
              </h4>

              <div className="space-y-2.5 text-muted-foreground">
                <div className="p-3 bg-amber-50/50 border border-amber-200 rounded-lg text-amber-900">
                  <strong>1. Product Authenticity & Quality</strong>
                  <p className="mt-1">
                    All products listed must be 100% genuine and accurately described. Selling counterfeit, illegal, expired, or dangerous items is strictly prohibited and results in permanent account termination.
                  </p>
                </div>

                <div className="p-3 bg-gray-50 border rounded-lg text-gray-800">
                  <strong>2. Order Dispatch & Fulfillment</strong>
                  <p className="mt-1">
                    Once a customer places an order, sellers must deliver the item to an official Trades Point Fulfillment Hub within <strong>24 to 48 hours</strong> to ensure prompt delivery.
                  </p>
                </div>

                <div className="p-3 bg-gray-50 border rounded-lg text-gray-800">
                  <strong>3. Accurate Pricing & Stock Management</strong>
                  <p className="mt-1">
                    Sellers are responsible for maintaining accurate product prices (GH₵) and real-time inventory counts to avoid stockouts.
                  </p>
                </div>

                <div className="p-3 bg-gray-50 border rounded-lg text-gray-800">
                  <strong>4. Customer Returns & Guarantee</strong>
                  <p className="mt-1">
                    If an item is damaged, defective, or incorrect upon customer receipt, Trades Point will review the claim. Defective items will be returned to the seller.
                  </p>
                </div>
              </div>
            </div>
          </TabsContent>

          {/* TAB 4: PRIVACY & SECURITY */}
          <TabsContent value="privacy" className="space-y-4">
            <div className="border rounded-xl p-4 space-y-3 bg-card text-xs">
              <h4 className="font-semibold text-sm text-foreground flex items-center gap-2">
                <ShieldCheck className="w-4 h-4 text-purple-600" /> Seller Privacy & Data Protection Policy
              </h4>

              <div className="space-y-2 text-muted-foreground">
                <div className="flex items-start gap-2.5 p-3 bg-purple-50/50 border border-purple-200 rounded-lg text-purple-900">
                  <Lock className="w-4 h-4 text-purple-600 shrink-0 mt-0.5" />
                  <div>
                    <strong>Encrypted Identity Storage</strong>
                    <p className="mt-0.5">
                      Your Ghana Card ID documents and verification selfies are encrypted and securely stored. They are accessed strictly by authorized verification administrators.
                    </p>
                  </div>
                </div>

                <div className="flex items-start gap-2.5 p-3 bg-gray-50 border rounded-lg text-gray-800">
                  <ShieldCheck className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                  <div>
                    <strong>Financial Credentials Protection</strong>
                    <p className="mt-0.5">
                      Your Mobile Money numbers and Bank account details are exclusively used by Paystack to disburse your payouts securely.
                    </p>
                  </div>
                </div>

                <div className="flex items-start gap-2.5 p-3 bg-gray-50 border rounded-lg text-gray-800">
                  <CheckCircle2 className="w-4 h-4 text-blue-600 shrink-0 mt-0.5" />
                  <div>
                    <strong>No Third-Party Sharing</strong>
                    <p className="mt-0.5">
                      Trades Point never sells, rents, or shares your business contact details with third-party marketers.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </TabsContent>
        </Tabs>

        <div className="border-t pt-4 mt-2 flex justify-end">
          <Button onClick={() => setIsOpen(false)} className="px-6 text-xs sm:text-sm">
            I Understand & Agree
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
