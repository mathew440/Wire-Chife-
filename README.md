# Wire Chief

Wire Chief is a mobile-first job book for an electrical contractor. Mat Hiner at AKA Electric in northern Ohio is the project manager. The foreman is a separate field and stays blank until that name is verified. It is not RivetOne and it does not share data with that app.

Jobs, daily reports, crew, open items, material takeoffs, and files stay in **IndexedDB on this phone or computer**. Version 1 has no account, no server, and no credentials.

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

On iPhone, open that address in Safari, then Share → Add to Home Screen. Open the icon once while you have signal so the service worker can store the shell. After that, a page you have already opened still loads with no signal. Jobs, reports, and files stay in IndexedDB on that phone. Export a backup from Data before you delete the icon. There is no account and no cloud copy.

## What's in the book

Two jobs are loaded the first time you open the app, from the AKA Electric Google Drive as of **10/23/26**. They are marked **DRIVE 10/23/26** and stay separate from each other:

- **Findley State Park** — AKA Job 26194. Wire pull in conduit bored by others. Facts that were not in that folder are marked needs verification.
- **St. Peter Church** — St. Peters Parish Hall. The only schedule on file is stale. Other details need verification.

You can remove them on the Data page. A backup JSON file is the way to move the book to another device until cloud sync exists.

Daily reports keep Completed, Ongoing, Planned, and Needs verification as separate notes. Nothing promotes a note from one to another. Weather stays **unverified** until you type it. Every date can be marked tentative or confirmed. Estimates are quantities and crew size × duration, with no price fields, and they export as their own PDF.

## How a backend would plug in later

All writes go through `src/lib/data/repo.ts`. Each row has `rev`, `updatedAt`, `deletedAt`, and `syncState`. Every save also appends a row to the `changelog` table. `src/lib/sync/adapter.ts` defines a `SyncAdapter`. v1 ships `localOnlySync`, which never leaves the device. A cloud service would push that log and pull other people's rows. Team accounts belong with that service.

## Roadmap

- **Cloud sync** for more than one device, using the change log and sync adapter already in the data layer
- **Team accounts** so a foreman and a PM can share a job without handing over a phone
- **Drawing markup and measurement** on the PDFs already stored on the job
- **Pocket AI note import** so a dictated note can land in the paste box, still without auto-filing it into a status
