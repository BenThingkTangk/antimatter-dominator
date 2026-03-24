export interface Product {
  id: number;
  name: string;
  slug: string;
  tagline: string;
  description: string;
  url: string;
  category: string;
  targetMarket: string;
  keyFeatures: string;
  valueProps: string;
  commonObjections: string;
  competitiveEdge: string;
  icon: string;
}

const PRODUCTS: Product[] = [
  {
    id: 1,
    name: "Antimatter AI Platform",
    slug: "antimatter-ai",
    tagline: "Digital Solutions That Matter",
    description: "Full-service AI development, product design, and GTM strategy platform. End-to-end product design, scalable web/mobile development, production-ready AI systems, HIPAA-compliant healthcare apps, IoT systems, and data-driven go-to-market strategies — all under one roof.",
    url: "https://antimatterai.com",
    category: "platform",
    targetMarket: "Enterprise organizations, SaaS companies, startups, healthcare systems, IoT companies needing AI-powered product development and go-to-market execution",
    keyFeatures: JSON.stringify([
      "End-to-end product design (User Research, UX Flows, UI Systems, Design Ops)",
      "Full-stack development (React/Next frontends, Node backend APIs, Flutter mobile, Docker CI/CD)",
      "AI Development (LLM agents, RAG, fine-tuning, model evals, guardrails, vision/NLP/speech pipelines)",
      "GTM Strategy (ICP & segmentation, positioning & messaging, pricing & packaging, demand gen)",
      "Healthcare Apps (HIPAA/PHI compliance, telehealth, EHR integrations via FHIR/HL7, audit logging)",
      "IoT Development (embedded firmware, BLE/Zigbee/LoRa, MQTT ingestion, edge AI, OTA pipelines)"
    ]),
    valueProps: JSON.stringify([
      "20+ projects delivered with 100% client satisfaction",
      "Full-stack capability: design → engineering → AI → GTM under one roof",
      "AI-native approach — every solution leverages ML from day one",
      "24/7 support with dedicated teams",
      "Proven case studies: Clinix AI, OWASP Foundation, Synergies4, Curehire"
    ]),
    commonObjections: JSON.stringify([
      "We already have an in-house dev team",
      "AI development is too expensive",
      "We're not ready for AI yet",
      "How do we know your AI will work?",
      "We've been burned by agencies before"
    ]),
    competitiveEdge: "Unlike traditional agencies, Antimatter AI is AI-native — every solution leverages machine learning from day one. We combine product design, engineering, AI development, healthcare compliance, IoT, and GTM under one roof, eliminating handoff friction and accelerating time-to-market by 3-5x. Proven across healthcare (Clinix AI), security (OWASP), and enterprise SaaS.",
    icon: "Atom"
  },
  {
    id: 2,
    name: "ATOM Enterprise AI",
    slug: "atom-enterprise",
    tagline: "Enterprise AI Framework — Deploy Anywhere, Own Everything",
    description: "ATOM is Antimatter's enterprise AI deployment framework. Deploy voice, search, and workflow agents in controlled environments — VPC, on-prem, or edge — with governance, zero-training guarantees, and full IP ownership. Framework, not a tool. Model-agnostic. Powered by Akamai + Linode edge partnership.",
    url: "https://www.antimatterai.com/enterprise-ai",
    category: "enterprise-ai",
    targetMarket: "CIOs, CTOs, VP Engineering at regulated enterprises, financial services, healthcare systems, defense contractors, government agencies, Fortune 500 companies needing secure AI deployment",
    keyFeatures: JSON.stringify([
      "Deploy anywhere: VPC, on-prem, hybrid, edge, containers, Kubernetes",
      "Security & Compliance: encryption at rest/transit, SSO + RBAC, audit logs, zero-training, private networking",
      "Full IP Ownership: you own prompts, agents, workflows, outputs — hard isolation, no shared pools",
      "Composable Framework: agents, orchestration, tool calls, retrieval, deterministic UI modules",
      "Model-Agnostic Runtime: swap hosted, open-source, private, or on-prem models without code changes, BYO embeddings",
      "Edge Deployment: Akamai + Linode partnership for low-latency voice/real-time UX with data residency boundaries"
    ]),
    valueProps: JSON.stringify([
      "Deploy agentic AI in your environment — not someone else's cloud",
      "Zero-training guarantee: ATOM never trains on your data or resells metadata",
      "Swap model providers without changing product logic — no vendor lock-in",
      "RBAC, audit trails, encryption, and retention policies per environment",
      "Edge inference with hybrid routing: edge + VPC/on-prem orchestration via Akamai",
      "Composable system: reuse agents, retrieval, and tools across teams without rewrites"
    ]),
    commonObjections: JSON.stringify([
      "We already have our own AI infrastructure",
      "Enterprise AI frameworks are too complex to deploy",
      "We're locked into our current cloud provider",
      "How is this different from AWS Bedrock or Azure AI?",
      "Our compliance team won't approve another vendor",
      "We need on-prem — cloud solutions don't work for us"
    ]),
    competitiveEdge: "ATOM is a framework, not a tool — build composable AI systems for voice, search, workflows, and decisions that you fully own. Unlike Kore.ai, Intercom Fin, Zendesk AI, or Microsoft Copilot Studio, ATOM offers hard tenant isolation, zero-training guarantees, full IP ownership, and deploys to VPC/on-prem/edge. The Akamai + Linode edge partnership delivers sub-100ms latency for voice and real-time UX with data residency controls. No shared pools, no vendor lock-in.",
    icon: "Server"
  },
  {
    id: 3,
    name: "Vidzee",
    slug: "vidzee",
    tagline: "Listing Photos to Cinematic Videos",
    description: "AI-powered platform that transforms real estate listing photos into cinematic property videos in under 5 minutes. Upload photos, AI storyboards and generates professional videos for Reels, TikTok, YouTube, and MLS.",
    url: "https://vidzee.vercel.app",
    category: "real-estate",
    targetMarket: "Real estate agents, brokerages, property managers, luxury agents, new agents, team leads at Compass, RE/MAX, Sotheby's, Keller Williams, Coldwell Banker, eXp Realty",
    keyFeatures: JSON.stringify([
      "AI-powered storyboarding (room detection, scene ordering, best-shot selection)",
      "Cinematic video generation powered by Kling AI",
      "Professional camera motions (Push In, Pan Left/Right, Tilt Up/Down)",
      "Multi-format export (9:16 for Reels/TikTok, 16:9 for YouTube/MLS)",
      "3 style packs: Modern Clean, Luxury Classic, Bold Dynamic",
      "Custom branding, team accounts, API access, white-label exports"
    ]),
    valueProps: JSON.stringify([
      "Create cinematic listing videos in under 5 minutes (not days)",
      "Save $200-$500 per video vs. hiring a videographer",
      "12,400+ videos created by 2,800+ agents",
      "One upload yields two formats for all platforms",
      "Consistent branding across entire team"
    ]),
    commonObjections: JSON.stringify([
      "I already hire a videographer",
      "AI videos won't look professional enough",
      "My listings don't need video",
      "I don't have time to learn new tools",
      "Free plan seems too limited"
    ]),
    competitiveEdge: "Vidzee replaces the $200-$500/video cost of a videographer with AI that produces cinematic results in 5 minutes. Smart storyboarding detects rooms, orders scenes logically, and applies professional camera motions — no editing skills required. Top producers at Compass, RE/MAX, and Sotheby's already use it.",
    icon: "Video"
  },
  {
    id: 4,
    name: "Clinix Agent",
    slug: "clinix-agent",
    tagline: "Supervised AI Billing Operations",
    description: "All-in-one platform helping healthcare providers, hospitals, and billing teams recover lost revenue by automating insurance denial appeals and resubmissions. From intake to payment — automates claims, denials, and appeals in one workflow.",
    url: "https://www.clinixagent.com",
    category: "healthcare",
    targetMarket: "Healthcare providers, hospitals, billing teams, RCM teams, medical billing companies",
    keyFeatures: JSON.stringify([
      "Eligibility Guardrails (plan rules, copay, prior-auth warnings from 270/271)",
      "Clean Claim Engine (payer-aware modifiers, POS validation, ICD↔CPT pointers)",
      "Live Status + Remits (276/277 real-time acceptance, 835 pattern parsing)",
      "Appeal Intelligence (template 275 attachments, track overturn rates)",
      "HIPAA-grade security (E2E encryption, RLS, audit trails)",
      "Success-based pricing (0.6-1.2% paid claims, 5-12% recovery)"
    ]),
    valueProps: JSON.stringify([
      "Stop denials before they start with eligibility guardrails",
      "Auto-generate corrections and appeal packets tailored to payer policy",
      "Track claim status and recovery with real-time reporting",
      "ML-powered signals from eligibility, status, and remits",
      "Pay only on success — aligned incentives"
    ]),
    commonObjections: JSON.stringify([
      "We already have a billing team",
      "We're worried about HIPAA compliance",
      "Our denial rate is manageable",
      "We don't trust AI with patient data",
      "Integration with our EHR seems complex"
    ]),
    competitiveEdge: "Clinix Agent combines Stedi rails with payer-specific rules and ML signals — not just a billing tool but an intelligent denial prevention engine. With success-based pricing, you only pay when we recover revenue. Dedicated VM per tenant with immutable audit trails for maximum security.",
    icon: "ShieldCheck"
  },
  {
    id: 5,
    name: "Clinix AI",
    slug: "clinix-ai",
    tagline: "AI-Powered Healthcare Documentation Automation",
    description: "Revolutionizing healthcare with AI-driven automation for medical documentation, SOAP notes, billing, and claims management. Extracts diagnoses, procedures, and justifications from clinical notes and generates ICD-10, CPT, and DSM-5-TR codes.",
    url: "https://www.tryclinixai.com",
    category: "healthcare",
    targetMarket: "Healthcare providers, clinicians, medical practices, behavioral health providers, hospitals",
    keyFeatures: JSON.stringify([
      "AI-powered SOAP note automation",
      "ICD-10, CPT, and DSM-5-TR code generation from clinical notes",
      "Seamless EHR integration",
      "Real-time updates and clinical workflow management",
      "Patient visit and billing summary management",
      "Diagnosis extraction and procedure justification"
    ]),
    valueProps: JSON.stringify([
      "Cut documentation time by 70% — focus on patient care",
      "Accurate AI-generated coding reduces claim denials",
      "Seamless integration with existing EHR systems",
      "Real-time clinical workflow management",
      "Reduce administrative burden and burnout"
    ]),
    commonObjections: JSON.stringify([
      "AI can't capture clinical nuance",
      "We're comfortable with our current workflow",
      "What about coding accuracy?",
      "EHR integration is always a nightmare",
      "Our providers won't adopt new technology"
    ]),
    competitiveEdge: "Clinix AI doesn't just transcribe — it understands clinical context. AI extracts diagnoses, procedures, and justifications from notes and generates accurate ICD-10/CPT/DSM-5-TR codes in real-time, directly integrated with your EHR. Providers save 2-3 hours per day on documentation.",
    icon: "Stethoscope"
  },
  {
    id: 6,
    name: "Red Team ATOM",
    slug: "red-team-atom",
    tagline: "Autonomous Quantum-Ready Red Team Range",
    description: "Active adversarial simulation platform with post-quantum cryptography engine, AI & quantum attack telemetry, and MITRE ATLAS & Quantum technique heatmaps. Autonomous red teaming for the quantum computing era.",
    url: "https://red-team-atom.vercel.app",
    category: "cybersecurity",
    targetMarket: "CISOs, security teams, defense contractors, government agencies, Fortune 500 security operations, compliance officers",
    keyFeatures: JSON.stringify([
      "PQC Engine (lattice-based key rotation, harvest-now-decrypt-later safe)",
      "AI & Quantum Attack Telemetry (real-time)",
      "Threat Analytics (Critical, High, Model Attacks, Prompt Inject)",
      "Red Team Defense Logging",
      "MITRE ATLAS & Quantum Technique Heatmap",
      "Agent-level, model attack, and quantum threat filters"
    ]),
    valueProps: JSON.stringify([
      "Only autonomous red team platform that's quantum-ready",
      "Proactively defend against harvest-now-decrypt-later attacks",
      "Real-time AI and quantum attack telemetry across your stack",
      "MITRE ATLAS compliance mapping out of the box",
      "Continuous adversarial simulation — not annual pen tests"
    ]),
    commonObjections: JSON.stringify([
      "Quantum threats are years away",
      "We already do annual penetration testing",
      "Our team doesn't have quantum security expertise",
      "This seems too advanced for our current needs",
      "How does this integrate with our existing SOC?"
    ]),
    competitiveEdge: "Red Team ATOM is the industry's first autonomous, quantum-ready red team range. While competitors offer static pen testing, ATOM runs continuous adversarial simulations with PQC-grade key rotation, real-time AI attack telemetry, and MITRE ATLAS heatmapping. If you're not preparing for quantum threats now, you're already behind.",
    icon: "Shield"
  }
];

export function getProducts(): Product[] {
  return PRODUCTS;
}

export function getProductBySlug(slug: string): Product | undefined {
  return PRODUCTS.find(p => p.slug === slug);
}

export function getProductById(id: number): Product | undefined {
  return PRODUCTS.find(p => p.id === id);
}
