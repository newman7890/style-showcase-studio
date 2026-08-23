import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'services/supabase_service.dart';
import 'theme/app_theme.dart';
import 'screens/login_screen.dart';
import 'screens/dashboard_screen.dart';
import 'screens/order_detail_screen.dart';
import 'screens/help_support_screen.dart';

void main() async {
  WidgetsFlutterBinding.ensureInitialized();

  // Lock to portrait mode for the rider app
  await SystemChrome.setPreferredOrientations([
    DeviceOrientation.portraitUp,
    DeviceOrientation.portraitDown,
  ]);

  // Set system UI overlay style for dark theme
  SystemChrome.setSystemUIOverlayStyle(const SystemUiOverlayStyle(
    statusBarColor: Colors.transparent,
    statusBarIconBrightness: Brightness.light,
    systemNavigationBarColor: AppTheme.background,
    systemNavigationBarIconBrightness: Brightness.light,
  ));

  // Initialize Supabase
  await SupabaseService.initialize();

  runApp(const RiderApp());
}

class RiderApp extends StatelessWidget {
  const RiderApp({super.key});

  @override
  Widget build(BuildContext context) {
    return MaterialApp(
      title: 'Rider App',
      debugShowCheckedModeBanner: false,
      theme: AppTheme.darkTheme,
      initialRoute: '/login',
      onGenerateRoute: (settings) {
        // Handle /order/:id route
        if (settings.name != null && settings.name!.startsWith('/order/')) {
          final orderId = settings.name!.replaceFirst('/order/', '');
          return MaterialPageRoute(
            builder: (_) => OrderDetailScreen(orderId: orderId),
          );
        }

        // Handle /support route with optional orderId parameter
        if (settings.name != null && settings.name!.startsWith('/support')) {
          final uri = Uri.parse(settings.name!);
          final orderId = uri.queryParameters['orderId'];
          return MaterialPageRoute(
            builder: (_) => HelpSupportScreen(orderId: orderId),
          );
        }

        switch (settings.name) {
          case '/login':
            return MaterialPageRoute(builder: (_) => const LoginScreen());
          case '/dashboard':
            return MaterialPageRoute(builder: (_) => const DashboardScreen());
          default:
            return MaterialPageRoute(builder: (_) => const LoginScreen());
        }
      },
    );
  }
}
