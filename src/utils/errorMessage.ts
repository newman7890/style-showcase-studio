/**
 * Converts raw technical errors (like "Failed to fetch") into clear, human-friendly messages.
 */
export const getFriendlyErrorMessage = (error: any): string => {
  if (!error) return "An unexpected error occurred. Please try again.";

  const msg =
    typeof error === "string"
      ? error
      : error?.message || error?.error_description || error?.userMessage || String(error);

  // Internet / Network Offline Errors
  if (
    msg.includes("Failed to fetch") ||
    msg.includes("NetworkError") ||
    msg.includes("network") ||
    msg.includes("Load failed") ||
    msg.includes("fetch failed") ||
    (typeof navigator !== "undefined" && !navigator.onLine)
  ) {
    return "No Internet Connection. Please check your network connection and try again.";
  }

  // Authentication Errors
  if (msg.toLowerCase().includes("invalid login credentials")) {
    return "Incorrect email or password. Please check your details and try again.";
  }

  if (msg.toLowerCase().includes("user already registered")) {
    return "An account with this email already exists. Please log in instead.";
  }

  if (msg.toLowerCase().includes("email not confirmed")) {
    return "Please confirm your email address before logging in.";
  }

  if (msg.toLowerCase().includes("password should be at least")) {
    return "Password must be at least 6 characters long.";
  }

  return msg;
};
