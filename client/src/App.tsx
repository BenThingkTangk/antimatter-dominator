import { Switch, Route, Router, Redirect } from "wouter";
import { useHashLocation } from "wouter/use-hash-location";
import { QueryClientProvider } from "@tanstack/react-query";
import { queryClient } from "./lib/queryClient";
import { Toaster } from "@/components/ui/toaster";
import { AppLayout } from "./components/AppLayout";
import PitchGenerator from "./pages/pitch-generator";
import ObjectionHandler from "./pages/objection-handler";
import MarketIntent from "./pages/market-intent";
import ProspectEngine from "./pages/prospect-engine";
import AtomLeadGen from "./pages/atom-leadgen";
import AtomCampaign from "./pages/atom-campaign";
import CompanyIntelligence from "./pages/company-intelligence";
import AtomWarRoom from "./pages/atom-warroom";
import AdminTenants from "./pages/admin-tenants";
import NotFound from "./pages/not-found";
import { useTenant } from "./lib/useTenant";

function AppRouter() {
  // Resolve tenant on first paint. Loading state is silent — we render
  // the cached/default brand immediately and swap if the API returns
  // something different.
  useTenant();
  return (
    <AppLayout>
      <Switch>
        <Route path="/"><Redirect to="/pitch" /></Route>
        <Route path="/pitch" component={PitchGenerator} />
        <Route path="/objections" component={ObjectionHandler} />
        <Route path="/market" component={MarketIntent} />
        <Route path="/prospects" component={ProspectEngine} />
        <Route path="/atom-leadgen" component={AtomLeadGen} />
        <Route path="/atom-campaign" component={AtomCampaign} />
        <Route path="/company-intelligence" component={CompanyIntelligence} />
        <Route path="/war-room" component={AtomWarRoom} />
        <Route path="/admin/tenants" component={AdminTenants} />
        <Route component={NotFound} />
      </Switch>
    </AppLayout>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <Router hook={useHashLocation}>
        <AppRouter />
      </Router>
      <Toaster />
    </QueryClientProvider>
  );
}

export default App;
