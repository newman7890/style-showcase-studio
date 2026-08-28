import { useEffect } from "react";

export function SourceProtection() {
  useEffect(() => {
    const handleContextMenu = (e: MouseEvent) => {
      e.preventDefault();
      return false;
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      // F12 key
      if (e.key === "F12" || e.keyCode === 123) {
        e.preventDefault();
        return false;
      }

      // Inspect / View Source shortcuts
      if (
        (e.ctrlKey || e.metaKey) &&
        (e.shiftKey
          ? ["I", "i", "J", "j", "C", "c"].includes(e.key)
          : ["U", "u", "S", "s"].includes(e.key))
      ) {
        e.preventDefault();
        return false;
      }
    };

    document.addEventListener("contextmenu", handleContextMenu);
    document.addEventListener("keydown", handleKeyDown);

    return () => {
      document.removeEventListener("contextmenu", handleContextMenu);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, []);

  return null;
}
