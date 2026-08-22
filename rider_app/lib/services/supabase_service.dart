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

  // Check if user has rider role
  static Future<bool> checkRiderRole(String userId) async {
    final data = await client
        .from('user_roles')
        .select('role')
        .eq('user_id', userId)
        .eq('role', 'rider')
        .maybeSingle();
    return data != null;
  }

  // Claim an unassigned order atomically via RPC
  static Future<void> claimOrder(String orderId) async {
    await client.rpc('claim_order_by_rider', params: {'_order_id': orderId});
  }

  // Fetch available unassigned orders
  static Future<List<Map<String, dynamic>>> fetchAvailableOrders() async {
    final response = await client
        .from('orders')
        .select('*')
        .filter('assigned_rider_id', 'is', null)
        .neq('status', 'delivered')
        .neq('status', 'cancelled')
        .order('created_at', ascending: false);
    return List<Map<String, dynamic>>.from(response);
  }

  // Fetch all orders assigned to current rider
  static Future<List<Map<String, dynamic>>> fetchOrders() async {
    final response = await client
        .from('orders')
        .select('*')
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

  // Fetch order items with product info
  static Future<List<Map<String, dynamic>>> fetchOrderItems(String orderId) async {
    final response = await client
        .from('order_items')
        .select('*')
        .eq('order_id', orderId);
        
    final items = List<Map<String, dynamic>>.from(response);
    
    // Fetch products separately to avoid PGRST116 on joined queries if RLS blocks products
    for (var item in items) {
      if (item['product_id'] != null) {
        try {
          final product = await client
              .from('products')
              .select('name, image, seller_id')
              .eq('id', item['product_id'])
              .maybeSingle();
          item['products'] = product;
        } catch (e) {
          item['products'] = null;
        }
      } else {
        item['products'] = null;
      }
    }
    
    return items;
  }

  // Fetch seller info via RPC
  static Future<Map<String, dynamic>?> fetchSellerInfo(String sellerId) async {
    try {
      final response = await client
          .rpc('get_public_seller_info', params: {'seller_uuid': sellerId});
      
      if (response != null && response is List && response.isNotEmpty) {
        return response.first as Map<String, dynamic>;
      } else if (response != null && response is Map) {
        return response as Map<String, dynamic>;
      }
      return null;
    } catch (e) {
      return null;
    }
  }

  // Mark order as delivered
  static Future<void> markDelivered(String orderId) async {
    await client
        .from('orders')
        .update({
          'status': 'delivered',
          'updated_at': DateTime.now().toIso8601String(),
        })
        .eq('id', orderId);
  }

  // Realtime stream for orders
  static Stream<List<Map<String, dynamic>>> ordersStream() {
    return client
        .from('orders')
        .stream(primaryKey: ['id'])
        .order('created_at', ascending: false);
  }
}
