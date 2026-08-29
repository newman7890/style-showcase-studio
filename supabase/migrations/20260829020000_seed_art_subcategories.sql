-- Seed comprehensive Art & Collectibles categories and subcategories

INSERT INTO public.categories (name, slug, department, is_active, display_order)
VALUES
  -- Paintings
  ('Paintings', 'paintings', 'art', true, 10),
  ('Acrylic Paintings', 'acrylic-paintings', 'art', true, 11),
  ('Oil Paintings', 'oil-paintings', 'art', true, 12),
  ('Watercolor Paintings', 'watercolor-paintings', 'art', true, 13),
  ('Canvas Paintings', 'canvas-paintings', 'art', true, 14),
  ('Abstract Art', 'abstract-art', 'art', true, 15),
  ('Portrait Paintings', 'portrait-paintings', 'art', true, 16),
  ('African Art Paintings', 'african-art-paintings', 'art', true, 17),

  -- Drawings & Sketches
  ('Drawings & Sketches', 'drawings-sketches', 'art', true, 20),
  ('Pencil Drawings', 'pencil-drawings', 'art', true, 21),
  ('Charcoal Drawings', 'charcoal-drawings', 'art', true, 22),
  ('Portrait Sketches', 'portrait-sketches', 'art', true, 23),
  ('Digital Drawings', 'digital-drawings', 'art', true, 24),

  -- Wall Art & Prints
  ('Wall Art & Prints', 'wall-art', 'art', true, 30),
  ('Art Prints', 'art-prints', 'art', true, 31),
  ('Posters', 'posters', 'art', true, 32),
  ('Canvas Prints', 'canvas-prints', 'art', true, 33),
  ('Metal Prints', 'metal-prints', 'art', true, 34),
  ('Wall Murals', 'wall-murals', 'art', true, 35),

  -- Sculptures & Carvings
  ('Sculptures & Carvings', 'sculptures', 'art', true, 40),
  ('Wood Sculptures', 'wood-sculptures', 'art', true, 41),
  ('Metal Sculptures', 'metal-sculptures', 'art', true, 42),
  ('Stone Sculptures', 'stone-sculptures', 'art', true, 43),
  ('Clay Sculptures', 'clay-sculptures', 'art', true, 44),
  ('African Sculptures', 'african-sculptures', 'art', true, 45),
  ('Wood Carvings', 'wood-carvings', 'art', true, 46),

  -- African Art & Crafts
  ('African Art & Crafts', 'african-art-crafts', 'art', true, 50),
  ('Adinkra Art', 'adinkra-art', 'art', true, 51),
  ('African Masks', 'african-masks', 'art', true, 52),
  ('Bead Art', 'bead-art', 'art', true, 53),
  ('Traditional Crafts', 'handcrafts', 'art', true, 54),
  ('Cultural Art', 'cultural-art', 'art', true, 55),

  -- Pottery & Ceramics
  ('Pottery & Ceramics', 'pottery-ceramics', 'art', true, 60),
  ('Ceramic Art', 'ceramic-art', 'art', true, 61),
  ('Pottery', 'pottery', 'art', true, 62),
  ('Clay Art', 'clay-art', 'art', true, 63),
  ('Decorative Vases', 'decorative-vases', 'art', true, 64),

  -- Photography
  ('Photography', 'photography', 'art', true, 70),
  ('Fine Art Photography', 'fine-art-photography', 'art', true, 71),
  ('Nature Photography', 'nature-photography', 'art', true, 72),
  ('African Photography', 'african-photography', 'art', true, 73),
  ('Photography Prints', 'photography-prints', 'art', true, 74),

  -- Textile Art
  ('Textile Art', 'textile-art', 'art', true, 80),
  ('Kente Art', 'kente-art', 'art', true, 81),
  ('Batik Art', 'batik-art', 'art', true, 82),
  ('Fabric Art', 'fabric-art', 'art', true, 83),
  ('Woven Art', 'woven-art', 'art', true, 84),

  -- Handmade & Decorative Art
  ('Handmade & Decorative Art', 'handmade-decorative-art', 'art', true, 90),
  ('Resin Art', 'resin-art', 'art', true, 91),
  ('Handmade Décor', 'handmade-decor', 'art', true, 92),
  ('Paper Art', 'paper-art', 'art', true, 93),
  ('Glass Art', 'glass-art', 'art', true, 94),
  ('Wood Art', 'wood-art', 'art', true, 95),

  -- Art Supplies
  ('Art Supplies', 'art-supplies', 'art', true, 100),
  ('Paints', 'paints', 'art', true, 101),
  ('Brushes', 'brushes', 'art', true, 102),
  ('Canvases', 'canvases', 'art', true, 103),
  ('Drawing Pencils', 'drawing-pencils', 'art', true, 104),
  ('Easels', 'easels', 'art', true, 105),
  ('Sketchbooks', 'sketchbooks', 'art', true, 106),
  ('Palettes', 'palettes', 'art', true, 107),

  -- Awards & Trophies
  ('Awards & Trophies', 'awards-trophies', 'art', true, 110),
  ('Trophies', 'trophies', 'art', true, 111),
  ('Medals', 'medals', 'art', true, 112),
  ('Plaques', 'plaques', 'art', true, 113),
  ('Awards', 'awards', 'art', true, 114)

ON CONFLICT (slug) DO UPDATE
SET name = EXCLUDED.name,
    department = EXCLUDED.department,
    is_active = EXCLUDED.is_active;
