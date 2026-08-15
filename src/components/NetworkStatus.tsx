import { useState, useEffect } from "react";
import { WifiOff, Wifi } from "lucide-react";

const NetworkStatus = () => {
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [showReconnected, setShowReconnected] = useState(false);
  const [wasOffline, setWasOffline] = useState(false);

  useEffect(() => {
    const handleOnline = () => {
      setIsOnline(true);
      if (wasOffline) {
        setShowReconnected(true);
        setTimeout(() => setShowReconnected(false), 3000);
      }
    };

    const handleOffline = () => {
      setIsOnline(false);
      setWasOffline(true);
    };

    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);

    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
    };
  }, [wasOffline]);

  // Nothing to show
  if (isOnline && !showReconnected) return null;

  return (
    <div
      style={{
        position: "fixed",
        top: 0,
        left: 0,
        right: 0,
        zIndex: 99999,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        gap: "10px",
        padding: "12px 20px",
        fontFamily: "'Inter', 'Segoe UI', sans-serif",
        fontSize: "14px",
        fontWeight: 600,
        color: "#fff",
        background: isOnline
          ? "linear-gradient(135deg, #10b981, #059669)"
          : "linear-gradient(135deg, #ef4444, #dc2626)",
        boxShadow: "0 4px 20px rgba(0,0,0,0.3)",
        animation: "slideDown 0.4s cubic-bezier(0.16, 1, 0.3, 1)",
      }}
    >
      <style>{`
        @keyframes slideDown {
          from { transform: translateY(-100%); opacity: 0; }
          to { transform: translateY(0); opacity: 1; }
        }
        @keyframes pulse-icon {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.4; }
        }
      `}</style>

      {isOnline ? (
        <>
          <Wifi size={20} />
          <span>Back online — connection restored!</span>
        </>
      ) : (
        <>
          <WifiOff
            size={20}
            style={{ animation: "pulse-icon 1.5s ease-in-out infinite" }}
          />
          <span>No internet connection. Please check your network.</span>
        </>
      )}
    </div>
  );
};

export default NetworkStatus;
