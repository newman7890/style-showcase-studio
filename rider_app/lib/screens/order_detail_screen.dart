import 'package:flutter/material.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';
import 'package:url_launcher/url_launcher.dart';
import '../services/supabase_service.dart';
import '../theme/app_theme.dart';

class OrderDetailScreen extends StatefulWidget {
  final String orderId;
  const OrderDetailScreen({super.key, required this.orderId});

  @override
  State<OrderDetailScreen> createState() => _OrderDetailScreenState();
}

class _OrderDetailScreenState extends State<OrderDetailScreen> {
  Map<String, dynamic>? _order;
  Map<String, dynamic>? _hub;
  Map<String, dynamic>? _seller;
  List<Map<String, dynamic>> _items = [];
  bool _loading = true;
  bool _updating = false;

  static const Map<String, Map<String, Color>> statusStyle = {
    'pending': {'bg': Color(0x26FBBF24), 'text': Color(0xFFFBBF24), 'dot': Color(0xFFFBBF24)},
    'processing': {'bg': Color(0x2660A5FA), 'text': Color(0xFF60A5FA), 'dot': Color(0xFF60A5FA)},
    'shipped': {'bg': Color(0x26C084FC), 'text': Color(0xFFC084FC), 'dot': Color(0xFFC084FC)},
    'delivered': {'bg': Color(0x264ADE80), 'text': Color(0xFF4ADE80), 'dot': Color(0xFF4ADE80)},
    'cancelled': {'bg': Color(0x26F87171), 'text': Color(0xFFF87171), 'dot': Color(0xFFF87171)},
  };

  @override
  void initState() {
    super.initState();
    _fetchOrder();
  }

  Future<void> _fetchOrder() async {
    try {
      final results = await Future.wait([
        SupabaseService.fetchOrder(widget.orderId),
        SupabaseService.fetchOrderItems(widget.orderId),
        SupabaseService.fetchHubForOrder(widget.orderId),
      ]);

      final order = results[0] as Map<String, dynamic>;
      final items = results[1] as List<Map<String, dynamic>>;
      final hub = results[2] as Map<String, dynamic>?;

      final processedItems = items.map((item) {
        final products = item['products'];
        if (products is List && products.isNotEmpty) {
          item['products'] = products[0];
        }
        return item;
      }).toList();

      String? sellerId;
      for (var item in processedItems) {
        final prod = item['products'];
        if (prod is Map && prod['seller_id'] != null) {
          sellerId = prod['seller_id'].toString();
          break;
        }
      }

      Map<String, dynamic>? seller;
      if (sellerId != null && sellerId.isNotEmpty) {
        seller = await SupabaseService.fetchSellerInfo(sellerId);
      }

      setState(() {
        _order = order;
        _hub = hub;
        _seller = seller;
        _items = processedItems;
      });
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text(e.toString()), backgroundColor: Colors.red.shade700),
        );
      }
    } finally {
      if (mounted) setState(() => _loading = false);
    }
  }

  Future<void> _handleMarkShipped() async {
    if (_order == null) return;
    setState(() => _updating = true);
    try {
      await SupabaseService.markShipped(_order!['id']);
      if (mounted) {
        setState(() {
          _order!['status'] = 'shipped';
        });
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(
            content: Text('Order Status Updated: Shipped / On the Way 🚚'),
            backgroundColor: Color(0xFFC084FC),
          ),
        );
      }
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text(e.toString()), backgroundColor: Colors.red.shade700),
        );
      }
    } finally {
      if (mounted) setState(() => _updating = false);
    }
  }

  Future<void> _handleMarkDelivered() async {
    if (_order == null) return;
    _showOtpVerificationSheet();
  }

  void _showOtpVerificationSheet() {
    final controllers = List.generate(6, (_) => TextEditingController());
    final focusNodes = List.generate(6, (_) => FocusNode());
    bool verifying = false;
    String? errorText;

    showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      backgroundColor: Colors.transparent,
      builder: (ctx) {
        return StatefulBuilder(
          builder: (context, setSheetState) {
            void submitOtp() async {
              final otp = controllers.map((c) => c.text).join();
              if (otp.length != 6) {
                setSheetState(() => errorText = 'Please enter all 6 digits');
                return;
              }

              setSheetState(() {
                verifying = true;
                errorText = null;
              });

              final nav = Navigator.of(context);
              final messenger = ScaffoldMessenger.of(context);

              try {
                await SupabaseService.confirmDeliveryOtp(_order!['id'], otp);
                if (ctx.mounted) {
                  Navigator.of(ctx).pop();
                }
                if (mounted) {
                  setState(() {
                    _order!['status'] = 'delivered';
                    _order!['payment_status'] = 'paid';
                  });
                  messenger.showSnackBar(
                    const SnackBar(
                      content: Text('✅ Delivery Confirmed! OTP Verified.'),
                      backgroundColor: AppTheme.primary,
                    ),
                  );
                  nav.pop();
                }
              } catch (e) {
                String msg = e.toString();
                if (msg.contains('Invalid OTP')) {
                  msg = 'Wrong code. Please ask the customer again.';
                } else if (msg.contains('expired')) {
                  msg = 'OTP expired. Please contact support.';
                } else if (msg.contains('suspended')) {
                  msg = 'Your account is suspended.';
                }
                setSheetState(() {
                  verifying = false;
                  errorText = msg;
                });
                // Clear all fields on error
                for (var c in controllers) {
                  c.clear();
                }
                focusNodes[0].requestFocus();
              }
            }

            return Padding(
              padding: EdgeInsets.only(
                bottom: MediaQuery.of(context).viewInsets.bottom,
              ),
              child: Container(
                decoration: const BoxDecoration(
                  color: AppTheme.surface,
                  borderRadius: BorderRadius.vertical(top: Radius.circular(24)),
                ),
                padding: const EdgeInsets.all(24),
                child: Column(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    // Handle bar
                    Container(
                      width: 40,
                      height: 4,
                      decoration: BoxDecoration(
                        color: Colors.white.withValues(alpha: 0.2),
                        borderRadius: BorderRadius.circular(2),
                      ),
                    ),
                    const SizedBox(height: 20),

                    // Icon
                    Container(
                      width: 64,
                      height: 64,
                      decoration: BoxDecoration(
                        shape: BoxShape.circle,
                        color: AppTheme.primary.withValues(alpha: 0.15),
                      ),
                      child: const Icon(
                        LucideIcons.shieldCheck,
                        color: AppTheme.primary,
                        size: 28,
                      ),
                    ),
                    const SizedBox(height: 16),

                    // Title
                    const Text(
                      'Enter Delivery Code',
                      style: TextStyle(
                        color: Colors.white,
                        fontSize: 20,
                        fontWeight: FontWeight.bold,
                      ),
                    ),
                    const SizedBox(height: 8),
                    Text(
                      'Ask the customer for the 6-digit code\nthey received via email',
                      textAlign: TextAlign.center,
                      style: TextStyle(
                        color: Colors.white.withValues(alpha: 0.5),
                        fontSize: 14,
                      ),
                    ),
                    const SizedBox(height: 24),

                    // OTP input fields
                    Row(
                      mainAxisAlignment: MainAxisAlignment.center,
                      children: List.generate(6, (i) {
                        return Container(
                          width: 46,
                          height: 56,
                          margin: EdgeInsets.only(
                            left: i == 0 ? 0 : 6,
                            right: i == 2 ? 12 : 0, // gap in the middle
                          ),
                          child: TextField(
                            controller: controllers[i],
                            focusNode: focusNodes[i],
                            textAlign: TextAlign.center,
                            keyboardType: TextInputType.number,
                            maxLength: 1,
                            style: const TextStyle(
                              color: Colors.white,
                              fontSize: 22,
                              fontWeight: FontWeight.bold,
                            ),
                            decoration: InputDecoration(
                              counterText: '',
                              filled: true,
                              fillColor: Colors.white.withValues(alpha: 0.08),
                              border: OutlineInputBorder(
                                borderRadius: BorderRadius.circular(12),
                                borderSide: BorderSide(
                                  color: errorText != null
                                      ? Colors.red.shade400
                                      : Colors.white.withValues(alpha: 0.15),
                                ),
                              ),
                              focusedBorder: OutlineInputBorder(
                                borderRadius: BorderRadius.circular(12),
                                borderSide: const BorderSide(
                                  color: AppTheme.primary,
                                  width: 2,
                                ),
                              ),
                              enabledBorder: OutlineInputBorder(
                                borderRadius: BorderRadius.circular(12),
                                borderSide: BorderSide(
                                  color: errorText != null
                                      ? Colors.red.shade400
                                      : Colors.white.withValues(alpha: 0.15),
                                ),
                              ),
                            ),
                            onChanged: (val) {
                              if (val.isNotEmpty && i < 5) {
                                focusNodes[i + 1].requestFocus();
                              }
                              if (val.isEmpty && i > 0) {
                                focusNodes[i - 1].requestFocus();
                              }
                              // Auto-submit when all 6 digits entered
                              final otp = controllers.map((c) => c.text).join();
                              if (otp.length == 6) {
                                submitOtp();
                              }
                            },
                          ),
                        );
                      }),
                    ),

                    // Error message
                    if (errorText != null) ...[
                      const SizedBox(height: 12),
                      Text(
                        errorText!,
                        textAlign: TextAlign.center,
                        style: TextStyle(
                          color: Colors.red.shade400,
                          fontSize: 13,
                          fontWeight: FontWeight.w500,
                        ),
                      ),
                    ],

                    const SizedBox(height: 24),

                    // Confirm button
                    SizedBox(
                      width: double.infinity,
                      height: 52,
                      child: ElevatedButton.icon(
                        onPressed: verifying ? null : submitOtp,
                        style: ElevatedButton.styleFrom(
                          backgroundColor: AppTheme.primary,
                          foregroundColor: Colors.black,
                          shape: RoundedRectangleBorder(
                            borderRadius: BorderRadius.circular(16),
                          ),
                          elevation: 0,
                        ),
                        icon: verifying
                            ? const SizedBox(
                                width: 20,
                                height: 20,
                                child: CircularProgressIndicator(
                                  strokeWidth: 2,
                                  color: Colors.black,
                                ),
                              )
                            : const Icon(LucideIcons.checkCircle2, size: 20),
                        label: Text(
                          verifying ? 'Verifying...' : 'Confirm Delivery',
                          style: const TextStyle(
                            fontSize: 16,
                            fontWeight: FontWeight.bold,
                          ),
                        ),
                      ),
                    ),
                    const SizedBox(height: 8),
                  ],
                ),
              ),
            );
          },
        );
      },
    );
  }

  Future<void> _openInMaps(String address) async {
    final uri = Uri.parse('https://www.google.com/maps/search/?api=1&query=${Uri.encodeComponent(address)}');
    if (await canLaunchUrl(uri)) {
      await launchUrl(uri, mode: LaunchMode.externalApplication);
    }
  }

  Future<void> _makeCall(String phone) async {
    final uri = Uri.parse('tel:$phone');
    if (await canLaunchUrl(uri)) {
      await launchUrl(uri);
    }
  }

  Future<void> _sendEmail(String email) async {
    final uri = Uri.parse('mailto:$email');
    if (await canLaunchUrl(uri)) {
      await launchUrl(uri);
    }
  }

  @override
  Widget build(BuildContext context) {
    if (_loading) {
      return Scaffold(
        backgroundColor: AppTheme.background,
        body: const Center(child: CircularProgressIndicator(color: AppTheme.primary)),
      );
    }

    if (_order == null) {
      return Scaffold(
        backgroundColor: AppTheme.background,
        body: Center(child: Text('Order not found', style: TextStyle(color: Colors.white.withValues(alpha: 0.4)))),
      );
    }

    final order = _order!;
    final status = order['status'] as String? ?? 'pending';
    final colors = statusStyle[status] ?? statusStyle['pending']!;
    final isDeliverable = status != 'delivered' && status != 'cancelled';

    return Scaffold(
      backgroundColor: AppTheme.background,
      appBar: AppBar(
        backgroundColor: AppTheme.background,
        surfaceTintColor: Colors.transparent,
        elevation: 0,
        leading: IconButton(
          icon: const Icon(LucideIcons.arrowLeft, color: Colors.white),
          onPressed: () => Navigator.of(context).pop(),
        ),
        title: Text(
          order['tracking_code'] ?? 'Order Details',
          style: const TextStyle(color: Colors.white, fontSize: 16, fontWeight: FontWeight.bold),
        ),
      ),
      body: SingleChildScrollView(
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            _buildHeader(order, status, colors),
            const SizedBox(height: 16),
            _buildCustomerInfo(order),
            const SizedBox(height: 16),
            _buildPickupSection(),
            const SizedBox(height: 16),
            _buildDeliveryAddress(order),
            const SizedBox(height: 16),
            _buildOrderItems(order),
            const SizedBox(height: 16),
            _buildPaymentSummary(order),
            const SizedBox(height: 24),
            if (isDeliverable) _buildActionButtons(),
            const SizedBox(height: 16),
            GestureDetector(
              onTap: () {
                Navigator.of(context).pushNamed('/support?orderId=${widget.orderId}');
              },
              child: Container(
                height: 44,
                decoration: BoxDecoration(
                  borderRadius: BorderRadius.circular(14),
                  color: Colors.white.withValues(alpha: 0.05),
                  border: Border.all(color: Colors.white.withValues(alpha: 0.1)),
                ),
                child: Row(
                  mainAxisAlignment: MainAxisAlignment.center,
                  children: [
                    Icon(LucideIcons.lifeBuoy, size: 16, color: Colors.white.withValues(alpha: 0.7)),
                    const SizedBox(width: 8),
                    Text(
                      'Report Issue / Need Help with this Order?',
                      style: TextStyle(color: Colors.white.withValues(alpha: 0.7), fontSize: 12, fontWeight: FontWeight.w600),
                    ),
                  ],
                ),
              ),
            ),
            const SizedBox(height: 32),
          ],
        ),
      ),
    );
  }

  Widget _buildHeader(Map<String, dynamic> order, String status, Map<String, Color> colors) {
    final createdAt = DateTime.tryParse(order['created_at'] ?? '');
    final formattedDate = createdAt != null
        ? '${createdAt.day}/${createdAt.month}/${createdAt.year} ${createdAt.hour}:${createdAt.minute.toString().padLeft(2, '0')}'
        : '';

    return Container(
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: AppTheme.surface,
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: Colors.white.withValues(alpha: 0.08)),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              Text(
                order['tracking_code'] ?? 'N/A',
                style: const TextStyle(color: Colors.white, fontSize: 18, fontWeight: FontWeight.bold),
              ),
              Container(
                padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
                decoration: BoxDecoration(
                  color: colors['bg'],
                  borderRadius: BorderRadius.circular(20),
                ),
                child: Row(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    Container(
                      width: 6, height: 6,
                      decoration: BoxDecoration(shape: BoxShape.circle, color: colors['dot']),
                    ),
                    const SizedBox(width: 6),
                    Text(
                      status.toUpperCase(),
                      style: TextStyle(color: colors['text'], fontSize: 11, fontWeight: FontWeight.bold),
                    ),
                  ],
                ),
              ),
            ],
          ),
          if (formattedDate.isNotEmpty) ...[
            const SizedBox(height: 8),
            Text(
              'Placed on $formattedDate',
              style: TextStyle(color: Colors.white.withValues(alpha: 0.4), fontSize: 12),
            ),
          ],
        ],
      ),
    );
  }

  Widget _buildCustomerInfo(Map<String, dynamic> order) {
    return _buildSectionCard(
      child: Column(
        children: [
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              _buildSectionHeader('Customer Details', LucideIcons.user, const Color(0xFF60A5FA)),
              Row(
                children: [
                  if (order['shipping_phone'] != null)
                    IconButton(
                      icon: const Icon(LucideIcons.phone, size: 18, color: Color(0xFF60A5FA)),
                      onPressed: () => _makeCall(order['shipping_phone']),
                    ),
                  if (order['shipping_email'] != null)
                    IconButton(
                      icon: const Icon(LucideIcons.mail, size: 18, color: Color(0xFF60A5FA)),
                      onPressed: () => _sendEmail(order['shipping_email']),
                    ),
                ],
              ),
            ],
          ),
          const SizedBox(height: 12),
          _buildInfoRow('Name', order['shipping_name'] ?? 'N/A'),
          const SizedBox(height: 8),
          _buildInfoRow('Phone', order['shipping_phone'] ?? 'N/A'),
          const SizedBox(height: 8),
          _buildInfoRow('Email', order['shipping_email'] ?? '', isSmall: true),
        ],
      ),
    );
  }

  Widget _buildPickupSection() {
    final sellerModel = _seller?['fulfillment_model']?.toString();
    final sellerAddress = _seller?['pickup_address'] ?? _seller?['business_address'] ?? _seller?['address'];
    final sellerLandmark = _seller?['pickup_landmark']?.toString();
    final sellerPhone = _seller?['pickup_phone'] ?? _seller?['phone'];
    final sellerMapsUrl = _seller?['pickup_google_maps_url']?.toString();
    final sellerLat = _seller?['pickup_latitude'];
    final sellerLng = _seller?['pickup_longitude'];
    final storeName = _seller?['business_name'] ?? _seller?['store_name'] ?? 'Seller Shop';

    final isDirectPickup = sellerModel == 'direct_pickup' || (sellerAddress != null && sellerAddress.toString().isNotEmpty);

    if (isDirectPickup && sellerAddress != null && sellerAddress.toString().isNotEmpty) {
      final navTarget = (sellerMapsUrl != null && sellerMapsUrl.isNotEmpty)
          ? sellerMapsUrl
          : (sellerLat != null && sellerLng != null)
              ? 'https://www.google.com/maps/search/?api=1&query=$sellerLat,$sellerLng'
              : 'https://www.google.com/maps/search/?api=1&query=${Uri.encodeComponent(sellerAddress.toString())}';

      return _buildSectionCard(
        borderColor: AppTheme.primary.withValues(alpha: 0.3),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
              children: [
                _buildSectionHeader('Pickup (Doorstep)', LucideIcons.bike, AppTheme.primary),
                Container(
                  padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
                  decoration: BoxDecoration(
                    color: AppTheme.primary.withValues(alpha: 0.15),
                    borderRadius: BorderRadius.circular(12),
                  ),
                  child: const Text(
                    '🛵 Direct Pickup',
                    style: TextStyle(color: AppTheme.primary, fontSize: 10, fontWeight: FontWeight.bold),
                  ),
                ),
              ],
            ),
            const SizedBox(height: 16),
            _buildInfoRow('Store Name', storeName),
            const SizedBox(height: 12),
            _buildInfoRow('Shop Address', sellerAddress.toString()),
            if (sellerLandmark != null && sellerLandmark.isNotEmpty) ...[
              const SizedBox(height: 12),
              _buildInfoRow('Landmark', sellerLandmark),
            ],
            if (sellerPhone != null && sellerPhone.toString().isNotEmpty) ...[
              const SizedBox(height: 12),
              Row(
                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                children: [
                  Expanded(child: _buildInfoRow('Seller Phone', sellerPhone.toString())),
                  IconButton(
                    icon: const Icon(LucideIcons.phoneCall, size: 18, color: Color(0xFF4ADE80)),
                    onPressed: () => _makeCall(sellerPhone.toString()),
                    constraints: const BoxConstraints(),
                    padding: EdgeInsets.zero,
                  ),
                ],
              ),
            ],
            const SizedBox(height: 14),
            GestureDetector(
              onTap: () async {
                final uri = Uri.parse(navTarget);
                if (await canLaunchUrl(uri)) {
                  await launchUrl(uri, mode: LaunchMode.externalApplication);
                }
              },
              child: Container(
                height: 42,
                decoration: BoxDecoration(
                  color: AppTheme.primary,
                  borderRadius: BorderRadius.circular(12),
                ),
                child: Row(
                  mainAxisAlignment: MainAxisAlignment.center,
                  children: const [
                    Icon(LucideIcons.navigation, size: 16, color: Colors.black),
                    SizedBox(width: 8),
                    Text(
                      '📍 Navigate to Seller Live Location',
                      style: TextStyle(color: Colors.black, fontSize: 13, fontWeight: FontWeight.bold),
                    ),
                  ],
                ),
              ),
            ),
          ],
        ),
      );
    }

    // Hub Dropoff Fallback
    final hubName = _hub?['name'] ?? 'Processing Hub';
    final hubAddress = _hub?['address'] != null
        ? '${_hub!['address']}, ${_hub!['region'] ?? ''}'
        : 'Accra, Ghana';
    final hubPhone = _hub?['contact_phone']?.toString();

    return _buildSectionCard(
      borderColor: Colors.blue.withValues(alpha: 0.3),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              _buildSectionHeader('Pickup (Hub)', LucideIcons.building, const Color(0xFF60A5FA)),
              Container(
                padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
                decoration: BoxDecoration(
                  color: Colors.blue.withValues(alpha: 0.15),
                  borderRadius: BorderRadius.circular(12),
                ),
                child: const Text(
                  '🏢 Hub Drop-Off',
                  style: TextStyle(color: Color(0xFF60A5FA), fontSize: 10, fontWeight: FontWeight.bold),
                ),
              ),
            ],
          ),
          const SizedBox(height: 16),
          _buildInfoRow('Location', hubName),
          const SizedBox(height: 12),
          _buildInfoRow('Address', hubAddress),
          if (hubPhone != null && hubPhone.isNotEmpty) ...[
            const SizedBox(height: 12),
            _buildInfoRow('Hub Phone', hubPhone),
          ],
          const SizedBox(height: 14),
          GestureDetector(
            onTap: () => _openInMaps(hubAddress),
            child: Container(
              height: 40,
              decoration: BoxDecoration(
                color: Colors.white.withValues(alpha: 0.05),
                borderRadius: BorderRadius.circular(12),
                border: Border.all(color: Colors.white.withValues(alpha: 0.1)),
              ),
              child: Row(
                mainAxisAlignment: MainAxisAlignment.center,
                children: [
                  Icon(LucideIcons.navigation, size: 14, color: Colors.white.withValues(alpha: 0.8)),
                  const SizedBox(width: 8),
                  Text('Navigate to $hubName', style: TextStyle(color: Colors.white.withValues(alpha: 0.8), fontSize: 12, fontWeight: FontWeight.w600)),
                ],
              ),
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildDeliveryAddress(Map<String, dynamic> order) {
    final fullAddr = '${order['shipping_address']}, ${order['shipping_city']}, ${order['shipping_region']}';
    return _buildSectionCard(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          _buildSectionHeader('Delivery Address', LucideIcons.mapPin, const Color(0xFFFBBF24)),
          const SizedBox(height: 16),
          Text(order['shipping_address'] ?? '', style: TextStyle(color: Colors.white.withValues(alpha: 0.8), fontSize: 14)),
          const SizedBox(height: 2),
          Text(
            '${order['shipping_city']}, ${order['shipping_region']}',
            style: TextStyle(color: Colors.white.withValues(alpha: 0.4), fontSize: 12),
          ),
          const SizedBox(height: 16),
          GestureDetector(
            onTap: () => _openInMaps(fullAddr),
            child: Container(
              height: 44,
              decoration: BoxDecoration(
                borderRadius: BorderRadius.circular(12),
                border: Border.all(color: Colors.white.withValues(alpha: 0.1)),
              ),
              child: Row(
                mainAxisAlignment: MainAxisAlignment.center,
                children: [
                  Icon(LucideIcons.navigation, size: 16, color: Colors.white.withValues(alpha: 0.7)),
                  const SizedBox(width: 8),
                  Text('Open in Google Maps', style: TextStyle(color: Colors.white.withValues(alpha: 0.7), fontSize: 14, fontWeight: FontWeight.w600)),
                ],
              ),
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildOrderItems(Map<String, dynamic> order) {
    return _buildSectionCard(
      child: Column(
        children: [
          _buildSectionHeader('Order Items (${_items.length})', LucideIcons.truck, const Color(0xFFC084FC)),
          const SizedBox(height: 16),
          ..._items.map((item) {
            final product = item['products'] as Map<String, dynamic>?;
            final price = (item['price'] as num?)?.toDouble() ?? 0;
            return Padding(
              padding: const EdgeInsets.only(bottom: 12),
              child: Row(
                children: [
                  if (product?['image'] != null)
                    ClipRRect(
                      borderRadius: BorderRadius.circular(12),
                      child: Image.network(
                        product!['image'],
                        width: 48, height: 48, fit: BoxFit.cover,
                        errorBuilder: (context, error, stackTrace) => Container(
                          width: 48, height: 48,
                          color: Colors.white.withValues(alpha: 0.1),
                          child: const Icon(LucideIcons.image, color: Colors.white24),
                        ),
                      ),
                    ),
                  const SizedBox(width: 12),
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(
                          product?['name'] ?? 'Product',
                          style: const TextStyle(color: Colors.white, fontSize: 14, fontWeight: FontWeight.w600),
                        ),
                        Text(
                          'Qty: ${item['quantity']} × GHS ${price.toStringAsFixed(2)}',
                          style: TextStyle(color: Colors.white.withValues(alpha: 0.4), fontSize: 12),
                        ),
                      ],
                    ),
                  ),
                  Text(
                    'GHS ${(price * (item['quantity'] as int? ?? 1)).toStringAsFixed(2)}',
                    style: const TextStyle(color: Colors.white, fontSize: 14, fontWeight: FontWeight.bold),
                  ),
                ],
              ),
            );
          }),
        ],
      ),
    );
  }

  Widget _buildPaymentSummary(Map<String, dynamic> order) {
    final total = (order['total_amount'] as num?)?.toDouble() ?? 0;
    return _buildSectionCard(
      child: Column(
        children: [
          _buildSectionHeader('Payment Summary', LucideIcons.creditCard, AppTheme.primary),
          const SizedBox(height: 16),
          _buildInfoRow('Payment Method', (order['payment_method'] ?? 'N/A').toString().toUpperCase()),
          const SizedBox(height: 8),
          _buildInfoRow(
            'Payment Status',
            ((order['payment_status'] == 'paid' || ['confirmed', 'processing', 'shipped', 'delivered'].contains(order['status']))
                ? 'PAID'
                : (order['payment_status'] ?? 'unpaid')).toString().toUpperCase(),
          ),
          const SizedBox(height: 12),
          Divider(color: Colors.white.withValues(alpha: 0.08)),
          const SizedBox(height: 12),
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              const Text('Total Amount', style: TextStyle(color: Colors.white, fontSize: 14, fontWeight: FontWeight.bold)),
              Text(
                'GHS ${total.toStringAsFixed(2)}',
                style: const TextStyle(color: AppTheme.primary, fontSize: 18, fontWeight: FontWeight.bold),
              ),
            ],
          ),
        ],
      ),
    );
  }

  Future<void> _handleClaimOrder() async {
    if (_order == null) return;
    setState(() => _updating = true);
    try {
      await SupabaseService.claimOrder(_order!['id']);
      if (mounted) {
        setState(() {
          _order!['assigned_rider_id'] = SupabaseService.currentUser?.id;
          _order!['status'] = 'processing';
        });
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(
            content: Text('Delivery Order Claimed Successfully! 🚴'),
            backgroundColor: AppTheme.primary,
          ),
        );
      }
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text(e.toString()), backgroundColor: Colors.red.shade700),
        );
      }
    } finally {
      if (mounted) setState(() => _updating = false);
    }
  }

  Widget _buildActionButtons() {
    final status = _order?['status'] as String? ?? 'pending';
    final isUnassigned = _order?['assigned_rider_id'] == null;
    final isShipped = status == 'shipped';

    if (isUnassigned) {
      return SizedBox(
        width: double.infinity,
        height: 52,
        child: ElevatedButton.icon(
          onPressed: _updating ? null : _handleClaimOrder,
          style: ElevatedButton.styleFrom(
            backgroundColor: const Color(0xFF3B82F6),
            foregroundColor: Colors.white,
            shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
            elevation: 0,
          ),
          icon: _updating
              ? const SizedBox(width: 20, height: 20, child: CircularProgressIndicator(strokeWidth: 2, color: Colors.white))
              : const Icon(LucideIcons.bike, size: 20),
          label: Text(
            _updating ? 'Updating...' : 'Claim Delivery Order 🚴',
            style: const TextStyle(fontSize: 16, fontWeight: FontWeight.bold),
          ),
        ),
      );
    } else if (isShipped) {
      return SizedBox(
        width: double.infinity,
        height: 52,
        child: ElevatedButton.icon(
          onPressed: _updating ? null : _handleMarkDelivered,
          style: ElevatedButton.styleFrom(
            backgroundColor: AppTheme.primary,
            foregroundColor: Colors.black,
            shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
            elevation: 0,
          ),
          icon: _updating
              ? const SizedBox(width: 20, height: 20, child: CircularProgressIndicator(strokeWidth: 2, color: Colors.black))
              : const Icon(LucideIcons.checkCircle2, size: 20),
          label: Text(
            _updating ? 'Updating...' : 'Complete Delivery (Mark Delivered)',
            style: const TextStyle(fontSize: 16, fontWeight: FontWeight.bold),
          ),
        ),
      );
    } else {
      return SizedBox(
        width: double.infinity,
        height: 52,
        child: ElevatedButton.icon(
          onPressed: _updating ? null : _handleMarkShipped,
          style: ElevatedButton.styleFrom(
            backgroundColor: const Color(0xFF8B5CF6),
            foregroundColor: Colors.white,
            shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
            elevation: 0,
          ),
          icon: _updating
              ? const SizedBox(width: 20, height: 20, child: CircularProgressIndicator(strokeWidth: 2, color: Colors.white))
              : const Icon(LucideIcons.truck, size: 20),
          label: Text(
            _updating ? 'Updating...' : 'Start Delivery (Mark as Shipped 🚚)',
            style: const TextStyle(fontSize: 16, fontWeight: FontWeight.bold),
          ),
        ),
      );
    }
  }

  Widget _buildSectionCard({required Widget child, Color? borderColor}) {
    return Container(
      width: double.infinity,
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: AppTheme.surface,
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: borderColor ?? Colors.white.withValues(alpha: 0.08)),
      ),
      child: child,
    );
  }

  Widget _buildSectionHeader(String title, IconData icon, Color color) {
    return Row(
      children: [
        Icon(icon, size: 18, color: color),
        const SizedBox(width: 8),
        Text(title, style: const TextStyle(color: Colors.white, fontSize: 14, fontWeight: FontWeight.bold)),
      ],
    );
  }

  Widget _buildInfoRow(String label, String value, {bool isSmall = false}) {
    return Row(
      mainAxisAlignment: MainAxisAlignment.spaceBetween,
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(label, style: TextStyle(color: Colors.white.withValues(alpha: 0.4), fontSize: 12)),
        const SizedBox(width: 12),
        Expanded(
          child: Text(
            value,
            textAlign: TextAlign.right,
            style: TextStyle(
              color: Colors.white.withValues(alpha: 0.9),
              fontSize: isSmall ? 12 : 13,
              fontWeight: FontWeight.w500,
            ),
          ),
        ),
      ],
    );
  }
}
