import 'package:flutter/material.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';
import '../services/supabase_service.dart';
import '../theme/app_theme.dart';

class LoginScreen extends StatefulWidget {
  const LoginScreen({super.key});

  @override
  State<LoginScreen> createState() => _LoginScreenState();
}

class _LoginScreenState extends State<LoginScreen>
    with SingleTickerProviderStateMixin {
  // Shared fields
  final _emailController = TextEditingController();
  final _passwordController = TextEditingController();
  bool _showPassword = false;
  bool _loading = false;
  bool _isRegister = false;

  // Registration-only fields
  final _fullNameController = TextEditingController();
  final _phoneController = TextEditingController();
  final _accessCodeController = TextEditingController();
  String _vehicleType = 'Motorcycle';

  late AnimationController _animController;
  late Animation<double> _scaleAnim;
  late Animation<double> _fadeAnim;

  @override
  void initState() {
    super.initState();
    _animController = AnimationController(
      vsync: this,
      duration: const Duration(milliseconds: 600),
    );
    _scaleAnim = Tween<double>(begin: 0.8, end: 1.0).animate(
      CurvedAnimation(parent: _animController, curve: Curves.easeOutBack),
    );
    _fadeAnim = Tween<double>(begin: 0.0, end: 1.0).animate(
      CurvedAnimation(parent: _animController, curve: Curves.easeOut),
    );
    _animController.forward();

    // Auto-redirect if already logged in
    _checkExistingSession();
  }

  Future<void> _checkExistingSession() async {
    final user = SupabaseService.currentUser;
    if (user != null) {
      final isSuspended = await SupabaseService.isRiderSuspended(user.id);
      if (isSuspended) {
        await SupabaseService.signOut();
        _showSnack('Account Suspended: Your rider account has been suspended by an Administrator.', isError: true);
        return;
      }

      final isRider = await SupabaseService.checkRiderRole(user.id);
      if (isRider && mounted) {
        Navigator.of(context).pushNamedAndRemoveUntil('/dashboard', (route) => false);
      }
    }
  }

  @override
  void dispose() {
    _emailController.dispose();
    _passwordController.dispose();
    _fullNameController.dispose();
    _phoneController.dispose();
    _accessCodeController.dispose();
    _animController.dispose();
    super.dispose();
  }

  void _showSnack(String message, {bool isError = false}) {
    if (!mounted) return;
    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(
        content: Text(message),
        backgroundColor: isError ? Colors.red.shade700 : AppTheme.primary,
      ),
    );
  }

  Future<void> _handleLogin() async {
    if (_loading) return;
    setState(() => _loading = true);

    try {
      final response = await SupabaseService.signIn(
        _emailController.text.trim(),
        _passwordController.text,
      );

      final userId = response.user?.id;
      if (userId == null) throw Exception('Login failed.');

      final isSuspended = await SupabaseService.isRiderSuspended(userId);
      if (isSuspended) {
        await SupabaseService.signOut();
        throw Exception('Account Suspended: Your rider account has been suspended by an Administrator. Please contact support.');
      }

      final isRider = await SupabaseService.checkRiderRole(userId);
      if (!isRider) {
        await SupabaseService.signOut();
        throw Exception('Access denied. You are not registered as a delivery rider.');
      }

      _showSnack('Welcome back! 🚴');
      if (mounted) Navigator.of(context).pushNamedAndRemoveUntil('/dashboard', (route) => false);
    } catch (e) {
      String message;
      final errorStr = e.toString().toLowerCase();
      
      if (errorStr.contains('invalid_credentials') || errorStr.contains('invalid login credentials')) {
        message = 'Invalid email or password. Please try again.';
      } else if (errorStr.contains('email_not_confirmed')) {
        message = 'Please verify your email address first.';
      } else if (errorStr.contains('too_many_requests') || errorStr.contains('rate_limit')) {
        message = 'Too many attempts. Please wait a moment and try again.';
      } else if (errorStr.contains('network') || errorStr.contains('socket') || errorStr.contains('host lookup')) {
        message = 'No internet connection. Please check your network.';
      } else if (errorStr.contains('access denied') || errorStr.contains('not registered as a delivery rider')) {
        message = 'Access denied. You are not registered as a delivery rider.';
      } else {
        message = 'Login failed. Please try again.';
      }
      
      _showSnack(message, isError: true);
    } finally {
      if (mounted) setState(() => _loading = false);
    }
  }

  Future<void> _handleRegister() async {
    if (_loading) return;

    final cleanCode = _accessCodeController.text.trim().toUpperCase();
    final name = _fullNameController.text.trim();
    final phone = _phoneController.text.trim();
    final email = _emailController.text.trim();
    final password = _passwordController.text;

    if (cleanCode.isEmpty) {
      _showSnack('Please enter your Admin-issued Access Code.', isError: true);
      return;
    }
    if (name.isEmpty) {
      _showSnack('Please enter your Full Name.', isError: true);
      return;
    }
    if (phone.isEmpty) {
      _showSnack('Please enter your Phone Number.', isError: true);
      return;
    }
    if (email.isEmpty) {
      _showSnack('Please enter your Email Address.', isError: true);
      return;
    }
    if (password.length < 6) {
      _showSnack('Password must be at least 6 characters long.', isError: true);
      return;
    }

    setState(() => _loading = true);

    try {
      // 1. Verify Access Code exists and is not used
      final codeValid = await SupabaseService.verifyRiderAccessCode(cleanCode);
      if (!codeValid) {
        throw Exception(
          'Invalid or already used Access Code. Please contact your administrator for a valid registration code.',
        );
      }

      // 2. Sign up rider account - DB trigger automatically verifies access code, auto-confirms email, assigns 'rider' role, creates rider profile, and marks access code as used.
      final authResponse = await SupabaseService.signUpRider(
        email: _emailController.text.trim(),
        password: _passwordController.text,
        fullName: _fullNameController.text.trim(),
        phoneNumber: _phoneController.text.trim(),
        vehicleType: _vehicleType,
        accessCode: cleanCode,
      );

      final newUser = authResponse.user;
      if (newUser == null) throw Exception('Registration failed. Please try again.');

      // Supabase Auth returns an empty identities array when the email is already registered
      if (newUser.identities != null && newUser.identities!.isEmpty) {
        throw Exception('An account with this email already exists. Try signing in instead.');
      }

      // Auto sign-in if session wasn't returned by signUp
      if (SupabaseService.currentUser == null) {
        await SupabaseService.signIn(
          _emailController.text.trim(),
          _passwordController.text,
        );
      }

      _showSnack('Account Registered Successfully! 🚴');
      if (mounted) Navigator.of(context).pushNamedAndRemoveUntil('/dashboard', (route) => false);
    } catch (e) {
      String message;
      final errorStr = e.toString().toLowerCase();

      if (errorStr.contains('rate_limit') || errorStr.contains('too_many_requests') || errorStr.contains('over_email_send')) {
        message = 'Too many attempts. Please wait a moment and try again.';
      } else if (errorStr.contains('user_already_exists') || errorStr.contains('already registered')) {
        message = 'An account with this email already exists. Try signing in instead.';
      } else if (errorStr.contains('invalid or already used')) {
        message = e.toString().replaceFirst('Exception: ', '');
      } else if (errorStr.contains('network') || errorStr.contains('socket') || errorStr.contains('host lookup')) {
        message = 'No internet connection. Please check your network.';
      } else {
        message = e.toString().replaceFirst('Exception: ', '').replaceFirst('AuthApiException(message: ', '').replaceAll(RegExp(r',\s*statusCode.*$'), '');
      }

      _showSnack(message, isError: true);
    } finally {
      if (mounted) setState(() => _loading = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: AppTheme.background,
      body: SafeArea(
        child: Column(
          children: [
            // Hero area with icon and title
            _buildHero(),

            // Login / Register card
            Expanded(child: _buildCard()),
          ],
        ),
      ),
    );
  }

  Widget _buildHero() {
    return Padding(
      padding: const EdgeInsets.fromLTRB(24, 32, 24, 8),
      child: Stack(
        alignment: Alignment.center,
        children: [
          // Glow blob
          Container(
            width: 256,
            height: 256,
            decoration: BoxDecoration(
              shape: BoxShape.circle,
              color: AppTheme.primary.withValues(alpha: 0.1),
              boxShadow: [
                BoxShadow(
                  color: AppTheme.primary.withValues(alpha: 0.1),
                  blurRadius: 80,
                  spreadRadius: 20,
                ),
              ],
            ),
          ),

          // Content
          Column(
            children: [
              // Animated website logo icon
              ScaleTransition(
                scale: _scaleAnim,
                child: FadeTransition(
                  opacity: _fadeAnim,
                  child: Container(
                    width: 104,
                    height: 104,
                    padding: const EdgeInsets.all(12),
                    decoration: BoxDecoration(
                      color: Colors.white,
                      borderRadius: BorderRadius.circular(24),
                      boxShadow: [
                        BoxShadow(
                          color: AppTheme.primary.withValues(alpha: 0.3),
                          blurRadius: 20,
                          offset: const Offset(0, 8),
                        ),
                      ],
                    ),
                    child: Image.asset(
                      'assets/logo.png',
                      fit: BoxFit.contain,
                    ),
                  ),
                ),
              ),

              const SizedBox(height: 20),

              FadeTransition(
                opacity: _fadeAnim,
                child: Column(
                  children: [
                    const Text(
                      'Rider Portal',
                      style: TextStyle(
                        fontSize: 24,
                        fontWeight: FontWeight.bold,
                        color: Colors.white,
                        letterSpacing: -0.5,
                      ),
                    ),
                    const SizedBox(height: 4),
                    Text(
                      "Trades Point",
                      style: TextStyle(
                        fontSize: 14,
                        color: Colors.white.withValues(alpha: 0.5),
                      ),
                    ),
                  ],
                ),
              ),

              const SizedBox(height: 20),

              // Sign In / Register toggle
              _buildToggle(),
            ],
          ),
        ],
      ),
    );
  }

  Widget _buildToggle() {
    return FadeTransition(
      opacity: _fadeAnim,
      child: Container(
        height: 44,
        decoration: BoxDecoration(
          color: const Color(0xFF0F1620),
          borderRadius: BorderRadius.circular(22),
          border: Border.all(color: Colors.white.withValues(alpha: 0.1)),
        ),
        padding: const EdgeInsets.all(3),
        child: Row(
          mainAxisSize: MainAxisSize.min,
          children: [
            _buildToggleButton('Sign In', !_isRegister, () {
              setState(() => _isRegister = false);
            }),
            _buildToggleButton('Register Rider', _isRegister, () {
              setState(() => _isRegister = true);
            }),
          ],
        ),
      ),
    );
  }

  Widget _buildToggleButton(String label, bool active, VoidCallback onTap) {
    return GestureDetector(
      onTap: onTap,
      child: AnimatedContainer(
        duration: const Duration(milliseconds: 200),
        padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 8),
        decoration: BoxDecoration(
          borderRadius: BorderRadius.circular(20),
          gradient: active
              ? const LinearGradient(
                  colors: [Color(0xFF4ADE80), Color(0xFF16A34A)],
                )
              : null,
          boxShadow: active
              ? [
                  BoxShadow(
                    color: AppTheme.primary.withValues(alpha: 0.3),
                    blurRadius: 8,
                    offset: const Offset(0, 2),
                  ),
                ]
              : null,
        ),
        child: Text(
          label,
          style: TextStyle(
            fontSize: 12,
            fontWeight: active ? FontWeight.w700 : FontWeight.w500,
            color: active ? Colors.white : Colors.white.withValues(alpha: 0.5),
          ),
        ),
      ),
    );
  }

  Widget _buildCard() {
    return AnimatedBuilder(
      animation: _fadeAnim,
      builder: (context, child) {
        return Transform.translate(
          offset: Offset(0, 30 * (1 - _fadeAnim.value)),
          child: Opacity(
            opacity: _fadeAnim.value,
            child: child,
          ),
        );
      },
      child: AnimatedSwitcher(
        duration: const Duration(milliseconds: 250),
        child: _isRegister ? _buildRegisterCard() : _buildLoginCard(),
      ),
    );
  }

  // ─── SIGN IN CARD ──────────────────────────────────────────────

  Widget _buildLoginCard() {
    return Container(
      key: const ValueKey('login'),
      decoration: const BoxDecoration(
        color: AppTheme.surface,
        borderRadius: BorderRadius.vertical(top: Radius.circular(32)),
      ),
      padding: const EdgeInsets.fromLTRB(24, 28, 24, 40),
      child: SingleChildScrollView(
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            const Text(
              'Sign In',
              style: TextStyle(
                color: Colors.white,
                fontSize: 20,
                fontWeight: FontWeight.bold,
              ),
            ),
            const SizedBox(height: 4),
            Text(
              'Enter your registered rider credentials',
              style: TextStyle(
                color: Colors.white.withValues(alpha: 0.4),
                fontSize: 13,
              ),
            ),
            const SizedBox(height: 28),

            // Email field
            _buildLabel('EMAIL ADDRESS'),
            const SizedBox(height: 8),
            _buildTextField(
              controller: _emailController,
              hint: 'rider@example.com',
              keyboardType: TextInputType.emailAddress,
            ),

            const SizedBox(height: 20),

            // Password field
            _buildLabel('PASSWORD'),
            const SizedBox(height: 8),
            _buildPasswordField(),

            const SizedBox(height: 28),

            // Sign In button
            _buildActionButton('Sign In →', _handleLogin),

            const SizedBox(height: 24),
            Center(
              child: Text(
                'Only authorized delivery riders with an Admin Access Code can access this portal.',
                style: TextStyle(
                  color: Colors.white.withValues(alpha: 0.25),
                  fontSize: 11,
                ),
                textAlign: TextAlign.center,
              ),
            ),
          ],
        ),
      ),
    );
  }

  // ─── REGISTRATION CARD ─────────────────────────────────────────

  Widget _buildRegisterCard() {
    return Container(
      key: const ValueKey('register'),
      decoration: const BoxDecoration(
        color: AppTheme.surface,
        borderRadius: BorderRadius.vertical(top: Radius.circular(32)),
      ),
      padding: const EdgeInsets.fromLTRB(24, 28, 24, 40),
      child: SingleChildScrollView(
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              children: [
                Icon(LucideIcons.shieldCheck, size: 20, color: AppTheme.primary),
                const SizedBox(width: 8),
                const Text(
                  'Rider Registration',
                  style: TextStyle(
                    color: Colors.white,
                    fontSize: 20,
                    fontWeight: FontWeight.bold,
                  ),
                ),
              ],
            ),
            const SizedBox(height: 4),
            Text(
              'Admin Access Code is required to create a rider account.',
              style: TextStyle(
                color: Colors.white.withValues(alpha: 0.4),
                fontSize: 13,
              ),
            ),
            const SizedBox(height: 24),

            // Admin Access Code
            _buildLabel('ADMIN ACCESS CODE', highlight: true),
            const SizedBox(height: 8),
            _buildAccessCodeField(),
            Padding(
              padding: const EdgeInsets.only(top: 6),
              child: Text(
                'Get your code from the Admin Dashboard.',
                style: TextStyle(
                  color: Colors.white.withValues(alpha: 0.35),
                  fontSize: 11,
                ),
              ),
            ),

            const SizedBox(height: 20),

            // Full Name
            _buildLabel('FULL NAME'),
            const SizedBox(height: 8),
            _buildTextField(
              controller: _fullNameController,
              hint: 'e.g. Kwame Mensah',
            ),

            const SizedBox(height: 16),

            // Phone & Vehicle row
            Row(
              children: [
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      _buildLabel('PHONE NUMBER'),
                      const SizedBox(height: 8),
                      _buildTextField(
                        controller: _phoneController,
                        hint: '+233 24 123 4567',
                        keyboardType: TextInputType.phone,
                      ),
                    ],
                  ),
                ),
                const SizedBox(width: 12),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      _buildLabel('VEHICLE TYPE'),
                      const SizedBox(height: 8),
                      _buildVehicleDropdown(),
                    ],
                  ),
                ),
              ],
            ),

            const SizedBox(height: 16),

            // Email
            _buildLabel('EMAIL ADDRESS'),
            const SizedBox(height: 8),
            _buildTextField(
              controller: _emailController,
              hint: 'rider@example.com',
              keyboardType: TextInputType.emailAddress,
            ),

            const SizedBox(height: 16),

            // Password
            _buildLabel('PASSWORD'),
            const SizedBox(height: 8),
            _buildPasswordField(),

            const SizedBox(height: 28),

            // Register button
            _buildActionButton(
              'Register & Access App →',
              _handleRegister,
              loadingText: 'Verifying Code & Creating Account...',
            ),

            const SizedBox(height: 24),
            Center(
              child: Text(
                'Only authorized delivery riders with an Admin Access Code can access this portal.',
                style: TextStyle(
                  color: Colors.white.withValues(alpha: 0.25),
                  fontSize: 11,
                ),
                textAlign: TextAlign.center,
              ),
            ),
          ],
        ),
      ),
    );
  }

  // ─── SHARED WIDGETS ────────────────────────────────────────────

  Widget _buildLabel(String text, {bool highlight = false}) {
    return Text(
      text,
      style: TextStyle(
        color: highlight ? AppTheme.primary : Colors.white.withValues(alpha: 0.6),
        fontSize: 11,
        fontWeight: FontWeight.w600,
        letterSpacing: 1.2,
      ),
    );
  }

  Widget _buildTextField({
    required TextEditingController controller,
    required String hint,
    TextInputType keyboardType = TextInputType.text,
  }) {
    return Container(
      height: 52,
      decoration: BoxDecoration(
        color: const Color(0xFF0F1620),
        borderRadius: BorderRadius.circular(14),
        border: Border.all(color: Colors.white.withValues(alpha: 0.1)),
      ),
      child: TextField(
        controller: controller,
        keyboardType: keyboardType,
        style: const TextStyle(color: Colors.white, fontSize: 14),
        decoration: InputDecoration(
          hintText: hint,
          hintStyle: TextStyle(color: Colors.white.withValues(alpha: 0.25)),
          border: InputBorder.none,
          contentPadding: const EdgeInsets.symmetric(horizontal: 16, vertical: 16),
        ),
      ),
    );
  }

  Widget _buildPasswordField() {
    return Container(
      height: 52,
      decoration: BoxDecoration(
        color: const Color(0xFF0F1620),
        borderRadius: BorderRadius.circular(14),
        border: Border.all(color: Colors.white.withValues(alpha: 0.1)),
      ),
      child: Row(
        children: [
          Expanded(
            child: TextField(
              controller: _passwordController,
              obscureText: !_showPassword,
              style: const TextStyle(color: Colors.white, fontSize: 14),
              decoration: InputDecoration(
                hintText: '••••••••',
                hintStyle: TextStyle(color: Colors.white.withValues(alpha: 0.25)),
                border: InputBorder.none,
                contentPadding: const EdgeInsets.symmetric(horizontal: 16, vertical: 16),
              ),
            ),
          ),
          GestureDetector(
            onTap: () => setState(() => _showPassword = !_showPassword),
            child: Padding(
              padding: const EdgeInsets.only(right: 16),
              child: Icon(
                _showPassword ? LucideIcons.eyeOff : LucideIcons.eye,
                size: 20,
                color: Colors.white.withValues(alpha: 0.3),
              ),
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildAccessCodeField() {
    return Container(
      height: 52,
      decoration: BoxDecoration(
        color: const Color(0xFF0F1620),
        borderRadius: BorderRadius.circular(14),
        border: Border.all(color: AppTheme.primary.withValues(alpha: 0.4)),
      ),
      child: Row(
        children: [
          Padding(
            padding: const EdgeInsets.only(left: 14),
            child: Icon(LucideIcons.keyRound, size: 16, color: AppTheme.primary),
          ),
          Expanded(
            child: TextField(
              controller: _accessCodeController,
              textCapitalization: TextCapitalization.characters,
              style: const TextStyle(
                color: Colors.white,
                fontSize: 14,
                fontFamily: 'monospace',
                letterSpacing: 2,
              ),
              decoration: InputDecoration(
                hintText: 'e.g. RIDER-4892',
                hintStyle: TextStyle(
                  color: Colors.white.withValues(alpha: 0.2),
                  fontFamily: 'monospace',
                  letterSpacing: 2,
                ),
                border: InputBorder.none,
                contentPadding: const EdgeInsets.symmetric(horizontal: 12, vertical: 16),
              ),
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildVehicleDropdown() {
    return Container(
      height: 52,
      decoration: BoxDecoration(
        color: const Color(0xFF0F1620),
        borderRadius: BorderRadius.circular(14),
        border: Border.all(color: Colors.white.withValues(alpha: 0.1)),
      ),
      padding: const EdgeInsets.symmetric(horizontal: 12),
      child: DropdownButtonHideUnderline(
        child: DropdownButton<String>(
          value: _vehicleType,
          isExpanded: true,
          dropdownColor: const Color(0xFF1A2234),
          style: const TextStyle(color: Colors.white, fontSize: 14),
          icon: Icon(LucideIcons.chevronDown, size: 16, color: Colors.white.withValues(alpha: 0.4)),
          items: ['Motorcycle', 'Bicycle', 'Car', 'Van']
              .map((v) => DropdownMenuItem(value: v, child: Text(v)))
              .toList(),
          onChanged: (v) {
            if (v != null) setState(() => _vehicleType = v);
          },
        ),
      ),
    );
  }

  Widget _buildActionButton(String label, VoidCallback onTap, {String? loadingText}) {
    return GestureDetector(
      onTap: _loading ? null : onTap,
      child: Container(
        height: 52,
        decoration: BoxDecoration(
          borderRadius: BorderRadius.circular(14),
          gradient: const LinearGradient(
            colors: [Color(0xFF4ADE80), Color(0xFF16A34A)],
          ),
          boxShadow: [
            BoxShadow(
              color: AppTheme.primary.withValues(alpha: 0.25),
              blurRadius: 20,
              offset: const Offset(0, 8),
            ),
          ],
        ),
        child: Center(
          child: _loading
              ? Row(
                  mainAxisAlignment: MainAxisAlignment.center,
                  children: [
                    const SizedBox(
                      width: 18,
                      height: 18,
                      child: CircularProgressIndicator(
                        strokeWidth: 2,
                        color: Colors.white,
                      ),
                    ),
                    if (loadingText != null) ...[
                      const SizedBox(width: 10),
                      Text(
                        loadingText,
                        style: const TextStyle(
                          color: Colors.white,
                          fontSize: 13,
                          fontWeight: FontWeight.w600,
                        ),
                      ),
                    ],
                  ],
                )
              : Text(
                  label,
                  style: const TextStyle(
                    color: Colors.white,
                    fontSize: 15,
                    fontWeight: FontWeight.bold,
                  ),
                ),
        ),
      ),
    );
  }
}
