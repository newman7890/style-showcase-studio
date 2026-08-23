import 'package:flutter/material.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';
import 'package:url_launcher/url_launcher.dart';
import '../services/supabase_service.dart';
import '../theme/app_theme.dart';

class HelpSupportScreen extends StatefulWidget {
  final String? orderId;

  const HelpSupportScreen({super.key, this.orderId});

  @override
  State<HelpSupportScreen> createState() => _HelpSupportScreenState();
}

class _HelpSupportScreenState extends State<HelpSupportScreen> {
  final _subjectController = TextEditingController();
  final _descriptionController = TextEditingController();
  String _category = 'delivery_issue';
  bool _submitting = false;
  bool _loadingTickets = true;
  List<Map<String, dynamic>> _tickets = [];

  final List<Map<String, String>> _categories = [
    {'id': 'delivery_issue', 'label': 'Delivery Issue 🚚'},
    {'id': 'app_problem', 'label': 'App Problem 📱'},
    {'id': 'payment', 'label': 'Payment / Earnings 💳'},
    {'id': 'general', 'label': 'General Inquiry 💬'},
  ];

  final List<Map<String, String>> _faqs = [
    {
      'question': 'Customer phone number unreachable or wrong address?',
      'answer':
          'Try calling the customer twice. If still unreachable, notify support via this page or tap Call Dispatch. Do not complete the delivery until instructed.'
    },
    {
      'question': 'What if the Hub is closed when I arrive for pickup?',
      'answer':
          'Check the Hub operating hours listed on the order details. If closed during regular hours, submit a support ticket under Delivery Issue.'
    },
    {
      'question': 'When do delivery payouts get transferred?',
      'answer':
          'Earnings for delivered orders are reconciled daily and credited to your registered Mobile Money / Bank account every week.'
    },
    {
      'question': 'How do I report a damaged item during transit?',
      'answer':
          'Take a photo of the item, select "Delivery Issue" below, mention the order ID, and submit a ticket immediately before continuing.'
    },
  ];

  @override
  void initState() {
    super.initState();
    if (widget.orderId != null) {
      _subjectController.text = 'Issue regarding Order #${widget.orderId!.substring(0, 8).toUpperCase()}';
    }
    _loadTickets();
  }

  @override
  void dispose() {
    _subjectController.dispose();
    _descriptionController.dispose();
    super.dispose();
  }

  Future<void> _loadTickets() async {
    try {
      final tickets = await SupabaseService.fetchSupportTickets();
      if (mounted) setState(() => _tickets = tickets);
    } catch (e) {
      // Ignore initial load failure silently
    } finally {
      if (mounted) setState(() => _loadingTickets = false);
    }
  }

  Future<void> _handleCallSupport() async {
    final uri = Uri.parse('tel:+233530044589');
    if (await canLaunchUrl(uri)) {
      await launchUrl(uri);
    } else {
      _showSnack('Could not launch phone call app', isError: true);
    }
  }

  Future<void> _handleWhatsAppSupport() async {
    final uri = Uri.parse('https://wa.me/233530044589?text=Hello%20Trades%20Point%20Rider%20Support');
    if (await canLaunchUrl(uri)) {
      await launchUrl(uri, mode: LaunchMode.externalApplication);
    } else {
      _showSnack('Could not launch WhatsApp', isError: true);
    }
  }

  Future<void> _handleSubmitTicket() async {
    final subject = _subjectController.text.trim();
    final description = _descriptionController.text.trim();

    if (subject.isEmpty) {
      _showSnack('Please enter a brief subject', isError: true);
      return;
    }
    if (description.isEmpty) {
      _showSnack('Please provide details about your issue', isError: true);
      return;
    }

    setState(() => _submitting = true);

    try {
      await SupabaseService.createSupportTicket(
        subject: subject,
        description: description,
        category: _category,
        orderId: widget.orderId,
      );

      _subjectController.clear();
      _descriptionController.clear();

      if (mounted) {
        _showSnack('Support ticket submitted successfully! 🎟️');
      }
      _loadTickets();
    } catch (e) {
      if (mounted) {
        _showSnack(e.toString().replaceAll('Exception: ', ''), isError: true);
      }
    } finally {
      if (mounted) setState(() => _submitting = false);
    }
  }

  void _showSnack(String msg, {bool isError = false}) {
    if (!mounted) return;
    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(
        content: Text(msg),
        backgroundColor: isError ? Colors.red.shade700 : AppTheme.primary,
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: AppTheme.background,
      appBar: AppBar(
        backgroundColor: AppTheme.surface,
        elevation: 0,
        leading: IconButton(
          icon: const Icon(LucideIcons.arrowLeft, color: Colors.white),
          onPressed: () => Navigator.of(context).pop(),
        ),
        title: const Text(
          'Help & Rider Support',
          style: TextStyle(color: Colors.white, fontSize: 18, fontWeight: FontWeight.bold),
        ),
      ),
      body: SingleChildScrollView(
        padding: const EdgeInsets.all(20),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            // Quick Call & WhatsApp Cards
            _buildContactButtons(),
            const SizedBox(height: 24),

            // Submit Ticket Card
            _buildSubmitTicketCard(),
            const SizedBox(height: 24),

            // Submitted Tickets
            _buildMyTicketsSection(),
            const SizedBox(height: 24),

            // FAQ Accordion
            _buildFAQSection(),
          ],
        ),
      ),
    );
  }

  Widget _buildContactButtons() {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        const Text(
          'Direct Contact',
          style: TextStyle(color: Colors.white, fontSize: 16, fontWeight: FontWeight.bold),
        ),
        const SizedBox(height: 12),
        Row(
          children: [
            Expanded(
              child: GestureDetector(
                onTap: _handleCallSupport,
                child: Container(
                  padding: const EdgeInsets.all(16),
                  decoration: BoxDecoration(
                    color: AppTheme.surface,
                    borderRadius: BorderRadius.circular(16),
                    border: Border.all(color: Colors.white.withValues(alpha: 0.08)),
                  ),
                  child: Column(
                    children: [
                      Container(
                        width: 44, height: 44,
                        decoration: BoxDecoration(
                          color: const Color(0xFF3B82F6).withValues(alpha: 0.15),
                          shape: BoxShape.circle,
                        ),
                        child: const Icon(LucideIcons.phoneCall, color: Color(0xFF3B82F6), size: 20),
                      ),
                      const SizedBox(height: 10),
                      const Text('Call Dispatch', style: TextStyle(color: Colors.white, fontWeight: FontWeight.bold, fontSize: 13)),
                      const SizedBox(height: 4),
                      Text('Emergency Support', style: TextStyle(color: Colors.white.withValues(alpha: 0.4), fontSize: 11)),
                    ],
                  ),
                ),
              ),
            ),
            const SizedBox(width: 12),
            Expanded(
              child: GestureDetector(
                onTap: _handleWhatsAppSupport,
                child: Container(
                  padding: const EdgeInsets.all(16),
                  decoration: BoxDecoration(
                    color: AppTheme.surface,
                    borderRadius: BorderRadius.circular(16),
                    border: Border.all(color: Colors.white.withValues(alpha: 0.08)),
                  ),
                  child: Column(
                    children: [
                      Container(
                        width: 44, height: 44,
                        decoration: BoxDecoration(
                          color: const Color(0xFF22C55E).withValues(alpha: 0.15),
                          shape: BoxShape.circle,
                        ),
                        child: const Icon(LucideIcons.messageCircle, color: Color(0xFF22C55E), size: 20),
                      ),
                      const SizedBox(height: 10),
                      const Text('WhatsApp Chat', style: TextStyle(color: Colors.white, fontWeight: FontWeight.bold, fontSize: 13)),
                      const SizedBox(height: 4),
                      Text('Live Rider Desk', style: TextStyle(color: Colors.white.withValues(alpha: 0.4), fontSize: 11)),
                    ],
                  ),
                ),
              ),
            ),
          ],
        ),
      ],
    );
  }

  Widget _buildSubmitTicketCard() {
    return Container(
      padding: const EdgeInsets.all(20),
      decoration: BoxDecoration(
        color: AppTheme.surface,
        borderRadius: BorderRadius.circular(20),
        border: Border.all(color: Colors.white.withValues(alpha: 0.08)),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Icon(LucideIcons.lifeBuoy, color: AppTheme.primary, size: 20),
              const SizedBox(width: 8),
              const Text(
                'Report an Issue / Submit Ticket',
                style: TextStyle(color: Colors.white, fontSize: 16, fontWeight: FontWeight.bold),
              ),
            ],
          ),
          const SizedBox(height: 16),

          // Category Dropdown
          Text('ISSUE CATEGORY', style: TextStyle(color: Colors.white.withValues(alpha: 0.5), fontSize: 11, fontWeight: FontWeight.w600, letterSpacing: 1)),
          const SizedBox(height: 6),
          Container(
            padding: const EdgeInsets.symmetric(horizontal: 12),
            decoration: BoxDecoration(
              color: const Color(0xFF0F1620),
              borderRadius: BorderRadius.circular(12),
              border: Border.all(color: Colors.white.withValues(alpha: 0.1)),
            ),
            child: DropdownButtonHideUnderline(
              child: DropdownButton<String>(
                value: _category,
                isExpanded: true,
                dropdownColor: const Color(0xFF1A2234),
                style: const TextStyle(color: Colors.white, fontSize: 13),
                icon: Icon(LucideIcons.chevronDown, size: 16, color: Colors.white.withValues(alpha: 0.4)),
                items: _categories
                    .map((c) => DropdownMenuItem(value: c['id'], child: Text(c['label']!)))
                    .toList(),
                onChanged: (v) {
                  if (v != null) setState(() => _category = v);
                },
              ),
            ),
          ),
          const SizedBox(height: 14),

          // Subject
          Text('SUBJECT', style: TextStyle(color: Colors.white.withValues(alpha: 0.5), fontSize: 11, fontWeight: FontWeight.w600, letterSpacing: 1)),
          const SizedBox(height: 6),
          Container(
            decoration: BoxDecoration(
              color: const Color(0xFF0F1620),
              borderRadius: BorderRadius.circular(12),
              border: Border.all(color: Colors.white.withValues(alpha: 0.1)),
            ),
            child: TextField(
              controller: _subjectController,
              style: const TextStyle(color: Colors.white, fontSize: 13),
              decoration: InputDecoration(
                hintText: 'Brief summary of the issue...',
                hintStyle: TextStyle(color: Colors.white.withValues(alpha: 0.3)),
                border: InputBorder.none,
                contentPadding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
              ),
            ),
          ),
          const SizedBox(height: 14),

          // Description
          Text('DETAILS', style: TextStyle(color: Colors.white.withValues(alpha: 0.5), fontSize: 11, fontWeight: FontWeight.w600, letterSpacing: 1)),
          const SizedBox(height: 6),
          Container(
            decoration: BoxDecoration(
              color: const Color(0xFF0F1620),
              borderRadius: BorderRadius.circular(12),
              border: Border.all(color: Colors.white.withValues(alpha: 0.1)),
            ),
            child: TextField(
              controller: _descriptionController,
              maxLines: 4,
              style: const TextStyle(color: Colors.white, fontSize: 13),
              decoration: InputDecoration(
                hintText: 'Describe what happened in detail...',
                hintStyle: TextStyle(color: Colors.white.withValues(alpha: 0.3)),
                border: InputBorder.none,
                contentPadding: const EdgeInsets.all(14),
              ),
            ),
          ),
          const SizedBox(height: 20),

          // Submit Button
          GestureDetector(
            onTap: _submitting ? null : _handleSubmitTicket,
            child: Container(
              height: 48,
              decoration: BoxDecoration(
                borderRadius: BorderRadius.circular(12),
                gradient: const LinearGradient(
                  colors: [Color(0xFF4ADE80), Color(0xFF16A34A)],
                ),
                boxShadow: [
                  BoxShadow(color: AppTheme.primary.withValues(alpha: 0.2), blurRadius: 12),
                ],
              ),
              child: Center(
                child: _submitting
                    ? const SizedBox(
                        width: 20, height: 20,
                        child: CircularProgressIndicator(strokeWidth: 2, color: Colors.white),
                      )
                    : const Row(
                        mainAxisAlignment: MainAxisAlignment.center,
                        children: [
                          Icon(LucideIcons.send, size: 16, color: Colors.white),
                          SizedBox(width: 8),
                          Text('Submit Ticket', style: TextStyle(color: Colors.white, fontWeight: FontWeight.bold, fontSize: 14)),
                        ],
                      ),
              ),
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildMyTicketsSection() {
    if (_loadingTickets) {
      return const Center(child: CircularProgressIndicator(color: AppTheme.primary));
    }
    if (_tickets.isEmpty) {
      return const SizedBox.shrink();
    }

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        const Text(
          'My Support Tickets',
          style: TextStyle(color: Colors.white, fontSize: 16, fontWeight: FontWeight.bold),
        ),
        const SizedBox(height: 12),
        ..._tickets.map((ticket) {
          final status = ticket['status'] as String? ?? 'open';
          final isResolved = status == 'resolved';
          final isInProgress = status == 'in_progress';
          final badgeColor = isResolved
              ? const Color(0xFF4ADE80)
              : (isInProgress ? const Color(0xFFFBBF24) : const Color(0xFF60A5FA));

          return Container(
            margin: const EdgeInsets.only(bottom: 10),
            padding: const EdgeInsets.all(14),
            decoration: BoxDecoration(
              color: AppTheme.surface,
              borderRadius: BorderRadius.circular(14),
              border: Border.all(color: Colors.white.withValues(alpha: 0.05)),
            ),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Row(
                  mainAxisAlignment: MainAxisAlignment.spaceBetween,
                  children: [
                    Expanded(
                      child: Text(
                        ticket['subject'] ?? '',
                        style: const TextStyle(color: Colors.white, fontWeight: FontWeight.bold, fontSize: 13),
                        maxLines: 1,
                        overflow: TextOverflow.ellipsis,
                      ),
                    ),
                    Container(
                      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
                      decoration: BoxDecoration(
                        color: badgeColor.withValues(alpha: 0.15),
                        borderRadius: BorderRadius.circular(8),
                      ),
                      child: Text(
                        status.toUpperCase(),
                        style: TextStyle(color: badgeColor, fontSize: 10, fontWeight: FontWeight.bold),
                      ),
                    ),
                  ],
                ),
                const SizedBox(height: 6),
                Text(
                  ticket['description'] ?? '',
                  style: TextStyle(color: Colors.white.withValues(alpha: 0.6), fontSize: 12),
                  maxLines: 2,
                  overflow: TextOverflow.ellipsis,
                ),
                if (ticket['admin_notes'] != null && (ticket['admin_notes'] as String).isNotEmpty) ...[
                  const SizedBox(height: 8),
                  Container(
                    padding: const EdgeInsets.all(10),
                    decoration: BoxDecoration(
                      color: Colors.white.withValues(alpha: 0.04),
                      borderRadius: BorderRadius.circular(8),
                    ),
                    child: Text(
                      'Admin Response: ${ticket['admin_notes']}',
                      style: const TextStyle(color: Color(0xFF60A5FA), fontSize: 11),
                    ),
                  ),
                ],
              ],
            ),
          );
        }),
      ],
    );
  }

  Widget _buildFAQSection() {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        const Text(
          'Frequently Asked Questions',
          style: TextStyle(color: Colors.white, fontSize: 16, fontWeight: FontWeight.bold),
        ),
        const SizedBox(height: 12),
        ..._faqs.map((faq) => Container(
              margin: const EdgeInsets.only(bottom: 8),
              decoration: BoxDecoration(
                color: AppTheme.surface,
                borderRadius: BorderRadius.circular(14),
                border: Border.all(color: Colors.white.withValues(alpha: 0.05)),
              ),
              child: ExpansionTile(
                iconColor: AppTheme.primary,
                collapsedIconColor: Colors.white.withValues(alpha: 0.4),
                title: Text(
                  faq['question']!,
                  style: const TextStyle(color: Colors.white, fontSize: 13, fontWeight: FontWeight.w600),
                ),
                children: [
                  Padding(
                    padding: const EdgeInsets.fromLTRB(16, 0, 16, 16),
                    child: Text(
                      faq['answer']!,
                      style: TextStyle(color: Colors.white.withValues(alpha: 0.6), fontSize: 12, height: 1.4),
                    ),
                  ),
                ],
              ),
            )),
      ],
    );
  }
}
