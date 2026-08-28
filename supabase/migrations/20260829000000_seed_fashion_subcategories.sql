-- Seed comprehensive Fashion categories and subcategories

INSERT INTO public.categories (name, slug, department, is_active, display_order)
VALUES
  -- Clothing
  ('Clothing', 'clothing', 'fashion', true, 10),
  ('T-Shirts', 't-shirts', 'fashion', true, 11),
  ('Shirts', 'shirts', 'fashion', true, 12),
  ('Trousers', 'trousers', 'fashion', true, 13),
  ('Jeans', 'jeans', 'fashion', true, 14),
  ('Shorts', 'shorts', 'fashion', true, 15),
  ('Dresses', 'dresses', 'fashion', true, 16),
  ('Skirts', 'skirts', 'fashion', true, 17),
  ('Suits & Blazers', 'suits-blazers', 'fashion', true, 18),
  ('Jackets & Coats', 'jackets-coats', 'fashion', true, 19),
  ('Hoodies & Sweatshirts', 'hoodies-sweatshirts', 'fashion', true, 20),
  ('Jumpsuits', 'jumpsuits', 'fashion', true, 21),
  ('Traditional Wear', 'traditional-wear', 'fashion', true, 22),
  ('Sportswear', 'sportswear', 'fashion', true, 23),
  ('Underwear & Lingerie', 'underwear-lingerie', 'fashion', true, 24),
  ('Sleepwear', 'sleepwear', 'fashion', true, 25),

  -- Shoes
  ('Shoes', 'shoes', 'fashion', true, 30),
  ('Sneakers', 'sneakers', 'fashion', true, 31),
  ('Sandals', 'sandals', 'fashion', true, 32),
  ('Slippers', 'slippers', 'fashion', true, 33),
  ('Boots', 'boots', 'fashion', true, 34),
  ('Formal Shoes', 'formal-shoes', 'fashion', true, 35),
  ('Heels', 'heels', 'fashion', true, 36),
  ('Flats', 'flats', 'fashion', true, 37),
  ('Loafers', 'loafers', 'fashion', true, 38),
  ('Sports Shoes', 'sports-shoes', 'fashion', true, 39),

  -- Bags
  ('Bags', 'bags', 'fashion', true, 40),
  ('Handbags', 'handbags', 'fashion', true, 41),
  ('Backpacks', 'backpacks', 'fashion', true, 42),
  ('Shoulder Bags', 'shoulder-bags', 'fashion', true, 43),
  ('Crossbody Bags', 'crossbody-bags', 'fashion', true, 44),
  ('Laptop Bags', 'laptop-bags', 'fashion', true, 45),
  ('Travel Bags', 'travel-bags', 'fashion', true, 46),
  ('Wallets & Purses', 'wallets-purses', 'fashion', true, 47),

  -- Jewelry & Accessories
  ('Jewelry & Accessories', 'jewelry-accessories', 'fashion', true, 50),
  ('Necklaces', 'necklaces', 'fashion', true, 51),
  ('Earrings', 'earrings', 'fashion', true, 52),
  ('Rings', 'rings', 'fashion', true, 53),
  ('Bracelets', 'bracelets', 'fashion', true, 54),
  ('Watches', 'watches', 'fashion', true, 55),
  ('Sunglasses', 'sunglasses', 'fashion', true, 56),
  ('Belts', 'belts', 'fashion', true, 57),
  ('Hats & Caps', 'hats-caps', 'fashion', true, 58),
  ('Scarves', 'scarves', 'fashion', true, 59),
  ('Ties & Bow Ties', 'ties-bow-ties', 'fashion', true, 60),

  -- Women's Fashion
  ('Women''s Fashion', 'womens-fashion', 'fashion', true, 70),
  ('Women''s Dresses', 'womens-dresses', 'fashion', true, 71),
  ('Women''s Tops', 'womens-tops', 'fashion', true, 72),
  ('Women''s Bottoms', 'womens-bottoms', 'fashion', true, 73),
  ('Women''s Shoes', 'womens-shoes', 'fashion', true, 74),
  ('Women''s Bags', 'womens-bags', 'fashion', true, 75),
  ('Women''s Accessories', 'womens-accessories', 'fashion', true, 76),

  -- Men's Fashion
  ('Men''s Fashion', 'mens-fashion', 'fashion', true, 80),
  ('Men''s Shirts', 'mens-shirts', 'fashion', true, 81),
  ('Men''s Trousers', 'mens-trousers', 'fashion', true, 82),
  ('Men''s T-Shirts', 'mens-t-shirts', 'fashion', true, 83),
  ('Men''s Shoes', 'mens-shoes', 'fashion', true, 84),
  ('Men''s Suits', 'mens-suits', 'fashion', true, 85),
  ('Men''s Accessories', 'mens-accessories', 'fashion', true, 86),

  -- Kids' Fashion
  ('Kids'' Fashion', 'kids-fashion', 'fashion', true, 90),
  ('Boys'' Clothing', 'boys-clothing', 'fashion', true, 91),
  ('Girls'' Clothing', 'girls-clothing', 'fashion', true, 92),
  ('Baby Clothing', 'baby-clothing', 'fashion', true, 93),
  ('Kids'' Shoes', 'kids-shoes', 'fashion', true, 94),
  ('Kids'' Accessories', 'kids-accessories', 'fashion', true, 95),

  -- African / Traditional Fashion
  ('African / Traditional Fashion', 'african-traditional-fashion', 'fashion', true, 100),
  ('Kente', 'kente', 'fashion', true, 101),
  ('African Print', 'african-print', 'fashion', true, 102),
  ('Kaftans', 'kaftans', 'fashion', true, 103),
  ('Dashiki', 'dashiki', 'fashion', true, 104),
  ('Agbada', 'agbada', 'fashion', true, 105),
  ('Traditional Dresses', 'traditional-dresses', 'fashion', true, 106),
  ('Traditional Shirts', 'traditional-shirts', 'fashion', true, 107),
  ('Fabrics & Textiles', 'fabrics-textiles', 'fashion', true, 108)

ON CONFLICT (slug) DO UPDATE
SET name = EXCLUDED.name,
    department = EXCLUDED.department,
    is_active = EXCLUDED.is_active;
