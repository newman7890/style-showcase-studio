import { useNavigate } from "react-router-dom";
import { BottomNav } from "@/components/BottomNav";
import { motion } from "framer-motion";
import { ChevronLeft, Shield, Lock, Eye, Database, Bell, Users, Globe, FileText } from "lucide-react";

const PrivacyPolicy = () => {
  const navigate = useNavigate();

  const sections = [
    {
      icon: Database,
      title: "Information We Collect",
      content: `We collect information you provide directly to us, such as when you create an account, make a purchase, or contact us for support. This includes:
      
• Personal information (name, email, phone number)
• Payment information (processed securely through our payment partners)
• Shipping addresses
• Order history and preferences
• Device information and usage data`,
    },
    {
      icon: Eye,
      title: "How We Use Your Information",
      content: `We use the information we collect to:

• Process and fulfill your orders
• Send order confirmations and updates
• Provide customer support
• Personalize your shopping experience
• Send promotional communications (with your consent)
• Improve our products and services
• Detect and prevent fraud`,
    },
    {
      icon: Users,
      title: "Information Sharing",
      content: `We do not sell your personal information. We may share your information with:

• Service providers who assist in our operations
• Payment processors for secure transactions
• Shipping carriers to deliver your orders
• Law enforcement when required by law
• Business partners with your consent`,
    },
    {
      icon: Lock,
      title: "Data Security",
      content: `We implement industry-standard security measures to protect your personal information:

• SSL/TLS encryption for data transmission
• Secure servers with regular security audits
• Limited employee access to personal data
• Regular security training for our team
• Secure payment processing partners`,
    },
    {
      icon: Bell,
      title: "Your Choices",
      content: `You have control over your information:

• Update your account information anytime
• Opt out of promotional emails
• Request access to your personal data
• Request deletion of your account
• Manage cookie preferences
• Control notification settings`,
    },
    {
      icon: Globe,
      title: "Cookies & Tracking",
      content: `We use cookies and similar technologies to:

• Remember your preferences
• Keep you logged in
• Understand how you use our app
• Show relevant advertisements
• Improve our services

You can manage cookie preferences in your browser settings.`,
    },
    {
      icon: FileText,
      title: "Policy Updates",
      content: `We may update this privacy policy from time to time. We will notify you of any material changes by:

• Posting the new policy on this page
• Sending an email notification
• Displaying a notice in the app

Last updated: January 2026`,
    },
  ];

  return (
    <>
      <div className="min-h-screen bg-background pb-20">
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-4 bg-background sticky top-0 z-10">
          <button
            onClick={() => navigate(-1)}
            className="w-10 h-10 rounded-full border border-border flex items-center justify-center"
          >
            <ChevronLeft className="w-5 h-5" />
          </button>
          <h1 className="text-lg font-semibold">Privacy Policy</h1>
          <div className="w-10 h-10" />
        </div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="px-4"
        >
          {/* Hero Section */}
          <div className="text-center py-6">
            <div className="w-20 h-20 bg-primary/10 rounded-full flex items-center justify-center mx-auto mb-4">
              <Shield className="w-10 h-10 text-primary" />
            </div>
            <h2 className="text-xl font-semibold mb-2">Your Privacy Matters</h2>
            <p className="text-muted-foreground text-sm">
              We are committed to protecting your personal information and being transparent about how we use it.
            </p>
          </div>

          {/* Quick Summary */}
          <div className="bg-primary/5 border border-primary/20 rounded-xl p-4 mb-6">
            <h3 className="font-medium mb-2 flex items-center gap-2">
              <Lock className="w-4 h-4 text-primary" />
              Quick Summary
            </h3>
            <ul className="text-sm text-muted-foreground space-y-1">
              <li>• We never sell your personal data</li>
              <li>• Your payment info is securely encrypted</li>
              <li>• You can delete your account anytime</li>
              <li>• We only collect what's necessary</li>
            </ul>
          </div>

          {/* Policy Sections */}
          <div className="space-y-4">
            {sections.map((section, index) => (
              <motion.div
                key={section.title}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.1 }}
                className="bg-secondary/30 rounded-xl p-4"
              >
                <div className="flex items-center gap-3 mb-3">
                  <div className="w-10 h-10 bg-primary/10 rounded-full flex items-center justify-center">
                    <section.icon className="w-5 h-5 text-primary" />
                  </div>
                  <h3 className="font-medium">{section.title}</h3>
                </div>
                <p className="text-sm text-muted-foreground whitespace-pre-line leading-relaxed">
                  {section.content}
                </p>
              </motion.div>
            ))}
          </div>

          {/* Contact Section */}
          <div className="mt-6 bg-secondary/30 rounded-xl p-4">
            <h3 className="font-medium mb-2">Questions?</h3>
            <p className="text-sm text-muted-foreground mb-3">
              If you have any questions about this Privacy Policy, please contact us.
            </p>
            <button
              onClick={() => navigate("/settings/contact")}
              className="text-primary text-sm font-medium"
            >
              Contact Support →
            </button>
          </div>

          {/* Footer */}
          <div className="text-center py-6 text-sm text-muted-foreground">
            <p>© 2026 ShopApp. All rights reserved.</p>
          </div>
        </motion.div>
      </div>
      <BottomNav />
    </>
  );
};

export default PrivacyPolicy;
