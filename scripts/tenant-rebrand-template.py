#!/usr/bin/env python3
"""
Intelisys rebrand pass across all pages.
- ATOM module names → Intelisys terms (reads from tenant config)
- Antimatter AI references → Intelisys
- Crimson War Room brand → Intelisys red
- Removes ATOM Sonar/PDL/Apollo brand references from user-visible text
"""
import os, re

BASE = "/home/user/workspace/intelisys-dominator/client/src"

# Simple string replacements applied to every .tsx/.ts file in pages/ and components/
REPLACEMENTS = [
    # ── Module-level branding in titles / subtitles ──
    ("ATOM War Room", "Partner War Room"),
    ("Von Clausewitz Engine", "Channel Intelligence Engine"),
    ("ATOM Pitch", "Opportunity Pitch"),
    ("ATOM Objection Handler", "Objection Navigator"),
    ("ATOM Market Intent", "Market Intel"),
    ("ATOM Prospect", "Account Discovery"),
    ("ATOM Lead Gen", "Partner Dialer"),
    ("ATOM Campaign", "Multi-Account Campaign"),
    ("ATOM WarBook", "Account Dossier"),
    ("ATOM WarRoom", "Partner War Room"),
    ("ATOM Aletheia", "Partner War Room"),
    ("ATOM Sales Dominator", "Intelisys Sales Copilot"),
    ("Sales Dominator", "Sales Copilot"),
    ("ATOM Deep Intelligence Engine", "Channel Deep Intelligence Engine"),
    ("ATOM Intelligence", "Channel Intelligence"),
    ("Deploy Von Clausewitz", "Deploy Channel Intel"),
    ("ATOM Sonar", "Channel Sonar"),
    ("ATOM AI", "Intelisys AI"),
    ("Antimatter AI", "Intelisys"),
    ("antimatterAI", "Intelisys"),
    ("ADAM from Antimatter", "ADAM from Intelisys"),
    ("ATOM Voice Brief", "Channel Voice Brief"),
    ("Dial with ATOM", "Dial with Intelisys"),

    # ── Domain / terminology ──
    # ATOM Sales Dominator ecosystem → Intelisys Sales Copilot ecosystem
    ("for the ATOM Sales Dominator ecosystem", "for the Intelisys Sales Copilot platform"),
    ("for the Intelisys Sales Copilot ecosystem", "for the Intelisys Sales Copilot platform"),

    # ── Footer / branding ──
    ("ATOM · Nirmata Holdings · © 2026", "Intelisys · A ScanSource Company · © 2026"),
    ("ATOM \u00b7 Nirmata Holdings", "Intelisys \u00b7 A ScanSource Company"),

    # ── Hide third-party vendor names from visible UI (but keep in comments/variables) ──
    # These are visible strings in filter panels
    ("Apollo Pro", "Channel Database"),
    ("Apollo + Hunter.io + PDL enrichment", "multi-source contact enrichment"),
    ("275M+ verified contacts", "275M+ channel contacts"),
    ("PDL enrichment", "channel enrichment"),

    # ── The "ATOM" wordmark O → nothing (already replaced above) ──

    # ── Brand-color tokens: crimson → Intelisys red ──
    # War Room crimson → Intelisys red
    ("linear-gradient(93.92deg, #f87171 -13.51%, #dc2626 40.91%, #b91c1c 113.69%)",
     "linear-gradient(93.92deg, #F55965 -13.51%, #D71925 40.91%, #A81319 113.69%)"),
    ("#dc2626", "#D71925"),
    ("#ef4444", "#F55965"),  # Lighter red → Intelisys primaryLight
    ("#b91c1c", "#A81319"),  # Darker red → Intelisys primaryDark
    ("#f87171", "#F55965"),
    ("rgba(220,38,38,", "rgba(215,25,37,"),
    ("rgba(239,68,68,", "rgba(245,89,101,"),

    # Violet (old ATOM accents) → Intelisys blue
    ("#a2a3e9", "#1FAAE1"),
    ("#696aac", "#1FAAE1"),
    ("#8587e3", "#64C6EA"),
    ("#4c4dac", "#1088B8"),
    ("#3e3f7e", "#0C6590"),
    ("rgba(105,106,172,", "rgba(31,170,225,"),

    # Indigo (WarBook) → Intelisys blue too
    ("#6366f1", "#1FAAE1"),
    ("#818cf8", "#64C6EA"),
    ("#4f46e5", "#1088B8"),
    ("rgba(99,102,241,", "rgba(31,170,225,"),

    # Violet (Aletheia/old War Room) → Intelisys red
    ("#8b5cf6", "#D71925"),
    ("#a78bfa", "#F55965"),
    ("#7c3aed", "#A81319"),
    ("rgba(139,92,246,", "rgba(215,25,37,"),

    # Dark backgrounds — keep same (theme handles light mode)
    # ── Font switch ──
    ("'Plus Jakarta Sans', system-ui, sans-serif", "'Inter', system-ui, sans-serif"),
    ("'Plus Jakarta Sans', Arial, sans-serif", "'Inter', Arial, sans-serif"),
    ("'Plus Jakarta Sans'", "'Inter'"),

    # Names used in voice
    ("Hey there — this is ADAM from Antimatter AI", "Hi, this is Alex from Intelisys"),
    ("ADAM from Antimatter", "Alex from Intelisys"),
    ("ADAM VOICE READY", "INTELISYS VOICE READY"),
    ("ADAM", "INTELISYS VOICE"),
]

targets = []
for root in ["pages", "components"]:
    for dirpath, _, filenames in os.walk(os.path.join(BASE, root)):
        for fn in filenames:
            if fn.endswith(".tsx") or fn.endswith(".ts"):
                targets.append(os.path.join(dirpath, fn))

total = 0
for fp in targets:
    with open(fp) as f:
        content = f.read()
    orig = content
    for old, new in REPLACEMENTS:
        content = content.replace(old, new)
    if content != orig:
        # Rough count of changes
        count = sum(orig.count(old) for old, _ in REPLACEMENTS if old in orig)
        total += count
        with open(fp, "w") as f:
            f.write(content)
        name = os.path.relpath(fp, BASE)
        print(f"  {name}: modified")

print(f"\nTotal replacements applied: {total}")
