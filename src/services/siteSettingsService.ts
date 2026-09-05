import { supabase } from "@/integrations/supabase/client";

// ─── Interfaces ────────────────────────────────────────────────────────────────

export interface LinkedFlashDeal {
  productId: string;
  productName: string;
  productImage: string;
  originalPrice: number;
  flashPrice: number;
  discountPercent: number;
  claimedPercent: number;
  sellerName: string;
  category?: string;
  department?: string | null;
}

export interface FlashDealSettings {
  enabled: boolean;
  title: string;
  subtitle: string;
  endsAt: string; // ISO string
  deals: LinkedFlashDeal[];
}

export interface SpotlightSettings {
  enabled: boolean;
  title: string;
  subtitle: string;
  speed: number; // 1 = slow, 2 = normal, 3 = fast
  pinnedProductIds: string[];
}

// ─── Default Configurations ───────────────────────────────────────────────────

export const getDefaultFlashEndTime = () => {
  const d = new Date();
  d.setHours(d.getHours() + 8);
  d.setMinutes(0);
  d.setSeconds(0);
  return d.toISOString();
};

export const DEFAULT_FLASH_DEALS_SETTINGS: FlashDealSettings = {
  enabled: true,
  title: "Lightning Flash Deals",
  subtitle: "Limited quantities at special discount prices",
  endsAt: getDefaultEndTime(),
  deals: [],
};

export const DEFAULT_SPOTLIGHT_SETTINGS: SpotlightSettings = {
  enabled: true,
  title: "Live Marketplace Spotlight",
  subtitle: "Continuous moving showcase of trending products & hot drops",
  speed: 2,
  pinnedProductIds: [],
};

const FLASH_DEALS_KEY = "flash_deals";
const SPOTLIGHT_KEY = "spotlight";
const LOCAL_STORAGE_FLASH_PREFIX = "admin_flash_deals_settings";
const LOCAL_STORAGE_SPOTLIGHT_PREFIX = "admin_spotlight_settings";

// ─── Local Storage Fallbacks (Synchronous) ────────────────────────────────────

export const getFlashDealSettingsFromStorage = (): FlashDealSettings => {
  try {
    const raw = localStorage.getItem(LOCAL_STORAGE_FLASH_PREFIX);
    if (raw) {
      const parsed = JSON.parse(raw);
      return { ...DEFAULT_FLASH_DEALS_SETTINGS, ...parsed };
    }
  } catch {
    // fallback
  }
  return { ...DEFAULT_FLASH_DEALS_SETTINGS };
};

export const getSpotlightSettingsFromStorage = (): SpotlightSettings => {
  try {
    const raw = localStorage.getItem(LOCAL_STORAGE_SPOTLIGHT_PREFIX);
    if (raw) {
      const parsed = JSON.parse(raw);
      return { ...DEFAULT_SPOTLIGHT_SETTINGS, ...parsed };
    }
  } catch {
    // fallback
  }
  return { ...DEFAULT_SPOTLIGHT_SETTINGS };
};

// ─── Supabase Database Operations ─────────────────────────────────────────────

export const fetchSiteSetting = async <T>(key: string, fallback: T): Promise<{ data: T; isTableMissing: boolean }> => {
  try {
    const { data, error } = await (supabase as any)
      .from("site_settings")
      .select("value")
      .eq("key", key)
      .maybeSingle();

    if (error) {
      const isMissing =
        error.message?.includes("site_settings") ||
        error.code === "PGRST204" ||
        error.code === "42P01" ||
        error.message?.includes("relation \"public.site_settings\" does not exist");
      return { data: fallback, isTableMissing: isMissing };
    }

    if (data && data.value) {
      // Cache in localStorage for offline / quick initial render
      if (key === FLASH_DEALS_KEY) {
        try {
          localStorage.setItem(LOCAL_STORAGE_FLASH_PREFIX, JSON.stringify(data.value));
        } catch {}
      } else if (key === SPOTLIGHT_KEY) {
        try {
          localStorage.setItem(LOCAL_STORAGE_SPOTLIGHT_PREFIX, JSON.stringify(data.value));
        } catch {}
      }
      return { data: data.value as T, isTableMissing: false };
    }

    return { data: fallback, isTableMissing: false };
  } catch {
    return { data: fallback, isTableMissing: false };
  }
};

export const saveSiteSetting = async <T>(
  key: string,
  value: T
): Promise<{ error: any | null; isTableMissing: boolean }> => {
  // 1. Immediately cache locally & notify local window
  if (key === FLASH_DEALS_KEY) {
    try {
      localStorage.setItem(LOCAL_STORAGE_FLASH_PREFIX, JSON.stringify(value));
    } catch {}
    window.dispatchEvent(new Event("flash-deals-settings-changed"));
  } else if (key === SPOTLIGHT_KEY) {
    try {
      localStorage.setItem(LOCAL_STORAGE_SPOTLIGHT_PREFIX, JSON.stringify(value));
    } catch {}
    window.dispatchEvent(new Event("spotlight-settings-changed"));
  }

  // 2. Persist to Supabase Database
  try {
    const { error } = await (supabase as any).from("site_settings").upsert(
      {
        key,
        value,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "key" }
    );

    if (error) {
      console.warn(`[siteSettingsService] Supabase save error for key "${key}":`, error);
      const isMissing =
        error.message?.includes("site_settings") ||
        error.code === "PGRST204" ||
        error.code === "42P01" ||
        error.message?.includes("relation \"public.site_settings\" does not exist");
      return { error, isTableMissing: isMissing };
    }

    return { error: null, isTableMissing: false };
  } catch (err: any) {
    console.error(`[siteSettingsService] Unexpected error saving key "${key}":`, err);
    return { error: err, isTableMissing: false };
  }
};

// ─── Specialized Functions ─────────────────────────────────────────────────────

export const fetchFlashDealSettings = async (): Promise<{ settings: FlashDealSettings; isTableMissing: boolean }> => {
  const fallback = getFlashDealSettingsFromStorage();
  const { data, isTableMissing } = await fetchSiteSetting<FlashDealSettings>(FLASH_DEALS_KEY, fallback);
  return {
    settings: {
      ...DEFAULT_FLASH_DEALS_SETTINGS,
      ...data,
      deals: Array.isArray(data?.deals) ? data.deals : [],
    },
    isTableMissing,
  };
};

export const saveFlashDealSettings = async (
  settings: FlashDealSettings
): Promise<{ error: any | null; isTableMissing: boolean }> => {
  return await saveSiteSetting(FLASH_DEALS_KEY, settings);
};

export const fetchSpotlightSettings = async (): Promise<{ settings: SpotlightSettings; isTableMissing: boolean }> => {
  const fallback = getSpotlightSettingsFromStorage();
  const { data, isTableMissing } = await fetchSiteSetting<SpotlightSettings>(SPOTLIGHT_KEY, fallback);
  return {
    settings: {
      ...DEFAULT_SPOTLIGHT_SETTINGS,
      ...data,
      pinnedProductIds: Array.isArray(data?.pinnedProductIds) ? data.pinnedProductIds : [],
    },
    isTableMissing,
  };
};

export const saveSpotlightSettings = async (
  settings: SpotlightSettings
): Promise<{ error: any | null; isTableMissing: boolean }> => {
  return await saveSiteSetting(SPOTLIGHT_KEY, settings);
};
