import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  'https://rsxpoctivfhlacgmjawj.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJzeHBvY3RpdmZobGFjZ21qYXdqIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjM5MTY5OTYsImV4cCI6MjA3OTQ5Mjk5Nn0.AhffOdP6HWfCarUsM6c90AebO2YkbL1SqJUhC7bTi8w'
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
