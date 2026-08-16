import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Header } from "@/components/Header";
import { BottomNav } from "@/components/BottomNav";
import { ChevronDown, SlidersHorizontal, CheckCircle2, User, Mail, MessageSquare, Loader2, X, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { supabase } from "@/integrations/supabase/client";
import { useCart } from "@/hooks/useCart";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

export const GIFT_CARD_PRODUCT_ID = "9e160ab4-358b-49ea-b1db-f2030997184a";

export const FALLBACK_GIFT_CARDS = [
  {
    id: "fashion",
    name: "Fashion Gift Card",
    brand: "Style",
    gradient: "from-pink-500 to-rose-500",
    discount: "10%",
    price: 100,
    originalPrice: 110,
    available: true,
  },
  {
    id: "tech",
    name: "Tech & Gadgets",
    brand: "Tech",
    gradient: "from-blue-600 to-cyan-500",
    discount: "15%",
    price: 200,
    originalPrice: 235,
    available: true,
  },
  {
    id: "home",
    name: "Home Decor",
    brand: "Living",
    gradient: "from-emerald-500 to-teal-400",
    discount: "5%",
    price: 50,
    originalPrice: 55,
    available: true,
  }
];

const GRADIENTS = [
  "from-pink-500 to-rose-400",
  "from-blue-500 to-cyan-400",
  "from-orange-500 to-amber-400",
  "from-violet-500 to-purple-400",
  "from-emerald-500 to-teal-400",
  "from-indigo-500 to-blue-400",
  "from-fuchsia-500 to-pink-400"
];

const GiftCards = () => {
  const [giftCards, setGiftCards] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const [totalProducts, setTotalProducts] = useState(0);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchInput, setSearchInput] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("All");
  const [sortBy, setSortBy] = useState("popular");
  const [minPrice, setMinPrice] = useState("");
  const [maxPrice, setMaxPrice] = useState("");
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [selectedCard, setSelectedCard] = useState<any | null>(null);
  
  const [amount, setAmount] = useState<number>(100);
  const [customAmount, setCustomAmount] = useState<string>("");
  const [isCustom, setIsCustom] = useState(false);
  const [recipientName, setRecipientName] = useState("");
  const [recipientEmail, setRecipientEmail] = useState("");
  const [message, setMessage] = useState("");
  const [isAdding, setIsAdding] = useState(false);

  const { addToCart } = useCart();
  const navigate = useNavigate();

  const PAGE_SIZE = 200;

  const mapProducts = (productsArray: any[], startIndex: number) => {
    return productsArray.map((product: any, i: number) => {
      const index = startIndex + i;
      const price = product.denominationType === "FIXED" 
        ? (product.fixedDenominations?.[0] || product.fixedRecipientDenominations?.[0] || 50) 
        : (product.minRecipientDenomination || 10);
      
      return {
        id: product.productId.toString(),
        name: product.productName,
        price: price,
        originalPrice: Math.round(price * 1.1),
        discount: product.discountPercentage ? `${product.discountPercentage}% OFF` : "Great Value",
        gradient: GRADIENTS[index % GRADIENTS.length],
        brand: product.brand?.brandName || "Universal",
        isDigital: true,
        logo: product.logoUrls?.[0] || product.brand?.logoUrl || null,
        country: product.country?.isoName || "",
      };
    });
  };

  const fetchPage = async (page: number) => {
    const { data, error } = await supabase.functions.invoke("reloadly-catalog", {
      body: {
        page,
        size: PAGE_SIZE,
        productName: searchQuery || undefined,
      },
    });
    if (error) throw error;
    const payload = data?.data ?? {};
    return {
      products: payload.content || (Array.isArray(payload) ? payload : []),
      totalElements: payload.totalElements || 0,
      totalPages: payload.totalPages || 1,
    };
  };

  // Loads the FULL Reloadly catalog: first page renders immediately, then the
  // remaining pages stream in automatically until every card is on the page.
  const loadCatalog = async () => {
    setIsLoading(true);
    setHasMore(true);

    try {
      const first = await fetchPage(1);
      let all = mapProducts(first.products, 0);

      setTotalProducts(first.totalElements || all.length);
      setGiftCards(all.length > 0 ? all : FALLBACK_GIFT_CARDS);
      setIsLoading(false);

      if (first.totalPages > 1 && all.length > 0) {
        setIsLoadingMore(true);
        for (let page = 2; page <= first.totalPages; page++) {
          try {
            const next = await fetchPage(page);
            const mapped = mapProducts(next.products, all.length);
            if (mapped.length === 0) break;
            all = [...all, ...mapped];
            setGiftCards(all);
          } catch (e) {
            console.error("Failed loading catalog page", page, e);
            break;
          }
        }
        setIsLoadingMore(false);
      }
      setHasMore(false);
    } catch (err) {
      console.error("Failed to load Reloadly catalog", err);
      setGiftCards(FALLBACK_GIFT_CARDS);
      setTotalProducts(FALLBACK_GIFT_CARDS.length);
      setHasMore(false);
      setIsLoading(false);
      setIsLoadingMore(false);
    }
  };

  useEffect(() => {
    setCurrentPage(1);
    loadCatalog();
  }, [searchQuery]);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    setSearchQuery(searchInput.trim());
  };


  const handleOpenDialog = (card?: any) => {
    if (card) {
      setSelectedCard(card);
      setAmount(card.price);
      setIsCustom(false);
      setCustomAmount("");
    } else {
      setSelectedCard(null);
    }
    setIsDialogOpen(true);
  };

  const handleAmountSelect = (val: number) => {
    setAmount(val);
    setIsCustom(false);
    setCustomAmount("");
  };

  const handleCustomAmountChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value.replace(/\D/g, "");
    setCustomAmount(val);
    setIsCustom(true);
    setAmount(val ? parseInt(val, 10) : 0);
  };

  const handleAddToCart = async () => {
    if (amount < 10) {
      toast.error("Minimum gift card amount is $10");
      return;
    }
    if (!recipientName.trim() || !recipientEmail.trim()) {
      toast.error("Please enter the recipient's name and email");
      return;
    }

    setIsAdding(true);
    
    const giftCardData = {
      name: selectedCard ? selectedCard.name : "Premium Gift Card",
      hex: "#ffffff",
      image: selectedCard?.logo ?? null,
      recipientName,
      recipientEmail,
      message,
      isGiftCard: true,
      reloadlyProductId: selectedCard?.id ?? null,
      brand: selectedCard?.brand ?? null,
      faceValue: amount,
    };

    try {
      // Gift cards are always stored against the single internal gift-card
      // product (price = 1 unit), so quantity carries the face value.
      await addToCart(GIFT_CARD_PRODUCT_ID, amount, giftCardData, null);

      toast.success("Gift Card added to cart!");
      setIsDialogOpen(false);
      navigate("/cart");
    } catch (error) {
      console.error(error);
      toast.error("Could not add gift card. Please try again.");
    } finally {
      setIsAdding(false);
    }
  };

  return (
    <div className="bg-[#f0f4f8] min-h-screen font-plus-jakarta pb-24">
      <Header />
      
      <main className="pt-24 px-4 md:px-8 max-w-[1400px] mx-auto">
        <div className="bg-white/40 backdrop-blur-3xl rounded-[2.5rem] p-6 md:p-12 shadow-[0_8px_32px_rgba(0,0,0,0.04)] border border-white/50 flex flex-col md:flex-row items-center gap-10 md:gap-20 overflow-hidden relative">
          
          <div className="absolute top-0 right-0 w-[500px] h-[500px] bg-blue-400/20 rounded-full blur-[100px] -translate-y-1/2 translate-x-1/3 pointer-events-none" />
          <div className="absolute bottom-0 left-0 w-[400px] h-[400px] bg-purple-400/20 rounded-full blur-[100px] translate-y-1/3 -translate-x-1/3 pointer-events-none" />

          <div className="w-full md:w-1/2 relative z-10 flex justify-center">
            <div className="relative w-full max-w-[500px] aspect-[4/3] rounded-3xl overflow-hidden glass-panel border border-white/60 p-4 shadow-2xl bg-white/30 backdrop-blur-md">
              <div className="w-full h-full rounded-2xl overflow-hidden bg-gradient-to-br from-gray-100 to-gray-200 relative group">
                <img 
                  src="https://images.unsplash.com/photo-1549465220-1a8b9238cd48?q=80&w=2040&auto=format&fit=crop" 
                  alt="Premium Gift Card"
                  className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-105"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/40 to-transparent flex items-end p-6">
                  <h3 className="text-white text-2xl font-bold tracking-wide">PREMIUM GIFT</h3>
                </div>
              </div>
            </div>
          </div>

          <div className="w-full md:w-1/2 relative z-10 space-y-6">
            <div>
              <h1 className="text-4xl md:text-5xl lg:text-6xl font-bold text-gray-900 tracking-tight leading-tight">
                Universal <br />Gift Card
              </h1>
              <p className="text-xl text-gray-500 mt-3 font-medium">All Regions & Departments</p>
            </div>

            <div className="pt-4 border-t border-gray-200/50">
              <Label className="text-sm text-gray-500 mb-2 block">Choose your configuration</Label>
              <button 
                onClick={() => handleOpenDialog()}
                className="w-full md:w-2/3 flex items-center justify-between bg-white border border-gray-200 rounded-xl px-4 py-3.5 text-left text-sm font-medium hover:border-gray-300 transition-colors"
              >
                <span>Select Amount & Recipient</span>
                <ChevronDown className="w-4 h-4 text-gray-400" />
              </button>
            </div>

            <div className="flex items-center gap-6 pt-4">
              <Button 
                onClick={() => handleOpenDialog()}
                className="rounded-full bg-gray-900 hover:bg-gray-800 text-white px-8 py-6 text-base font-semibold shadow-xl shadow-gray-900/20 transition-all hover:scale-105 active:scale-95"
              >
                Add to Cart
              </Button>
              <div className="flex flex-col">
                <span className="text-xl font-bold text-gray-900">$ 100+</span>
                <span className="text-xs font-medium text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-full inline-flex w-fit mt-1">
                  Instant Delivery
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Search + Filter Bar */}
        <div className="mt-12 space-y-4">
          {/* Search Bar */}
          <form onSubmit={handleSearch} className="relative">
            <Search className="absolute left-5 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
            <input
              type="text"
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              placeholder="Search gift cards... (e.g. Amazon, iTunes, Netflix, Google Play)"
              className="w-full h-14 pl-14 pr-32 bg-white/70 backdrop-blur-xl border border-white shadow-sm rounded-2xl text-sm font-medium outline-none focus:border-gray-300 focus:shadow-md transition-all placeholder:text-gray-400"
            />
            <button
              type="submit"
              className="absolute right-3 top-1/2 -translate-y-1/2 bg-gray-900 hover:bg-gray-800 text-white text-sm font-semibold px-6 py-2.5 rounded-xl transition-colors"
            >
              Search
            </button>
          </form>

          {/* Results count */}
          {totalProducts > 0 && (
            <div className="flex items-center justify-between px-1">
              <p className="text-sm text-gray-500 font-medium">
                Showing <span className="text-gray-900 font-bold">{giftCards.length}</span> of <span className="text-gray-900 font-bold">{totalProducts}</span> gift cards
                {searchQuery && <span> for "<span className="text-gray-900">{searchQuery}</span>"</span>}
              </p>
              {searchQuery && (
                <button
                  onClick={() => { setSearchInput(""); setSearchQuery(""); }}
                  className="text-xs text-red-500 font-semibold hover:text-red-600 flex items-center gap-1"
                >
                  <X className="w-3 h-3" /> Clear search
                </button>
              )}
            </div>
          )}

          {/* Filter Row */}
          <div className="bg-white/60 backdrop-blur-xl border border-white shadow-sm rounded-2xl p-4 flex flex-wrap items-center justify-between gap-4">
            <div className="flex flex-wrap items-center gap-3 md:gap-6">
              <div className="flex items-center gap-2">
                <span className="text-xs text-gray-500 font-medium whitespace-nowrap">Sort by</span>
                <Select value={sortBy} onValueChange={setSortBy}>
                  <SelectTrigger className="w-[140px] h-10 bg-white rounded-xl border-gray-100 shadow-sm text-sm font-semibold text-gray-800 focus:ring-0">
                    <SelectValue placeholder="Sort by" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="popular">Popular</SelectItem>
                    <SelectItem value="price_asc">Price: Low to High</SelectItem>
                    <SelectItem value="price_desc">Price: High to Low</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              
              <div className="flex items-center gap-2">
                <span className="text-xs text-gray-500 font-medium">Price</span>
                <div className="flex items-center gap-2">
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-xs font-semibold">$</span>
                    <input 
                      type="number"
                      value={minPrice}
                      onChange={(e) => setMinPrice(e.target.value)}
                      placeholder="Min"
                      className="w-24 h-10 pl-11 pr-3 bg-white rounded-xl border border-gray-100 shadow-sm text-sm font-semibold outline-none focus:border-gray-300"
                    />
                  </div>
                  <span className="text-xs text-gray-400">to</span>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-xs font-semibold">$</span>
                    <input 
                      type="number"
                      value={maxPrice}
                      onChange={(e) => setMaxPrice(e.target.value)}
                      placeholder="Max"
                      className="w-24 h-10 pl-11 pr-3 bg-white rounded-xl border border-gray-100 shadow-sm text-sm font-semibold outline-none focus:border-gray-300"
                    />
                  </div>
                </div>
              </div>

              <button 
                onClick={() => { setSortBy("popular"); setMinPrice(""); setMaxPrice(""); setSelectedCategory("All"); }}
                className="text-red-500 text-sm font-semibold hover:text-red-600 px-2"
              >
                Clear
              </button>
            </div>

            <div className="flex items-center gap-4">
              <div className="hidden md:flex items-center gap-2">
                <span className="text-xs text-gray-500 font-medium whitespace-nowrap">Category</span>
                <Select value={selectedCategory} onValueChange={setSelectedCategory}>
                  <SelectTrigger className="w-[140px] h-10 bg-white rounded-xl border-gray-100 shadow-sm text-sm font-semibold text-gray-800 focus:ring-0">
                    <SelectValue placeholder="Category" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="All">All</SelectItem>
                    {Array.from(new Set(giftCards.map(card => card.brand))).filter(Boolean).map(brand => (
                      <SelectItem key={brand} value={brand}>{brand}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <button className="w-10 h-10 bg-white rounded-xl border border-gray-100 shadow-sm flex items-center justify-center text-gray-600 hover:border-gray-300 transition-colors">
                <SlidersHorizontal className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>

        <div className="mt-8 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
          {isLoading ? (
            Array.from({ length: 8 }).map((_, i) => (
              <div key={i} className="bg-white rounded-[2rem] p-2 shadow-sm border border-gray-100 flex flex-col h-[320px] animate-pulse">
                <div className="w-full h-40 rounded-[1.5rem] bg-gray-200"></div>
                <div className="p-5 flex flex-col flex-1 mt-2">
                  <div className="h-5 bg-gray-200 rounded w-3/4"></div>
                  <div className="h-3 bg-gray-200 rounded w-1/4 mt-3"></div>
                  <div className="flex justify-between items-end mt-auto pt-4">
                    <div className="h-8 bg-gray-200 rounded w-1/3"></div>
                    <div className="h-10 bg-gray-200 rounded w-1/3"></div>
                  </div>
                </div>
              </div>
            ))
          ) : (
            (() => {
              const filteredCards = giftCards.filter(card => {
                if (selectedCategory !== "All" && card.brand !== selectedCategory) return false;
                if (minPrice && card.price < Number(minPrice)) return false;
                if (maxPrice && card.price > Number(maxPrice)) return false;
                return true;
              }).sort((a, b) => {
                if (sortBy === "price_asc") return a.price - b.price;
                if (sortBy === "price_desc") return b.price - a.price;
                return 0;
              });
              
              if (filteredCards.length === 0) {
                return (
                  <div className="col-span-full py-12 text-center text-gray-500">
                    No gift cards match your filters.
                  </div>
                );
              }

              return filteredCards.map((card, index) => (
                <motion.div 
                  key={card.id}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: Math.min(index, 8) * 0.05 }}
                  className="bg-white rounded-[2rem] p-2 shadow-sm border border-white hover:shadow-xl transition-all duration-300 group flex flex-col h-full"
                >
                  <div className={`w-full h-40 rounded-[1.5rem] bg-gradient-to-br ${card.gradient} relative overflow-hidden p-6 flex flex-col justify-between`}>
                    <div className="absolute inset-0 bg-gradient-to-br from-white/20 to-transparent opacity-50 pointer-events-none" />
                    <div className="absolute -right-10 -top-10 w-32 h-32 bg-white/10 rounded-full blur-2xl pointer-events-none" />
                    
                    {card.logo ? (
                      <img src={card.logo} alt={card.brand} className="h-10 object-contain self-start drop-shadow-md rounded bg-white/20 p-1" />
                    ) : (
                      <h3 className="text-white text-3xl font-bold tracking-tighter opacity-90">{card.brand}</h3>
                    )}
                    
                    <div className="self-end bg-black/20 backdrop-blur-md rounded-full px-3 py-1 border border-white/10">
                      <span className="text-white/90 text-xs font-semibold">{card.discount}</span>
                    </div>
                  </div>

                  <div className="p-5 flex flex-col flex-1">
                    <div className="flex-1">
                      <h4 className="font-bold text-gray-900 text-lg">{card.name}</h4>
                      <div className="flex items-center gap-1.5 mt-2">
                        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />
                        <span className="text-xs font-semibold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-full">Available</span>
                      </div>
                    </div>

                    <div className="flex items-end justify-between mt-6">
                      <div>
                        <span className="text-xs text-gray-400 line-through font-medium block">${card.originalPrice}</span>
                        <span className="text-2xl font-bold text-gray-900 tracking-tight">${card.price}</span>
                      </div>
                      <Button 
                        onClick={() => handleOpenDialog(card)}
                        className="rounded-xl bg-[#FDB913] hover:bg-[#e5a60e] text-black font-bold px-6 py-5 shadow-lg shadow-yellow-500/20 transition-transform hover:scale-105 active:scale-95"
                      >
                        Buy
                      </Button>
                    </div>
                  </div>
                </motion.div>
              ));
            })()
          )}
        </div>

        {/* Background loading indicator while the rest of the catalog streams in */}
        {!isLoading && isLoadingMore && (
          <div className="mt-10 flex justify-center items-center gap-2 text-gray-500 text-sm font-semibold">
            <Loader2 className="w-5 h-5 animate-spin" /> Loading the rest of the catalog...
          </div>
        )}

        {!isLoading && !isLoadingMore && giftCards.length > 0 && (
          <div className="mt-10 text-center">
            <p className="text-sm text-gray-400 font-medium">All {giftCards.length} gift cards loaded</p>
          </div>
        )}

      </main>

      <BottomNav />

      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="sm:max-w-[425px] max-h-[90vh] overflow-y-auto rounded-[2rem] p-0 border-0 shadow-2xl">
          <div className="bg-gradient-to-br from-gray-50 to-gray-100 p-6 border-b border-gray-200/50">
            <DialogHeader>
              <DialogTitle className="text-2xl font-bold text-gray-900">
                {selectedCard ? selectedCard.name : "Configure Gift Card"}
              </DialogTitle>
            </DialogHeader>
            <p className="text-sm text-gray-500 mt-1 font-medium">Enter the recipient details for instant email delivery.</p>
          </div>
          
          <div className="p-6 space-y-5 bg-white">
            {/* Amount Selection inside dialog if no specific card selected */}
            {!selectedCard && (
              <div className="space-y-3">
                <Label className="text-xs uppercase tracking-wider font-bold text-gray-500">Amount ($)</Label>
                <div className="grid grid-cols-3 gap-2">
                  {[50, 100, 200].map((preset) => (
                    <button
                      key={preset}
                      onClick={() => handleAmountSelect(preset)}
                      className={`h-11 rounded-xl text-sm font-semibold transition-colors border ${
                        !isCustom && amount === preset
                          ? "bg-gray-900 text-white border-gray-900"
                          : "bg-white text-gray-700 border-gray-200 hover:border-gray-300"
                      }`}
                    >
                      {preset}
                    </button>
                  ))}
                </div>
                <div className="relative mt-2">
                  <span className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-500 font-medium">$</span>
                  <Input
                    value={customAmount}
                    onChange={handleCustomAmountChange}
                    onFocus={() => setIsCustom(true)}
                    placeholder="Custom Amount"
                    className={`pl-14 h-12 rounded-xl border ${isCustom ? 'border-gray-900 ring-1 ring-gray-900' : 'border-gray-200'} bg-white font-medium`}
                  />
                </div>
              </div>
            )}

            <div className="space-y-4 pt-2">
              <div>
                <Label htmlFor="recipientName" className="text-xs uppercase tracking-wider font-bold text-gray-500 mb-1.5 block">Recipient Name</Label>
                <div className="relative">
                  <User className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                  <Input
                    id="recipientName"
                    value={recipientName}
                    onChange={(e) => setRecipientName(e.target.value)}
                    placeholder="Jane Doe"
                    className="pl-10 h-12 rounded-xl border-gray-200 bg-gray-50/50 focus:bg-white focus:border-gray-900 focus:ring-1 focus:ring-gray-900 font-medium transition-colors"
                  />
                </div>
              </div>

              <div>
                <Label htmlFor="recipientEmail" className="text-xs uppercase tracking-wider font-bold text-gray-500 mb-1.5 block">Recipient Email</Label>
                <div className="relative">
                  <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                  <Input
                    id="recipientEmail"
                    type="email"
                    value={recipientEmail}
                    onChange={(e) => setRecipientEmail(e.target.value)}
                    placeholder="jane@example.com"
                    className="pl-10 h-12 rounded-xl border-gray-200 bg-gray-50/50 focus:bg-white focus:border-gray-900 focus:ring-1 focus:ring-gray-900 font-medium transition-colors"
                  />
                </div>
              </div>

              <div>
                <Label htmlFor="message" className="text-xs uppercase tracking-wider font-bold text-gray-500 mb-1.5 block">Message (Optional)</Label>
                <div className="relative">
                  <MessageSquare className="absolute left-3.5 top-3.5 w-4 h-4 text-gray-400" />
                  <Textarea
                    id="message"
                    value={message}
                    onChange={(e) => setMessage(e.target.value)}
                    placeholder="Happy Birthday!"
                    className="pl-10 min-h-[100px] resize-none rounded-xl border-gray-200 bg-gray-50/50 focus:bg-white focus:border-gray-900 focus:ring-1 focus:ring-gray-900 font-medium transition-colors py-3"
                  />
                </div>
              </div>
            </div>
            
            <div className="pt-4 flex gap-3">
              <Button
                variant="outline"
                onClick={() => setIsDialogOpen(false)}
                className="flex-1 h-12 rounded-xl border-gray-200 text-gray-700 font-semibold hover:bg-gray-50"
              >
                Cancel
              </Button>
              <Button
                onClick={handleAddToCart}
                disabled={isAdding || amount < 10}
                className="flex-[2] h-12 rounded-xl bg-gray-900 text-white hover:bg-gray-800 font-semibold shadow-lg shadow-gray-900/10"
              >
                {isAdding ? <Loader2 className="w-5 h-5 animate-spin" /> : `Add - $${amount || 0}`}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default GiftCards;
