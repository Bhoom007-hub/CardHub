# CardHub — Business Card Organizer

A fully client-side business card manager. No build step, no frameworks,
no backend — open `index.html` in a browser and it works. All data is
stored in the browser's `localStorage`.

## Running it

Just open `index.html` in a modern browser (Chrome, Firefox, Safari, Edge).
Double-clicking the file works fine since everything is plain HTML/CSS/JS
with relative paths — no server required.

## Folder structure

```
business-card-organizer/
├── index.html            Single-page app shell (all views live here)
├── css/
│   ├── style.css          Design tokens, layout, buttons, modals, dashboard
│   ├── contacts.css        The business-card tiles + flip interaction
│   └── responsive.css      Tablet / mobile breakpoints
├── js/
│   ├── storage.js          LocalStorage read/write — the only file that touches it
│   ├── utils.js             Helpers: ids, formatting, clipboard, toasts, vCard, file downloads
│   ├── validation.js        Contact, image, duplicate, and import validation
│   ├── search.js            Pure filter/sort logic (no DOM access)
│   ├── contacts.js          Contact + category CRUD, rendering, modals
│   └── app.js                Boots the app: navigation, theme, settings wiring
└── assets/                 Empty folders reserved for icons/images
```

## Features

- **Dashboard** — total cards, unique companies, favorites, category count,
  a recently-added list, and a per-category breakdown.
- **Contacts** — add, edit, delete, and favorite cards. Each card has a
  flip interaction (click to flip): the front shows name/role/category,
  the back shows email/phone/website plus quick actions.
- **Search & filters** — live search by name, company, or email; filter
  by category; favorites-only toggle; sort by name, company, or recency;
  switch between grid and list layouts.
- **Categories** — default categories (Clients, Vendors, Partners,
  Employees, Personal) plus custom categories you add or remove.
- **Contact detail modal** — full field view, copy email/phone to
  clipboard, open the website in a new tab, export a `.vcf` vCard.
- **Settings** — light/dark theme, export all data as JSON, import a
  previously exported JSON file with a record preview and duplicate protection,
  and a full data reset with an optional backup download.
- **Validation and safety** — required names, email/phone/website/date/length
  checks, 1 MB PNG/JPEG/GIF/WebP photo limits, safe rendering of stored values,
  and user-friendly storage errors.
- **Responsive** — sidebar collapses to a slide-out drawer on mobile,
  grid reflows down to a single column.

## Data model

Each contact is stored as:

```json
{
  "id": "c_...",
  "fullName": "Ada Lovelace",
  "company": "Analytical Engines Ltd",
  "jobTitle": "Mathematician",
  "email": "ada@engines.co",
  "phone": "+1 555 010 0100",
  "website": "engines.co",
  "address": "1 Analytical Ave",
  "category": "Clients",
  "notes": "Met at the print fair.",
  "photo": "data:image/png;base64,... or null",
  "favorite": false,
  "priority": "medium",
  "status": "active",
  "lastContactedAt": null,
  "nextFollowUpAt": null,
  "createdAt": "2026-07-27T00:00:00.000Z",
  "updatedAt": "2026-07-27T00:00:00.000Z"
}
```

LocalStorage keys used: `bco_contacts`, `bco_categories`, `bco_settings`.
Exports include a top-level schema version and timestamp. The current schema is
version 2; `storage.js` normalizes older valid records when they are read.

## Testing

Test add, edit, delete, favorite, search, combined category/favorite filters,
all five sort options, category removal, import preview, export, reset backup,
theme persistence, invalid input, duplicate detection, photo limits, and empty
states. Check keyboard-only use and layouts at 320, 375, 390, 414, 768, 1024,
1280, 1440, and 1920 pixels in Chrome, Safari, Firefox, and Edge.

## Notes for future contributors

- `storage.js` is the single source of truth for persistence — don't call
  `localStorage` directly from other files.
- `search.js` has no DOM dependencies by design, so its filter/sort logic
  is easy to unit test in isolation.
- Photos are stored as base64 data URLs directly in localStorage. This is
  fine for a handful of small images but will hit localStorage's ~5MB
  limit if used heavily — a future version could move to IndexedDB.


## Live demo

- Netlify: `PASTE_YOUR_NETLIFY_LINK_HERE`
- GitHub Pages: `PASTE_YOUR_GITHUB_PAGES_LINK_HERE`

## Source code

- GitHub repository: `PASTE_YOUR_GITHUB_REPOSITORY_LINK_HERE`
