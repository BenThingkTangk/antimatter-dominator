// Global state store that persists across page navigation
// Using a simple module-level singleton — survives React re-renders and route changes

interface Pitch {
  id: number;
  productId: number;
  pitchType: string;
  targetPersona: string;
  content: string;
  createdAt: string;
}

interface ObjectionEntry {
  id: number;
  productId: number;
  objection: string;
  response: string;
  category: string;
  createdAt: string;
}

interface MarketIntel {
  id: number;
  title: string;
  summary: string;
  relevantProducts: string;
  impactLevel: string;
  source: string;
  category: string;
  createdAt: string;
}

interface Prospect {
  id: number;
  companyName: string;
  industry: string;
  score: number;
  reason: string;
  matchedProducts: string;
  signals: string;
  companySize: string;
  urgency: string;
  lastUpdated: string;
  status: string;
}

type Listener = () => void;

class SalesStore {
  pitches: Pitch[] = [];
  objections: ObjectionEntry[] = [];
  intel: MarketIntel[] = [];
  prospects: Prospect[] = [];

  private listeners = new Set<Listener>();

  subscribe(listener: Listener) {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  private notify() {
    this.listeners.forEach((l) => l());
  }

  addPitch(pitch: Pitch) {
    this.pitches = [pitch, ...this.pitches];
    this.notify();
  }

  addObjection(obj: ObjectionEntry) {
    this.objections = [obj, ...this.objections];
    this.notify();
  }

  addIntel(item: MarketIntel) {
    this.intel = [item, ...this.intel];
    this.notify();
  }

  addProspects(newProspects: Prospect[]) {
    const newNames = new Set(newProspects.map((p) => p.companyName));
    const existing = this.prospects.filter((p) => !newNames.has(p.companyName));
    this.prospects = [...newProspects, ...existing].sort((a, b) => b.score - a.score);
    this.notify();
  }

  updateProspectStatus(id: number, status: string) {
    this.prospects = this.prospects.map((p) => (p.id === id ? { ...p, status } : p));
    this.notify();
  }
}

export const store = new SalesStore();

// React hook to subscribe to store changes
import { useSyncExternalStore } from "react";

export function usePitches() {
  return useSyncExternalStore(
    (cb) => store.subscribe(cb),
    () => store.pitches
  );
}

export function useObjections() {
  return useSyncExternalStore(
    (cb) => store.subscribe(cb),
    () => store.objections
  );
}

export function useIntel() {
  return useSyncExternalStore(
    (cb) => store.subscribe(cb),
    () => store.intel
  );
}

export function useProspects() {
  return useSyncExternalStore(
    (cb) => store.subscribe(cb),
    () => store.prospects
  );
}

export type { Pitch, ObjectionEntry, MarketIntel, Prospect };
