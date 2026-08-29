# UnivCupid

<p align="center">
  <strong>A campus-first social discovery app for finding your people.</strong><br />
  Built natively for Android with Kotlin, Jetpack Compose, and Supabase.
</p>

<p align="center">
  <a href="#quick-start">Quick start</a> ·
  <a href="#whats-inside">Features</a> ·
  <a href="#management-console">Management</a> ·
  <a href="#security">Security</a>
</p>

<p align="center">
  <img src="screenshot_valid.png" alt="UnivCupid app preview" width="280" />
</p>

> [!IMPORTANT]
> UnivCupid is a student community product. Deploy it only with your institution's privacy, moderation, and consent requirements in place.

## Choose Your Path

| I want to... | Start here |
| --- | --- |
| Run the Android app | [Quick start](#quick-start) |
| Configure Supabase | [Backend setup](#supabase-setup) |
| Moderate content | [Management console](#management-console) |
| Deploy schema and functions | [Deployment](#deployment) |

## What's Inside

| Experience | What it does |
| --- | --- |
| **Vibes** | Share activity updates, photos, reactions, and join intent. |
| **Cupid** | Discover compatible students and create mutual matches. |
| **VibesMates** | Send, accept, and manage private social connections. |
| **Circles** | Join campus communities and post in their lounge feeds. |
| **Chats** | Message matched students in private conversations. |
| **Profile & privacy** | Control discovery, messages, and campus visibility. |
| **Management dashboard** | Review reports, moderation data, circles, and broadcasts. |

<details>
<summary><strong>Explore the app flow</strong></summary>

```text
Sign in
  -> Vibes: discover campus activity
  -> Cupid: like compatible students
  -> Mutual match: private conversation created
  -> Circles: join community lounges
  -> Profile: manage privacy and account settings
```

</details>

## Tech Stack

| Layer | Technology |
| --- | --- |
| Android client | Kotlin, Jetpack Compose, Material 3 |
| Authentication | Supabase Auth |
| Data and realtime-ready API | Supabase Postgres, REST, RPC |
| Media | Supabase Storage (`vibe-media`) |
| Server workflows | Supabase Edge Functions |
| Management UI | Static HTML, CSS, and JavaScript |

## Quick Start

### 1. Clone and open

```powershell
git clone https://github.com/carlohustletv-alt/UniVcupid.git
Set-Location UniVcupid
```

### 2. Add local Supabase configuration

Create `local.properties` in the repository root. This file is intentionally ignored by Git.

```properties
SUPABASE_URL=https://your-project-ref.supabase.co
SUPABASE_ANON_KEY=your-public-anon-key
```

### 3. Build the debug APK

```powershell
.\gradlew.bat :app:assembleDebug
```

The APK is written to:

```text
app/build/outputs/apk/debug/app-debug.apk
```

## Supabase Setup

1. Create a Supabase project.
2. Run `supabase/schema.sql` in the Supabase SQL Editor.
3. Apply the SQL files in `supabase/migrations/` in timestamp order if the environment was created from an earlier schema version.
4. Create or confirm the `vibe-media` Storage bucket is public for reads.
5. Configure the Android email confirmation callback:

```text
Site URL:             univcupid://auth/callback
Redirect allow list:  univcupid://auth/callback
```

<details>
<summary><strong>Backend routes used by the Android client</strong></summary>

| Area | Route or resource |
| --- | --- |
| Sign in and sign up | `/auth/v1/token`, `/auth/v1/signup` |
| Vibe feed | `get_vibe_feed` RPC |
| Circles | `get_circles_for_user` RPC |
| Cupid | `get_cupid_candidates` RPC |
| Chats | `get_conversations_for_user` RPC |
| Vibes | `vibes`, `vibe_reactions` |
| Circle membership | `circle_members` |
| Matching | `likes`, `matches` |
| Messages | `messages` |
| Privacy and profile | `privacy_settings`, `profiles` |

</details>

## Management Console

The management dashboard lives in [`management/`](management/). It is a separate web interface for authorized staff.

```text
management/
  index.html    Dashboard shell
  styles.css    Dashboard styling
  app.js        Supabase-authenticated client
```

Open it through a local static web server, then sign in with an authorized Supabase account. Administrative access is enforced in the database through `app_admins` and admin RPCs.

> [!WARNING]
> The current dashboard contains some direct browser-side moderation controls that still need to be fully wired to the admin RPC suite. Do not use it as a production moderation console until those actions are RPC-backed and tested against RLS.

## Deployment

Use a personal Supabase access token or a database connection string. Never use a service-role key in Android or browser code.

```powershell
$env:SUPABASE_ACCESS_TOKEN="your-personal-supabase-access-token"
.\scripts\deploy-supabase.ps1
```

Alternatively:

```powershell
$env:SUPABASE_DB_URL="postgresql://postgres:your-db-password@db.your-project-ref.supabase.co:5432/postgres"
.\scripts\deploy-supabase.ps1
```

<details>
<summary><strong>Supabase CLI note</strong></summary>

The deployment script locates the Supabase CLI locally. Downloaded CLI binaries and Supabase temporary metadata are ignored by Git, so each environment should provision its own CLI installation.

</details>

## Security

- `local.properties`, keystores, IDE metadata, downloaded CLI binaries, and Supabase temporary data are ignored by Git.
- Only the Supabase publishable/anon key belongs in clients. It is public by design but constrained by Row Level Security.
- Service-role keys, database passwords, and access tokens must stay in environment variables or secret managers.
- Database policies scope student data to the authenticated user and use `app_admins` for administrative operations.
- `vibe-media` writes are restricted to authenticated owners' paths; media reads are public by design.

<details>
<summary><strong>Before a public launch</strong></summary>

- Test Row Level Security with a non-admin account.
- Complete RPC backing for every management action.
- Define report response times and a moderation audit process.
- Publish privacy, community, and account-deletion policies.
- Verify media retention and deletion behavior.

</details>

## Repository Map

```text
app/                    Android application
management/             Staff management dashboard
supabase/schema.sql     Baseline database schema and policies
supabase/migrations/    Incremental database changes
supabase/functions/     Edge Functions
scripts/                Local deployment helpers
```

## Build Verification

```powershell
.\gradlew.bat :app:assembleDebug
node --check management/app.js
```

## Contributing

1. Create a focused branch.
2. Keep backend changes accompanied by a migration.
3. Run the relevant build or syntax check.
4. Do not commit secrets, local configuration, or generated tooling.

---

<p align="center">
  <strong>UnivCupid</strong><br />
  Find the vibe. Build the circle.
</p>
