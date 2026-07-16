import { useNavigate } from "react-router-dom";
import { BottomNav } from "@/components/BottomNav";
import { motion } from "framer-motion";
import { useLanguage } from "@/contexts/LanguageContext";
import { 
  ChevronRight, 
  ChevronLeft,
  Globe,
  User,
  Mail,
  Lock,
  Shield
} from "lucide-react";

const languages = [
  { code: "en", name: "English" },
  { code: "es", name: "Español" },
  { code: "fr", name: "Français" },
  { code: "de", name: "Deutsch" },
  { code: "zh", name: "中文" },
  { code: "tw", name: "繁體中文" },
  { code: "ar", name: "العربية" },
];

const Settings = () => {
  const navigate = useNavigate();
  const { t, language } = useLanguage();
  
  const currentLanguageName = languages.find(l => l.code === language)?.name || language;

  const generalItems = [
    { icon: Globe, label: t("language"), value: currentLanguageName, path: "/settings/language" },
    { icon: User, label: t("myProfile"), path: "/profile" },
    { icon: Mail, label: t("contactUs"), path: "/settings/contact" },
  ];

  const securityItems = [
    { icon: Lock, label: t("changePassword"), path: "/settings/password" },
    { icon: Shield, label: t("privacyPolicy"), path: "/settings/privacy" },
  ];

  return (
    <>
      <div className="min-h-screen bg-background pb-20">
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-4 bg-background max-w-2xl mx-auto">
          <button 
            onClick={() => navigate(-1)}
            className="w-10 h-10 rounded-full border border-border flex items-center justify-center"
          >
            <ChevronLeft className="w-5 h-5" />
          </button>
          <h1 className="text-lg font-semibold">{t("settings")}</h1>
          <div className="w-10 h-10" />
        </div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="px-4 max-w-2xl mx-auto"
        >
          {/* General Section */}
          <div className="mt-4">
            <h3 className="text-sm text-muted-foreground mb-2">{t("general")}</h3>
            <div className="space-y-1">
              {generalItems.map((item, index) => (
                <motion.button
                  key={item.path}
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: index * 0.05 }}
                  onClick={() => navigate(item.path)}
                  className="w-full flex items-center justify-between py-4 hover:bg-secondary/50 rounded-lg px-2 transition-colors"
                >
                  <div className="flex items-center gap-3 text-foreground">
                    <item.icon className="w-5 h-5 text-muted-foreground" />
                    <span>{item.label}</span>
                  </div>
                  <div className="flex items-center gap-2 text-muted-foreground">
                    {item.value && <span className="text-sm">{item.value}</span>}
                    <ChevronRight className="w-5 h-5" />
                  </div>
                </motion.button>
              ))}
            </div>
          </div>

          {/* Security Section */}
          <div className="mt-8">
            <h3 className="text-sm text-muted-foreground mb-2">{t("security")}</h3>
            <div className="space-y-1">
              {securityItems.map((item, index) => (
                <motion.button
                  key={item.path}
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: (index + generalItems.length) * 0.05 }}
                  onClick={() => navigate(item.path)}
                  className="w-full flex items-center justify-between py-4 hover:bg-secondary/50 rounded-lg px-2 transition-colors"
                >
                  <div className="flex items-center gap-3 text-foreground">
                    <item.icon className="w-5 h-5 text-muted-foreground" />
                    <span>{item.label}</span>
                  </div>
                  <ChevronRight className="w-5 h-5 text-muted-foreground" />
                </motion.button>
              ))}
            </div>
          </div>

        </motion.div>
      </div>
      <BottomNav />
    </>
  );
};

export default Settings;
