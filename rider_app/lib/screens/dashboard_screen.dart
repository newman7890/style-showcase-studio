import 'package:flutter/material.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';
import '../services/supabase_service.dart';
import '../theme/app_theme.dart';

class DashboardScreen extends StatefulWidget {
  const DashboardScreen({super.key});

  @override
  State<DashboardScreen> createState() => _DashboardScreenState();
}

class _DashboardScreenState extends State<DashboardScreen> {
  List<Map<String, dynamic>> _orders = [];
  bool _loading = true;
  bool _refreshing = false;
  String _filter = 'available'; // available | my_orders | delivered | all
  int _activeTab = 0; // 0 = orders, 1 = profile

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
    _fetchOrders();
    // Listen for realtime updates
    SupabaseService.ordersStream().listen((data) {
      if (mounted) {
        setState(() => _orders = data);
      }
    });
  }

  Future<void> _fetchOrders() async {
    try {
      final user = SupabaseService.currentUser;
      if (user != null) {
        final isSuspended = await SupabaseService.isRiderSuspended(user.id);
        if (isSuspended && mounted) {
          await SupabaseService.signOut();
          if (!mounted) return;
          Navigator.of(context).pushReplacementNamed('/login');
          ScaffoldMessenger.of(context).showSnackBar(
            SnackBar(
              content: const Text('Account Suspended: Your rider account has been suspended by an Administrator.'),
              backgroundColor: Colors.red.shade700,
            ),
          );
          return;
        }
      }

      final data = await SupabaseService.fetchOrders();
      if (mounted) setState(() => _orders = data);
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text(e.toString()), backgroundColor: Colors.red.shade700),
        );
      }
    } finally {
      if (mounted) setState(() { _loading = false; _refreshing = false; });
    }
  }

  void _handleRefresh() {
    setState(() => _refreshing = true);
    _fetchOrders();
  }

  Future<void> _handleLogout() async {
    await SupabaseService.signOut();
    if (mounted) {
      Navigator.of(context).pushReplacementNamed('/login');
    }
  }

  Future<void> _handleMarkDelivered(String orderId) async {
    try {
      await SupabaseService.markDelivered(orderId);
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(
            content: Text('Order Delivered ✅'),
            backgroundColor: AppTheme.primary,
          ),
        );
      }
      _fetchOrders();
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text(e.toString()), backgroundColor: Colors.red.shade700),
        );
      }
    }
  }

  Future<void> _handleClaimOrder(String orderId) async {
    try {
      await SupabaseService.claimOrder(orderId);
      if (mounted) {
        setState(() {
          final idx = _orders.indexWhere((o) => o['id'] == orderId);
          if (idx != -1) {
            _orders[idx]['assigned_rider_id'] = SupabaseService.currentUser?.id;
            _orders[idx]['status'] = 'processing';
          }
        });
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(
            content: Text('Delivery Order Claimed Successfully! 🚴'),
            backgroundColor: AppTheme.primary,
          ),
        );
      }
      _fetchOrders();
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text(e.toString().replaceAll('Exception: ', '').replaceAll('AuthApiException(message: ', '').replaceAll(RegExp(r',\s*statusCode.*$'), '')),
            backgroundColor: Colors.red.shade700,
          ),
        );
      }
    }
  }

  Future<void> _handleMarkShipped(String orderId) async {
    try {
      await SupabaseService.markShipped(orderId);
      if (mounted) {
        setState(() {
          final idx = _orders.indexWhere((o) => o['id'] == orderId);
          if (idx != -1) {
            _orders[idx]['status'] = 'shipped';
            _orders[idx]['assigned_rider_id'] = SupabaseService.currentUser?.id;
          }
        });
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(
            content: Text('Order Status Updated: Shipped / On the Way 🚚'),
            backgroundColor: Color(0xFFC084FC),
          ),
        );
      }
      _fetchOrders();
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text(e.toString()), backgroundColor: Colors.red.shade700),
        );
      }
    }
  }

  List<Map<String, dynamic>> get _filteredOrders {
    final currentUserId = SupabaseService.currentUser?.id;
    return _orders.where((o) {
      final status = (o['status'] as String? ?? '').toLowerCase();
      final paymentStatus = (o['payment_status'] as String? ?? '').toLowerCase();
      final assignedRiderId = o['assigned_rider_id'] as String?;

      final isPaidOrConfirmed = (paymentStatus == 'paid') ||
          (status == 'confirmed' || status == 'processing' || status == 'shipped');

      if (_filter == 'available') {
        return assignedRiderId == null && isPaidOrConfirmed && status != 'pending' && status != 'delivered' && status != 'cancelled';
      }
      if (_filter == 'my_orders') {
        return assignedRiderId == currentUserId && status != 'delivered' && status != 'cancelled';
      }
      if (_filter == 'delivered') {
        return status == 'delivered' && assignedRiderId == currentUserId;
      }
      if (_filter == 'all') {
        // Show unclaimed orders OR orders claimed by this rider
        return assignedRiderId == null || assignedRiderId == currentUserId;
      }
      return true;
    }).toList();
  }

  int get _availableCount => _orders.where((o) {
    final s = (o['status'] as String? ?? '').toLowerCase();
    return o['assigned_rider_id'] == null && s != 'delivered' && s != 'cancelled';
  }).length;

  int get _myOrdersCount => _orders.where((o) {
    final s = (o['status'] as String? ?? '').toLowerCase();
    final currentUserId = SupabaseService.currentUser?.id;
    return o['assigned_rider_id'] == currentUserId && s != 'delivered' && s != 'cancelled';
  }).length;

  int get _deliveredCount => _orders.where((o) {
    final s = (o['status'] as String? ?? '').toLowerCase();
    final currentUserId = SupabaseService.currentUser?.id;
    return s == 'delivered' && o['assigned_rider_id'] == currentUserId;
  }).length;

  @override
  Widget build(BuildContext context) {
    if (_loading) {
      return Scaffold(
        backgroundColor: AppTheme.background,
        body: const Center(
          child: CircularProgressIndicator(color: AppTheme.primary),
        ),
      );
    }

    return Scaffold(
      backgroundColor: AppTheme.background,
      body: SafeArea(
        child: Column(
          children: [
            _buildHeader(),
            if (_activeTab == 0) ...[
              _buildStatsRow(),
              _buildFilterPills(),
              Expanded(child: _buildOrdersList()),
            ] else
              Expanded(child: _buildProfileTab()),
            _buildBottomNav(),
          ],
        ),
      ),
    );
  }



  Widget _buildHeader() {
    final email = SupabaseService.currentUser?.email ?? '';
    return Padding(
      padding: const EdgeInsets.fromLTRB(24, 12, 24, 16),
      child: Row(
        children: [
          Container(
            width: 40, height: 40,
            decoration: BoxDecoration(
              borderRadius: BorderRadius.circular(16),
              gradient: const LinearGradient(
                begin: Alignment.topLeft,
                end: Alignment.bottomRight,
                colors: [Color(0xFF4ADE80), Color(0xFF16A34A)],
              ),
              boxShadow: [
                BoxShadow(color: AppTheme.primary.withValues(alpha: 0.3), blurRadius: 12, offset: const Offset(0, 4)),
              ],
            ),
            child: const Icon(LucideIcons.bike, size: 20, color: Colors.white),
          ),
          const SizedBox(width: 12),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                const Text('My Deliveries', style: TextStyle(color: Colors.white, fontWeight: FontWeight.bold, fontSize: 16)),
                Text(email, style: TextStyle(color: Colors.white.withValues(alpha: 0.4), fontSize: 12), overflow: TextOverflow.ellipsis),
              ],
            ),
          ),
          _buildHeaderButton(
            icon: LucideIcons.refreshCw,
            onTap: _handleRefresh,
            spinning: _refreshing,
          ),
        ],
      ),
    );
  }

  Widget _buildHeaderButton({
    required IconData icon,
    required VoidCallback onTap,
    bool spinning = false,
    bool isLogout = false,
  }) {
    return GestureDetector(
      onTap: onTap,
      child: Container(
        width: 36, height: 36,
        decoration: BoxDecoration(
          color: Colors.white.withValues(alpha: 0.05),
          borderRadius: BorderRadius.circular(12),
        ),
        child: Center(
          child: spinning
              ? SizedBox(
                  width: 16, height: 16,
                  child: CircularProgressIndicator(
                    strokeWidth: 2,
                    color: Colors.white.withValues(alpha: 0.6),
                  ),
                )
              : Icon(
                  icon,
                  size: 16,
                  color: isLogout
                      ? Colors.white.withValues(alpha: 0.6)
                      : Colors.white.withValues(alpha: 0.6),
                ),
        ),
      ),
    );
  }

  Widget _buildStatsRow() {
    return Padding(
      padding: const EdgeInsets.fromLTRB(24, 0, 24, 20),
      child: Row(
        children: [
          Expanded(child: _buildStatCard('Available', _availableCount, const Color(0xFF3B82F6), LucideIcons.bike)),
          const SizedBox(width: 8),
          Expanded(child: _buildStatCard('My Orders', _myOrdersCount, const Color(0xFFFBBF24), LucideIcons.package)),
          const SizedBox(width: 8),
          Expanded(child: _buildStatCard('Delivered', _deliveredCount, const Color(0xFF4ADE80), LucideIcons.checkCircle2)),
        ],
      ),
    );
  }

  Widget _buildStatCard(String label, int count, Color color, IconData icon) {
    return Container(
      padding: const EdgeInsets.all(12),
      decoration: BoxDecoration(
        color: AppTheme.surface,
        borderRadius: BorderRadius.circular(16),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Container(
                width: 24, height: 24,
                decoration: BoxDecoration(
                  color: color.withValues(alpha: 0.15),
                  borderRadius: BorderRadius.circular(10),
                ),
                child: Icon(icon, size: 12, color: color),
              ),
              const SizedBox(width: 6),
              Expanded(
                child: Text(
                  label,
                  style: TextStyle(color: Colors.white.withValues(alpha: 0.5), fontSize: 11, fontWeight: FontWeight.w500),
                  overflow: TextOverflow.ellipsis,
                ),
              ),
            ],
          ),
          const SizedBox(height: 6),
          Text('$count', style: const TextStyle(color: Colors.white, fontSize: 24, fontWeight: FontWeight.bold)),
        ],
      ),
    );
  }

  Widget _buildFilterPills() {
    final pills = [
      {'id': 'available', 'label': 'Available'},
      {'id': 'my_orders', 'label': 'My Orders'},
      {'id': 'delivered', 'label': 'Delivered'},
      {'id': 'all', 'label': 'All'},
    ];
    return Padding(
      padding: const EdgeInsets.fromLTRB(24, 0, 24, 16),
      child: SingleChildScrollView(
        scrollDirection: Axis.horizontal,
        child: Row(
          children: pills.map((p) {
            final f = p['id']!;
            final isSelected = _filter == f;
            return Padding(
              padding: const EdgeInsets.only(right: 8),
              child: GestureDetector(
                onTap: () => setState(() => _filter = f),
                child: Container(
                  padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
                  decoration: BoxDecoration(
                    color: isSelected ? AppTheme.primary : Colors.white.withValues(alpha: 0.08),
                    borderRadius: BorderRadius.circular(20),
                    boxShadow: isSelected
                        ? [BoxShadow(color: AppTheme.primary.withValues(alpha: 0.2), blurRadius: 12)]
                        : null,
                  ),
                  child: Text(
                    p['label']!,
                    style: TextStyle(
                      color: isSelected ? const Color(0xFF0A1A0A) : Colors.white.withValues(alpha: 0.5),
                      fontSize: 12,
                      fontWeight: FontWeight.w600,
                    ),
                  ),
                ),
              ),
            );
          }).toList(),
        ),
      ),
    );
  }

  Widget _buildOrdersList() {
    final orders = _filteredOrders;
    if (orders.isEmpty) {
      return Center(
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            Container(
              width: 64, height: 64,
              decoration: BoxDecoration(
                color: Colors.white.withValues(alpha: 0.05),
                borderRadius: BorderRadius.circular(24),
              ),
              child: Icon(LucideIcons.package, size: 32, color: Colors.white.withValues(alpha: 0.2)),
            ),
            const SizedBox(height: 16),
            Text('No orders found', style: TextStyle(color: Colors.white.withValues(alpha: 0.3), fontSize: 14)),
          ],
        ),
      );
    }

    return ListView.builder(
      padding: const EdgeInsets.symmetric(horizontal: 24, vertical: 0),
      itemCount: orders.length,
      itemBuilder: (context, i) => _buildOrderCard(orders[i]),
    );
  }

  Widget _buildOrderCard(Map<String, dynamic> order) {
    final status = order['status'] as String? ?? 'pending';
    final colors = statusStyle[status] ?? statusStyle['pending']!;
    final isActive = status != 'delivered' && status != 'cancelled';
    final isUnassigned = order['assigned_rider_id'] == null && isActive;
    final trackingCode = order['tracking_code'] as String? ??
        (order['id'] as String? ?? '').substring(0, 8).toUpperCase();
    final createdAt = order['created_at'] != null
        ? DateTime.tryParse(order['created_at'])
        : null;

    return GestureDetector(
      onTap: () => Navigator.of(context).pushNamed('/order/${order['id']}'),
      child: Container(
        margin: const EdgeInsets.only(bottom: 12),
        padding: const EdgeInsets.all(16),
        decoration: BoxDecoration(
          color: AppTheme.surface,
          borderRadius: BorderRadius.circular(16),
          border: Border.all(color: Colors.white.withValues(alpha: 0.05)),
        ),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            // Top row: name + status
            Row(
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
              children: [
                Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      order['shipping_name'] ?? '',
                      style: const TextStyle(color: Colors.white, fontWeight: FontWeight.w600, fontSize: 14),
                    ),
                    const SizedBox(height: 2),
                    Text(
                      '#$trackingCode',
                      style: TextStyle(color: Colors.white.withValues(alpha: 0.35), fontSize: 12, fontFamily: 'monospace'),
                    ),
                  ],
                ),
                Row(
                  children: [
                    Container(
                      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
                      decoration: BoxDecoration(
                        color: colors['bg'],
                        borderRadius: BorderRadius.circular(12),
                      ),
                      child: Row(
                        mainAxisSize: MainAxisSize.min,
                        children: [
                          Container(
                            width: 6, height: 6,
                            decoration: BoxDecoration(shape: BoxShape.circle, color: colors['dot']),
                          ),
                          const SizedBox(width: 6),
                          Text(status, style: TextStyle(color: colors['text'], fontSize: 11, fontWeight: FontWeight.w600)),
                        ],
                      ),
                    ),
                    const SizedBox(width: 4),
                    Icon(LucideIcons.chevronRight, size: 16, color: Colors.white.withValues(alpha: 0.25)),
                  ],
                ),
              ],
            ),
            const SizedBox(height: 8),

            // Address
            Row(
              children: [
                Icon(LucideIcons.mapPin, size: 14, color: Colors.white.withValues(alpha: 0.3)),
                const SizedBox(width: 8),
                Expanded(
                  child: Text(
                    '${order['shipping_address']}, ${order['shipping_city']}',
                    style: TextStyle(color: Colors.white.withValues(alpha: 0.5), fontSize: 12),
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                  ),
                ),
              ],
            ),
            const SizedBox(height: 8),

            // Time & amount
            Row(
              children: [
                Icon(LucideIcons.clock, size: 14, color: Colors.white.withValues(alpha: 0.3)),
                const SizedBox(width: 8),
                Text(
                  createdAt != null
                      ? '${createdAt.day}/${createdAt.month}/${createdAt.year}'
                      : 'N/A',
                  style: TextStyle(color: Colors.white.withValues(alpha: 0.4), fontSize: 12),
                ),
                const Spacer(),
                Text(
                  '${order['currency'] ?? ''} ${(order['total_amount'] as num?)?.toStringAsFixed(2) ?? '0.00'}',
                  style: const TextStyle(color: Colors.white, fontWeight: FontWeight.bold, fontSize: 14),
                ),
              ],
            ),
            const SizedBox(height: 12),

            // Action buttons
            Row(
              children: [
                _buildCallButton(order['shipping_phone'] ?? ''),
                if (isUnassigned) ...[
                  const SizedBox(width: 8),
                  Expanded(
                    child: GestureDetector(
                      onTap: () => _handleClaimOrder(order['id']),
                      child: Container(
                        height: 36,
                        decoration: BoxDecoration(
                          borderRadius: BorderRadius.circular(12),
                          gradient: const LinearGradient(
                            colors: [Color(0xFF3B82F6), Color(0xFF1D4ED8)],
                          ),
                          boxShadow: [
                            BoxShadow(color: Colors.blue.withValues(alpha: 0.2), blurRadius: 12),
                          ],
                        ),
                        child: const Row(
                          mainAxisAlignment: MainAxisAlignment.center,
                          children: [
                            Icon(LucideIcons.bike, size: 14, color: Colors.white),
                            SizedBox(width: 6),
                            Text('Claim Delivery 🚴', style: TextStyle(color: Colors.white, fontSize: 12, fontWeight: FontWeight.bold)),
                          ],
                        ),
                      ),
                    ),
                  ),
                ] else if (isActive && status == 'shipped') ...[
                  const SizedBox(width: 8),
                  Expanded(
                    child: GestureDetector(
                      onTap: () => _handleMarkDelivered(order['id']),
                      child: Container(
                        height: 36,
                        decoration: BoxDecoration(
                          borderRadius: BorderRadius.circular(12),
                          gradient: const LinearGradient(
                            colors: [Color(0xFF4ADE80), Color(0xFF16A34A)],
                          ),
                          boxShadow: [
                            BoxShadow(color: AppTheme.primary.withValues(alpha: 0.2), blurRadius: 12),
                          ],
                        ),
                        child: const Row(
                          mainAxisAlignment: MainAxisAlignment.center,
                          children: [
                            Icon(LucideIcons.checkCircle2, size: 14, color: Colors.white),
                            SizedBox(width: 6),
                            Text('Complete Delivery', style: TextStyle(color: Colors.white, fontSize: 12, fontWeight: FontWeight.bold)),
                          ],
                        ),
                      ),
                    ),
                  ),
                ] else if (isActive) ...[
                  const SizedBox(width: 8),
                  Expanded(
                    child: GestureDetector(
                      onTap: () => _handleMarkShipped(order['id']),
                      child: Container(
                        height: 36,
                        decoration: BoxDecoration(
                          borderRadius: BorderRadius.circular(12),
                          gradient: const LinearGradient(
                            colors: [Color(0xFF8B5CF6), Color(0xFF6D28D9)],
                          ),
                          boxShadow: [
                            BoxShadow(color: Colors.purple.withValues(alpha: 0.2), blurRadius: 12),
                          ],
                        ),
                        child: const Row(
                          mainAxisAlignment: MainAxisAlignment.center,
                          children: [
                            Icon(LucideIcons.truck, size: 14, color: Colors.white),
                            SizedBox(width: 6),
                            Text('Start Delivery 🚚', style: TextStyle(color: Colors.white, fontSize: 12, fontWeight: FontWeight.bold)),
                          ],
                        ),
                      ),
                    ),
                  ),
                ],
              ],
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildCallButton(String phone) {
    return GestureDetector(
      onTap: () {
        // url_launcher would be used here for tel: links
      },
      child: Container(
        padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
        decoration: BoxDecoration(
          color: Colors.white.withValues(alpha: 0.08),
          borderRadius: BorderRadius.circular(12),
        ),
        child: Row(
          mainAxisSize: MainAxisSize.min,
          children: [
            Icon(LucideIcons.phone, size: 14, color: Colors.white.withValues(alpha: 0.7)),
            const SizedBox(width: 6),
            Text('Call', style: TextStyle(color: Colors.white.withValues(alpha: 0.7), fontSize: 12, fontWeight: FontWeight.w600)),
          ],
        ),
      ),
    );
  }

  Widget _buildProfileTab() {
    final email = SupabaseService.currentUser?.email ?? '';
    return SingleChildScrollView(
      padding: const EdgeInsets.all(24),
      child: Column(
        children: [
          // Stats summary
          Row(
            children: [
              Expanded(child: _buildProfileStatCard('My Orders', _myOrdersCount)),
              const SizedBox(width: 12),
              Expanded(child: _buildProfileStatCard('Delivered', _deliveredCount)),
            ],
          ),
          const SizedBox(height: 16),

          // Info rows
          Container(
            decoration: BoxDecoration(
              color: AppTheme.surface,
              borderRadius: BorderRadius.circular(16),
              border: Border.all(color: Colors.white.withValues(alpha: 0.05)),
            ),
            child: Column(
              children: [
                _buildInfoRow('Role', 'Delivery Rider'),
                Divider(height: 1, color: Colors.white.withValues(alpha: 0.05)),
                _buildInfoRow('Email', email, isSmall: true),
                Divider(height: 1, color: Colors.white.withValues(alpha: 0.05)),
                _buildInfoRow('Total Orders', '${_orders.length}'),
              ],
            ),
          ),
          // Help & Support button
          GestureDetector(
            onTap: () => Navigator.of(context).pushNamed('/support'),
            child: Container(
              height: 52,
              decoration: BoxDecoration(
                borderRadius: BorderRadius.circular(16),
                color: AppTheme.primary.withValues(alpha: 0.15),
                border: Border.all(color: AppTheme.primary.withValues(alpha: 0.3)),
              ),
              child: const Row(
                mainAxisAlignment: MainAxisAlignment.center,
                children: [
                  Icon(LucideIcons.lifeBuoy, size: 18, color: AppTheme.primary),
                  SizedBox(width: 10),
                  Text('Help & Support Center', style: TextStyle(color: AppTheme.primary, fontWeight: FontWeight.bold, fontSize: 14)),
                ],
              ),
            ),
          ),
          const SizedBox(height: 12),

          // Sign Out button
          GestureDetector(
            onTap: _handleLogout,
            child: Container(
              height: 48,
              decoration: BoxDecoration(
                borderRadius: BorderRadius.circular(16),
                border: Border.all(color: Colors.red.withValues(alpha: 0.3)),
                color: Colors.red.withValues(alpha: 0.1),
              ),
              child: const Row(
                mainAxisAlignment: MainAxisAlignment.center,
                children: [
                  Icon(LucideIcons.logOut, size: 16, color: Color(0xFFF87171)),
                  SizedBox(width: 8),
                  Text('Sign Out', style: TextStyle(color: Color(0xFFF87171), fontWeight: FontWeight.w600, fontSize: 14)),
                ],
              ),
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildProfileStatCard(String label, int count) {
    return Container(
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: AppTheme.surface,
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: Colors.white.withValues(alpha: 0.05)),
      ),
      child: Column(
        children: [
          Text('$count', style: const TextStyle(color: Colors.white, fontSize: 30, fontWeight: FontWeight.bold)),
          const SizedBox(height: 4),
          Text(label, style: TextStyle(color: Colors.white.withValues(alpha: 0.4), fontSize: 12)),
        ],
      ),
    );
  }

  Widget _buildInfoRow(String label, String value, {bool isSmall = false}) {
    return Padding(
      padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
      child: Row(
        mainAxisAlignment: MainAxisAlignment.spaceBetween,
        children: [
          Text(label, style: TextStyle(color: Colors.white.withValues(alpha: 0.4), fontSize: 14)),
          Flexible(
            child: Text(
              value,
              style: TextStyle(
                color: isSmall ? Colors.white.withValues(alpha: 0.7) : Colors.white,
                fontSize: isSmall ? 12 : 14,
                fontWeight: FontWeight.w600,
              ),
              overflow: TextOverflow.ellipsis,
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildBottomNav() {
    return Container(
      decoration: BoxDecoration(
        color: AppTheme.surface,
        border: Border(top: BorderSide(color: Colors.white.withValues(alpha: 0.08))),
      ),
      padding: const EdgeInsets.symmetric(horizontal: 24, vertical: 12),
      child: Row(
        mainAxisAlignment: MainAxisAlignment.spaceAround,
        children: [
          _buildNavItem(0, LucideIcons.layoutGrid, 'Orders'),
          _buildNavItem(1, LucideIcons.user, 'Profile'),
        ],
      ),
    );
  }

  Widget _buildNavItem(int index, IconData icon, String label) {
    final isActive = _activeTab == index;
    return GestureDetector(
      onTap: () => setState(() => _activeTab = index),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          Icon(icon, size: 20, color: isActive ? AppTheme.primary : Colors.white.withValues(alpha: 0.3)),
          const SizedBox(height: 4),
          Text(
            label,
            style: TextStyle(
              color: isActive ? AppTheme.primary : Colors.white.withValues(alpha: 0.3),
              fontSize: 10,
              fontWeight: FontWeight.w600,
            ),
          ),
        ],
      ),
    );
  }


}
