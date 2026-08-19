const Storage = (() => {
  const KEYS = { CONTACTS: 'bco_contacts', CATEGORIES: 'bco_categories', SETTINGS: 'bco_settings', USERS: 'chp_users' };
  const SCHEMA_VERSION = 2;
  const DEFAULT_CATEGORIES = ['Clients', 'Vendors', 'Partners', 'Employees', 'Personal'];
  const DEFAULT_SETTINGS = { theme: 'light', schemaVersion: SCHEMA_VERSION };

  function safeParse(raw, fallback) {
    if (!raw) return fallback;
    try { const parsed = JSON.parse(raw); return parsed === null ? fallback : parsed; } catch (_) { return fallback; }
  }
  function read(key, fallback) {
    try { return safeParse(localStorage.getItem(key), fallback); } catch (_) { throw new Error('Browser storage is unavailable. Changes cannot be saved.'); }
  }
  function write(key, value) {
    try { localStorage.setItem(key, JSON.stringify(value)); } catch (_) { throw new Error('Browser storage is full or unavailable. Changes were not saved.'); }
  }
  function normalizeCategories(value) {
    if (!Array.isArray(value)) return [...DEFAULT_CATEGORIES];
    const unique = [];
    value.forEach((category) => {
      const name = typeof category === 'string' ? category.trim() : '';
      if (name && name.length <= 60 && !unique.some((item) => item.toLowerCase() === name.toLowerCase())) unique.push(name);
    });
    return unique.length ? unique : [...DEFAULT_CATEGORIES];
  }
  function normalizeContacts(value) {
    if (!Array.isArray(value)) return [];
    const ids = new Set();
    return value.reduce((result, item) => {
      if (!item || typeof item !== 'object') return result;
      const contact = Validation.sanitizeContact(item);
      if (Object.keys(Validation.validateContact(contact)).length || ids.has(contact.id)) return result;
      ids.add(contact.id); result.push(contact); return result;
    }, []);
  }
  function getContacts() { return normalizeContacts(read(KEYS.CONTACTS, [])); }
  function saveContacts(contacts) {
    if (!Array.isArray(contacts)) throw new Error('Contacts must be an array.');
    write(KEYS.CONTACTS, normalizeContacts(contacts));
  }
  function getCategories() { return normalizeCategories(read(KEYS.CATEGORIES, [...DEFAULT_CATEGORIES])); }
  function saveCategories(categories) { write(KEYS.CATEGORIES, normalizeCategories(categories)); }
  function getSettings() {
    const settings = read(KEYS.SETTINGS, { ...DEFAULT_SETTINGS });
    return { ...DEFAULT_SETTINGS, ...(settings && typeof settings === 'object' ? settings : {}) };
  }
  function saveSettings(settings) { write(KEYS.SETTINGS, { ...DEFAULT_SETTINGS, ...(settings || {}), schemaVersion: SCHEMA_VERSION }); }
  function init() { saveContacts(getContacts()); saveCategories(getCategories()); saveSettings(getSettings()); }
  function exportAll() { return { contacts: getContacts(), categories: getCategories(), settings: getSettings(), exportedAt: new Date().toISOString(), version: SCHEMA_VERSION }; }
  function inspectImport(data) {
    if (!data || typeof data !== 'object' || !Array.isArray(data.contacts)) throw new Error('The import file must contain a contacts array.');
    const existing = getContacts(); const importIds = new Set(); const newContacts = [];
    let duplicateRecords = 0; let invalidRecords = 0;
    data.contacts.forEach((item) => {
      if (!item || typeof item !== 'object') { invalidRecords += 1; return; }
      const contact = Validation.sanitizeContact(item);
      if (Object.keys(Validation.validateContact(contact)).length || importIds.has(contact.id)) { invalidRecords += 1; return; }
      importIds.add(contact.id);
      if (Validation.findDuplicate(contact, [...existing, ...newContacts])) { duplicateRecords += 1; return; }
      newContacts.push(contact);
    });
    return { totalRecords: data.contacts.length, newContacts, duplicateRecords, invalidRecords, categories: normalizeCategories(data.categories) };
  }
  function importAll(data) {
    const preview = inspectImport(data);
    if (!preview.newContacts.length) return preview;
    saveContacts([...getContacts(), ...preview.newContacts]);
    saveCategories([...getCategories(), ...preview.categories]);
    return preview;
  }
  function resetAll() {
    try { localStorage.removeItem(KEYS.CONTACTS); localStorage.removeItem(KEYS.CATEGORIES); localStorage.removeItem(KEYS.SETTINGS); init(); }
    catch (_) { throw new Error('Browser storage is unavailable. Data could not be reset.'); }
  }

  // --- User store helpers (multi-user API) ---

  /** Returns the full array of User records. Returns [] if the key is missing or the stored value is corrupt. */
  function getUsers() {
    const users = read(KEYS.USERS, []);
    return Array.isArray(users) ? users : [];
  }

  /** Persists the full array of User records to LocalStorage. */
  function saveUsers(users) {
    if (!Array.isArray(users)) throw new Error('Users must be an array.');
    write(KEYS.USERS, users);
  }

  /** Returns the User object whose id matches userId, or null if not found. */
  function getUserById(userId) {
    if (!userId) return null;
    const users = getUsers();
    return users.find((u) => u && u.id === userId) || null;
  }

  /** Returns the User object whose email matches (case-insensitive), or null if not found. */
  function getUserByEmail(email) {
    if (!email) return null;
    const target = email.toLowerCase();
    const users = getUsers();
    return users.find((u) => u && typeof u.email === 'string' && u.email.toLowerCase() === target) || null;
  }

  // --- Per-user data methods (Req 17 AC 2) ---

  /** Returns the Contact array for the given user, normalised via normalizeContacts.
   *  Returns [] if userId does not match any record. */
  function getContactsForUser(userId) {
    const user = getUserById(userId);
    if (!user) return [];
    return normalizeContacts(Array.isArray(user.contacts) ? user.contacts : []);
  }

  /** Persists contacts to the matching user's record via saveUsers.
   *  Does nothing if userId is not found. */
  function saveContactsForUser(userId, contacts) {
    const users = getUsers();
    const index = users.findIndex((u) => u && u.id === userId);
    if (index === -1) return;
    users[index] = { ...users[index], contacts: normalizeContacts(Array.isArray(contacts) ? contacts : []) };
    saveUsers(users);
  }

  /** Returns the categories array for the given user.
   *  Returns [...DEFAULT_CATEGORIES] if userId does not match any record. */
  function getCategoriesForUser(userId) {
    const user = getUserById(userId);
    if (!user) return [...DEFAULT_CATEGORIES];
    return Array.isArray(user.categories) ? user.categories : [...DEFAULT_CATEGORIES];
  }

  /** Persists normalizeCategories(categories) to the matching user's record via saveUsers.
   *  Does nothing if userId is not found. */
  function saveCategoriesForUser(userId, categories) {
    const users = getUsers();
    const index = users.findIndex((u) => u && u.id === userId);
    if (index === -1) return;
    users[index] = { ...users[index], categories: normalizeCategories(categories) };
    saveUsers(users);
  }

  /** Returns the settings object for the given user.
   *  Returns DEFAULT_SETTINGS if userId does not match any record. */
  function getSettingsForUser(userId) {
    const user = getUserById(userId);
    if (!user) return { ...DEFAULT_SETTINGS };
    const stored = user.settings && typeof user.settings === 'object' ? user.settings : {};
    return { ...DEFAULT_SETTINGS, ...stored };
  }

  /** Persists settings merged with DEFAULT_SETTINGS to the matching user's record via saveUsers.
   *  Does nothing if userId is not found. */
  function saveSettingsForUser(userId, settings) {
    const users = getUsers();
    const index = users.findIndex((u) => u && u.id === userId);
    if (index === -1) return;
    users[index] = { ...users[index], settings: { ...DEFAULT_SETTINGS, ...(settings || {}), schemaVersion: SCHEMA_VERSION } };
    saveUsers(users);
  }

  // --- Per-user export / import / reset (Req 8 AC 5; Design §4.1) ---

  /**
   * Returns a snapshot of the user's data suitable for download.
   * Reads exclusively via the per-user helpers — no direct localStorage access.
   * @param {string} userId
   * @returns {{ contacts: Contact[], categories: string[], settings: object, exportedAt: string, version: number }}
   */
  function exportForUser(userId) {
    return {
      contacts: getContactsForUser(userId),
      categories: getCategoriesForUser(userId),
      settings: getSettingsForUser(userId),
      exportedAt: new Date().toISOString(),
      version: SCHEMA_VERSION,
    };
  }

  /**
   * Analyses import data against the user's existing contacts using the same
   * duplicate-detection logic as inspectImport.  Does NOT persist anything.
   * @param {string} userId
   * @param {{ contacts: any[] }} data
   * @returns {{ totalRecords: number, newContacts: Contact[], duplicateRecords: number, invalidRecords: number }}
   */
  function inspectImportForUser(userId, data) {
    if (!data || typeof data !== 'object' || !Array.isArray(data.contacts)) {
      throw new Error('The import file must contain a contacts array.');
    }
    const existing = getContactsForUser(userId);
    const importIds = new Set();
    const newContacts = [];
    let duplicateRecords = 0;
    let invalidRecords = 0;

    data.contacts.forEach((item) => {
      if (!item || typeof item !== 'object') { invalidRecords += 1; return; }
      const contact = Validation.sanitizeContact(item);
      if (Object.keys(Validation.validateContact(contact)).length || importIds.has(contact.id)) {
        invalidRecords += 1;
        return;
      }
      importIds.add(contact.id);
      if (Validation.findDuplicate(contact, [...existing, ...newContacts])) {
        duplicateRecords += 1;
        return;
      }
      newContacts.push(contact);
    });

    return { totalRecords: data.contacts.length, newContacts, duplicateRecords, invalidRecords };
  }

  /**
   * Merges valid, non-duplicate contacts from data into the user's Contact_Store
   * and persists the result via saveContactsForUser.
   * @param {string} userId
   * @param {{ contacts: any[] }} data
   * @returns {{ totalRecords: number, newContacts: Contact[], duplicateRecords: number, invalidRecords: number }}
   */
  function importAllForUser(userId, data) {
    const preview = inspectImportForUser(userId, data);
    if (preview.newContacts.length > 0) {
      const merged = [...getContactsForUser(userId), ...preview.newContacts];
      saveContactsForUser(userId, merged);
    }
    return preview;
  }

  /**
   * Resets a user's contacts to [], categories to the default list, and settings
   * to { theme: 'light', schemaVersion: 2 }.  Does NOT remove the user account.
   * @param {string} userId
   */
  function resetUser(userId) {
    const users = getUsers();
    const index = users.findIndex((u) => u && u.id === userId);
    if (index === -1) return;
    users[index] = {
      ...users[index],
      contacts: [],
      categories: [...DEFAULT_CATEGORIES],
      settings: { ...DEFAULT_SETTINGS },
    };
    saveUsers(users);
  }

  // --- Migration helpers (Req 18; Design §4.1, §7) ---

  /**
   * Returns true only when the legacy `bco_contacts` key is present AND the
   * new `chp_users` key is absent — i.e. this is a first-run after upgrading
   * from the single-user version.
   * Once migration is complete (bco_* keys removed) this will return false on
   * every subsequent page load, satisfying the "callable only once" guarantee
   * (Req 18 AC 7).
   * @returns {boolean}
   */
  function detectLegacyData() {
    try {
      const hasLegacy = localStorage.getItem(KEYS.CONTACTS) !== null;
      const hasUsers  = localStorage.getItem(KEYS.USERS)    !== null;
      return hasLegacy && !hasUsers;
    } catch (_) {
      return false;
    }
  }

  /**
   * Copies contacts and categories from the legacy bco_* keys into the named
   * user's record, then removes bco_contacts, bco_categories, and bco_settings.
   * Is idempotent: if bco_contacts is already absent, returns { contactCount: 0 }
   * without error (Req 18 AC 3, 7).
   * NOTE: Does NOT delete legacy data before migration is complete — the bco_*
   * keys are only removed after a successful merge (Req 18 AC 1).
   * @param {string} userId
   * @returns {{ contactCount: number }}
   */
  function claimLegacyData(userId) {
    // Idempotency: if there is nothing to migrate, return early.
    if (localStorage.getItem(KEYS.CONTACTS) === null) {
      return { contactCount: 0 };
    }

    // Read legacy data without removing it yet (Req 18 AC 1).
    const legacyContacts   = safeParse(localStorage.getItem(KEYS.CONTACTS),   []);
    const legacyCategories = safeParse(localStorage.getItem(KEYS.CATEGORIES), []);

    const normalizedLegacyContacts   = normalizeContacts(legacyContacts);
    const normalizedLegacyCategories = normalizeCategories(legacyCategories);
    const contactCount = normalizedLegacyContacts.length;

    // Merge contacts — append to the user's existing contacts, skipping
    // duplicates detected by Validation.findDuplicate (same logic as importAll).
    const existingContacts = getContactsForUser(userId);
    const dedupedNew = normalizedLegacyContacts.filter(
      (lc) => !Validation.findDuplicate(lc, existingContacts),
    );
    saveContactsForUser(userId, [...existingContacts, ...dedupedNew]);

    // Merge categories — union of existing and legacy, preserving order.
    const existingCategories = getCategoriesForUser(userId);
    const mergedCategories = normalizeCategories([...existingCategories, ...normalizedLegacyCategories]);
    saveCategoriesForUser(userId, mergedCategories);

    // Only now that the merge has succeeded, remove the legacy keys (Req 18 AC 3).
    try { localStorage.removeItem(KEYS.CONTACTS);   } catch (_) { /* best-effort */ }
    try { localStorage.removeItem(KEYS.CATEGORIES); } catch (_) { /* best-effort */ }
    try { localStorage.removeItem(KEYS.SETTINGS);   } catch (_) { /* best-effort */ }

    return { contactCount };
  }

  /**
   * Removes bco_contacts, bco_categories, and bco_settings from LocalStorage
   * without reading their contents (Req 18 AC 5).
   * Used when the user chooses "Start Fresh" in the migration flow.
   */
  function discardLegacyData() {
    try { localStorage.removeItem(KEYS.CONTACTS);   } catch (_) { /* best-effort */ }
    try { localStorage.removeItem(KEYS.CATEGORIES); } catch (_) { /* best-effort */ }
    try { localStorage.removeItem(KEYS.SETTINGS);   } catch (_) { /* best-effort */ }
  }

  return { KEYS, SCHEMA_VERSION, DEFAULT_CATEGORIES, init, getContacts, saveContacts, getCategories, saveCategories, getSettings, saveSettings, exportAll, inspectImport, importAll, resetAll, getUsers, saveUsers, getUserById, getUserByEmail, getContactsForUser, saveContactsForUser, getCategoriesForUser, saveCategoriesForUser, getSettingsForUser, saveSettingsForUser, exportForUser, inspectImportForUser, importAllForUser, resetUser, detectLegacyData, claimLegacyData, discardLegacyData };
})();
