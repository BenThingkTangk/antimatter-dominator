// Global state store with localStorage persistence
// Survives page refreshes and navigation

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

interface Contact {
  email: string;
  firstName: string;
  lastName: string;
  position: string;
  seniority: string;
  department: string;
  linkedin: string | null;
  phone: string | null;
  confidence: number;
  verification: string;
}

interface Prospect {
  id: number;
  companyName: string;
  domain: string;
  industry: string;
  score: number;
  reason: string;
  matchedProducts: string;
  signals: string;
  companySize: string;
  urgency: string;
  lastUpdated: string;
  status: string;
  contacts: string;
}

interface CallRecord {
  id: number;
  companyName: string;
  contactName: string;
  contactTitle: string;
  productSlug: string;
  phoneNumber: string;
  callType: "simulated" | "twilio-dial" | "hume-voice";
  callSid: string;
  transcript: string;
  sentimentTimeline: string;
  intentTimeline: string;
  emotionalTones: string;
  qualification: string;
  outcome: string;
  duration: number;
  aiRecommendations: string;
  createdAt: string;
  status: string;
  sentiment: number;
  buyerIntent: number;
}

type Listener = () => void;

// localStorage helpers
function loadFromStorage<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(`dominator_${key}`);
    return raw ? JSON.parse(raw) : fallback;
  } catch {
    return fallback;
  }
}

function saveToStorage<T>(key: string, data: T) {
  try {
    localStorage.setItem(`dominator_${key}`, JSON.stringify(data));
  } catch {
    // localStorage full or unavailable — silently fail
  }
}

class SalesStore {
  pitches: Pitch[] = loadFromStorage("pitches", []);
  objections: ObjectionEntry[] = loadFromStorage("objections", []);
  intel: MarketIntel[] = loadFromStorage("intel", []);
  prospects: Prospect[] = loadFromStorage("prospects", []);
  calls: CallRecord[] = loadFromStorage("calls", []);

  private listeners = new Set<Listener>();

  subscribe(listener: Listener) {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  private notify() {
    this.listeners.forEach((l) => l());
  }

  private persist() {
    saveToStorage("pitches", this.pitches);
    saveToStorage("objections", this.objections);
    saveToStorage("intel", this.intel);
    saveToStorage("prospects", this.prospects);
    saveToStorage("calls", this.calls);
  }

  // Pitches
  addPitch(pitch: Pitch) {
    this.pitches = [pitch, ...this.pitches];
    this.notify();
    this.persist();
  }

  // Objections
  addObjection(obj: ObjectionEntry) {
    this.objections = [obj, ...this.objections];
    this.notify();
    this.persist();
  }

  // Intel
  addIntel(item: MarketIntel) {
    this.intel = [item, ...this.intel];
    this.notify();
    this.persist();
  }

  // Prospects
  addProspects(newProspects: Prospect[]) {
    const newNames = new Set(newProspects.map((p) => p.companyName));
    const existing = this.prospects.filter((p) => !newNames.has(p.companyName));
    this.prospects = [...newProspects, ...existing].sort((a, b) => b.score - a.score);
    this.notify();
    this.persist();
  }

  updateProspectStatus(id: number, status: string) {
    this.prospects = this.prospects.map((p) => (p.id === id ? { ...p, status } : p));
    this.notify();
    this.persist();
  }

  updateProspectContacts(id: number, contacts: string) {
    this.prospects = this.prospects.map((p) => (p.id === id ? { ...p, contacts } : p));
    this.notify();
    this.persist();
  }

  // Calls
  addCall(call: CallRecord) {
    this.calls = [call, ...this.calls];
    this.notify();
    this.persist();
  }

  updateCall(id: number, updates: Partial<CallRecord>) {
    this.calls = this.calls.map((c) => (c.id === id ? { ...c, ...updates } : c));
    this.notify();
    this.persist();
  }

  clearAll() {
    this.pitches = [];
    this.objections = [];
    this.intel = [];
    this.prospects = [];
    this.calls = [];
    this.notify();
    this.persist();
  }
}

export const store = new SalesStore();

import { useSyncExternalStore } from "react";

export function usePitches() {
  return useSyncExternalStore((cb) => store.subscribe(cb), () => store.pitches);
}

export function useObjections() {
  return useSyncExternalStore((cb) => store.subscribe(cb), () => store.objections);
}

export function useIntel() {
  return useSyncExternalStore((cb) => store.subscribe(cb), () => store.intel);
}

export function useProspects() {
  return useSyncExternalStore((cb) => store.subscribe(cb), () => store.prospects);
}

export function useCalls() {
  return useSyncExternalStore((cb) => store.subscribe(cb), () => store.calls);
}

export type { Pitch, ObjectionEntry, MarketIntel, Prospect, Contact, CallRecord };
