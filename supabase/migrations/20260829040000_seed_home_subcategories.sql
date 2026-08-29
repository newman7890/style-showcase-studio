-- Seed comprehensive Home & Living department categories and subcategories

INSERT INTO public.categories (name, slug, department, is_active, display_order)
VALUES
  -- Kitchen & Dining
  ('Kitchen & Dining', 'kitchen-dining', 'home', true, 10),
  ('Cookware & Bakeware', 'cookware-bakeware', 'home', true, 11),
  ('Kitchen Appliances', 'kitchen-appliances', 'home', true, 12),
  ('Dinnerware & Tableware', 'dinnerware-tableware', 'home', true, 13),
  ('Cutlery & Knives', 'cutlery-knives', 'home', true, 14),
  ('Drinkware & Glassware', 'drinkware-glassware', 'home', true, 15),
  ('Kitchen Storage & Containers', 'kitchen-storage-containers', 'home', true, 16),
  ('Kitchen Tools & Utensils', 'kitchen-tools-utensils', 'home', true, 17),

  -- Bedroom & Bedding
  ('Bedroom & Bedding', 'bedroom-bedding', 'home', true, 20),
  ('Bed Sheets & Pillowcases', 'bed-sheets-pillowcases', 'home', true, 21),
  ('Duvets & Comforters', 'duvets-comforters', 'home', true, 22),
  ('Pillows & Cushions', 'pillows-cushions', 'home', true, 23),
  ('Mattresses & Toppers', 'mattresses-toppers', 'home', true, 24),
  ('Blankets & Throws', 'blankets-throws', 'home', true, 25),
  ('Wardrobes & Closets', 'wardrobes-closets', 'home', true, 26),

  -- Living Room
  ('Living Room', 'living-room', 'home', true, 30),
  ('Sofas & Couches', 'sofas-couches', 'home', true, 31),
  ('Coffee & Side Tables', 'coffee-side-tables', 'home', true, 32),
  ('TV Stands & Media Units', 'tv-stands-media-units', 'home', true, 33),
  ('Chairs & Recliners', 'chairs-recliners', 'home', true, 34),
  ('Living Room Decor', 'living-room-decor', 'home', true, 35),

  -- Bathroom
  ('Bathroom', 'bathroom', 'home', true, 40),
  ('Towels & Washcloths', 'towels-washcloths', 'home', true, 41),
  ('Bath Mats & Rugs', 'bath-mats-rugs', 'home', true, 42),
  ('Bathroom Accessories', 'bathroom-accessories', 'home', true, 43),
  ('Shower Curtains', 'shower-curtains', 'home', true, 44),
  ('Bathroom Storage & Mirrors', 'bathroom-storage-mirrors', 'home', true, 45),

  -- Home Decor & Accents
  ('Home Decor & Accents', 'home-decor', 'home', true, 50),
  ('Wall Clocks & Mirrors', 'wall-clocks-mirrors', 'home', true, 51),
  ('Vases & Artificial Plants', 'vases-artificial-plants', 'home', true, 52),
  ('Candles & Diffusers', 'candles-diffusers', 'home', true, 53),
  ('Rugs & Carpets', 'rugs-carpets', 'home', true, 54),
  ('Curtains & Blinds', 'curtains-blinds', 'home', true, 55),
  ('Picture Frames', 'picture-frames', 'home', true, 56),

  -- Lighting & Fans
  ('Lighting & Fans', 'lighting-fans', 'home', true, 60),
  ('Ceiling Lights & Chandeliers', 'ceiling-lights-chandeliers', 'home', true, 61),
  ('Table & Desk Lamps', 'table-desk-lamps', 'home', true, 62),
  ('Floor Lamps', 'floor-lamps', 'home', true, 63),
  ('Decorative String Lights', 'decorative-string-lights', 'home', true, 64),
  ('Ceiling & Standing Fans', 'ceiling-standing-fans', 'home', true, 65),

  -- Storage & Organization
  ('Storage & Organization', 'storage-organization', 'home', true, 70),
  ('Storage Boxes & Bins', 'storage-boxes-bins', 'home', true, 71),
  ('Shoe Racks & Organizers', 'shoe-racks-organizers', 'home', true, 72),
  ('Laundry Baskets & Hampers', 'laundry-baskets-hampers', 'home', true, 73),
  ('Shelves & Wall Racks', 'shelves-wall-racks', 'home', true, 74),

  -- Housekeeping & Cleaning
  ('Housekeeping & Cleaning', 'housekeeping-cleaning', 'home', true, 80),
  ('Cleaning Supplies & Tools', 'cleaning-supplies-tools', 'home', true, 81),
  ('Trash Cans & Liners', 'trash-cans-liners', 'home', true, 82),
  ('Ironing & Garment Care', 'ironing-garment-care', 'home', true, 83),
  ('Air Fresheners', 'air-fresheners', 'home', true, 84),

  -- Garden & Outdoor Living
  ('Garden & Outdoor Living', 'garden-outdoor-living', 'home', true, 90),
  ('Outdoor Furniture', 'outdoor-furniture', 'home', true, 91),
  ('Garden Tools & Plants', 'garden-tools-plants', 'home', true, 92),
  ('Outdoor Lighting & Decor', 'outdoor-lighting-decor', 'home', true, 93),
  ('BBQ & Grilling', 'bbq-grilling', 'home', true, 94)

ON CONFLICT (slug) DO UPDATE
SET name = EXCLUDED.name,
    department = EXCLUDED.department,
    is_active = EXCLUDED.is_active;
