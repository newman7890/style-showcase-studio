-- Seed comprehensive Other department categories and subcategories

INSERT INTO public.categories (name, slug, department, is_active, display_order)
VALUES
  -- Beauty & Personal Care
  ('Beauty & Personal Care', 'beauty-personal-care', 'other', true, 10),
  ('Skincare', 'skincare', 'other', true, 11),
  ('Hair Care', 'hair-care', 'other', true, 12),
  ('Fragrances & Perfumes', 'fragrances-perfumes', 'other', true, 13),
  ('Makeup & Cosmetics', 'makeup-cosmetics', 'other', true, 14),
  ('Grooming & Shaving', 'grooming-shaving', 'other', true, 15),

  -- Health & Wellness
  ('Health & Wellness', 'health-wellness', 'other', true, 20),
  ('Vitamins & Supplements', 'vitamins-supplements', 'other', true, 21),
  ('Fitness Accessories', 'fitness-accessories', 'other', true, 22),
  ('Personal Health', 'personal-health', 'other', true, 23),

  -- Books & Stationery
  ('Books & Stationery', 'books-stationery', 'other', true, 30),
  ('Books & Literature', 'books-literature', 'other', true, 31),
  ('Notebooks & Journals', 'notebooks-journals', 'other', true, 32),
  ('Office & School Supplies', 'office-school-supplies', 'other', true, 33),

  -- Toys, Games & Hobbies
  ('Toys, Games & Hobbies', 'toys-games-hobbies', 'other', true, 40),
  ('Board Games & Puzzles', 'board-games-puzzles', 'other', true, 41),
  ('Toys & Action Figures', 'toys-action-figures', 'other', true, 42),
  ('Musical Instruments', 'musical-instruments', 'other', true, 43),

  -- Automotive & Hardware
  ('Automotive & Hardware', 'automotive-hardware', 'other', true, 50),
  ('Car Care & Cleaners', 'car-care-cleaners', 'other', true, 51),
  ('Tools & Hardware', 'tools-hardware', 'other', true, 52),

  -- Pet Supplies
  ('Pet Supplies', 'pet-supplies', 'other', true, 60),
  ('Pet Food & Treats', 'pet-food-treats', 'other', true, 61),
  ('Pet Accessories', 'pet-accessories', 'other', true, 62),

  -- Groceries & Provisions
  ('Groceries & Provisions', 'groceries-provisions', 'other', true, 70),
  ('Snacks & Confectionery', 'snacks-confectionery', 'other', true, 71),
  ('Beverages & Drinks', 'beverages-drinks', 'other', true, 72),
  ('Specialty & Local Foods', 'specialty-local-foods', 'other', true, 73),

  -- General Miscellaneous
  ('General Miscellaneous', 'general-miscellaneous', 'other', true, 80)

ON CONFLICT (slug) DO UPDATE
SET name = EXCLUDED.name,
    department = EXCLUDED.department,
    is_active = EXCLUDED.is_active;
