import { useNavigate } from "react-router-dom";
import { BottomNav } from "@/components/BottomNav";
import { motion } from "framer-motion";
import { 
  ChevronLeft, 
  Phone, 
  Mail, 
  MessageCircle, 
  MapPin, 
  Clock,
  ChevronRight,
  Headphones
} from "lucide-react";

const ContactUs = () => {
  const navigate = useNavigate();

  const contactOptions = [
    {
      icon: Phone,
      title: "Call Us",
      description: "Talk to our support team",
      value: "+1 (800) 123-4567",
      action: () => window.open("tel:+18001234567"),
    },
    {
      icon: Mail,
      title: "Email Us",
      description: "Get help via email",
      value: "support@shopapp.com",
      action: () => window.open("mailto:support@shopapp.com"),
    },
    {
      icon: MessageCircle,
      title: "Live Chat",
      description: "Chat with us in real-time",
      value: "Available 24/7",
      action: () => {
        // In a real app, this would open a chat widget
        alert("Live chat feature coming soon!");
      },
    },
  ];

  const faqItems = [
    { question: "How do I track my order?", path: "/track-order" },
    { question: "What is your return policy?", path: "/settings/privacy" },
    { question: "How do I change my password?", path: "/settings/password" },
    { question: "How do I update my address?", path: "/profile/address" },
  ];

  return (
    <>
      <div className="min-h-screen bg-background pb-20">
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-4 bg-background">
          <button
            onClick={() => navigate(-1)}
            className="w-10 h-10 rounded-full border border-border flex items-center justify-center"
          >
            <ChevronLeft className="w-5 h-5" />
          </button>
          <h1 className="text-lg font-semibold">Contact Us</h1>
          <div className="w-10 h-10" />
        </div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="px-4"
        >
          {/* Hero Section */}
          <div className="text-center py-6">
            <div className="w-20 h-20 bg-primary/10 rounded-full flex items-center justify-center mx-auto mb-4">
              <Headphones className="w-10 h-10 text-primary" />
            </div>
            <h2 className="text-xl font-semibold mb-2">How can we help you?</h2>
            <p className="text-muted-foreground text-sm">
              Our customer service team is here to assist you
            </p>
          </div>

          {/* Contact Options */}
          <div className="space-y-3 mb-8">
            {contactOptions.map((option, index) => (
              <motion.button
                key={option.title}
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: index * 0.1 }}
                onClick={option.action}
                className="w-full flex items-center gap-4 p-4 bg-secondary/30 hover:bg-secondary/50 rounded-xl transition-colors"
              >
                <div className="w-12 h-12 bg-primary/10 rounded-full flex items-center justify-center">
                  <option.icon className="w-6 h-6 text-primary" />
                </div>
                <div className="flex-1 text-left">
                  <h3 className="font-medium">{option.title}</h3>
                  <p className="text-sm text-muted-foreground">{option.description}</p>
                  <p className="text-sm text-primary mt-1">{option.value}</p>
                </div>
                <ChevronRight className="w-5 h-5 text-muted-foreground" />
              </motion.button>
            ))}
          </div>

          {/* Business Hours */}
          <div className="bg-secondary/30 rounded-xl p-4 mb-8">
            <div className="flex items-center gap-3 mb-3">
              <Clock className="w-5 h-5 text-primary" />
              <h3 className="font-medium">Business Hours</h3>
            </div>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Monday - Friday</span>
                <span>9:00 AM - 8:00 PM</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Saturday</span>
                <span>10:00 AM - 6:00 PM</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Sunday</span>
                <span>Closed</span>
              </div>
            </div>
          </div>

          {/* Office Location */}
          <div className="bg-secondary/30 rounded-xl p-4 mb-8">
            <div className="flex items-center gap-3 mb-3">
              <MapPin className="w-5 h-5 text-primary" />
              <h3 className="font-medium">Office Location</h3>
            </div>
            <p className="text-sm text-muted-foreground">
              123 Commerce Street, Suite 456<br />
              New York, NY 10001<br />
              United States
            </p>
          </div>

          {/* FAQ Section */}
          <div>
            <h3 className="font-medium mb-3">Frequently Asked Questions</h3>
            <div className="space-y-1">
              {faqItems.map((item, index) => (
                <motion.button
                  key={item.question}
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 0.3 + index * 0.05 }}
                  onClick={() => navigate(item.path)}
                  className="w-full flex items-center justify-between py-3 hover:bg-secondary/50 rounded-lg px-2 transition-colors"
                >
                  <span className="text-sm">{item.question}</span>
                  <ChevronRight className="w-4 h-4 text-muted-foreground" />
                </motion.button>
              ))}
            </div>
          </div>
        </motion.div>
      </div>
      <BottomNav />
    </>
  );
};

export default ContactUs;
