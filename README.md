<div align="center">

<img width="100%" src="https://capsule-render.vercel.app/api?type=waving&color=0:09001F,25:240046,60:5A189A,100:00E5FF&height=220&section=header&text=DEMO%20ACCESS&fontSize=52&fontColor=FFFFFF&animation=twinkling&fontAlignY=38&desc=FAMILY%20CARE%20HUB%20%E2%80%A2%20LIVE%20EXPERIENCE&descSize=16&descAlignY=62&descColor=00F5FF" />

<br/>

# <span style="color:#00F5FF">EXPERIENCE THE PLATFORM</span>

### <span style="color:#B388FF">YOUR ACCESS. YOUR EXPERIENCE.</span>

Explore **Family Care Hub** using the exclusive demo account below.

<br/>

<img src="https://img.shields.io/badge/STATUS-DEMO%20AVAILABLE-00F5FF?style=for-the-badge&labelColor=09001F" />

<br/><br/>

<table>
<tr>
<td colspan="2" align="center">

<h2>TEST ACCOUNT CREDENTIALS</h2>

</td>
</tr>
<tr>
<td align="center"><b>EMAIL ADDRESS</b></td>
<td align="center"><code>chaoslives01@gmail.com</code></td>
</tr>
<tr>
<td align="center"><b>PASSWORD</b></td>
<td align="center"><code>Leo12345</code></td>
</tr>
</table>

<br/>

<img src="https://img.shields.io/badge/ACCESS-READY%20TO%20EXPLORE-8A2BE2?style=for-the-badge&labelColor=09001F" />

<br/><br/>

### <span style="color:#00F5FF">SIGN IN. DISCOVER. EXPERIENCE.</span>

<img width="100%" src="https://capsule-render.vercel.app/api?type=waving&color=0:00E5FF,40:5A189A,100:09001F&height=120&section=footer&animation=twinkling" />

</div>

# Family Care Hub

A family healthcare coordination platform that helps users organize
family groups, care recipients, appointments, tasks, medical
information, and family updates through a centralized dashboard.

> **Project status:** Development / hackathon project\
> **Data notice:** Use synthetic or properly authorized data for
> demonstrations and testing.
This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).

## Getting Started

First, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```
<div align="center">

<img src="https://capsule-render.vercel.app/api?type=waving&color=0:141E30,100:243B55&height=180&section=header&text=FAMILY%20CARE%20HUB&fontSize=38&fontColor=ffffff&animation=fadeIn&fontAlignY=38&desc=Explore%20the%20Platform%20Live&descAlignY=60&descSize=16" width="100%" />


##  **EXPLORE THE FEATURES**

- **Family Dashboard**
- **Family Group Management**
- **Care Recipient Management**
- **Appointment Scheduling**
- **Task Management**
- **Notifications**
- **Medical Records**

> **⚠️ IMPORTANT:** This account is exclusively for demonstration and testing. Do not enter real personal or medical information.
Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.

## Features

-   User authentication
-   Family group creation and management
-   Family membership and role assignment
-   Role-based permissions: Admin, Caregiver, Contributor, and Viewer
-   Care-recipient management
-   Appointment coordination
-   Care-related task tracking
-   Medical records and prescription organization
-   Family timeline and updates

Feature availability may depend on the current implementation and
deployment configuration.

## Technology Stack

-   **Framework:** Next.js
-   **Language:** TypeScript
-   **Styling:** Tailwind CSS
-   **Backend/API:** Next.js Route Handlers
-   **Database and authentication:** Supabase
-   **Supabase integration:** Supabase JavaScript client and
    `@supabase/ssr`

## Project Structure

``` text
family-care-hub/
├── frontend/
│   ├── src/
│   │   ├── app/
│   │   │   └── api/           # API route handlers
│   │   ├── lib/
│   │   │   ├── server/        # Server-side auth and permissions
│   │   │   └── supabase/      # Supabase client setup
│   │   └── ...
│   └── package.json
├── supabase/
│   ├── migrations/            # Database migrations
│   └── config.toml
└── README.md
```

The exact structure may evolve as the project develops.

## Prerequisites

-   Node.js (supported LTS release)
-   npm
-   Git
-   A Supabase project

## Getting Started

### 1. Clone the repository

``` bash
git clone <YOUR_REPOSITORY_URL>
cd family-care-hub
```

### 2. Install dependencies

``` bash
cd frontend
npm install
```

### 3. Configure environment variables

Create `frontend/.env.local`:

``` env
NEXT_PUBLIC_SUPABASE_URL=your_supabase_project_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_publishable_or_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_server_only_secret_key
```

Obtain the values from your Supabase project settings.

**Security:** - Never commit `.env.local` or credentials. - Never expose
`SUPABASE_SERVICE_ROLE_KEY` in browser-side code. - Keep service-role
access in server-only modules. - If a secret is exposed, rotate it
immediately in Supabase.

### 4. Apply the database migrations

From the repository root, authenticate and link the Supabase CLI to your
own project:

``` bash
npx supabase login
npx supabase link --project-ref YOUR_SUPABASE_PROJECT_REF
npx supabase db push --remote
```

Review migration files and verify the target project before applying
database changes. Back up important data first.

### 5. Start the development server

From `frontend/`:

``` bash
npm run dev
```

To use another port, such as 3001:

``` bash
npm run dev -- -p 3001
```

Open `http://localhost:3000` or `http://localhost:3001`, depending on
the selected port.

## Available Scripts

Run commands from `frontend/`. The scripts actually available are listed
in `frontend/package.json`.

  Command           Purpose
  ----------------- ------------------------------------------
  `npm run dev`     Start the development server, if defined
  `npm run build`   Build the production app, if defined
  `npm run start`   Start the production server, if defined
  `npm run lint`    Run lint checks, if defined

## Database and Access Control

Supabase provides data storage and authentication. Server-side API
routes should authenticate users and verify family membership and
permissions before returning or changing family data.

The application uses these family roles:

-   **Admin**
-   **Caregiver**
-   **Contributor**
-   **Viewer**

Authorization must be enforced on the server and through Supabase Row
Level Security (RLS), not only by hiding frontend controls.

## Privacy and Responsible Use

Family Care Hub is a software project and is not a medical device or a
substitute for professional medical advice, diagnosis, or treatment.

Before using the application with real personal or health information:

1.  Review applicable privacy, security, and healthcare-data
    requirements.
2.  Configure and test Supabase RLS policies.
3.  Review authentication, authorization, session handling, storage,
    logging, and backups.
4.  Use HTTPS and secure deployment settings.
5.  Collect only the information required.
6.  Obtain appropriate consent and authorization.
7.  Do not use demo credentials or synthetic data in production.

The presence of security-related code does not certify regulatory
compliance or guarantee that a deployment is secure.

## Deployment

Deploy the Next.js frontend to a hosting provider that supports Next.js.
Configure the required environment variables in the hosting provider's
server-side settings.

Before deployment:

-   Verify the linked Supabase project.
-   Apply and verify database migrations.
-   Check RLS policies and role permissions.
-   Keep service-role credentials server-only.
-   Test sign-in, family creation, membership, and access restrictions
    with separate test accounts.
-   Run the production build.
-   Use synthetic data for public demonstrations.

## Contributing

1.  Fork the repository.
2.  Create a feature branch.
3.  Make focused changes.
4.  Run the checks and tests available in the project.
5.  Submit a pull request describing the change.

Do not include patient data, credentials, access tokens, or private user
information in commits or pull requests.

## License

MIT License

Copyright (c) 2026 Clown Minons

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files...

## Acknowledgements

-   Next.js
-   Supabase
-   TypeScript
-   Tailwind CSS
