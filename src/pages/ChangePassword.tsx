import { useNavigate } from "react-router-dom";
import { BottomNav } from "@/components/BottomNav";
import { motion } from "framer-motion";
import { ChevronLeft, Eye, EyeOff, Lock, Check } from "lucide-react";
import { useState } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

const ChangePassword = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showCurrentPassword, setShowCurrentPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  const passwordRequirements = [
    { label: "At least 8 characters", met: newPassword.length >= 8 },
    { label: "Contains uppercase letter", met: /[A-Z]/.test(newPassword) },
    { label: "Contains lowercase letter", met: /[a-z]/.test(newPassword) },
    { label: "Contains a number", met: /\d/.test(newPassword) },
    { label: "Passwords match", met: newPassword === confirmPassword && confirmPassword.length > 0 },
  ];

  const allRequirementsMet = passwordRequirements.every((req) => req.met);

  const handleChangePassword = async () => {
    if (!allRequirementsMet) {
      toast({
        title: "Error",
        description: "Please meet all password requirements",
        variant: "destructive",
      });
      return;
    }
    if (!currentPassword) {
      toast({
        title: "Error",
        description: "Please enter your current password",
        variant: "destructive",
      });
      return;
    }


    setIsLoading(true);
    try {
      // Re-authenticate with current password to prove ownership
      const { data: sessionData } = await supabase.auth.getUser();
      const email = sessionData.user?.email;
      if (!email) throw new Error("No active session");

      const { error: reauthError } = await supabase.auth.signInWithPassword({
        email,
        password: currentPassword,
      });
      if (reauthError) {
        throw new Error("Current password is incorrect");
      }

      const { error } = await supabase.auth.updateUser({
        password: newPassword,
      });

      if (error) throw error;


      toast({
        title: "Success",
        description: "Your password has been updated successfully",
      });

      // Clear form
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");

      // Navigate back after a short delay
      setTimeout(() => navigate(-1), 1500);
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to update password",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

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
          <h1 className="text-lg font-semibold">Change Password</h1>
          <div className="w-10 h-10" />
        </div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="px-4"
        >
          {/* Lock Icon */}
          <div className="text-center py-6">
            <div className="w-20 h-20 bg-primary/10 rounded-full flex items-center justify-center mx-auto mb-4">
              <Lock className="w-10 h-10 text-primary" />
            </div>
            <p className="text-muted-foreground text-sm">
              Create a strong password to secure your account
            </p>
          </div>

          {/* Form */}
          <div className="space-y-6">
            {/* Current Password */}
            <div className="space-y-2">
              <Label htmlFor="currentPassword">Current Password</Label>
              <div className="relative">
                <Input
                  id="currentPassword"
                  type={showCurrentPassword ? "text" : "password"}
                  value={currentPassword}
                  onChange={(e) => setCurrentPassword(e.target.value)}
                  placeholder="Enter current password"
                  className="pr-10"
                />
                <button
                  type="button"
                  onClick={() => setShowCurrentPassword(!showCurrentPassword)}
                  className="absolute right-3 top-1/2 transform -translate-y-1/2 text-muted-foreground"
                >
                  {showCurrentPassword ? (
                    <EyeOff className="w-5 h-5" />
                  ) : (
                    <Eye className="w-5 h-5" />
                  )}
                </button>
              </div>
            </div>

            {/* New Password */}
            <div className="space-y-2">
              <Label htmlFor="newPassword">New Password</Label>
              <div className="relative">
                <Input
                  id="newPassword"
                  type={showNewPassword ? "text" : "password"}
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder="Enter new password"
                  className="pr-10"
                />
                <button
                  type="button"
                  onClick={() => setShowNewPassword(!showNewPassword)}
                  className="absolute right-3 top-1/2 transform -translate-y-1/2 text-muted-foreground"
                >
                  {showNewPassword ? (
                    <EyeOff className="w-5 h-5" />
                  ) : (
                    <Eye className="w-5 h-5" />
                  )}
                </button>
              </div>
            </div>

            {/* Confirm Password */}
            <div className="space-y-2">
              <Label htmlFor="confirmPassword">Confirm New Password</Label>
              <div className="relative">
                <Input
                  id="confirmPassword"
                  type={showConfirmPassword ? "text" : "password"}
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="Confirm new password"
                  className="pr-10"
                />
                <button
                  type="button"
                  onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                  className="absolute right-3 top-1/2 transform -translate-y-1/2 text-muted-foreground"
                >
                  {showConfirmPassword ? (
                    <EyeOff className="w-5 h-5" />
                  ) : (
                    <Eye className="w-5 h-5" />
                  )}
                </button>
              </div>
            </div>

            {/* Password Requirements */}
            <div className="bg-secondary/30 rounded-xl p-4">
              <h3 className="text-sm font-medium mb-3">Password Requirements</h3>
              <div className="space-y-2">
                {passwordRequirements.map((req, index) => (
                  <div key={index} className="flex items-center gap-2">
                    <div
                      className={`w-5 h-5 rounded-full flex items-center justify-center ${
                        req.met ? "bg-green-500" : "bg-muted"
                      }`}
                    >
                      {req.met && <Check className="w-3 h-3 text-white" />}
                    </div>
                    <span
                      className={`text-sm ${
                        req.met ? "text-foreground" : "text-muted-foreground"
                      }`}
                    >
                      {req.label}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            {/* Submit Button */}
            <Button
              onClick={handleChangePassword}
              disabled={!allRequirementsMet || isLoading}
              className="w-full"
            >
              {isLoading ? "Updating..." : "Update Password"}
            </Button>
          </div>
        </motion.div>
      </div>
      <BottomNav />
    </>
  );
};

export default ChangePassword;
