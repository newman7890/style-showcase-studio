-- Migration: Import seed data from old database for categories, delivery_fees, and marketing_banners

-- 1. Import Categories
INSERT INTO public.categories (id, name, slug, image, display_order, is_active, created_at, updated_at, department)
VALUES
  ('9f2270ad-1647-4dcf-8c63-f17456c8f380', 'T-Shirts', 't-shirts', 'https://images.unsplash.com/photo-1521572163474-6864f9cf17ab?w=400&h=400&fit=crop', 1, true, '2026-08-17T14:16:44.414807+00:00', '2026-08-17T14:16:44.414807+00:00', 'fashion'),
  ('e6322571-9f0c-495a-b143-d9e9a07a5916', 'Jeans', 'jeans', 'https://images.unsplash.com/photo-1542272604-787c3835535d?w=400&h=400&fit=crop', 2, true, '2026-08-17T14:16:44.414807+00:00', '2026-08-17T14:16:44.414807+00:00', 'fashion'),
  ('6070b4c6-03bf-4130-bd5c-1d6d866b2482', 'Jackets', 'jackets', 'https://images.unsplash.com/photo-1551028719-00167b16eac5?w=400&h=400&fit=crop', 3, true, '2026-08-17T14:16:44.414807+00:00', '2026-08-17T14:16:44.414807+00:00', 'fashion'),
  ('d87205aa-39a4-4eaa-a882-b584e16df7d9', 'Shoes', 'shoes', 'https://images.unsplash.com/photo-1549298916-b41d501d3772?w=400&h=400&fit=crop', 4, true, '2026-08-17T14:16:44.414807+00:00', '2026-08-17T14:16:44.414807+00:00', 'fashion'),
  ('12afe400-15ff-4534-b9a7-38bed0c1b1bb', 'Kitchen & Dining', 'kitchen-dining', NULL, 1, true, '2026-08-17T14:22:46.462975+00:00', '2026-08-17T14:22:46.462975+00:00', 'home'),
  ('d22e1d3e-3e56-4628-8881-617067f83522', 'Bedroom & Bedding', 'bedroom-bedding', NULL, 2, true, '2026-08-17T14:22:46.462975+00:00', '2026-08-17T14:22:46.462975+00:00', 'home'),
  ('1939027b-ade6-49ed-928d-86e384707137', 'Living Room', 'living-room', NULL, 3, true, '2026-08-17T14:22:46.462975+00:00', '2026-08-17T14:22:46.462975+00:00', 'home'),
  ('ebb108a0-be8a-4dfc-abc2-2c3d7560b1bb', 'Bathroom', 'bathroom', NULL, 4, true, '2026-08-17T14:22:46.462975+00:00', '2026-08-17T14:22:46.462975+00:00', 'home'),
  ('bba34898-eeb9-4ac0-a712-8976a5984aa9', 'Home Decor', 'home-decor', NULL, 5, true, '2026-08-17T14:22:46.462975+00:00', '2026-08-17T14:22:46.462975+00:00', 'home'),
  ('50587806-dbb7-47c8-8fde-0947ab1e79fa', 'Storage & Organization', 'storage-organization', NULL, 6, true, '2026-08-17T14:22:46.462975+00:00', '2026-08-17T14:22:46.462975+00:00', 'home'),
  ('d7497cc7-aabe-4482-9b1d-52e41526170c', 'Phones & Tablets', 'phones-tablets', NULL, 1, true, '2026-08-17T14:22:46.462975+00:00', '2026-08-17T14:22:46.462975+00:00', 'gadgets'),
  ('9243b74a-12a4-4e86-b73d-707ce9526338', 'Audio & Headphones', 'audio-headphones', NULL, 2, true, '2026-08-17T14:22:46.462975+00:00', '2026-08-17T14:22:46.462975+00:00', 'gadgets'),
  ('cee3e7b6-0085-48c7-a859-61089bf5cc22', 'Wearables', 'wearables', NULL, 3, true, '2026-08-17T14:22:46.462975+00:00', '2026-08-17T14:22:46.462975+00:00', 'gadgets'),
  ('6282f41d-2ecf-4339-93c2-9da9058090b6', 'Accessories', 'gadget-accessories', NULL, 4, true, '2026-08-17T14:22:46.462975+00:00', '2026-08-17T14:22:46.462975+00:00', 'gadgets'),
  ('59cff4fc-f2e2-46d8-94f4-764f7bcc7b62', 'Smart Home', 'smart-home', NULL, 5, true, '2026-08-17T14:22:46.462975+00:00', '2026-08-17T14:22:46.462975+00:00', 'gadgets'),
  ('18585d21-c2d8-45c0-97d9-d632dd7f4bb2', 'Paintings', 'paintings', NULL, 1, true, '2026-08-17T14:22:46.462975+00:00', '2026-08-17T14:22:46.462975+00:00', 'art'),
  ('e7732b77-836d-44bc-b7b2-8a778e891d9f', 'Digital Art', 'digital-art', NULL, 2, true, '2026-08-17T14:22:46.462975+00:00', '2026-08-17T14:22:46.462975+00:00', 'art'),
  ('9e72e7f1-382d-4b57-9c64-ab8987e3f6ff', 'Sculptures', 'sculptures', NULL, 3, true, '2026-08-17T14:22:46.462975+00:00', '2026-08-17T14:22:46.462975+00:00', 'art'),
  ('7d7c2b64-5c77-4105-9616-f7f560b7a98d', 'Photography', 'photography', NULL, 4, true, '2026-08-17T14:22:46.462975+00:00', '2026-08-17T14:22:46.462975+00:00', 'art'),
  ('65a7c00c-0d85-40e1-9e28-1da99a6155ac', 'Handcrafts', 'handcrafts', NULL, 5, true, '2026-08-17T14:22:46.462975+00:00', '2026-08-17T14:22:46.462975+00:00', 'art'),
  ('f0c0434b-6add-4835-b0c7-f5214719eabb', 'Books & Stationery', 'books-stationery', NULL, 1, true, '2026-08-17T14:22:46.462975+00:00', '2026-08-17T14:22:46.462975+00:00', 'other'),
  ('97345dbf-eb43-43d4-949d-c0389f6d6d30', 'Sports & Outdoors', 'sports-outdoors', NULL, 2, true, '2026-08-17T14:22:46.462975+00:00', '2026-08-17T14:22:46.462975+00:00', 'other'),
  ('bc759c6f-ecfd-4560-a92e-89a5018cd7fd', 'Toys & Games', 'toys-games', NULL, 3, true, '2026-08-17T14:22:46.462975+00:00', '2026-08-17T14:22:46.462975+00:00', 'other'),
  ('879a7270-276e-45a6-9fca-2347095ea262', 'Health & Beauty', 'health-beauty', NULL, 4, true, '2026-08-17T14:22:46.462975+00:00', '2026-08-17T14:22:46.462975+00:00', 'other'),
  ('353b7c4b-bea0-4cb3-a33d-e2306fd3d5fb', 'Groceries', 'groceries', NULL, 5, true, '2026-08-17T14:22:46.462975+00:00', '2026-08-17T14:22:46.462975+00:00', 'other')
ON CONFLICT (slug) DO UPDATE SET
  name = EXCLUDED.name,
  image = EXCLUDED.image,
  display_order = EXCLUDED.display_order,
  is_active = EXCLUDED.is_active,
  department = EXCLUDED.department;

-- 2. Import Delivery Fees
INSERT INTO public.delivery_fees (id, region, city, fee, is_active, created_at, updated_at, is_default)
VALUES
  ('a43abe7c-d0ee-4ef7-b2d3-bf2413476bda', 'Greater Accra', NULL, 30, true, '2026-08-17T14:20:56.222516+00:00', '2026-08-17T14:20:56.222516+00:00', false),
  ('29f6994f-87f9-44ae-8fa1-1838b6ab354b', 'Ashanti', NULL, 50, true, '2026-08-17T14:20:56.222516+00:00', '2026-08-17T14:20:56.222516+00:00', false),
  ('25add9bc-ab62-4ffc-8bb1-9b5c722d1934', 'Western', NULL, 60, true, '2026-08-17T14:20:56.222516+00:00', '2026-08-17T14:20:56.222516+00:00', false),
  ('c17a8c3b-031e-4e36-b4ea-862a9c12259f', 'Central', NULL, 50, true, '2026-08-17T14:20:56.222516+00:00', '2026-08-17T14:20:56.222516+00:00', false),
  ('4e6a9f88-eff7-4ab9-ac19-f6fceda5610f', 'Eastern', NULL, 50, true, '2026-08-17T14:20:56.222516+00:00', '2026-08-17T14:20:56.222516+00:00', false),
  ('b448d3cb-726c-425b-8793-52791dfe45c4', 'Volta', NULL, 70, true, '2026-08-17T14:20:56.222516+00:00', '2026-08-17T14:20:56.222516+00:00', false),
  ('14000c4d-4930-4b94-b944-6bf06a8a0b5e', 'Northern', NULL, 100, true, '2026-08-17T14:20:56.222516+00:00', '2026-08-17T14:20:56.222516+00:00', false),
  ('36a0fbaa-f8d7-4eee-b1bc-4052c7f8cfda', 'Upper East', NULL, 120, true, '2026-08-17T14:20:56.222516+00:00', '2026-08-17T14:20:56.222516+00:00', false),
  ('37c7f3c7-bd28-40a7-8dd8-cd53860b7ee6', 'Upper West', NULL, 120, true, '2026-08-17T14:20:56.222516+00:00', '2026-08-17T14:20:56.222516+00:00', false),
  ('916a9b66-31fc-404f-af7a-5d4dfad58be2', 'Bono', NULL, 80, true, '2026-08-17T14:20:56.222516+00:00', '2026-08-17T14:20:56.222516+00:00', false),
  ('93e10cf5-8be0-436f-a9c6-8527d1dab0fc', 'Bono East', NULL, 80, true, '2026-08-17T14:20:56.222516+00:00', '2026-08-17T14:20:56.222516+00:00', false),
  ('8f3ce373-81c2-46ad-98db-e79f4b24f873', 'Ahafo', NULL, 80, true, '2026-08-17T14:20:56.222516+00:00', '2026-08-17T14:20:56.222516+00:00', false),
  ('174b6855-622f-4080-9e8f-b14188ecd5d2', 'Oti', NULL, 90, true, '2026-08-17T14:20:56.222516+00:00', '2026-08-17T14:20:56.222516+00:00', false),
  ('3462d010-ffa6-49ed-a641-5a0c0d57b762', 'Savannah', NULL, 100, true, '2026-08-17T14:20:56.222516+00:00', '2026-08-17T14:20:56.222516+00:00', false),
  ('616ab0e5-f013-46cd-80a3-e93ec9cb79e7', 'North East', NULL, 110, true, '2026-08-17T14:20:56.222516+00:00', '2026-08-17T14:20:56.222516+00:00', false),
  ('e91a94af-0423-4fae-be9f-533d36b9d9b4', 'Western North', NULL, 70, true, '2026-08-17T14:20:56.222516+00:00', '2026-08-17T14:20:56.222516+00:00', false),
  ('0f9b974e-66f2-4f8c-a6d9-05179f5a1bb8', 'Default', NULL, 50, true, '2026-08-17T14:20:59.646772+00:00', '2026-08-17T14:20:59.646772+00:00', true)
ON CONFLICT (region) DO UPDATE SET
  fee = EXCLUDED.fee,
  is_active = EXCLUDED.is_active,
  is_default = EXCLUDED.is_default;

-- 3. Import Marketing Banners
INSERT INTO public.marketing_banners (id, title, badge, label, image_url, link_url, is_active, display_order, created_at, updated_at, placement, click_count)
VALUES
  ('b0d6fa61-d084-40db-baeb-b222b5e2f131', 'Nike', '', '', 'https://wnfmcdncbbfcyfoewewd.supabase.co/storage/v1/object/public/product-images/marketing/1787006505001-bdbxmapn01f.jpg', '/department/home', true, 0, '2026-08-17T22:41:45.79726+00:00', '2026-08-17T22:41:45.79726+00:00', 'hero_carousel', 0)
ON CONFLICT (id) DO UPDATE SET
  title = EXCLUDED.title,
  image_url = EXCLUDED.image_url,
  link_url = EXCLUDED.link_url,
  is_active = EXCLUDED.is_active,
  placement = EXCLUDED.placement;
