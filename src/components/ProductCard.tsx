import { motion } from "framer-motion";
import { Heart } from "lucide-react";
import { Link } from "react-router-dom";

interface ProductCardProps {
  id: string;
  name: string;
  price: number;
  image: string;
}

export const ProductCard = ({ id, name, price, image }: ProductCardProps) => {
  return (
    <Link to={`/product/${id}`}>
      <motion.div
        whileHover={{ y: -4 }}
        transition={{ duration: 0.2 }}
        className="group cursor-pointer"
      >
        <div className="relative aspect-square bg-secondary rounded-2xl mb-3 overflow-hidden">
          <img
            src={image}
            alt={name}
            className="w-full h-full object-cover"
          />
          <button className="absolute top-4 right-4 w-8 h-8 bg-background rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
            <Heart className="w-4 h-4" />
          </button>
        </div>
        <h3 className="text-sm font-medium mb-1">{name}</h3>
        <p className="text-sm font-semibold">${price}</p>
      </motion.div>
    </Link>
  );
};
