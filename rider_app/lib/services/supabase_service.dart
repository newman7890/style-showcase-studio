import 'package:supabase_flutter/supabase_flutter.dart';

class SupabaseService {
  static const String supabaseUrl = 'https://wnfmcdncbbfcyfoewewd.supabase.co';
  static const String supabaseAnonKey =
      'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InduZm1jZG5jYmJmY3lmb2V3ZXdkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODY5NjgxMDcsImV4cCI6MjEwMjU0NDEwN30.kKmq5_1ANxn7R7Xjfoqmk5mnRwFIULR6AOA_WqQ9GFE';

  static SupabaseClient get client => Supabase.instance.client;

  static Future<void> initialize() async {
    await Supabase.initialize(
      url: supabaseUrl,
      publishableKey: supabaseAnonKey,
    );
  }

  // Auth helpers
  static User? get currentUser => client.auth.currentUser;
  static Stream<AuthState> get authStateChanges => client.auth.onAuthStateChange;

  static Future<AuthResponse> signIn(String email, String password) {
    return client.auth.signInWithPassword(email: email, password: password);
  }

  static Future<void> signOut() {
    return client.auth.signOut();
  }

  // Sign up a new rider account with access code
  static Future<AuthResponse> signUpRider({
    required String email,
    required String password,
    required String fullName,
    required String phoneNumber,
    required String vehicleType,
    required String accessCode,
  }) {
    return client.auth.signUp(
      email: email,
      password: password,
      data: {
        'full_name': fullName,
        'phone_number': phoneNumber,
        'vehicle_type': vehicleType,
        'access_code': accessCode.trim().toUpperCase(),
      },
    );
  }

  // Verify rider access code via RPC (server-side, no table read)
  static Future<bool> verifyRiderAccessCode(String code) async {
    try {
      final result = await client.rpc('verify_rider_access_code', params: {'_code': code});
      return result == true;
    } catch (e) {
      return false;
    }
  }

  // Mark access code as used via RPC
  static Future<void> consumeRiderAccessCode(String code) async {
    await client.rpc('consume_rider_access_code', params: {'_code': code});
  }

  // Assign rider role in user_roles
  static Future<void> assignRiderRole(String userId) async {
    try {
      await client.from('user_roles').insert({
        'user_id': userId,
        'role': 'rider',
      });
    } catch (e) {
      // Ignore duplicate key errors
      if (!e.toString().contains('duplicate')) rethrow;
    }
  }

  // Create rider profile entry
  static Future<void> createRiderProfile({
    required String userId,
    required String fullName,
    required String phoneNumber,
    required String vehicleType,
    required String accessCode,
  }) async {
    await client.from('rider_profiles').insert({
      'user_id': userId,
      'full_name': fullName,
      'phone_number': phoneNumber,
      'vehicle_type': vehicleType,
      'access_code': accessCode,
      'status': 'active',
    });
  }

  // Check if user has rider role (or admin role)
  static Future<bool> checkRiderRole(String userId) async {
    final roles = await client
        .from('user_roles')
        .select('role')
        .eq('user_id', userId);
        
    return roles.any((r) => r['role'] == 'rider' || r['role'] == 'admin');
  }

  // Check if rider account is suspended by an admin
  static Future<bool> isRiderSuspended(String userId) async {
    try {
      final isAdmin = await client
          .from('user_roles')
          .select('role')
          .eq('user_id', userId)
          .eq('role', 'admin')
          .maybeSingle() != null;

      if (isAdmin) return false;

      final profile = await client
          .from('rider_profiles')
          .select('status')
          .eq('user_id', userId)
          .maybeSingle();

      return profile != null && profile['status'] == 'suspended';
    } catch (e) {
      return false;
    }
  }

  // Claim an unassigned order atomically via RPC
  static Future<void> claimOrder(String orderId) async {
    await client.rpc('claim_order_by_rider', params: {'_order_id': orderId});
  }

  // Fetch available unassigned orders (paid / confirmed only)
  static Future<List<Map<String, dynamic>>> fetchAvailableOrders() async {
    final response = await client
        .from('orders')
        .select('*')
        .filter('assigned_rider_id', 'is', null)
        .or('payment_status.eq.paid,status.in.(confirmed,processing,shipped)')
        .neq('status', 'pending')
        .neq('status', 'delivered')
        .neq('status', 'cancelled')
        .neq('status', 'refunded')
        .order('created_at', ascending: false);
    return List<Map<String, dynamic>>.from(response);
  }

  // Fetch all orders assigned to current rider or available paid orders
  static Future<List<Map<String, dynamic>>> fetchOrders() async {
    final uid = currentUser?.id;
    final response = await client
        .from('orders')
        .select('*')
        .or('assigned_rider_id.eq.${uid ?? ''},and(payment_status.eq.paid,assigned_rider_id.is.null),and(status.in.(confirmed,processing,shipped),assigned_rider_id.is.null)')
        .neq('status', 'cancelled')
        .neq('status', 'refunded')
        .order('created_at', ascending: false);
    return List<Map<String, dynamic>>.from(response);
  }

  // Fetch single order
  static Future<Map<String, dynamic>> fetchOrder(String orderId) async {
    final response = await client
        .from('orders')
        .select('*')
        .eq('id', orderId)
        .maybeSingle();
        
    if (response == null) {
      throw Exception('Order not found or access denied.');
    }
    return response;
  }

  // Fetch order items with product info (batch fetched for high performance)
  static Future<List<Map<String, dynamic>>> fetchOrderItems(String orderId) async {
    final response = await client
        .from('order_items')
        .select('*')
        .eq('order_id', orderId);
        
    final items = List<Map<String, dynamic>>.from(response);
    
    final productIds = items
        .map((i) => i['product_id']?.toString())
        .where((id) => id != null && id.isNotEmpty)
        .toSet()
        .toList();

    if (productIds.isNotEmpty) {
      try {
        final products = await client
            .from('products')
            .select('id, name, image, seller_id')
            .filter('id', 'in', productIds);
        final productMap = {for (var p in products) (p['id'] as dynamic).toString(): p};
        for (var item in items) {
          final pid = item['product_id']?.toString();
          item['products'] = pid != null ? productMap[pid] : null;
        }
      } catch (e) {
        for (var item in items) {
          item['products'] = null;
        }
      }
    } else {
      for (var item in items) {
        item['products'] = null;
      }
    }
    
    return items;
  }

  // Fetch seller info via RPC (with direct table fallback for complete fulfillment fields)
  static Future<Map<String, dynamic>?> fetchSellerInfo(String sellerId) async {
    try {
      final response = await client
          .rpc('get_public_seller_info', params: {'seller_uuid': sellerId});
      
      Map<String, dynamic>? sellerData;
      if (response != null && response is List && response.isNotEmpty) {
        sellerData = Map<String, dynamic>.from(response.first as Map);
      } else if (response != null && response is Map) {
        sellerData = Map<String, dynamic>.from(response as Map);
      }

      if (sellerData != null && sellerData['fulfillment_model'] != null) {
        return sellerData;
      }

      // Fallback query if RPC result lacked fulfillment_model
      final directRes = await client
          .from('seller_profiles')
          .select('fulfillment_model, pickup_address, pickup_landmark, pickup_latitude, pickup_longitude, pickup_phone, pickup_google_maps_url, business_name, business_address, address, phone')
          .eq('user_id', sellerId)
          .maybeSingle();

      if (directRes != null) {
        return Map<String, dynamic>.from(directRes);
      }

      return sellerData;
    } catch (e) {
      try {
        final fallbackRes = await client
            .from('seller_profiles')
            .select('fulfillment_model, pickup_address, pickup_landmark, pickup_latitude, pickup_longitude, pickup_phone, pickup_google_maps_url, business_name, business_address, address, phone')
            .eq('user_id', sellerId)
            .maybeSingle();
        return fallbackRes != null ? Map<String, dynamic>.from(fallbackRes) : null;
      } catch (_) {
        return null;
      }
    }
  }

  // Mark order as shipped (in transit) via RPC
  static Future<void> markShipped(String orderId) async {
    await client.rpc('mark_order_shipped_by_rider', params: {'_order_id': orderId});
  }

  // Mark order as delivered via RPC
  static Future<void> markDelivered(String orderId) async {
    await client.rpc('mark_order_delivered_by_rider', params: {'_order_id': orderId});
  }

  // Confirm delivery with OTP code (proof of delivery)
  static Future<void> confirmDeliveryOtp(String orderId, String otpCode) async {
    await client.rpc('confirm_delivery_otp', params: {
      '_order_id': orderId,
      '_otp': otpCode,
    });
  }

  // Realtime stream for orders
  static Stream<List<Map<String, dynamic>>> ordersStream() {
    return client
        .from('orders')
        .stream(primaryKey: ['id'])
        .order('created_at', ascending: false);
  }

  // Fetch Hub info for an order (from order_items origin_hub_id or active hubs fallback)
  static Future<Map<String, dynamic>?> fetchHubForOrder(String orderId) async {
    try {
      final itemRes = await client
          .from('order_items')
          .select('origin_hub_id')
          .eq('order_id', orderId)
          .not('origin_hub_id', 'is', null)
          .limit(1)
          .maybeSingle();

      final hubId = itemRes?['origin_hub_id'];
      if (hubId != null) {
        final hubRes = await client
            .from('hubs')
            .select('id, name, address, region, contact_phone')
            .eq('id', hubId)
            .maybeSingle();
        if (hubRes != null) return hubRes;
      }

      final fallbackHub = await client
          .from('hubs')
          .select('id, name, address, region, contact_phone')
          .eq('is_active', true)
          .limit(1)
          .maybeSingle();

      return fallbackHub;
    } catch (e) {
      return null;
    }
  }

  // Create a rider support ticket
  static Future<void> createSupportTicket({
    required String subject,
    required String description,
    required String category,
    String? orderId,
  }) async {
    final userId = currentUser?.id;
    if (userId == null) throw Exception('User not authenticated.');

    await client.from('rider_support_tickets').insert({
      'rider_id': userId,
      'order_id': orderId,
      'subject': subject,
      'description': description,
      'category': category,
      'status': 'open',
    });
  }

  // Fetch support tickets for current rider
  static Future<List<Map<String, dynamic>>> fetchSupportTickets() async {
    final userId = currentUser?.id;
    if (userId == null) return [];

    final response = await client
        .from('rider_support_tickets')
        .select('*')
        .eq('rider_id', userId)
        .order('created_at', ascending: false);

    return List<Map<String, dynamic>>.from(response);
  }
}
