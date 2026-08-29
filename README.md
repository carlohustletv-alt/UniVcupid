# UnivCupid Android

Native Android MVP built with Kotlin and Jetpack Compose.

## Build

Use Gradle wrapper 8.14.5:

```powershell
.\gradlew.bat :app:assembleDebug
```

Debug APK output:

```text
app/build/outputs/apk/debug/app-debug.apk
```

## Supabase Setup

1. Create a Supabase project.
2. Run `supabase/schema.sql` in the Supabase SQL editor.
3. Set these values as Gradle properties or environment variables:

```text
SUPABASE_URL=https://your-project-ref.supabase.co
SUPABASE_ANON_KEY=your-public-anon-key
```

Do not commit real keys. The app reads them into `BuildConfig` and shows connection readiness on the You screen.

Supabase Auth must use the Android callback URL so confirmation emails do not return to localhost:

```text
Site URL: univcupid://auth/callback
Redirect allow list: univcupid://auth/callback
```

The `vibe-media` Storage bucket must be public for reads and restricted so authenticated users can write only under their own user-id folder. The schema migrations include those policies.

## Supabase CLI

The CLI is installed locally in this workspace:

```powershell
.\tools\supabase\supabase.exe --version
```

## Supabase Backend

The Android app uses Supabase Auth plus direct REST/RPC calls for the current MVP:

```text
Auth            /auth/v1/token and /auth/v1/signup
Vibe feed       /rest/v1/rpc/get_vibe_feed
Circles         /rest/v1/rpc/get_circles_for_user
Cupid           /rest/v1/rpc/get_cupid_candidates
Chats           /rest/v1/rpc/get_conversations_for_user
QuickShare      /rest/v1/vibes
Reactions       /rest/v1/vibe_reactions
Circle joins    /rest/v1/circle_members
Likes           /rest/v1/likes
Messages        /rest/v1/messages
Privacy         /rest/v1/privacy_settings
Profile setup   /rest/v1/profiles and /rest/v1/privacy_settings
```

## Current App Functions

- Vibe feed filters, reactions, and join intent.
- Real Supabase email/password sign in and sign up.
- QuickShare posts through `publish-vibe`.
- Vibe feed loads through `vibe-feed`.
- Circles load through `circles-list`; join/leave uses `join-circle`.
- Cupid candidates load through `cupid-candidates`; likes use `cupid-like`.
- Chats load through `conversations-list`; send uses `send-message`.
- Privacy toggles, report/block entry points, and Supabase readiness display.

## Production Data

Clear app tables in Supabase SQL editor only when intentionally resetting an environment:

```sql
-- supabase/reset.sql
```

Production should use real student signups only. Do not seed shared production environments with sample accounts.

The service role key must stay local and must never be placed in Android resources or committed.

To deploy schema and functions from this machine, use one of these instead of the project secret key:

```powershell
$env:SUPABASE_ACCESS_TOKEN="your-personal-supabase-access-token"
.\scripts\deploy-supabase.ps1
```

or:

```powershell
$env:SUPABASE_DB_URL="postgresql://postgres:your-db-password@db.ssanipbptgzcahrxzzrq.supabase.co:5432/postgres"
.\scripts\deploy-supabase.ps1
```

The `sb_secret...` project key can seed data through REST after tables exist, but it cannot create tables. To create the schema, run `supabase/schema.sql` in the Supabase SQL editor or use `scripts/deploy-supabase.ps1` with `SUPABASE_ACCESS_TOKEN` or `SUPABASE_DB_URL`.
