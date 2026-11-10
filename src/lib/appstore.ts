"use client";
import { create } from "zustand";

export type EngineId = "home" | "v1" | "v2";
export const useApp = create<{ engine: EngineId; setEngine: (e: EngineId) => void }>((set) => ({
  engine: "home",
  setEngine: (engine) => set({ engine }),
}));
