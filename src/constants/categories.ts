export interface CategoryItem {
  id: string;
  name: string;
  slug: string;
  department: string;
  group?: string;
  image?: string | null;
}

export const PRESET_FASHION_CATEGORIES: CategoryItem[] = [
  // Clothing
  { id: "clothing", name: "Clothing", slug: "clothing", department: "fashion", group: "Clothing" },
  { id: "t-shirts", name: "T-Shirts", slug: "t-shirts", department: "fashion", group: "Clothing" },
  { id: "shirts", name: "Shirts", slug: "shirts", department: "fashion", group: "Clothing" },
  { id: "trousers", name: "Trousers", slug: "trousers", department: "fashion", group: "Clothing" },
  { id: "jeans", name: "Jeans", slug: "jeans", department: "fashion", group: "Clothing" },
  { id: "shorts", name: "Shorts", slug: "shorts", department: "fashion", group: "Clothing" },
  { id: "dresses", name: "Dresses", slug: "dresses", department: "fashion", group: "Clothing" },
  { id: "skirts", name: "Skirts", slug: "skirts", department: "fashion", group: "Clothing" },
  { id: "suits-blazers", name: "Suits & Blazers", slug: "suits-blazers", department: "fashion", group: "Clothing" },
  { id: "jackets-coats", name: "Jackets & Coats", slug: "jackets-coats", department: "fashion", group: "Clothing" },
  { id: "hoodies-sweatshirts", name: "Hoodies & Sweatshirts", slug: "hoodies-sweatshirts", department: "fashion", group: "Clothing" },
  { id: "jumpsuits", name: "Jumpsuits", slug: "jumpsuits", department: "fashion", group: "Clothing" },
  { id: "traditional-wear", name: "Traditional Wear", slug: "traditional-wear", department: "fashion", group: "Clothing" },
  { id: "sportswear", name: "Sportswear", slug: "sportswear", department: "fashion", group: "Clothing" },
  { id: "underwear-lingerie", name: "Underwear & Lingerie", slug: "underwear-lingerie", department: "fashion", group: "Clothing" },
  { id: "sleepwear", name: "Sleepwear", slug: "sleepwear", department: "fashion", group: "Clothing" },

  // Shoes
  { id: "shoes", name: "Shoes 👟", slug: "shoes", department: "fashion", group: "Shoes" },
  { id: "sneakers", name: "Sneakers", slug: "sneakers", department: "fashion", group: "Shoes" },
  { id: "sandals", name: "Sandals", slug: "sandals", department: "fashion", group: "Shoes" },
  { id: "slippers", name: "Slippers", slug: "slippers", department: "fashion", group: "Shoes" },
  { id: "boots", name: "Boots", slug: "boots", department: "fashion", group: "Shoes" },
  { id: "formal-shoes", name: "Formal Shoes", slug: "formal-shoes", department: "fashion", group: "Shoes" },
  { id: "heels", name: "Heels", slug: "heels", department: "fashion", group: "Shoes" },
  { id: "flats", name: "Flats", slug: "flats", department: "fashion", group: "Shoes" },
  { id: "loafers", name: "Loafers", slug: "loafers", department: "fashion", group: "Shoes" },
  { id: "sports-shoes", name: "Sports Shoes", slug: "sports-shoes", department: "fashion", group: "Shoes" },

  // Bags
  { id: "bags", name: "Bags 👜", slug: "bags", department: "fashion", group: "Bags" },
  { id: "handbags", name: "Handbags", slug: "handbags", department: "fashion", group: "Bags" },
  { id: "backpacks", name: "Backpacks", slug: "backpacks", department: "fashion", group: "Bags" },
  { id: "shoulder-bags", name: "Shoulder Bags", slug: "shoulder-bags", department: "fashion", group: "Bags" },
  { id: "crossbody-bags", name: "Crossbody Bags", slug: "crossbody-bags", department: "fashion", group: "Bags" },
  { id: "laptop-bags", name: "Laptop Bags", slug: "laptop-bags", department: "fashion", group: "Bags" },
  { id: "travel-bags", name: "Travel Bags", slug: "travel-bags", department: "fashion", group: "Bags" },
  { id: "wallets-purses", name: "Wallets & Purses", slug: "wallets-purses", department: "fashion", group: "Bags" },

  // Jewelry & Accessories
  { id: "jewelry-accessories", name: "Jewelry & Accessories 💎", slug: "jewelry-accessories", department: "fashion", group: "Jewelry & Accessories" },
  { id: "necklaces", name: "Necklaces", slug: "necklaces", department: "fashion", group: "Jewelry & Accessories" },
  { id: "earrings", name: "Earrings", slug: "earrings", department: "fashion", group: "Jewelry & Accessories" },
  { id: "rings", name: "Rings", slug: "rings", department: "fashion", group: "Jewelry & Accessories" },
  { id: "bracelets", name: "Bracelets", slug: "bracelets", department: "fashion", group: "Jewelry & Accessories" },
  { id: "watches", name: "Watches", slug: "watches", department: "fashion", group: "Jewelry & Accessories" },
  { id: "sunglasses", name: "Sunglasses", slug: "sunglasses", department: "fashion", group: "Jewelry & Accessories" },
  { id: "belts", name: "Belts", slug: "belts", department: "fashion", group: "Jewelry & Accessories" },
  { id: "hats-caps", name: "Hats & Caps", slug: "hats-caps", department: "fashion", group: "Jewelry & Accessories" },
  { id: "scarves", name: "Scarves", slug: "scarves", department: "fashion", group: "Jewelry & Accessories" },
  { id: "ties-bow-ties", name: "Ties & Bow Ties", slug: "ties-bow-ties", department: "fashion", group: "Jewelry & Accessories" },

  // Women's Fashion
  { id: "womens-fashion", name: "Women's Fashion 👩", slug: "womens-fashion", department: "fashion", group: "Women's Fashion" },
  { id: "womens-dresses", name: "Women's Dresses", slug: "womens-dresses", department: "fashion", group: "Women's Fashion" },
  { id: "womens-tops", name: "Women's Tops", slug: "womens-tops", department: "fashion", group: "Women's Fashion" },
  { id: "womens-bottoms", name: "Women's Bottoms", slug: "womens-bottoms", department: "fashion", group: "Women's Fashion" },
  { id: "womens-shoes", name: "Women's Shoes", slug: "womens-shoes", department: "fashion", group: "Women's Fashion" },
  { id: "womens-bags", name: "Women's Bags", slug: "womens-bags", department: "fashion", group: "Women's Fashion" },
  { id: "womens-accessories", name: "Women's Accessories", slug: "womens-accessories", department: "fashion", group: "Women's Fashion" },

  // Men's Fashion
  { id: "mens-fashion", name: "Men's Fashion 👨", slug: "mens-fashion", department: "fashion", group: "Men's Fashion" },
  { id: "mens-shirts", name: "Men's Shirts", slug: "mens-shirts", department: "fashion", group: "Men's Fashion" },
  { id: "mens-trousers", name: "Men's Trousers", slug: "mens-trousers", department: "fashion", group: "Men's Fashion" },
  { id: "mens-t-shirts", name: "Men's T-Shirts", slug: "mens-t-shirts", department: "fashion", group: "Men's Fashion" },
  { id: "mens-shoes", name: "Men's Shoes", slug: "mens-shoes", department: "fashion", group: "Men's Fashion" },
  { id: "mens-suits", name: "Men's Suits", slug: "mens-suits", department: "fashion", group: "Men's Fashion" },
  { id: "mens-accessories", name: "Men's Accessories", slug: "mens-accessories", department: "fashion", group: "Men's Fashion" },

  // Kids' Fashion
  { id: "kids-fashion", name: "Kids' Fashion 👶", slug: "kids-fashion", department: "fashion", group: "Kids' Fashion" },
  { id: "boys-clothing", name: "Boys' Clothing", slug: "boys-clothing", department: "fashion", group: "Kids' Fashion" },
  { id: "girls-clothing", name: "Girls' Clothing", slug: "girls-clothing", department: "fashion", group: "Kids' Fashion" },
  { id: "baby-clothing", name: "Baby Clothing", slug: "baby-clothing", department: "fashion", group: "Kids' Fashion" },
  { id: "kids-shoes", name: "Kids' Shoes", slug: "kids-shoes", department: "fashion", group: "Kids' Fashion" },
  { id: "kids-accessories", name: "Kids' Accessories", slug: "kids-accessories", department: "fashion", group: "Kids' Fashion" },

  // African / Traditional Fashion
  { id: "african-traditional-fashion", name: "African / Traditional Fashion 🇬🇭", slug: "african-traditional-fashion", department: "fashion", group: "African / Traditional Fashion" },
  { id: "kente", name: "Kente", slug: "kente", department: "fashion", group: "African / Traditional Fashion" },
  { id: "african-print", name: "African Print", slug: "african-print", department: "fashion", group: "African / Traditional Fashion" },
  { id: "kaftans", name: "Kaftans", slug: "kaftans", department: "fashion", group: "African / Traditional Fashion" },
  { id: "dashiki", name: "Dashiki", slug: "dashiki", department: "fashion", group: "African / Traditional Fashion" },
  { id: "agbada", name: "Agbada", slug: "agbada", department: "fashion", group: "African / Traditional Fashion" },
  { id: "traditional-dresses", name: "Traditional Dresses", slug: "traditional-dresses", department: "fashion", group: "African / Traditional Fashion" },
  { id: "traditional-shirts", name: "Traditional Shirts", slug: "traditional-shirts", department: "fashion", group: "African / Traditional Fashion" },
  { id: "fabrics-textiles", name: "Fabrics & Textiles", slug: "fabrics-textiles", department: "fashion", group: "African / Traditional Fashion" },
];

export const PRESET_GADGETS_CATEGORIES: CategoryItem[] = [
  // Smartphones & Tablets
  { id: "smartphones", name: "Smartphones 📱", slug: "smartphones", department: "gadgets", group: "Smartphones & Tablets" },
  { id: "tablets", name: "Tablets 📲", slug: "tablets", department: "gadgets", group: "Smartphones & Tablets" },

  // Wearables
  { id: "wearables", name: "Wearables ⌚", slug: "wearables", department: "gadgets", group: "Wearables" },
  { id: "smartwatches", name: "Smartwatches", slug: "smartwatches", department: "gadgets", group: "Wearables" },
  { id: "fitness-trackers", name: "Fitness Trackers", slug: "fitness-trackers", department: "gadgets", group: "Wearables" },
  { id: "smart-rings", name: "Smart Rings", slug: "smart-rings", department: "gadgets", group: "Wearables" },
  { id: "smart-glasses", name: "Smart Glasses", slug: "smart-glasses", department: "gadgets", group: "Wearables" },

  // Audio
  { id: "audio-headphones", name: "Audio 🎧", slug: "audio-headphones", department: "gadgets", group: "Audio" },
  { id: "earbuds-earphones", name: "Earbuds & Earphones", slug: "earbuds-earphones", department: "gadgets", group: "Audio" },
  { id: "headphones", name: "Headphones", slug: "headphones", department: "gadgets", group: "Audio" },
  { id: "bluetooth-speakers", name: "Bluetooth Speakers", slug: "bluetooth-speakers", department: "gadgets", group: "Audio" },
  { id: "wireless-microphones", name: "Wireless Microphones", slug: "wireless-microphones", department: "gadgets", group: "Audio" },

  // Power & Charging
  { id: "power-banks", name: "Power Banks 🔋", slug: "power-banks", department: "gadgets", group: "Power & Charging" },
  { id: "chargers-adapters", name: "Chargers & Adapters 🔌", slug: "chargers-adapters", department: "gadgets", group: "Power & Charging" },
  { id: "wireless-chargers", name: "Wireless Chargers", slug: "wireless-chargers", department: "gadgets", group: "Power & Charging" },
  { id: "usb-cables-data-cables", name: "USB & Data Cables", slug: "usb-cables-data-cables", department: "gadgets", group: "Power & Charging" },

  // Phone Accessories
  { id: "gadget-accessories", name: "Phone Accessories 📱", slug: "gadget-accessories", department: "gadgets", group: "Phone Accessories" },
  { id: "phone-cases", name: "Phone Cases", slug: "phone-cases", department: "gadgets", group: "Phone Accessories" },
  { id: "screen-protectors", name: "Screen Protectors", slug: "screen-protectors", department: "gadgets", group: "Phone Accessories" },
  { id: "phone-stands-holders", name: "Phone Stands & Holders", slug: "phone-stands-holders", department: "gadgets", group: "Phone Accessories" },
  { id: "selfie-sticks-tripods", name: "Selfie Sticks & Tripods", slug: "selfie-sticks-tripods", department: "gadgets", group: "Phone Accessories" },
  { id: "phone-coolers", name: "Phone Coolers", slug: "phone-coolers", department: "gadgets", group: "Phone Accessories" },

  // Cameras & Photography
  { id: "cameras-photography", name: "Cameras & Photography 📷", slug: "cameras-photography", department: "gadgets", group: "Cameras & Photography" },
  { id: "drones", name: "Drones & RC", slug: "drones", department: "gadgets", group: "Cameras & Photography" },
  { id: "action-cameras", name: "Action Cameras", slug: "action-cameras", department: "gadgets", group: "Cameras & Photography" },
  { id: "digital-cameras", name: "Digital Cameras", slug: "digital-cameras", department: "gadgets", group: "Cameras & Photography" },
  { id: "camera-accessories", name: "Camera Accessories", slug: "camera-accessories", department: "gadgets", group: "Cameras & Photography" },

  // Gaming & VR
  { id: "gaming-gadgets", name: "Gaming Gadgets 🎮", slug: "gaming-gadgets", department: "gadgets", group: "Gaming & VR" },
  { id: "vr-headsets", name: "VR Headsets 🥽", slug: "vr-headsets", department: "gadgets", group: "Gaming & VR" },

  // Smart Home & Lighting
  { id: "smart-home", name: "Smart Home Devices 🏠", slug: "smart-home", department: "gadgets", group: "Smart Home & Lighting" },
  { id: "led-smart-lights", name: "LED & Smart Lights 💡", slug: "led-smart-lights", department: "gadgets", group: "Smart Home & Lighting" },
  { id: "projectors", name: "Projectors 📹", slug: "projectors", department: "gadgets", group: "Smart Home & Lighting" },
  { id: "tv-boxes-streaming", name: "TV Boxes & Streaming Devices", slug: "tv-boxes-streaming", department: "gadgets", group: "Smart Home & Lighting" },

  // Computer Accessories
  { id: "computer-accessories", name: "Computer Accessories 💻", slug: "computer-accessories", department: "gadgets", group: "Computer Accessories" },
  { id: "usb-hubs-adapters", name: "USB Hubs & Adapters", slug: "usb-hubs-adapters", department: "gadgets", group: "Computer Accessories" },

  // Storage & Memory
  { id: "memory-cards-flash-drives", name: "Memory Cards & Flash Drives 💾", slug: "memory-cards-flash-drives", department: "gadgets", group: "Storage & Memory" },

  // Car Gadgets & Tracking
  { id: "car-gadgets", name: "Car Gadgets 🚗", slug: "car-gadgets", department: "gadgets", group: "Car Gadgets & Tracking" },
  { id: "gps-tracking-devices", name: "GPS & Tracking Devices 📍", slug: "gps-tracking-devices", department: "gadgets", group: "Car Gadgets & Tracking" },

  // Other Gadgets
  { id: "other-gadgets", name: "Other Gadgets", slug: "other-gadgets", department: "gadgets", group: "Other Gadgets" },
];

export const PRESET_ART_CATEGORIES: CategoryItem[] = [
  // Paintings
  { id: "paintings", name: "Paintings 🎨", slug: "paintings", department: "art", group: "Paintings" },
  { id: "acrylic-paintings", name: "Acrylic Paintings", slug: "acrylic-paintings", department: "art", group: "Paintings" },
  { id: "oil-paintings", name: "Oil Paintings", slug: "oil-paintings", department: "art", group: "Paintings" },
  { id: "watercolor-paintings", name: "Watercolor Paintings", slug: "watercolor-paintings", department: "art", group: "Paintings" },
  { id: "canvas-paintings", name: "Canvas Paintings", slug: "canvas-paintings", department: "art", group: "Paintings" },
  { id: "abstract-art", name: "Abstract Art", slug: "abstract-art", department: "art", group: "Paintings" },
  { id: "portrait-paintings", name: "Portrait Paintings", slug: "portrait-paintings", department: "art", group: "Paintings" },
  { id: "african-art-paintings", name: "African Art Paintings", slug: "african-art-paintings", department: "art", group: "Paintings" },

  // Drawings & Sketches
  { id: "drawings-sketches", name: "Drawings & Sketches ✏️", slug: "drawings-sketches", department: "art", group: "Drawings & Sketches" },
  { id: "pencil-drawings", name: "Pencil Drawings", slug: "pencil-drawings", department: "art", group: "Drawings & Sketches" },
  { id: "charcoal-drawings", name: "Charcoal Drawings", slug: "charcoal-drawings", department: "art", group: "Drawings & Sketches" },
  { id: "portrait-sketches", name: "Portrait Sketches", slug: "portrait-sketches", department: "art", group: "Drawings & Sketches" },
  { id: "digital-drawings", name: "Digital Drawings", slug: "digital-drawings", department: "art", group: "Drawings & Sketches" },

  // Wall Art & Prints
  { id: "wall-art", name: "Wall Art & Prints 🖼️", slug: "wall-art", department: "art", group: "Wall Art & Prints" },
  { id: "art-prints", name: "Art Prints", slug: "art-prints", department: "art", group: "Wall Art & Prints" },
  { id: "posters", name: "Posters", slug: "posters", department: "art", group: "Wall Art & Prints" },
  { id: "canvas-prints", name: "Canvas Prints", slug: "canvas-prints", department: "art", group: "Wall Art & Prints" },
  { id: "metal-prints", name: "Metal Prints", slug: "metal-prints", department: "art", group: "Wall Art & Prints" },
  { id: "wall-murals", name: "Wall Murals", slug: "wall-murals", department: "art", group: "Wall Art & Prints" },

  // Sculptures & Carvings
  { id: "sculptures", name: "Sculptures & Carvings 🗿", slug: "sculptures", department: "art", group: "Sculptures & Carvings" },
  { id: "wood-sculptures", name: "Wood Sculptures", slug: "wood-sculptures", department: "art", group: "Sculptures & Carvings" },
  { id: "metal-sculptures", name: "Metal Sculptures", slug: "metal-sculptures", department: "art", group: "Sculptures & Carvings" },
  { id: "stone-sculptures", name: "Stone Sculptures", slug: "stone-sculptures", department: "art", group: "Sculptures & Carvings" },
  { id: "clay-sculptures", name: "Clay Sculptures", slug: "clay-sculptures", department: "art", group: "Sculptures & Carvings" },
  { id: "african-sculptures", name: "African Sculptures", slug: "african-sculptures", department: "art", group: "Sculptures & Carvings" },
  { id: "wood-carvings", name: "Wood Carvings", slug: "wood-carvings", department: "art", group: "Sculptures & Carvings" },

  // African Art & Crafts
  { id: "african-art-crafts", name: "African Art & Crafts 🇬🇭", slug: "african-art-crafts", department: "art", group: "African Art & Crafts" },
  { id: "adinkra-art", name: "Adinkra Art", slug: "adinkra-art", department: "art", group: "African Art & Crafts" },
  { id: "african-masks", name: "African Masks", slug: "african-masks", department: "art", group: "African Art & Crafts" },
  { id: "bead-art", name: "Bead Art", slug: "bead-art", department: "art", group: "African Art & Crafts" },
  { id: "handcrafts", name: "Traditional Crafts", slug: "handcrafts", department: "art", group: "African Art & Crafts" },
  { id: "cultural-art", name: "Cultural Art", slug: "cultural-art", department: "art", group: "African Art & Crafts" },

  // Pottery & Ceramics
  { id: "pottery-ceramics", name: "Pottery & Ceramics 🏺", slug: "pottery-ceramics", department: "art", group: "Pottery & Ceramics" },
  { id: "ceramic-art", name: "Ceramic Art", slug: "ceramic-art", department: "art", group: "Pottery & Ceramics" },
  { id: "pottery", name: "Pottery", slug: "pottery", department: "art", group: "Pottery & Ceramics" },
  { id: "clay-art", name: "Clay Art", slug: "clay-art", department: "art", group: "Pottery & Ceramics" },
  { id: "decorative-vases", name: "Decorative Vases", slug: "decorative-vases", department: "art", group: "Pottery & Ceramics" },

  // Photography
  { id: "photography", name: "Photography 📷", slug: "photography", department: "art", group: "Photography" },
  { id: "fine-art-photography", name: "Fine Art Photography", slug: "fine-art-photography", department: "art", group: "Photography" },
  { id: "nature-photography", name: "Nature Photography", slug: "nature-photography", department: "art", group: "Photography" },
  { id: "african-photography", name: "African Photography", slug: "african-photography", department: "art", group: "Photography" },
  { id: "photography-prints", name: "Photography Prints", slug: "photography-prints", department: "art", group: "Photography" },

  // Textile Art
  { id: "textile-art", name: "Textile Art 🧵", slug: "textile-art", department: "art", group: "Textile Art" },
  { id: "kente-art", name: "Kente Art", slug: "kente-art", department: "art", group: "Textile Art" },
  { id: "batik-art", name: "Batik Art", slug: "batik-art", department: "art", group: "Textile Art" },
  { id: "fabric-art", name: "Fabric Art", slug: "fabric-art", department: "art", group: "Textile Art" },
  { id: "woven-art", name: "Woven Art", slug: "woven-art", department: "art", group: "Textile Art" },

  // Handmade & Decorative Art
  { id: "handmade-decorative-art", name: "Handmade & Decorative Art 🪡", slug: "handmade-decorative-art", department: "art", group: "Handmade & Decorative Art" },
  { id: "resin-art", name: "Resin Art", slug: "resin-art", department: "art", group: "Handmade & Decorative Art" },
  { id: "handmade-decor", name: "Handmade Décor", slug: "handmade-decor", department: "art", group: "Handmade & Decorative Art" },
  { id: "paper-art", name: "Paper Art", slug: "paper-art", department: "art", group: "Handmade & Decorative Art" },
  { id: "glass-art", name: "Glass Art", slug: "glass-art", department: "art", group: "Handmade & Decorative Art" },
  { id: "wood-art", name: "Wood Art", slug: "wood-art", department: "art", group: "Handmade & Decorative Art" },

  // Art Supplies
  { id: "art-supplies", name: "Art Supplies 🖌️", slug: "art-supplies", department: "art", group: "Art Supplies" },
  { id: "paints", name: "Paints", slug: "paints", department: "art", group: "Art Supplies" },
  { id: "brushes", name: "Brushes", slug: "brushes", department: "art", group: "Art Supplies" },
  { id: "canvases", name: "Canvases", slug: "canvases", department: "art", group: "Art Supplies" },
  { id: "drawing-pencils", name: "Drawing Pencils", slug: "drawing-pencils", department: "art", group: "Art Supplies" },
  { id: "easels", name: "Easels", slug: "easels", department: "art", group: "Art Supplies" },
  { id: "sketchbooks", name: "Sketchbooks", slug: "sketchbooks", department: "art", group: "Art Supplies" },
  { id: "palettes", name: "Palettes", slug: "palettes", department: "art", group: "Art Supplies" },

  // Awards & Trophies
  { id: "awards-trophies", name: "Awards & Trophies 🏆", slug: "awards-trophies", department: "art", group: "Awards & Trophies" },
  { id: "trophies", name: "Trophies", slug: "trophies", department: "art", group: "Awards & Trophies" },
  { id: "medals", name: "Medals", slug: "medals", department: "art", group: "Awards & Trophies" },
  { id: "plaques", name: "Plaques", slug: "plaques", department: "art", group: "Awards & Trophies" },
  { id: "awards", name: "Awards", slug: "awards", department: "art", group: "Awards & Trophies" },
];

export const PRESET_OTHER_CATEGORIES: CategoryItem[] = [
  // Beauty & Personal Care
  { id: "beauty-personal-care", name: "Beauty & Personal Care 💄", slug: "beauty-personal-care", department: "other", group: "Beauty & Personal Care" },
  { id: "skincare", name: "Skincare", slug: "skincare", department: "other", group: "Beauty & Personal Care" },
  { id: "hair-care", name: "Hair Care", slug: "hair-care", department: "other", group: "Beauty & Personal Care" },
  { id: "fragrances-perfumes", name: "Fragrances & Perfumes", slug: "fragrances-perfumes", department: "other", group: "Beauty & Personal Care" },
  { id: "makeup-cosmetics", name: "Makeup & Cosmetics", slug: "makeup-cosmetics", department: "other", group: "Beauty & Personal Care" },
  { id: "grooming-shaving", name: "Grooming & Shaving", slug: "grooming-shaving", department: "other", group: "Beauty & Personal Care" },

  // Health & Wellness
  { id: "health-wellness", name: "Health & Wellness 🌿", slug: "health-wellness", department: "other", group: "Health & Wellness" },
  { id: "vitamins-supplements", name: "Vitamins & Supplements", slug: "vitamins-supplements", department: "other", group: "Health & Wellness" },
  { id: "fitness-accessories", name: "Fitness Accessories", slug: "fitness-accessories", department: "other", group: "Health & Wellness" },
  { id: "personal-health", name: "Personal Health", slug: "personal-health", department: "other", group: "Health & Wellness" },

  // Books & Stationery
  { id: "books-stationery", name: "Books & Stationery 📚", slug: "books-stationery", department: "other", group: "Books & Stationery" },
  { id: "books-literature", name: "Books & Literature", slug: "books-literature", department: "other", group: "Books & Stationery" },
  { id: "notebooks-journals", name: "Notebooks & Journals", slug: "notebooks-journals", department: "other", group: "Books & Stationery" },
  { id: "office-school-supplies", name: "Office & School Supplies", slug: "office-school-supplies", department: "other", group: "Books & Stationery" },

  // Toys, Games & Hobbies
  { id: "toys-games-hobbies", name: "Toys, Games & Hobbies 🧸", slug: "toys-games-hobbies", department: "other", group: "Toys, Games & Hobbies" },
  { id: "board-games-puzzles", name: "Board Games & Puzzles", slug: "board-games-puzzles", department: "other", group: "Toys, Games & Hobbies" },
  { id: "toys-action-figures", name: "Toys & Action Figures", slug: "toys-action-figures", department: "other", group: "Toys, Games & Hobbies" },
  { id: "musical-instruments", name: "Musical Instruments", slug: "musical-instruments", department: "other", group: "Toys, Games & Hobbies" },

  // Automotive & Hardware
  { id: "automotive-hardware", name: "Automotive & Hardware 🚗", slug: "automotive-hardware", department: "other", group: "Automotive & Hardware" },
  { id: "car-care-cleaners", name: "Car Care & Cleaners", slug: "car-care-cleaners", department: "other", group: "Automotive & Hardware" },
  { id: "tools-hardware", name: "Tools & Hardware", slug: "tools-hardware", department: "other", group: "Automotive & Hardware" },

  // Pet Supplies
  { id: "pet-supplies", name: "Pet Supplies 🐾", slug: "pet-supplies", department: "other", group: "Pet Supplies" },
  { id: "pet-food-treats", name: "Pet Food & Treats", slug: "pet-food-treats", department: "other", group: "Pet Supplies" },
  { id: "pet-accessories", name: "Pet Accessories", slug: "pet-accessories", department: "other", group: "Pet Supplies" },

  // Groceries & Provisions
  { id: "groceries-provisions", name: "Groceries & Provisions 🛒", slug: "groceries-provisions", department: "other", group: "Groceries & Provisions" },
  { id: "snacks-confectionery", name: "Snacks & Confectionery", slug: "snacks-confectionery", department: "other", group: "Groceries & Provisions" },
  { id: "beverages-drinks", name: "Beverages & Drinks", slug: "beverages-drinks", department: "other", group: "Groceries & Provisions" },
  { id: "specialty-local-foods", name: "Specialty & Local Foods", slug: "specialty-local-foods", department: "other", group: "Groceries & Provisions" },

  // General Miscellaneous
  { id: "general-miscellaneous", name: "General Miscellaneous 📦", slug: "general-miscellaneous", department: "other", group: "General Miscellaneous" },
];

export const PRESET_HOME_CATEGORIES: CategoryItem[] = [
  // Kitchen & Dining
  { id: "kitchen-dining", name: "Kitchen & Dining 🍳", slug: "kitchen-dining", department: "home", group: "Kitchen & Dining" },
  { id: "cookware-bakeware", name: "Cookware & Bakeware", slug: "cookware-bakeware", department: "home", group: "Kitchen & Dining" },
  { id: "kitchen-appliances", name: "Kitchen Appliances", slug: "kitchen-appliances", department: "home", group: "Kitchen & Dining" },
  { id: "dinnerware-tableware", name: "Dinnerware & Tableware", slug: "dinnerware-tableware", department: "home", group: "Kitchen & Dining" },
  { id: "cutlery-knives", name: "Cutlery & Knives", slug: "cutlery-knives", department: "home", group: "Kitchen & Dining" },
  { id: "drinkware-glassware", name: "Drinkware & Glassware", slug: "drinkware-glassware", department: "home", group: "Kitchen & Dining" },
  { id: "kitchen-storage-containers", name: "Kitchen Storage & Containers", slug: "kitchen-storage-containers", department: "home", group: "Kitchen & Dining" },
  { id: "kitchen-tools-utensils", name: "Kitchen Tools & Utensils", slug: "kitchen-tools-utensils", department: "home", group: "Kitchen & Dining" },

  // Bedroom & Bedding
  { id: "bedroom-bedding", name: "Bedroom & Bedding 🛏️", slug: "bedroom-bedding", department: "home", group: "Bedroom & Bedding" },
  { id: "bed-sheets-pillowcases", name: "Bed Sheets & Pillowcases", slug: "bed-sheets-pillowcases", department: "home", group: "Bedroom & Bedding" },
  { id: "duvets-comforters", name: "Duvets & Comforters", slug: "duvets-comforters", department: "home", group: "Bedroom & Bedding" },
  { id: "pillows-cushions", name: "Pillows & Cushions", slug: "pillows-cushions", department: "home", group: "Bedroom & Bedding" },
  { id: "mattresses-toppers", name: "Mattresses & Toppers", slug: "mattresses-toppers", department: "home", group: "Bedroom & Bedding" },
  { id: "blankets-throws", name: "Blankets & Throws", slug: "blankets-throws", department: "home", group: "Bedroom & Bedding" },
  { id: "wardrobes-closets", name: "Wardrobes & Closets", slug: "wardrobes-closets", department: "home", group: "Bedroom & Bedding" },

  // Living Room
  { id: "living-room", name: "Living Room 🛋️", slug: "living-room", department: "home", group: "Living Room" },
  { id: "sofas-couches", name: "Sofas & Couches", slug: "sofas-couches", department: "home", group: "Living Room" },
  { id: "coffee-side-tables", name: "Coffee & Side Tables", slug: "coffee-side-tables", department: "home", group: "Living Room" },
  { id: "tv-stands-media-units", name: "TV Stands & Media Units", slug: "tv-stands-media-units", department: "home", group: "Living Room" },
  { id: "chairs-recliners", name: "Chairs & Recliners", slug: "chairs-recliners", department: "home", group: "Living Room" },
  { id: "living-room-decor", name: "Living Room Decor", slug: "living-room-decor", department: "home", group: "Living Room" },

  // Bathroom
  { id: "bathroom", name: "Bathroom 🛁", slug: "bathroom", department: "home", group: "Bathroom" },
  { id: "towels-washcloths", name: "Towels & Washcloths", slug: "towels-washcloths", department: "home", group: "Bathroom" },
  { id: "bath-mats-rugs", name: "Bath Mats & Rugs", slug: "bath-mats-rugs", department: "home", group: "Bathroom" },
  { id: "bathroom-accessories", name: "Bathroom Accessories", slug: "bathroom-accessories", department: "home", group: "Bathroom" },
  { id: "shower-curtains", name: "Shower Curtains", slug: "shower-curtains", department: "home", group: "Bathroom" },
  { id: "bathroom-storage-mirrors", name: "Bathroom Storage & Mirrors", slug: "bathroom-storage-mirrors", department: "home", group: "Bathroom" },

  // Home Decor & Accents
  { id: "home-decor", name: "Home Decor & Accents 🪴", slug: "home-decor", department: "home", group: "Home Decor & Accents" },
  { id: "wall-clocks-mirrors", name: "Wall Clocks & Mirrors", slug: "wall-clocks-mirrors", department: "home", group: "Home Decor & Accents" },
  { id: "vases-artificial-plants", name: "Vases & Artificial Plants", slug: "vases-artificial-plants", department: "home", group: "Home Decor & Accents" },
  { id: "candles-diffusers", name: "Candles & Diffusers", slug: "candles-diffusers", department: "home", group: "Home Decor & Accents" },
  { id: "rugs-carpets", name: "Rugs & Carpets", slug: "rugs-carpets", department: "home", group: "Home Decor & Accents" },
  { id: "curtains-blinds", name: "Curtains & Blinds", slug: "curtains-blinds", department: "home", group: "Home Decor & Accents" },
  { id: "picture-frames", name: "Picture Frames", slug: "picture-frames", department: "home", group: "Home Decor & Accents" },

  // Lighting & Fans
  { id: "lighting-fans", name: "Lighting & Fans 💡", slug: "lighting-fans", department: "home", group: "Lighting & Fans" },
  { id: "ceiling-lights-chandeliers", name: "Ceiling Lights & Chandeliers", slug: "ceiling-lights-chandeliers", department: "home", group: "Lighting & Fans" },
  { id: "table-desk-lamps", name: "Table & Desk Lamps", slug: "table-desk-lamps", department: "home", group: "Lighting & Fans" },
  { id: "floor-lamps", name: "Floor Lamps", slug: "floor-lamps", department: "home", group: "Lighting & Fans" },
  { id: "decorative-string-lights", name: "Decorative String Lights", slug: "decorative-string-lights", department: "home", group: "Lighting & Fans" },
  { id: "ceiling-standing-fans", name: "Ceiling & Standing Fans", slug: "ceiling-standing-fans", department: "home", group: "Lighting & Fans" },

  // Storage & Organization
  { id: "storage-organization", name: "Storage & Organization 📦", slug: "storage-organization", department: "home", group: "Storage & Organization" },
  { id: "storage-boxes-bins", name: "Storage Boxes & Bins", slug: "storage-boxes-bins", department: "home", group: "Storage & Organization" },
  { id: "shoe-racks-organizers", name: "Shoe Racks & Organizers", slug: "shoe-racks-organizers", department: "home", group: "Storage & Organization" },
  { id: "laundry-baskets-hampers", name: "Laundry Baskets & Hampers", slug: "laundry-baskets-hampers", department: "home", group: "Storage & Organization" },
  { id: "shelves-wall-racks", name: "Shelves & Wall Racks", slug: "shelves-wall-racks", department: "home", group: "Storage & Organization" },

  // Housekeeping & Cleaning
  { id: "housekeeping-cleaning", name: "Housekeeping & Cleaning 🧹", slug: "housekeeping-cleaning", department: "home", group: "Housekeeping & Cleaning" },
  { id: "cleaning-supplies-tools", name: "Cleaning Supplies & Tools", slug: "cleaning-supplies-tools", department: "home", group: "Housekeeping & Cleaning" },
  { id: "trash-cans-liners", name: "Trash Cans & Liners", slug: "trash-cans-liners", department: "home", group: "Housekeeping & Cleaning" },
  { id: "ironing-garment-care", name: "Ironing & Garment Care", slug: "ironing-garment-care", department: "home", group: "Housekeeping & Cleaning" },
  { id: "air-fresheners", name: "Air Fresheners", slug: "air-fresheners", department: "home", group: "Housekeeping & Cleaning" },

  // Garden & Outdoor Living
  { id: "garden-outdoor-living", name: "Garden & Outdoor Living 🏡", slug: "garden-outdoor-living", department: "home", group: "Garden & Outdoor Living" },
  { id: "outdoor-furniture", name: "Outdoor Furniture", slug: "outdoor-furniture", department: "home", group: "Garden & Outdoor Living" },
  { id: "garden-tools-plants", name: "Garden Tools & Plants", slug: "garden-tools-plants", department: "home", group: "Garden & Outdoor Living" },
  { id: "outdoor-lighting-decor", name: "Outdoor Lighting & Decor", slug: "outdoor-lighting-decor", department: "home", group: "Garden & Outdoor Living" },
  { id: "bbq-grilling", name: "BBQ & Grilling", slug: "bbq-grilling", department: "home", group: "Garden & Outdoor Living" },
];

export const PRESET_CATEGORIES_BY_DEPARTMENT: Record<string, CategoryItem[]> = {
  fashion: PRESET_FASHION_CATEGORIES,
  gadgets: PRESET_GADGETS_CATEGORIES,
  art: PRESET_ART_CATEGORIES,
  other: PRESET_OTHER_CATEGORIES,
  home: PRESET_HOME_CATEGORIES,
};
