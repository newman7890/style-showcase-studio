import { useState, useEffect } from "react";

interface TimeLeft {
  days: number;
  hours: number;
  minutes: number;
  seconds: number;
  formattedHours: string;
  formattedMinutes: string;
  formattedSeconds: string;
  isExpired: boolean;
  totalSeconds: number;
}

export const useCountdown = (
  targetDate: string | Date | number | null | undefined,
  autoRenew: boolean = true
): TimeLeft => {
  const calculateTimeLeft = (): TimeLeft => {
    const now = new Date().getTime();
    let target = targetDate
      ? typeof targetDate === "string" || typeof targetDate === "number"
        ? new Date(targetDate).getTime()
        : targetDate.getTime()
      : 0;

    let difference = target - now;

    // If target is in the past, missing, or invalid and autoRenew is enabled:
    // Auto-roll over to the end of the day (midnight tonight) or 8-hour rolling window
    if ((difference <= 0 || isNaN(difference)) && autoRenew) {
      const midnight = new Date();
      midnight.setHours(23, 59, 59, 999);
      difference = midnight.getTime() - now;
      if (difference <= 0) {
        difference = 8 * 60 * 60 * 1000; // 8 hours fallback
      }
    } else if (difference <= 0 || isNaN(difference)) {
      return {
        days: 0,
        hours: 0,
        minutes: 0,
        seconds: 0,
        formattedHours: "00",
        formattedMinutes: "00",
        formattedSeconds: "00",
        isExpired: true,
        totalSeconds: 0,
      };
    }

    const days = Math.floor(difference / (1000 * 60 * 60 * 24));
    const hours = Math.floor((difference / (1000 * 60 * 60)) % 24) + days * 24;
    const minutes = Math.floor((difference / 1000 / 60) % 60);
    const seconds = Math.floor((difference / 1000) % 60);

    return {
      days,
      hours,
      minutes,
      seconds,
      formattedHours: String(hours).padStart(2, "0"),
      formattedMinutes: String(minutes).padStart(2, "0"),
      formattedSeconds: String(seconds).padStart(2, "0"),
      isExpired: false,
      totalSeconds: Math.floor(difference / 1000),
    };
  };

  const [timeLeft, setTimeLeft] = useState<TimeLeft>(calculateTimeLeft);

  useEffect(() => {
    setTimeLeft(calculateTimeLeft());

    const timer = setInterval(() => {
      setTimeLeft(calculateTimeLeft());
    }, 1000);

    return () => clearInterval(timer);
  }, [targetDate, autoRenew]);

  return timeLeft;
};
