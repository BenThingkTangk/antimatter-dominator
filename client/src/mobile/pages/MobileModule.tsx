/**
 * MobileModule — wraps a desktop module page inside the mobile shell.
 *
 * The desktop module pages already encapsulate their full UI (form +
 * results) and use the shared API and React Query stack — so we just embed
 * them in the mobile scroll container with a tightened width so the desktop
 * grid collapses gracefully on a phone.
 *
 * Each module page is reused 1:1 to guarantee functional parity with the
 * web app — no duplicate logic, no parallel API contract.
 */
import { ComponentType } from "react";
import { MobileShell } from "../MobileShell";

interface MobileModuleProps {
  title: string;
  /** The desktop module page component to mount. */
  Page: ComponentType;
}

export function MobileModule({ title, Page }: MobileModuleProps) {
  return (
    <MobileShell title={title}>
      {/* Width-clamp so any desktop max-w utility collapses at phone widths.
          Pages built with Tailwind grid + flex naturally reflow inside this. */}
      <div className="m-module-host">
        <Page />
      </div>
    </MobileShell>
  );
}

import PitchGenerator from "../../pages/pitch-generator";
import ObjectionHandler from "../../pages/objection-handler";
import MarketIntent from "../../pages/market-intent";
import ProspectEngine from "../../pages/prospect-engine";
import CompanyIntelligence from "../../pages/company-intelligence";
import AtomWarRoom from "../../pages/atom-warroom";

export const MobilePitch       = () => <MobileModule title="ΔTOM Pitch"      Page={PitchGenerator} />;
export const MobileObjections  = () => <MobileModule title="ΔTOM Objection"  Page={ObjectionHandler} />;
export const MobileMarket      = () => <MobileModule title="ΔTOM Market"     Page={MarketIntent} />;
export const MobileProspects   = () => <MobileModule title="ΔTOM Prospect"   Page={ProspectEngine} />;
export const MobileWarBook     = () => <MobileModule title="ΔTOM WarBook"    Page={CompanyIntelligence} />;
export const MobileWarRoom     = () => <MobileModule title="ΔTOM War Room"   Page={AtomWarRoom} />;
