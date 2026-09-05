import React, { useState, useEffect, useMemo, useRef } from "react";
import { Check, ChevronsUpDown, Plus, Search, Sparkles, Tag, Layers } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { PRESET_CATEGORIES_BY_DEPARTMENT, CategoryItem } from "@/constants/categories";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";

export interface CategoryOption {
  value: string;
  label: string;
  department?: string;
  isDb?: boolean;
  isCustom?: boolean;
}

interface CategoryComboboxProps {
  department?: string;
  value: string;
  onChange: (value: string, department?: string) => void;
  error?: string;
  placeholder?: string;
  disabled?: boolean;
  className?: string;
  allowCustom?: boolean;
}

const DEPT_LABELS: Record<string, string> = {
  fashion: "Fashion 👗",
  gadgets: "Gadgets 📱",
  art: "Art 🎨",
  home: "Home 🏠",
  other: "Other 📦",
};

export const CategoryCombobox: React.FC<CategoryComboboxProps> = ({
  department = "fashion",
  value,
  onChange,
  error,
  placeholder = "Select or type category...",
  disabled = false,
  className,
  allowCustom = true,
}) => {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [selectedDeptTab, setSelectedDeptTab] = useState<string>("current");
  const [isCustomMode, setIsCustomMode] = useState(false);
  const [customInput, setCustomInput] = useState("");
  const [dbCategories, setDbCategories] = useState<CategoryOption[]>([]);
  const [sessionCustomCategories, setSessionCustomCategories] = useState<string[]>(() => {
    try {
      const stored = sessionStorage.getItem("seller_custom_categories");
      return stored ? JSON.parse(stored) : [];
    } catch {
      return [];
    }
  });
  const searchInputRef = useRef<HTMLInputElement>(null);

  // Fetch categories from Database and Local Storage Cache
  const fetchAllCategories = async () => {
    const combined: CategoryOption[] = [];
    const seen = new Set<string>();

    // 1. Load from localStorage cache (for instant offline & admin tab sync)
    try {
      const localCached = localStorage.getItem("local_custom_categories");
      if (localCached) {
        const parsed = JSON.parse(localCached);
        if (Array.isArray(parsed)) {
          parsed.forEach((cat: any) => {
            const key = (cat.name || "").toLowerCase().trim();
            if (key && !seen.has(key)) {
              seen.add(key);
              combined.push({
                value: cat.name,
                label: cat.name,
                department: cat.department ? cat.department.toLowerCase() : undefined,
                isDb: true,
              });
            }
          });
        }
      }
    } catch {
      // ignore
    }

    // 2. Load from Supabase Database
    try {
      const { data, error: catErr } = await supabase
        .from("categories")
        .select("id, name, slug, department, is_active")
        .eq("is_active", true)
        .order("display_order", { ascending: true });

      if (!catErr && data) {
        data.forEach((c) => {
          const key = (c.name || "").toLowerCase().trim();
          if (key && !seen.has(key)) {
            seen.add(key);
            combined.push({
              value: c.name,
              label: c.name,
              department: c.department ? c.department.toLowerCase() : undefined,
              isDb: true,
            });
          }
        });
      }
    } catch (err) {
      console.warn("Could not fetch categories from database:", err);
    }

    setDbCategories(combined);
  };

  useEffect(() => {
    fetchAllCategories();

    // 1. Subscribe to Supabase realtime table changes
    const channel = supabase
      .channel("public:categories_sync_combobox")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "categories" },
        () => {
          fetchAllCategories();
        }
      )
      .subscribe();

    // 2. Listen to custom window events triggered when admin saves a category
    const handleCustomEvent = () => fetchAllCategories();
    window.addEventListener("categories_updated", handleCustomEvent);
    window.addEventListener("storage", handleCustomEvent);

    return () => {
      supabase.removeChannel(channel);
      window.removeEventListener("categories_updated", handleCustomEvent);
      window.removeEventListener("storage", handleCustomEvent);
    };
  }, []);

  // When opening popover, focus search
  useEffect(() => {
    if (open) {
      setTimeout(() => {
        searchInputRef.current?.focus();
      }, 50);
    } else {
      setSearch("");
      setIsCustomMode(false);
      setSelectedDeptTab("current");
    }
  }, [open]);

  // Aggregate ALL categories across all departments (Presets + DB + Session Custom)
  const allKnownCategories = useMemo(() => {
    const list: CategoryOption[] = [];
    const seen = new Set<string>();

    // 1. Add DB / Admin created categories
    dbCategories.forEach((cat) => {
      const norm = cat.value.toLowerCase().trim();
      if (norm && !seen.has(norm)) {
        seen.add(norm);
        list.push(cat);
      }
    });

    // 2. Add Presets across all departments
    Object.entries(PRESET_CATEGORIES_BY_DEPARTMENT).forEach(([deptKey, items]) => {
      items.forEach((p: CategoryItem) => {
        const norm = p.name.toLowerCase().trim();
        if (norm && !seen.has(norm)) {
          seen.add(norm);
          list.push({
            value: p.name,
            label: p.name,
            department: deptKey.toLowerCase(),
            isDb: false,
          });
        }
      });
    });

    // 3. Add Session Custom Categories typed by user in current department
    sessionCustomCategories.forEach((customName) => {
      const norm = customName.toLowerCase().trim();
      if (norm && !seen.has(norm)) {
        seen.add(norm);
        list.push({
          value: customName,
          label: customName,
          department: (department || "fashion").toLowerCase(),
          isCustom: true,
        });
      }
    });

    return list;
  }, [dbCategories, sessionCustomCategories, department]);

  // Categorize matches into Current Department vs Other Departments when searching
  const { currentDeptMatches, otherDeptMatches, hasMatches } = useMemo(() => {
    const q = search.toLowerCase().trim();
    const currentDeptKey = (department || "fashion").toLowerCase();

    let targetPool = allKnownCategories;

    // If tab filter is applied and not searching
    if (!q) {
      if (selectedDeptTab === "current") {
        targetPool = allKnownCategories.filter(
          (c) => !c.department || c.department === currentDeptKey
        );
      } else if (selectedDeptTab !== "all") {
        targetPool = allKnownCategories.filter(
          (c) => c.department && c.department.toLowerCase() === selectedDeptTab.toLowerCase()
        );
      }
      return {
        currentDeptMatches: targetPool,
        otherDeptMatches: [],
        hasMatches: targetPool.length > 0,
      };
    }

    // When searching, match across ALL categories
    const matching = allKnownCategories.filter((c) =>
      c.label.toLowerCase().includes(q)
    );

    const inCurrent: CategoryOption[] = [];
    const inOther: CategoryOption[] = [];

    matching.forEach((cat) => {
      if (!cat.department || cat.department === currentDeptKey) {
        inCurrent.push(cat);
      } else {
        inOther.push(cat);
      }
    });

    return {
      currentDeptMatches: inCurrent,
      otherDeptMatches: inOther,
      hasMatches: matching.length > 0,
    };
  }, [allKnownCategories, search, department, selectedDeptTab]);

  // Check if current search is an exact match for an existing item
  const exactMatch = useMemo(() => {
    const q = search.toLowerCase().trim();
    if (!q) return null;
    return allKnownCategories.find((c) => c.label.toLowerCase().trim() === q);
  }, [allKnownCategories, search]);

  // Handle selecting an existing category option
  const handleSelect = (category: CategoryOption, isCrossDepartment = false) => {
    // Only pass department override if the user explicitly clicked an item under "In Other Departments"
    const targetDept = isCrossDepartment ? category.department : undefined;
    onChange(category.value.trim(), targetDept);
    setOpen(false);
    setSearch("");
    setIsCustomMode(false);
  };

  // Save and apply a custom typed category (inherits the currently selected department)
  const saveCustomCategory = (name: string) => {
    const trimmed = name.trim();
    if (!trimmed) return;

    // Save to session cache so user can re-use it
    setSessionCustomCategories((prev) => {
      if (prev.includes(trimmed)) return prev;
      const updated = [trimmed, ...prev].slice(0, 30);
      try {
        sessionStorage.setItem("seller_custom_categories", JSON.stringify(updated));
      } catch {
        // ignore
      }
      return updated;
    });

    // Custom category stays strictly in the user's currently selected department
    onChange(trimmed, undefined);
    setOpen(false);
    setSearch("");
    setCustomInput("");
    setIsCustomMode(false);
  };

  const handleApplyCustomFromSearch = () => {
    if (search.trim()) {
      saveCustomCategory(search.trim());
    }
  };

  const handleApplyManualCustom = () => {
    if (customInput.trim()) {
      saveCustomCategory(customInput.trim());
    }
  };

  return (
    <div className="w-full">
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            type="button"
            variant="outline"
            role="combobox"
            aria-expanded={open}
            disabled={disabled}
            className={cn(
              "w-full justify-between h-10 px-3 font-normal text-left bg-background border-input hover:bg-accent/5 hover:text-foreground transition-all",
              !value && "text-muted-foreground",
              error && "border-destructive focus-visible:ring-destructive",
              className
            )}
          >
            <div className="flex items-center gap-2 truncate">
              <Tag className="w-4 h-4 shrink-0 text-primary" />
              <span className="truncate">{value || placeholder}</span>
            </div>
            <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
          </Button>
        </PopoverTrigger>
        <PopoverContent
          className="w-[330px] sm:w-[420px] p-0 shadow-xl border-border/80 z-[100]"
          align="start"
          onWheel={(e) => e.stopPropagation()}
          onTouchMove={(e) => e.stopPropagation()}
        >
          <div className="flex flex-col max-h-[400px]">
            {/* 1. Search Bar */}
            <div className="flex items-center border-b px-3 py-2.5 gap-2 bg-muted/20 shrink-0">
              <Search className="w-4 h-4 text-muted-foreground shrink-0" />
              <input
                ref={searchInputRef}
                type="text"
                placeholder="Search or type custom category..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    if (exactMatch) {
                      const isCross = exactMatch.department && exactMatch.department.toLowerCase() !== (department || "fashion").toLowerCase();
                      handleSelect(exactMatch, isCross);
                    } else if (search.trim() && allowCustom) {
                      handleApplyCustomFromSearch();
                    } else if (currentDeptMatches.length > 0) {
                      handleSelect(currentDeptMatches[0], false);
                    }
                  }
                }}
                className="w-full bg-transparent text-sm outline-none placeholder:text-muted-foreground"
              />
              {search && (
                <button
                  type="button"
                  onClick={() => setSearch("")}
                  className="text-xs text-muted-foreground hover:text-foreground px-1 py-0.5 rounded"
                  title="Clear search"
                >
                  ✕
                </button>
              )}
            </div>

            {/* 2. Department Quick Tabs (visible when not searching) */}
            {!search && (
              <div className="flex items-center gap-1 px-2.5 py-1.5 border-b bg-muted/10 overflow-x-auto scrollbar-none text-[11px] shrink-0">
                <button
                  type="button"
                  onClick={() => setSelectedDeptTab("current")}
                  className={cn(
                    "px-2 py-1 rounded-md font-medium whitespace-nowrap transition-colors",
                    selectedDeptTab === "current"
                      ? "bg-primary text-primary-foreground shadow-xs"
                      : "text-muted-foreground hover:bg-muted"
                  )}
                >
                  {DEPT_LABELS[department.toLowerCase()] || "Current Dept"}
                </button>
                <button
                  type="button"
                  onClick={() => setSelectedDeptTab("all")}
                  className={cn(
                    "px-2 py-1 rounded-md font-medium whitespace-nowrap transition-colors",
                    selectedDeptTab === "all"
                      ? "bg-primary text-primary-foreground shadow-xs"
                      : "text-muted-foreground hover:bg-muted"
                  )}
                >
                  All ({allKnownCategories.length})
                </button>
                {Object.entries(DEPT_LABELS).map(([deptKey, label]) => {
                  if (deptKey.toLowerCase() === department.toLowerCase()) return null;
                  return (
                    <button
                      key={deptKey}
                      type="button"
                      onClick={() => setSelectedDeptTab(deptKey)}
                      className={cn(
                        "px-2 py-1 rounded-md font-medium whitespace-nowrap transition-colors",
                        selectedDeptTab === deptKey
                          ? "bg-primary text-primary-foreground shadow-xs"
                          : "text-muted-foreground hover:bg-muted"
                      )}
                    >
                      {label}
                    </button>
                  );
                })}
              </div>
            )}

            {/* 3. Custom Category Quick Prompt from Search */}
            {search.trim() && !exactMatch && allowCustom && (
              <div className="p-2 border-b bg-primary/5 hover:bg-primary/10 transition-colors shrink-0">
                <button
                  type="button"
                  onClick={handleApplyCustomFromSearch}
                  className="w-full text-left flex items-center justify-between gap-2 px-2.5 py-2 rounded-md text-sm font-medium text-primary hover:text-primary transition-colors group"
                >
                  <div className="flex items-center gap-2 truncate">
                    <Sparkles className="w-4 h-4 text-primary shrink-0 group-hover:scale-110 transition-transform" />
                    <span className="truncate">
                      Use custom in {DEPT_LABELS[department.toLowerCase()] || department}: <strong className="font-semibold underline">"{search.trim()}"</strong>
                    </span>
                  </div>
                  <Badge variant="outline" className="text-[10px] bg-background shrink-0 border-primary/30">
                    Press Enter ↵
                  </Badge>
                </button>
              </div>
            )}

            {/* 4. Category List (Scrollable Area) */}
            <ScrollArea className="h-[240px] flex-1 p-1">
              {hasMatches ? (
                <div className="space-y-2">
                  {/* Current Department Matches */}
                  {currentDeptMatches.length > 0 && (
                    <div>
                      {search && otherDeptMatches.length > 0 && (
                        <div className="px-2.5 py-1 text-[10px] font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
                          <Layers className="w-3 h-3" />
                          In {DEPT_LABELS[department.toLowerCase()] || "Current Department"} ({currentDeptMatches.length})
                        </div>
                      )}
                      <div className="space-y-0.5">
                        {currentDeptMatches.map((cat) => {
                          const isSelected = value?.toLowerCase().trim() === cat.value.toLowerCase().trim();
                          return (
                            <button
                              key={`${cat.department || department}-${cat.value}`}
                              type="button"
                              onClick={() => handleSelect(cat, false)}
                              className={cn(
                                "w-full text-left flex items-center justify-between px-3 py-2 rounded-md text-sm transition-colors hover:bg-accent hover:text-accent-foreground",
                                isSelected && "bg-primary/10 text-primary font-medium"
                              )}
                            >
                              <span className="truncate">{cat.label}</span>
                              {isSelected && <Check className="w-4 h-4 text-primary shrink-0 ml-2" />}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  {/* Other Department Matches (Cross-Department Search) */}
                  {search && otherDeptMatches.length > 0 && (
                    <div className="pt-2">
                      <div className="px-2.5 py-1 text-[10px] font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
                        <Layers className="w-3 h-3 text-muted-foreground" />
                        In Other Departments ({otherDeptMatches.length}) — switches department on click
                      </div>
                      <div className="space-y-0.5">
                        {otherDeptMatches.map((cat) => {
                          const isSelected = value?.toLowerCase().trim() === cat.value.toLowerCase().trim();
                          const deptBadge = cat.department ? (DEPT_LABELS[cat.department] || cat.department) : "General";
                          return (
                            <button
                              key={`${cat.department}-${cat.value}`}
                              type="button"
                              onClick={() => handleSelect(cat, true)}
                              className={cn(
                                "w-full text-left flex items-center justify-between px-3 py-2 rounded-md text-sm transition-colors hover:bg-accent hover:text-accent-foreground",
                                isSelected && "bg-primary/10 text-primary font-medium"
                              )}
                            >
                              <div className="flex items-center gap-2 truncate">
                                <span className="truncate">{cat.label}</span>
                                <Badge variant="secondary" className="text-[9px] uppercase font-medium px-1.5 py-0">
                                  {deptBadge}
                                </Badge>
                              </div>
                              {isSelected && <Check className="w-4 h-4 text-primary shrink-0 ml-2" />}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </div>
              ) : (
                <div className="py-6 px-4 text-center">
                  <p className="text-xs text-muted-foreground mb-3">
                    No matching existing categories found for "{search}"
                  </p>
                  {search.trim() && allowCustom && (
                    <Button
                      type="button"
                      size="sm"
                      onClick={handleApplyCustomFromSearch}
                      className="w-full text-xs h-9 gap-1.5 bg-primary text-primary-foreground font-medium"
                    >
                      <Plus className="w-4 h-4" />
                      Set "{search.trim()}" in {DEPT_LABELS[department.toLowerCase()] || department}
                    </Button>
                  )}
                </div>
              )}
            </ScrollArea>

            {/* 5. Manual Custom Category Input Option */}
            {allowCustom && (
              <div className="border-t p-2 bg-muted/10 shrink-0">
                {isCustomMode ? (
                  <div className="space-y-1.5">
                    <div className="flex items-center gap-1.5">
                      <Input
                        type="text"
                        placeholder={`Type custom category for ${DEPT_LABELS[department.toLowerCase()] || department}...`}
                        value={customInput}
                        onChange={(e) => setCustomInput(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") {
                            e.preventDefault();
                            handleApplyManualCustom();
                          }
                        }}
                        className="h-8 text-xs"
                        autoFocus
                      />
                      <Button
                        type="button"
                        size="sm"
                        onClick={handleApplyManualCustom}
                        disabled={!customInput.trim()}
                        className="h-8 text-xs shrink-0 px-3"
                      >
                        Set
                      </Button>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => {
                          setIsCustomMode(false);
                          setCustomInput("");
                        }}
                        className="h-8 text-xs shrink-0 px-2"
                      >
                        Cancel
                      </Button>
                    </div>
                    <p className="text-[10px] text-muted-foreground px-1">
                      Custom categories are automatically saved under {DEPT_LABELS[department.toLowerCase()] || department}.
                    </p>
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={() => setIsCustomMode(true)}
                    className="w-full text-center py-1.5 text-xs text-muted-foreground hover:text-foreground font-medium flex items-center justify-center gap-1.5 hover:bg-muted/50 rounded-md transition-colors"
                  >
                    <Plus className="w-3.5 h-3.5 text-primary" />
                    <span>Don't see your category? <strong>Type your own here</strong></span>
                  </button>
                )}
              </div>
            )}
          </div>
        </PopoverContent>
      </Popover>
      {error && <p className="text-sm text-destructive mt-1">{error}</p>}
    </div>
  );
};
