import { useNavigate } from "react-router-dom";
import { BottomNav } from "@/components/BottomNav";
import { motion } from "framer-motion";
import { ChevronLeft, Check, Search, Loader2 } from "lucide-react";
import { useState } from "react";
import { Input } from "@/components/ui/input";
import { useLanguage, SupportedLanguage } from "@/contexts/LanguageContext";
import { toast } from "sonner";

const languages = [
  { code: "en", name: "English", native: "English" },
  { code: "es", name: "Spanish", native: "Español" },
  { code: "fr", name: "French", native: "Français" },
  { code: "de", name: "German", native: "Deutsch" },
  { code: "zh", name: "Chinese (Simplified)", native: "中文" },
  { code: "tw", name: "Chinese (Traditional)", native: "繁體中文" },
  { code: "ar", name: "Arabic", native: "العربية" },
];

const Language = () => {
  const navigate = useNavigate();
  const { language, setLanguage, t } = useLanguage();
  const [searchQuery, setSearchQuery] = useState("");
  const [saving, setSaving] = useState(false);

  const filteredLanguages = languages.filter(
    (lang) =>
      lang.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      lang.native.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const handleLanguageSelect = async (code: string) => {
    setSaving(true);
    try {
      await setLanguage(code as SupportedLanguage);
      const langName = languages.find((l) => l.code === code)?.name || code;
      toast.success(t("languageChanged") + " " + langName);
    } catch (error) {
      console.error("Error saving language preference:", error);
      toast.error(t("failedSaveLanguage") || "Failed to save language preference");
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      <div className="min-h-screen bg-background pb-20">
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-4 bg-background">
          <button
            onClick={() => navigate(-1)}
            className="w-10 h-10 rounded-full border border-border flex items-center justify-center"
          >
            <ChevronLeft className="w-5 h-5" />
          </button>
          <h1 className="text-lg font-semibold">{t("language")}</h1>
          <div className="w-10 h-10 flex items-center justify-center">
            {saving && <Loader2 className="w-5 h-5 animate-spin text-primary" />}
          </div>
        </div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="px-4"
        >
          {/* Search */}
          <div className="relative mb-4">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-muted-foreground" />
            <Input
              placeholder={t("searchLanguage") || "Search language..."}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10"
            />
          </div>

          <div className="space-y-1">
            {filteredLanguages.map((lang, index) => (
              <motion.button
                key={lang.code}
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: index * 0.02 }}
                onClick={() => handleLanguageSelect(lang.code)}
                disabled={saving}
                className="w-full flex items-center justify-between py-4 hover:bg-secondary/50 rounded-lg px-3 transition-colors disabled:opacity-50"
              >
                <div className="flex flex-col items-start">
                  <span className="text-foreground font-medium">{lang.name}</span>
                  <span className="text-sm text-muted-foreground">{lang.native}</span>
                </div>
                {language === lang.code && (
                  <Check className="w-5 h-5 text-primary" />
                )}
              </motion.button>
            ))}
          </div>
        </motion.div>
      </div>
      <BottomNav />
    </>
  );
};

export default Language;