# RFP System

A high-performance Google Drive Shared Drives project management system built with Next.js.

## Features

- **Template-Based Folder Structure**: Define folder templates with permission rules
- **Diff-Based Sync**: Only apply changes, not full rescans
- **Strict Permission Enforcement**: Auto-revert unauthorized permission changes
- **Background Jobs**: Inngest-powered job queue for reliable sync operations
- **Role-Based Permissions**: Map roles to Google Groups or Users
- **Real-Time Progress**: Track job progress in the dashboard
- **Audit Log**: Complete history of all system actions

## Tech Stack

- **Framework**: Next.js 14 (App Router)
- **UI**: shadcn/ui + Tailwind CSS
- **Database**: Supabase PostgreSQL (schema: `RFP`)
- **Auth**: Google OAuth (User OAuth with offline access)
- **Jobs**: Inngest (Vercel-compatible)
- **APIs**: Google Drive API v3 + Admin SDK Directory API

## Getting Started

### Prerequisites

1. Node.js 18+
2. A Supabase project
3. A Google Cloud project with OAuth configured
4. An Inngest account (optional for local dev)

### Environment Variables

Copy `.env.example` to `.env.local` and fill in:

```env
# Supabase
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key

# Google OAuth
GOOGLE_CLIENT_ID=your-client-id.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=your-client-secret
GOOGLE_REDIRECT_URI=http://localhost:3000/api/auth/callback

# Token Encryption (generate a 32-char random string)
TOKEN_ENCRYPTION_KEY=your-32-character-encryption-key

# NextAuth
NEXTAUTH_URL=http://localhost:3000
NEXTAUTH_SECRET=your-nextauth-secret

# Inngest (optional for local dev)
INNGEST_EVENT_KEY=your-inngest-event-key
INNGEST_SIGNING_KEY=your-inngest-signing-key

# App Config
SHARED_DRIVE_ID=your-shared-drive-id
ADMIN_EMAIL=your-email@domain.com
```

### Database Setup

1. Go to your Supabase project
2. Open SQL Editor
3. Run the migration file: `supabase/migrations/001_initial_schema.sql`

### Google Cloud Setup

1. Create a new project in Google Cloud Console
2. Enable APIs:
   - Google Drive API
   - Admin SDK API
3. Configure OAuth consent screen:
   - User Type: Internal
   - Scopes: `drive`, `admin.directory.user.readonly`, `admin.directory.group.readonly`
4. Create OAuth credentials:
   - Application type: Web application
   - Authorized redirect URIs: `http://localhost:3000/api/auth/callback`

### Install Dependencies

```bash
npm install
```

### Run Development Server

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000)

### Run Inngest Dev Server (optional)

```bash
npx inngest-cli@latest dev
```

## Deployment to Vercel

1. Push your code to GitHub
2. Import the project in Vercel
3. Add all environment variables
4. Deploy

## Project Structure

```
rfp/
├── src/
│   ├── app/                    # Next.js App Router pages
│   │   ├── api/               # API routes
│   │   │   ├── auth/          # OAuth routes
│   │   │   └── inngest/       # Inngest webhook
│   │   ├── projects/          # Projects pages
│   │   ├── template/          # Template editor
│   │   ├── users/             # Users management
│   │   ├── groups/            # Groups management
│   │   ├── roles/             # Permission Directory
│   │   ├── jobs/              # Job monitoring
│   │   ├── audit/             # Audit log
│   │   └── settings/          # System settings
│   ├── components/            # React components
│   │   ├── ui/               # shadcn/ui components
│   │   └── app-sidebar.tsx   # Main navigation
│   ├── lib/                   # Utilities
│   │   ├── config.ts         # App configuration
│   │   ├── supabase.ts       # Supabase clients
│   │   ├── crypto.ts         # Encryption utilities
│   │   └── inngest.ts        # Inngest client
│   └── server/               # Server-side code
│       ├── google-drive.ts   # Drive API client
│       ├── google-admin.ts   # Admin SDK client
│       └── jobs.ts           # Inngest job functions
├── supabase/
│   └── migrations/           # Database migrations
└── docs/                     # Documentation
```

## Key Concepts

### Template

The template defines:
- Folder structure (paths and names)
- Limited access settings per folder
- Permission roles per folder

### Roles

Roles are abstract permission groups (e.g., ADMIN, PROJECT_MANAGER) that:
- Map to a Drive role (organizer, fileOrganizer, writer, reader)
- Can have multiple principals (groups or users)
- Are referenced by the template

### Folder Index

A database cache that maps:
- Template path → Drive folder ID
- Enables instant lookups without scanning Drive

### Strict Mode

When enabled:
- Any manual permission changes are detected
- Violations are automatically reverted
- Protected principals are never removed

## Verification Checklist

After deployment, verify:

- [ ] Can login with Google OAuth
- [ ] Projects list loads from Supabase
- [ ] Template editor shows folder tree
- [ ] Can create new template version
- [ ] Can apply template to projects
- [ ] Jobs appear in job dashboard
- [ ] Permission violations are detected
- [ ] Audit log records actions
- [ ] Settings page shows protected principals

## License

Private - All rights reserved
