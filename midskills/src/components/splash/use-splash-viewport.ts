"use client";

import { useEffect, useState } from "react";

export type SplashViewportTier = "xs" | "sm" | "md" | "lg" | "xl";

export type SplashViewport = {
  tier: SplashViewportTier;
  short: boolean;
  width: number;
};

function resolveViewport(width: number, height: number): SplashViewport {
  const short = height < 680;
  let tier: SplashViewportTier = "xl";
  if (width < 380) tier = "xs";
  else if (width < 640) tier = "sm";
  else if (width < 1024) tier = "md";
  else if (width < 1280) tier = "lg";

  return { tier, short, width };
}

export function useSplashViewport(): SplashViewport {
  const [viewport, setViewport] = useState<SplashViewport>({
    tier: "lg",
    short: false,
    width: 1280,
  });

  useEffect(() => {
    function update() {
      setViewport(resolveViewport(window.innerWidth, window.innerHeight));
    }

    update();
    window.addEventListener("resize", update, { passive: true });
    window.addEventListener("orientationchange", update);
    return () => {
      window.removeEventListener("resize", update);
      window.removeEventListener("orientationchange", update);
    };
  }, []);

  return viewport;
}
