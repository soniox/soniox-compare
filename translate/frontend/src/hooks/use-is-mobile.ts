import { createContext, useContext, useState, useEffect } from "react";

const MOBILE_BREAKPOINT = 768; // Corresponds to Tailwind's `md` breakpoint

/** Set inside the recording stage, whose width decides the layout there. */
export const LayoutWindowContext = createContext<Window | null>(null);

export const useIsMobile = () => {
  const layoutWindow = useContext(LayoutWindowContext);
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }
    const view = layoutWindow ?? window;

    const checkScreenSize = () => {
      setIsMobile(view.innerWidth < MOBILE_BREAKPOINT);
    };

    checkScreenSize();
    view.addEventListener("resize", checkScreenSize);

    return () => view.removeEventListener("resize", checkScreenSize);
  }, [layoutWindow]);

  return isMobile;
};
