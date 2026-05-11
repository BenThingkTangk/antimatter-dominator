/**
 * @nirmata/dtom-brand-system — salesDominatorChapters.ts
 *
 * Canonical chapter data for the ΔTOM Sales Dominator pinned keynote sequence.
 * 12 modules. Image paths are relative to assetBasePath (default: /dtom-assets).
 *
 * Domain: AtomDominator.com | Brand: ΔTOM | Parent: Nirmata Holdings
 */

export interface SalesDominatorChapter {
  /** Zero-padded chapter number, e.g. "01" */
  num: string;
  /** Module name, used in nav sidebar and dossier header */
  module: string;
  /** Full ΔTOM-branded title used as chapter headline */
  title: string;
  /** One-line cinematic description of the module's role */
  role: string;
  /** Key interface capabilities shown in the screenshot */
  capabilities: string[];
  /** Image filename within /dtom-assets/sales-dominator/ */
  image: string;
  /** Mission intel score 0-100 */
  score: number;
  /** Short mission code for dossier overlays */
  missionCode: string;
}

export const salesDominatorChapters: SalesDominatorChapter[] = [
  {
    num: "01",
    module: "Nirmata HQ",
    title: "Executive Command Cockpit",
    role: "Mission control for the entire revenue operation — pipeline pressure, operator telemetry, and next-action intelligence in a single command surface.",
    capabilities: [
      "Module status board",
      "Pipeline pressure gauge",
      "Mission telemetry",
      "Next-action engine",
      "Live operator feed",
    ],
    image: "hq.jpg",
    score: 98,
    missionCode: "NHQ-01-ALPHA",
  },
  {
    num: "02",
    module: "Vibranium GA",
    title: "Generative Asset Foundry",
    role: "On-demand creation of account-specific briefs, voice scripts, campaign copy, and persuasion variants — deployed at machine scale.",
    capabilities: [
      "Voice script generation",
      "Campaign copy variants",
      "Account-specific briefs",
      "Asset version control",
      "Confidence score per asset",
    ],
    image: "vibranium-ga.jpg",
    score: 94,
    missionCode: "VGA-02-FORGE",
  },
  {
    num: "03",
    module: "ΔTOM War Room",
    title: "Named-Account Mission Command",
    role: "Full-spectrum named-account intelligence hub: Command Center, Intel Analyzer, Operator Intel, Deal Pipeline, Playbook Engine, War History, and Ghost Ops.",
    capabilities: [
      "Command Center view",
      "Intel Analyzer",
      "Operator Intel feed",
      "Deal Pipeline tracker",
      "Playbook Engine",
      "War History log",
      "Ghost Ops queue",
    ],
    image: "war-room.jpg",
    score: 97,
    missionCode: "WAR-03-COMMAND",
  },
  {
    num: "04",
    module: "ΔTOM Pitch",
    title: "Boardroom Persuasion Engine",
    role: "Precision pitch construction mapped to pain, timing, proof, stakeholder angle, and close path — before the call begins.",
    capabilities: [
      "Pain signal mapping",
      "Timing intelligence",
      "Proof point library",
      "Stakeholder angle matrix",
      "Close path builder",
    ],
    image: "pitch.jpg",
    score: 92,
    missionCode: "PCH-04-BOARD",
  },
  {
    num: "05",
    module: "Objection Handler",
    title: "Defensive Targeting Matrix",
    role: "Real-time objection classification, risk read, counter-move generation, and close-path recovery — deployed live on call.",
    capabilities: [
      "Resistance class detection",
      "Risk read engine",
      "Counter-move generator",
      "Close path recovery",
      "Objection history log",
    ],
    image: "objection.jpg",
    score: 91,
    missionCode: "OBJ-05-MATRIX",
  },
  {
    num: "06",
    module: "Market Intent",
    title: "Live Signal Radar",
    role: "Real-time market intent signals from news, hiring, funding, leadership change, compliance activity, and technology triggers — routed to operators before the competition detects them.",
    capabilities: [
      "News trigger feed",
      "Hiring signal radar",
      "Funding event detection",
      "Leadership change alerts",
      "Compliance trigger monitor",
      "Technology stack signals",
    ],
    image: "market-intent.jpg",
    score: 95,
    missionCode: "MKT-06-RADAR",
  },
  {
    num: "07",
    module: "ΔTOM Prospect",
    title: "Decision-Maker Acquisition Radar",
    role: "Company scoring, verified contact discovery, LinkedIn enrichment, direct phone, and one-tap 'Call with ΔTOM' — the cold-start elimination module.",
    capabilities: [
      "Company intent scores",
      "Verified contact data",
      "LinkedIn enrichment",
      "Direct phone numbers",
      "Call with ΔTOM trigger",
    ],
    image: "prospect.jpg",
    score: 93,
    missionCode: "PRO-07-RADAR",
  },
  {
    num: "08",
    module: "ΔTOM Dial",
    title: "Voice Strike Console",
    role: "Pi3 - SiQ live call state, waveform analysis, real-time sentiment read, objection cue detection, and next-best-sentence prompting — the real-time AI co-pilot for every dial.",
    capabilities: [
      "Pi3 - SiQ call state",
      "Live waveform monitor",
      "Sentiment analysis",
      "Objection cue detection",
      "Next-best sentence engine",
    ],
    image: "dial.jpg",
    score: 99,
    missionCode: "DIAL-08-STRIKE",
  },
  {
    num: "09",
    module: "ΔTOM Campaign",
    title: "Launch-Control Table",
    role: "Score, company, contact, email, intent signal, channel selection, and target confirmation — the campaign sequencer built for enterprise precision at cold-call scale.",
    capabilities: [
      "Intent-scored target list",
      "Multi-channel sequencer",
      "Contact verification",
      "Launch confirmation gate",
      "Campaign analytics",
    ],
    image: "campaign.jpg",
    score: 90,
    missionCode: "CMP-09-LAUNCH",
  },
  {
    num: "10",
    module: "ΔTOM WarBook",
    title: "Deep Intelligence Engine",
    role: "Sonar account scans, AI synthesis reports, voice brief generation, battle card assembly, and decision-maker dossiers — the intelligence layer beneath every deal.",
    capabilities: [
      "Sonar account scan",
      "AI synthesis report",
      "Voice brief generator",
      "Battle card builder",
      "Decision-maker dossiers",
    ],
    image: "warbook.jpg",
    score: 96,
    missionCode: "WAR-10-INTEL",
  },
  {
    num: "11",
    module: "Billing & Plan",
    title: "Enterprise Monetization Bay",
    role: "Plan hierarchy management, seat controls, monthly total tracking, and current plan state — the command surface for enterprise account governance.",
    capabilities: [
      "Plan hierarchy view",
      "Seat management",
      "Monthly total tracker",
      "Current plan status",
      "Usage analytics",
    ],
    image: "billing.jpg",
    score: 88,
    missionCode: "BIL-11-PLAN",
  },
  {
    num: "12",
    module: "System Control",
    title: "Sovereign Admin Console",
    role: "Tenant management, seat provisioning, dial controls, compliance monitoring, incident log, API key vault, and integration hub — full sovereign control over the ΔTOM infrastructure.",
    capabilities: [
      "Tenant management",
      "Seat provisioning",
      "Compliance monitor",
      "Incident log",
      "API key vault",
      "Integration hub",
    ],
    image: "system-control.jpg",
    score: 97,
    missionCode: "SYS-12-SOVEREIGN",
  },
];

export default salesDominatorChapters;
