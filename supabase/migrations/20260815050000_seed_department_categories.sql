-- Seed default categories for each department
-- Only inserts if no categories exist for that department yet

-- ===== HOME & LIVING =====
INSERT INTO categories (name, slug, department, is_active, display_order)
SELECT name, slug, department, is_active, display_order
FROM (VALUES
  ('Kitchen & Dining', 'kitchen-dining', 'home', true, 1),
  ('Bedroom & Bedding', 'bedroom-bedding', 'home', true, 2),
  ('Living Room', 'living-room', 'home', true, 3),
  ('Bathroom', 'bathroom', 'home', true, 4),
  ('Home Decor', 'home-decor', 'home', true, 5),
  ('Storage & Organization', 'storage-organization', 'home', true, 6)
) AS v(name, slug, department, is_active, display_order)
WHERE NOT EXISTS (
  SELECT 1 FROM categories WHERE categories.department = 'home'
);

-- ===== FASHION =====
INSERT INTO categories (name, slug, department, is_active, display_order)
SELECT name, slug, department, is_active, display_order
FROM (VALUES
  ('Men''s Clothing', 'mens-clothing', 'fashion', true, 1),
  ('Women''s Clothing', 'womens-clothing', 'fashion', true, 2),
  ('Shoes & Sneakers', 'shoes-sneakers', 'fashion', true, 3),
  ('Bags & Accessories', 'bags-accessories', 'fashion', true, 4),
  ('Watches & Jewelry', 'watches-jewelry', 'fashion', true, 5)
) AS v(name, slug, department, is_active, display_order)
WHERE NOT EXISTS (
  SELECT 1 FROM categories WHERE categories.department = 'fashion'
);

-- ===== GADGETS =====
INSERT INTO categories (name, slug, department, is_active, display_order)
SELECT name, slug, department, is_active, display_order
FROM (VALUES
  ('Phones & Tablets', 'phones-tablets', 'gadgets', true, 1),
  ('Audio & Headphones', 'audio-headphones', 'gadgets', true, 2),
  ('Wearables', 'wearables', 'gadgets', true, 3),
  ('Accessories', 'gadget-accessories', 'gadgets', true, 4),
  ('Smart Home', 'smart-home', 'gadgets', true, 5)
) AS v(name, slug, department, is_active, display_order)
WHERE NOT EXISTS (
  SELECT 1 FROM categories WHERE categories.department = 'gadgets'
);

-- ===== ART & COLLECTIBLES =====
INSERT INTO categories (name, slug, department, is_active, display_order)
SELECT name, slug, department, is_active, display_order
FROM (VALUES
  ('Paintings', 'paintings', 'art', true, 1),
  ('Digital Art', 'digital-art', 'art', true, 2),
  ('Sculptures', 'sculptures', 'art', true, 3),
  ('Photography', 'photography', 'art', true, 4),
  ('Handcrafts', 'handcrafts', 'art', true, 5)
) AS v(name, slug, department, is_active, display_order)
WHERE NOT EXISTS (
  SELECT 1 FROM categories WHERE categories.department = 'art'
);

-- ===== OTHER =====
INSERT INTO categories (name, slug, department, is_active, display_order)
SELECT name, slug, department, is_active, display_order
FROM (VALUES
  ('Books & Stationery', 'books-stationery', 'other', true, 1),
  ('Sports & Outdoors', 'sports-outdoors', 'other', true, 2),
  ('Toys & Games', 'toys-games', 'other', true, 3),
  ('Health & Beauty', 'health-beauty', 'other', true, 4),
  ('Groceries', 'groceries', 'other', true, 5)
) AS v(name, slug, department, is_active, display_order)
WHERE NOT EXISTS (
  SELECT 1 FROM categories WHERE categories.department = 'other'
);
