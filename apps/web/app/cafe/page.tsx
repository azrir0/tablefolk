import React, { Suspense } from "react";
import { CafeExperience } from "@/components/CafeExperience";

export const metadata = {
  title: "Sunlit Oak Café — TableFolk",
  robots: { index: false, follow: false },
};

export default function CafePage() {
  return (
    <Suspense
      fallback={
        <div className="flex h-screen items-center justify-center bg-oat-100 font-display text-lg font-bold text-espresso">
          Brewing espresso &amp; setting up tables...
        </div>
      }
    >
      <CafeExperience />
    </Suspense>
  );
}
