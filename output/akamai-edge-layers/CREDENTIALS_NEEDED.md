# Akamai Credentials Setup Guide

This guide walks through obtaining all credentials required to build and deploy the ATOM EdgeWorker.

---

## Step 1 — Create an API Client in Akamai Control Center

1. Log in to [Akamai Control Center](https://control.akamai.com)
2. Navigate to **☰ Menu → Identity & Access Management** (or search "Identity & Access")
3. Click **API Users** in the left sidebar
4. Click **New API Client**
5. Fill in:
   - **Name**: `atom-edgeworker-deploy` (or similar)
   - **Description**: "EdgeWorker deploy automation for ATOM Sales Dominator"
   - **Group**: Select your account group
6. Under **API Access**, grant these scopes:

   | API | Access Level |
   |-----|-------------|
   | EdgeWorkers | READ-WRITE |
   | Property Manager (PAPI) | READ-WRITE (for property rule linkage) |
   | Diagnostics | READ-ONLY (optional, for enhanced debugging) |

7. Click **Create API Client**

---

## Step 2 — Download the .edgerc File

After creating the API client:

1. You'll see a **Download .edgerc snippet** button — click it
2. The downloaded file looks like:
   ```ini
   [default]
   client_secret = <your-client-secret>
   host          = akab-xxxxxxxxxxxxxxxx-xxxxxxxxxxxxxxxx.luna.akamaiapis.net
   access_token  = akab-xxxxxxxxxxxxxxxx-xxxxxxxxxxxxxxxx
   client_token  = akab-xxxxxxxxxxxxxxxx-xxxxxxxxxxxxxxxx
   max-body-size = 131072
   ```
3. Save it to `~/.edgerc` (default location used by the Akamai CLI)
4. If you have multiple accounts, add named sections:
   ```ini
   [atom-prod]
   client_secret = ...
   host = ...
   ...
   ```
   Then pass `--section atom-prod` to CLI commands.

> **Security**: Never commit `.edgerc` to git. It is already in `.gitignore`.

---

## Step 3 — Install the Akamai CLI + EdgeWorkers Plugin

```bash
# Install Akamai CLI
brew install akamai          # macOS
# or: pip3 install akamai-cli

# Install EdgeWorkers sub-command
akamai install edgeworkers

# Verify
akamai edgeworkers help
```

---

## Step 4 — Find Your EdgeWorker ID

The EdgeWorker ID is a numeric identifier assigned when you first create the EdgeWorker in the UI.

### Option A — Create a new EdgeWorker (first deploy)

1. Go to **☰ Menu → EdgeWorkers** in Control Center
2. Click **Create EdgeWorker**
3. Fill in:
   - **Name**: `atom-sales-dominator`
   - **Group**: Your account group
   - **Resource Tier**: Choose `Dynamic Compute` for SSE / streaming support
4. Click **Create** — the EdgeWorker ID appears in the URL and on the detail page:
   `https://control.akamai.com/apps/edgeworkers/#/edgeworkers/<EDGEWORKER_ID>/summary`

### Option B — Find an existing EdgeWorker ID

```bash
# List all EdgeWorkers in your account
akamai edgeworkers list-ids

# Example output:
# ID      NAME                    GROUP
# 12345   atom-sales-dominator    My Group
```

The first column is your `EDGEWORKER_ID`. Export it:

```bash
export EDGEWORKER_ID=12345
```

---

## Step 5 — Link EdgeWorker to Your Property

1. Open **☰ Menu → Property Manager**
2. Select your property for `api.atomsalesdominator.com`
3. Add a **Behavior → EdgeWorkers** rule:
   - **EdgeWorker ID**: `<EDGEWORKER_ID>`
   - For SSE paths, add a **Criteria** rule:
     - Path matches `/api/signals/*` OR `/api/atom-chat` → enable `responseProvider`
4. Save and activate the property on staging, then production

---

## Step 6 — Geo Variables Setup

Ensure the following PMUSER variables are available in your property rules (required by Layer 5):

- `PMUSER_GEO_COUNTRY` — populated by Akamai's EdgeGrid GeoIP database  
  In Property Manager: Add **Behavior → Set Variable**, `PMUSER_GEO_COUNTRY = {{builtin.AK_COUNTRY_CODE}}`

- `PMUSER_TRUE_CLIENT_IP` — for accurate rate limiting in Layer 2:  
  Add **Behavior → Set Variable**, `PMUSER_TRUE_CLIENT_IP = {{builtin.AK_CLIENT_IP}}`

---

## Step 7 — EdgeKV Setup (Production Rate Limiting)

For production-grade shared rate limits across EdgeWorker instances:

1. Go to **☰ Menu → EdgeKV**
2. Create a namespace: `atom-ratelimits`
3. Note the namespace ID
4. Update `layer2-bot-defense.ts` to use `@akamai/edgekv` instead of the in-process Map:
   ```typescript
   import { EdgeKV } from "@akamai/edgekv";
   const kvStore = new EdgeKV({ namespace: "atom-ratelimits", group: "rl" });
   ```

---

## Credential Checklist

- [ ] `.edgerc` file at `~/.edgerc` with `client_secret`, `host`, `access_token`, `client_token`
- [ ] `EDGEWORKER_ID` exported in shell / CI environment
- [ ] `AKAMAI_NETWORK` set to `staging` or `production`
- [ ] Akamai CLI installed (`akamai --version`)
- [ ] EdgeWorkers plugin installed (`akamai edgeworkers help`)
- [ ] Property linked to EdgeWorker ID
- [ ] `PMUSER_GEO_COUNTRY` variable configured in property rules
