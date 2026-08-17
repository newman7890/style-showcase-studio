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
      final order = await SupabaseService.fetchOrder(widget.orderId);
      final items = await SupabaseService.fetchOrderItems(widget.orderId);

      // Process items (flatten products array)
      final processedItems = items.map((item) {
        final products = item['products'];
        if (products is List && products.isNotEmpty) {
          item['products'] = products[0];
        }
        return item;
      }).toList();

      setState(() {
        _order = order;
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

  Future<void> _handleMarkDelivered() async {
    if (_order == null) return;
    setState(() => _updating = true);
    try {
      await SupabaseService.markDelivered(_order!['id']);
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('Order Delivered ✅'), backgroundColor: AppTheme.primary),
        );
        Navigator.of(context).pop();
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
      body: SafeArea(
        child: Column(
          children: [
            _buildHeader(order, colors),
            Expanded(
              child: SingleChildScrollView(
                padding: const EdgeInsets.symmetric(horizontal: 24),
                child: Column(
                  children: [
                    const SizedBox(height: 4),
                    _buildCustomerInfo(order),
                    const SizedBox(height: 16),
                    _buildPickupSection(),
                    const SizedBox(height: 16),
                    _buildDeliveryAddress(order),
                    const SizedBox(height: 16),
                    _buildOrderItems(order),
                    const SizedBox(height: 16),
                    _buildOrderMeta(order),
                    const SizedBox(height: 16),
                    _buildActionButtons(order, isDeliverable),
                    const SizedBox(height: 16),
                  ],
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }



  Widget _buildHeader(Map<String, dynamic> order, Map<String, Color> colors) {
    final trackingCode = order['tracking_code'] as String? ??
        (order['id'] as String? ?? '').substring(0, 8).toUpperCase();
    final status = order['status'] as String? ?? 'pending';

    return Padding(
      padding: const EdgeInsets.fromLTRB(24, 12, 24, 16),
      child: Row(
        children: [
          GestureDetector(
            onTap: () => Navigator.of(context).pop(),
            child: Container(
              width: 40, height: 40,
              decoration: BoxDecoration(
                color: Colors.white.withValues(alpha: 0.08),
                borderRadius: BorderRadius.circular(16),
              ),
              child: Icon(LucideIcons.arrowLeft, size: 20, color: Colors.white.withValues(alpha: 0.7)),
            ),
          ),
          const SizedBox(width: 16),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                const Text('Order Details', style: TextStyle(color: Colors.white, fontWeight: FontWeight.bold, fontSize: 16)),
                Text('#$trackingCode', style: TextStyle(color: Colors.white.withValues(alpha: 0.4), fontSize: 12, fontFamily: 'monospace')),
              ],
            ),
          ),
          Container(
            padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
            decoration: BoxDecoration(
              color: colors['bg'],
              borderRadius: BorderRadius.circular(12),
            ),
            child: Row(
              mainAxisSize: MainAxisSize.min,
              children: [
                Container(width: 6, height: 6, decoration: BoxDecoration(shape: BoxShape.circle, color: colors['dot'])),
                const SizedBox(width: 6),
                Text(status, style: TextStyle(color: colors['text'], fontSize: 11, fontWeight: FontWeight.w600)),
              ],
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildSectionCard({required Widget child, Color? borderColor}) {
    return Container(
      width: double.infinity,
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: AppTheme.surface,
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: borderColor ?? Colors.white.withValues(alpha: 0.05)),
      ),
      child: child,
    );
  }

  Widget _buildSectionHeader(String title, IconData icon, Color color) {
    return Row(
      children: [
        Container(
          width: 28, height: 28,
          decoration: BoxDecoration(
            color: color.withValues(alpha: 0.15),
            borderRadius: BorderRadius.circular(12),
          ),
          child: Icon(icon, size: 14, color: color),
        ),
        const SizedBox(width: 8),
        Text(title, style: const TextStyle(color: Colors.white, fontWeight: FontWeight.w600, fontSize: 14)),
      ],
    );
  }

  Widget _buildCustomerInfo(Map<String, dynamic> order) {
    return _buildSectionCard(
      child: Column(
        children: [
          _buildSectionHeader('Customer Info', LucideIcons.package, const Color(0xFF60A5FA)),
          const SizedBox(height: 16),
          _buildInfoRow('Name', order['shipping_name'] ?? ''),
          const SizedBox(height: 12),
          _buildInfoRowWidget(
            'Phone',
            GestureDetector(
              onTap: () => _makeCall(order['shipping_phone'] ?? ''),
              child: Row(
                mainAxisSize: MainAxisSize.min,
                children: [
                  const Icon(LucideIcons.phone, size: 14, color: AppTheme.primary),
                  const SizedBox(width: 4),
                  Text(order['shipping_phone'] ?? '', style: const TextStyle(color: AppTheme.primary, fontSize: 14, fontWeight: FontWeight.w600)),
                ],
              ),
            ),
          ),
          const SizedBox(height: 12),
          _buildInfoRow('Email', order['shipping_email'] ?? '', isSmall: true),
        ],
      ),
    );
  }

  Widget _buildPickupSection() {
    return _buildSectionCard(
      borderColor: AppTheme.primary.withValues(alpha: 0.2),
      child: Stack(
        children: [
          Positioned(
            top: -40, right: -40,
            child: Container(
              width: 128, height: 128,
              decoration: BoxDecoration(
                shape: BoxShape.circle,
                color: AppTheme.primary.withValues(alpha: 0.05),
              ),
            ),
          ),
          Column(
            children: [
              Row(
                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                children: [
                  _buildSectionHeader('Pickup (Hub)', LucideIcons.mapPin, AppTheme.primary),
                ],
              ),
              const SizedBox(height: 16),
              _buildInfoRow('Location', 'Central Processing Hub'),
              const SizedBox(height: 12),
              _buildInfoRow('Address', 'Accra Central, Ghana'),
              const SizedBox(height: 12),
              GestureDetector(
                onTap: () => _openInMaps('Accra Central, Ghana'),
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
                      Text('Navigate to Hub', style: TextStyle(color: Colors.white.withValues(alpha: 0.8), fontSize: 12, fontWeight: FontWeight.w600)),
                    ],
                  ),
                ),
              ),
            ],
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
                        Text(product?['name'] ?? 'Product', style: const TextStyle(color: Colors.white, fontSize: 14, fontWeight: FontWeight.w500), maxLines: 1, overflow: TextOverflow.ellipsis),
                        Text('Qty: ${item['quantity']}', style: TextStyle(color: Colors.white.withValues(alpha: 0.4), fontSize: 12)),
                      ],
                    ),
                  ),
                  Text(
                    '${order['currency']} ${price.toStringAsFixed(2)}',
                    style: const TextStyle(color: Colors.white, fontWeight: FontWeight.bold, fontSize: 14),
                  ),
                ],
              ),
            );
          }),
          Divider(color: Colors.white.withValues(alpha: 0.08)),
          const SizedBox(height: 8),
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              Text('Total', style: TextStyle(color: Colors.white.withValues(alpha: 0.6), fontSize: 14, fontWeight: FontWeight.w500)),
              Text(
                '${order['currency']} ${(order['total_amount'] as num?)?.toStringAsFixed(2) ?? '0.00'}',
                style: const TextStyle(color: Colors.white, fontWeight: FontWeight.bold, fontSize: 18),
              ),
            ],
          ),
        ],
      ),
    );
  }

  Widget _buildOrderMeta(Map<String, dynamic> order) {
    final createdAt = order['created_at'] != null ? DateTime.tryParse(order['created_at']) : null;
    return _buildSectionCard(
      child: Column(
        children: [
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              Row(
                children: [
                  Icon(LucideIcons.clock, size: 14, color: Colors.white.withValues(alpha: 0.4)),
                  const SizedBox(width: 6),
                  Text('Ordered', style: TextStyle(color: Colors.white.withValues(alpha: 0.4), fontSize: 12)),
                ],
              ),
              Text(
                createdAt != null ? '${createdAt.day}/${createdAt.month}/${createdAt.year} ${createdAt.hour}:${createdAt.minute.toString().padLeft(2, '0')}' : 'N/A',
                style: TextStyle(color: Colors.white.withValues(alpha: 0.7), fontSize: 12),
              ),
            ],
          ),
          const SizedBox(height: 12),
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              Text('Payment', style: TextStyle(color: Colors.white.withValues(alpha: 0.4), fontSize: 12)),
              Text(order['payment_method'] ?? '', style: TextStyle(color: Colors.white.withValues(alpha: 0.7), fontSize: 12)),
            ],
          ),
        ],
      ),
    );
  }

  Widget _buildActionButtons(Map<String, dynamic> order, bool isDeliverable) {
    return Column(
      children: [
        Row(
          children: [
            Expanded(
              child: GestureDetector(
                onTap: () => _makeCall(order['shipping_phone'] ?? ''),
                child: Container(
                  height: 48,
                  decoration: BoxDecoration(
                    color: Colors.white.withValues(alpha: 0.08),
                    borderRadius: BorderRadius.circular(16),
                    border: Border.all(color: Colors.white.withValues(alpha: 0.08)),
                  ),
                  child: Row(
                    mainAxisAlignment: MainAxisAlignment.center,
                    children: [
                      Icon(LucideIcons.phone, size: 16, color: Colors.white.withValues(alpha: 0.8)),
                      const SizedBox(width: 8),
                      Text('Call', style: TextStyle(color: Colors.white.withValues(alpha: 0.8), fontSize: 14, fontWeight: FontWeight.w600)),
                    ],
                  ),
                ),
              ),
            ),
            const SizedBox(width: 12),
            Expanded(
              child: GestureDetector(
                onTap: () => _sendEmail(order['shipping_email'] ?? ''),
                child: Container(
                  height: 48,
                  decoration: BoxDecoration(
                    color: Colors.white.withValues(alpha: 0.08),
                    borderRadius: BorderRadius.circular(16),
                    border: Border.all(color: Colors.white.withValues(alpha: 0.08)),
                  ),
                  child: Row(
                    mainAxisAlignment: MainAxisAlignment.center,
                    children: [
                      Icon(LucideIcons.mail, size: 16, color: Colors.white.withValues(alpha: 0.8)),
                      const SizedBox(width: 8),
                      Text('Email', style: TextStyle(color: Colors.white.withValues(alpha: 0.8), fontSize: 14, fontWeight: FontWeight.w600)),
                    ],
                  ),
                ),
              ),
            ),
          ],
        ),
        if (isDeliverable) ...[
          const SizedBox(height: 12),
          GestureDetector(
            onTap: _updating ? null : _handleMarkDelivered,
            child: Container(
              height: 56,
              decoration: BoxDecoration(
                borderRadius: BorderRadius.circular(16),
                gradient: const LinearGradient(colors: [Color(0xFF4ADE80), Color(0xFF16A34A)]),
                boxShadow: [
                  BoxShadow(color: AppTheme.primary.withValues(alpha: 0.25), blurRadius: 20, offset: const Offset(0, 8)),
                ],
              ),
              child: Center(
                child: _updating
                    ? const SizedBox(
                        width: 20, height: 20,
                        child: CircularProgressIndicator(strokeWidth: 2, color: Colors.white),
                      )
                    : const Row(
                        mainAxisAlignment: MainAxisAlignment.center,
                        children: [
                          Icon(LucideIcons.checkCircle2, size: 20, color: Colors.white),
                          SizedBox(width: 8),
                          Text('Mark as Delivered', style: TextStyle(color: Colors.white, fontSize: 16, fontWeight: FontWeight.bold)),
                        ],
                      ),
              ),
            ),
          ),
        ],
      ],
    );
  }

  Widget _buildInfoRow(String label, String value, {bool isSmall = false}) {
    return Row(
      mainAxisAlignment: MainAxisAlignment.spaceBetween,
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(label, style: TextStyle(color: Colors.white.withValues(alpha: 0.4), fontSize: 12)),
        const SizedBox(width: 16),
        Flexible(
          child: Text(
            value,
            style: TextStyle(
              color: isSmall ? Colors.white.withValues(alpha: 0.6) : Colors.white,
              fontSize: isSmall ? 12 : 14,
              fontWeight: FontWeight.w600,
            ),
            textAlign: TextAlign.right,
          ),
        ),
      ],
    );
  }

  Widget _buildInfoRowWidget(String label, Widget valueWidget) {
    return Row(
      mainAxisAlignment: MainAxisAlignment.spaceBetween,
      children: [
        Text(label, style: TextStyle(color: Colors.white.withValues(alpha: 0.4), fontSize: 12)),
        valueWidget,
      ],
    );
  }


}
