export interface Product {
  id: string;
  name: string;
  price: number;
  category: string;
  colors: string[];
  sizes: string[];
  image: string;
  description: string;
}

export const products: Product[] = [
  {
    id: "1",
    name: "2IWN reversible angora cardigan",
    price: 120,
    category: "apparel",
    colors: ["#000000", "#E5E5E5", "#D4B5A0"],
    sizes: ["XS", "S", "M", "L", "XL"],
    image: "https://images.unsplash.com/photo-1591047139829-d91aecb6caea?w=800",
    description: "Premium reversible angora cardigan with modern design"
  },
  {
    id: "2",
    name: "Oblong Bag",
    price: 120,
    category: "bag",
    colors: ["#000000", "#E5E5E5", "#D4B5A0"],
    sizes: ["One Size"],
    image: "https://images.unsplash.com/photo-1548036328-c9fa89d128fa?w=800",
    description: "Elegant oblong bag for everyday style"
  },
  {
    id: "3",
    name: "Classic White Tee",
    price: 45,
    category: "tshirt",
    colors: ["#FFFFFF", "#000000", "#808080"],
    sizes: ["XS", "S", "M", "L", "XL"],
    image: "https://images.unsplash.com/photo-1521572163474-6864f9cf17ab?w=800",
    description: "Essential white tee with perfect fit"
  },
  {
    id: "4",
    name: "Flowing Maxi Dress",
    price: 180,
    category: "dress",
    colors: ["#000000", "#FFFFFF", "#D4B5A0"],
    sizes: ["XS", "S", "M", "L", "XL"],
    image: "https://images.unsplash.com/photo-1595777457583-95e059d581b8?w=800",
    description: "Elegant flowing maxi dress for any occasion"
  },
  {
    id: "5",
    name: "Minimalist Shoulder Bag",
    price: 95,
    category: "bag",
    colors: ["#000000", "#8B4513", "#D4B5A0"],
    sizes: ["One Size"],
    image: "https://images.unsplash.com/photo-1590874103328-eac38a683ce7?w=800",
    description: "Sleek shoulder bag with minimalist design"
  },
  {
    id: "6",
    name: "Oversized Knit Sweater",
    price: 135,
    category: "apparel",
    colors: ["#F5F5DC", "#808080", "#000000"],
    sizes: ["S", "M", "L", "XL"],
    image: "https://images.unsplash.com/photo-1576566588028-4147f3842f27?w=800",
    description: "Cozy oversized knit for chilly days"
  }
];
