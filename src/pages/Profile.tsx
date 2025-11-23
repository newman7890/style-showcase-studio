import { Header } from "@/components/Header";
import { BottomNav } from "@/components/BottomNav";
import { motion } from "framer-motion";
import { User } from "lucide-react";

const Profile = () => {
  return (
    <>
      <Header />
      <main className="min-h-screen pt-16 pb-20">
        <div className="container mx-auto px-4 py-8">
          <motion.h1
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            className="text-3xl font-semibold mb-8"
          >
            Profile
          </motion.h1>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="flex flex-col items-center justify-center min-h-[50vh]"
          >
            <div className="w-24 h-24 rounded-full bg-secondary flex items-center justify-center mb-4">
              <User className="w-12 h-12 text-muted-foreground" />
            </div>
            <h2 className="text-xl font-semibold mb-2">Sign in to continue</h2>
            <p className="text-muted-foreground text-center max-w-sm">
              Create an account or sign in to save your preferences
            </p>
          </motion.div>
        </div>
      </main>
      <BottomNav />
    </>
  );
};

export default Profile;
