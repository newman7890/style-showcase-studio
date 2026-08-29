-- Seed comprehensive Gadgets categories and subcategories

INSERT INTO public.categories (name, slug, department, is_active, display_order)
VALUES
  -- Smartphones & Tablets
  ('Smartphones', 'smartphones', 'gadgets', true, 10),
  ('Tablets', 'tablets', 'gadgets', true, 11),

  -- Wearables
  ('Wearables', 'wearables', 'gadgets', true, 20),
  ('Smartwatches', 'smartwatches', 'gadgets', true, 21),
  ('Fitness Trackers', 'fitness-trackers', 'gadgets', true, 22),
  ('Smart Rings', 'smart-rings', 'gadgets', true, 23),
  ('Smart Glasses', 'smart-glasses', 'gadgets', true, 24),

  -- Audio
  ('Audio', 'audio-headphones', 'gadgets', true, 30),
  ('Earbuds & Earphones', 'earbuds-earphones', 'gadgets', true, 31),
  ('Headphones', 'headphones', 'gadgets', true, 32),
  ('Bluetooth Speakers', 'bluetooth-speakers', 'gadgets', true, 33),
  ('Wireless Microphones', 'wireless-microphones', 'gadgets', true, 34),

  -- Power & Charging
  ('Power Banks', 'power-banks', 'gadgets', true, 40),
  ('Chargers & Adapters', 'chargers-adapters', 'gadgets', true, 41),
  ('Wireless Chargers', 'wireless-chargers', 'gadgets', true, 42),
  ('USB & Data Cables', 'usb-cables-data-cables', 'gadgets', true, 43),

  -- Phone Accessories
  ('Phone Accessories', 'gadget-accessories', 'gadgets', true, 50),
  ('Phone Cases', 'phone-cases', 'gadgets', true, 51),
  ('Screen Protectors', 'screen-protectors', 'gadgets', true, 52),
  ('Phone Stands & Holders', 'phone-stands-holders', 'gadgets', true, 53),
  ('Selfie Sticks & Tripods', 'selfie-sticks-tripods', 'gadgets', true, 54),
  ('Phone Coolers', 'phone-coolers', 'gadgets', true, 55),

  -- Cameras & Photography
  ('Cameras & Photography', 'cameras-photography', 'gadgets', true, 60),
  ('Drones & RC', 'drones', 'gadgets', true, 61),
  ('Action Cameras', 'action-cameras', 'gadgets', true, 62),
  ('Digital Cameras', 'digital-cameras', 'gadgets', true, 63),
  ('Camera Accessories', 'camera-accessories', 'gadgets', true, 64),

  -- Gaming & VR
  ('Gaming Gadgets', 'gaming-gadgets', 'gadgets', true, 70),
  ('VR Headsets', 'vr-headsets', 'gadgets', true, 71),

  -- Smart Home & Lighting
  ('Smart Home Devices', 'smart-home', 'gadgets', true, 80),
  ('LED & Smart Lights', 'led-smart-lights', 'gadgets', true, 81),
  ('Projectors', 'projectors', 'gadgets', true, 82),
  ('TV Boxes & Streaming Devices', 'tv-boxes-streaming', 'gadgets', true, 83),

  -- Computer Accessories
  ('Computer Accessories', 'computer-accessories', 'gadgets', true, 90),
  ('USB Hubs & Adapters', 'usb-hubs-adapters', 'gadgets', true, 91),

  -- Storage & Memory
  ('Memory Cards & Flash Drives', 'memory-cards-flash-drives', 'gadgets', true, 100),

  -- Car Gadgets & Tracking
  ('Car Gadgets', 'car-gadgets', 'gadgets', true, 110),
  ('GPS & Tracking Devices', 'gps-tracking-devices', 'gadgets', true, 111),

  -- Other Gadgets
  ('Other Gadgets', 'other-gadgets', 'gadgets', true, 120)

ON CONFLICT (slug) DO UPDATE
SET name = EXCLUDED.name,
    department = EXCLUDED.department,
    is_active = EXCLUDED.is_active;
