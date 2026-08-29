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

export const PRESET_CATEGORIES_BY_DEPARTMENT: Record<string, CategoryItem[]> = {
  fashion: PRESET_FASHION_CATEGORIES,
  gadgets: PRESET_GADGETS_CATEGORIES,
};
