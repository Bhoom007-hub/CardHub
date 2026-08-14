# Implementation audit — CardHub

## Scope and baseline

Reviewed `index.html`, all available CSS and JavaScript files, `README.md`,
and `sample-import.json`. No `assets/` directory or `js/validation.js` existed
at the start of the review.

## What already worked

- Modular separation was mostly sound: `storage.js` was the only direct
  LocalStorage consumer; search logic was DOM-free; UI rendering lived in
  `contacts.js`.
- Core CRUD, favorites, categories, search, combined filters, grid/list views,
  dashboard counts, theme persistence, vCard export, JSON export, responsive
  sidebar, toast feedback, and Escape-to-close modal behavior were implemented.
- User text was escaped in most HTML templates, and website tabs were opened
  with `noopener`.

## Findings before changes

| Severity | Finding | Impact |
| --- | --- | --- |
| High | `validation.js` was required but absent. | Invalid data, oversized/unsafe photos, and duplicates could be saved. |
| High | Imports overwrote contacts/categories/settings without validation or preview. | Data loss and corrupted records were possible. |
| High | Storage assumed LocalStorage always works and could throw raw errors. | The UI could fail after quota/privacy-mode errors. |
| High | Stored contacts were missing full schema normalization/versioning. | `updatedAt`, priority/status, IDs, and imported records were unreliable. |
| Medium | The form had an accidental nested `.form-grid` and no matching close. | Browser HTML repair could produce inconsistent form layout/behavior. |
| Medium | Descending sort options and `lastContactedAt` input were absent. | Required features were incomplete. |
| Medium | Image URLs were inserted from persisted data without a strict allowlist. | Imported values were not defensively handled. |
| Medium | Reset re-ran theme initialization, adding another click listener. | Theme could toggle twice after reset. |
| Medium | Several controls lacked explicit button types or complete ARIA state. | Keyboard and screen-reader use was less reliable. |
| Low | README omitted the complete model, validation, schema version, and testing guidance. | Handoff documentation was incomplete. |

## Implemented changes

Each item names the original code being replaced and the new behavior. Exact
current implementation is in the linked file; this document intentionally
records only the changed blocks rather than duplicating whole source files.

### `js/validation.js` — new file

- **Old code:** no validation module existed.
- **New code:** `Validation` provides contact field/date/length validation,
  duplicate detection (email or name+company), safe `http(s)` URL normalization,
  1 MB PNG/JPEG/GIF/WebP checks, safe data-image allowlisting, and schema
  normalization.
- **Test:** attempt blank/invalid fields, duplicate email, malformed website,
  SVG/oversize photo, and a valid contact.
- **Side effect:** websites are stored with an `https://` prefix when omitted;
  unsupported image types are now rejected.

### `index.html` — form and accessibility repair

- **Old code:** `'<div class="form-grid"><div class="form-grid">'` opened two
  form grids but only one was closed; sort values were `name` and `company`;
  the last-contacted field and validation script were missing.
- **New code:** one balanced form grid, `name-asc/name-desc/company-asc/company-desc`
  choices, `fieldLastContacted`, length limits, form error live message,
  `validation.js` script, labelled search, explicit button types, navigation
  state, and live toast semantics.
- **Test:** tab through controls; submit invalid data; choose each sort option;
  verify the form grid at desktop and mobile widths.
- **Side effect:** browser-native max lengths now stop overlong input sooner.

### `js/storage.js` — persistence boundary hardening

- **Old code:** direct `localStorage.getItem/setItem/removeItem` calls were
  unguarded; `importAll` assigned incoming arrays directly; export version was
  fixed at `1`.
- **New code:** guarded `read`/`write`, schema version `2`, category and contact
  normalization, safe defaults, `inspectImport`, merge-only validated import,
  and controlled reset errors.
- **Test:** import `sample-import.json` twice; the first preview is 8 new and
  the second is 8 duplicates. Simulate unavailable/full storage in browser
  privacy/quota conditions.
- **Side effect:** malformed stored records are excluded instead of being
  rendered; import no longer overwrites settings or existing contacts.

### `js/contacts.js` — validation and data integrity integration

- **Old code:** save checked only `if (!fullName)` and created contact objects
  inline; photos were read without type/size checks; photo strings were trusted
  in dashboard/detail rendering.
- **New code:** form errors are announced and focused, duplicate creation is
  blocked, images are validated, contact updates use `Validation.sanitizeContact`,
  `createdAt` is retained, `updatedAt` changes on edits, `lastContactedAt` is
  captured/displayed, unsafe photos fall back to initials, and save failures
  show a toast instead of escaping as exceptions.
- **Test:** add/edit a contact and confirm immutable `createdAt`; add same email
  again; upload SVG or a file over 1 MB; inspect last-contacted in details.
- **Side effect:** a previously accepted duplicate must be reviewed rather than
  saved, and unsupported legacy photo URLs are hidden.

### `js/search.js` — complete sort coverage

- **Old code:** `case 'name'` and `case 'company'` supported ascending only.
- **New code:** explicit ascending and descending name/company cases.
- **Test:** add contacts with differing names and companies, then select all
  five sort choices.
- **Side effect:** external callers must use the new explicit sort values.

### `js/app.js` — import/reset/theme safety

- **Old code:** import directly called `Storage.importAll(data)`; reset called
  `initTheme()` after initialization.
- **New code:** import displays total/new/duplicate/invalid preview before a
  merge-only import; reset offers a backup download and reapplies theme without
  adding another listener; navigation/mobile ARIA state stays synchronized.
- **Test:** cancel and confirm an import; cancel and confirm reset; reset then
  toggle theme once.
- **Side effect:** imports require a confirmation click after file selection.

### `js/utils.js` and `css/style.css` — output and validation presentation

- **Old code:** vCard values were inserted without vCard escaping, and there
  was no reusable visually-hidden label/error styling.
- **New code:** vCard delimiters/newlines are escaped; `.sr-only`, invalid-field,
  and form-error styles support the new accessible controls.
- **Test:** export a vCard containing commas, semicolons, backslashes, and line
  breaks; submit an invalid form with a keyboard.
- **Side effect:** exported vCards encode special characters per vCard rules.

### `README.md` — documentation update

- **Old code:** described only the original reduced data model and no validation
  or test plan.
- **New code:** documents `validation.js`, new schema fields/version, hardened
  import/reset behavior, and a browser/device test checklist.
- **Test:** compare the documented model and folder tree to the project files.
- **Side effect:** none at runtime.

## Verification performed

- `node --check` passed for every JavaScript module.
- A sandboxed storage test loaded `utils.js`, `validation.js`, and `storage.js`:
  default initialization, valid sample preview, merge import, duplicate import,
  timestamp handling, and image validation passed.
- A source scan confirmed `storage.js` is the only JavaScript file that
  references `localStorage`.

## Remaining manual verification

The available browser automation surface blocks local `file:` URLs, so visual
and interaction testing must be run locally. Validate the README checklist,
especially Safari/Firefox/Edge behavior and all listed viewport widths.

## Deliberate follow-up work

- Replace browser `confirm()` dialogs for import/reset with the existing
  focus-trapping modal pattern; the current confirmation is functional but not
  the final accessible-modal standard.
- Add automated browser tests once the project has a local test server.
- Consider IndexedDB for photos/large data sets; LocalStorage quota remains a
browser limitation even with graceful failures.
