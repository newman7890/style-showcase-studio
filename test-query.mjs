import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  'https://wnfmcdncbbfcyfoewewd.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InduZm1jZG5jYmJmY3lmb2V3ZXdkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODY5NjgxMDcsImV4cCI6MjEwMjU0NDEwN30.kKmq5_1ANxn7R7Xjfoqmk5mnRwFIULR6AOA_WqQ9GFE'
);

async function run() {
  // Let's just fetch ANY order_item with a product
  const { data: items, error } = await supabase
    .from('order_items')
    .select('*, products(name, image, seller_id)')
    .limit(1);
    
  console.log('Order Items:', JSON.stringify(items, null, 2));
  if (error) console.error('Error:', error);
  
  if (items && items.length > 0 && items[0].products) {
    const product = Array.isArray(items[0].products) ? items[0].products[0] : items[0].products;
    console.log('Product:', product);
    
    if (product.seller_id) {
      const { data: seller, error: sellerError } = await supabase
        .from('public_seller_info')
        .select('business_name, business_address, address, phone')
        .eq('id', product.seller_id)
        .single();
        
      console.log('Seller:', seller);
      if (sellerError) console.error('Seller Error:', sellerError);
    } else {
      console.log('NO SELLER ID ON PRODUCT');
    }
  }
}

run();
