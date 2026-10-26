# Wire Chief

Wire Chief is a mobile-first job book for an electrical contractor. Mat Hiner, Project Manager at AKA Electric Inc, is the default profile. His email on a new device is Mathew@akaelectricinc.com. The foreman is a separate field and stays blank until that name is verified. It is not RivetOne and it does not share data with that app.

Jobs, daily reports, crew, open items, material takeoffs, and files stay in **IndexedDB on this phone or computer**. The book works with no sign-in and with no signal. Sign in to share it with the crew.

## Run it

```bash
npm install
npm run dev -- --hostname 0.0.0.0 --port 43123
```

Open `http://127.0.0.1:43123/Wire-Chife-/`. The app is mounted at `/Wire-Chife-` so it matches the GitHub Pages project site.

Other commands:

```bash
npm test
npm run lint
npm run build
npm run preview:pages
```

`npm run build` writes a static site to `out/`. `npm run preview:pages` serves that folder the way GitHub Pages does, including the 404 shell for a job id that was created on the phone.

## Phone install

The public site is [https://mathew440.github.io/Wire-Chife-/](https://mathew440.github.io/Wire-Chife-/). This repository (`mathew440/Wire-Chife-`) is the GitHub Pages host. A push to `main` runs `.github/workflows/pages.yml`, which builds the static export and deploys it.

On iPhone, open that address in Safari, then Share → Add to Home Screen. Open the icon once while you have signal so the service worker can store the shell. After that, a page you have already opened still loads with no signal. Jobs, reports, and files stay in IndexedDB on that phone. Export a backup from Data before you delete the icon.

## What's in the book

The first open starts empty. There are no built-in jobs. Add a job, or import a backup JSON file from Data. A backup from an earlier version still loads, including one whose settings already mark a starter book as loaded. Data has two imports: add one job from a file (other jobs stay) or replace every job (this wipes the phone, and the screen asks you to export first).

## How sharing works

Sign in from Data or the status line in the header with the email Mat set up and a password. The first time, choose Create my login. There is no password-reset email. If you forget the password, ask Mat.

The phone still works if you skip sign-in, or if the shared database cannot be reached. Sharing runs only while you are signed in and online. The header shows Synced, Syncing, Offline, or Needs sign-in. Data has a Sync now button and Sign out.

The first time you sign in on a phone that already has jobs, Wire Chief asks before it uploads them. Yes sends this phone's jobs up. No leaves those jobs on this phone until you edit them. Jobs already in the shared book are merged in by their id. The same backup imported on two phones does not create two copies of a job. If two people edit the same row, the later edit wins. A delete is shared too. When a row says who edited it, the screen shows "Last edited by" that person.

Photos and PDFs are stored as files, not inside the job text. They download onto the phone when you open them. An older backup that has no sharing fields still imports.

Each job has a submittal log, an RFI log, a 2-week and 6-week look-ahead with start and end dates, a photo log by area, an orders list, hours allowed against hours used, and a weekly PDF. Hours you type are used first. A daily report's manpower is added only on a day with no typed hours, so a day is never counted twice. Orders and hours travel in the same backup. An older backup that does not have them still loads. Photos are reduced in size on the device and travel with the backup. Contacts have a company and an email, and the Contacts tab lists them across jobs. The job list shows what is overdue or due within 7 days. The browser can show one notification a day when you allow it.

Daily reports keep Completed, Ongoing, Planned, and Needs verification as separate notes. Nothing promotes a note from one to another. Weather stays **unverified** until you type it. Schedule dates can be tentative, confirmed, or needs verification. Estimates are quantities and crew size × duration, with no price fields, and they export as their own PDF. The weekly PDF uses the name, role, company, and email saved on this device. The default profile is Mat Hiner, Project Manager, AKA Electric Inc, Mathew@akaelectricinc.com. A blank company or email on an older device is filled in once. A company or email you already typed is left as it is. The old built-in company name AKA Electric is updated to AKA Electric Inc.

## How records are stored

All writes go through `src/lib/data/repo.ts`. Each row has `rev`, `updatedAt`, `deletedAt`, and `syncState`. Every save also appends a row to the `changelog` table on this phone. Signed-in sharing is in `src/lib/sync/engine.ts`.

## Roadmap

- **Drawing markup and measurement** on the PDFs already stored on the job
- **Pocket AI note import** so a dictated note can land in the paste box, still without auto-filing it into a status
