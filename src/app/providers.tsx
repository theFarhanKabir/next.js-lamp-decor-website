"use client";

import type { ReactNode } from "react";
import { AppProvider } from "./App";

export default function Providers({ children }: { children: ReactNode }) {
  return <AppProvider>{children}</AppProvider>;
}
