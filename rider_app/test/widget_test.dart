import 'package:flutter_test/flutter_test.dart';
import 'package:rider_app/main.dart';

void main() {
  testWidgets('App renders login screen', (WidgetTester tester) async {
    await tester.pumpWidget(const RiderApp());
    expect(find.text('Rider Portal'), findsOneWidget);
  });
}
