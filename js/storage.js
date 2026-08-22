const Storage = (() => {
  const SCHEMA_VERSION = 2;
  const DEFAULT_CATEGORIES = ['Clients', 'Vendors', 'Partners', 'Employees', 'Personal'];
  const DEFAULT_SETTINGS   = { theme: 'light', schemaVersion: SCHEMA_VERSION };

  // Legacy LocalStorage keys — kept only for the one-time migration path.
  const LEGACY_KEYS = {
    CONTACTS:   'bco_contacts',
    CATEGORIES: 'bco_categories',
    SETTINGS:   'bco_settings',
    USERS:      'chp_users',
    SESSION:    'chp_session',
  };

  // ── helpers shared with import / migration ────────────────────────────────

  function safeParse(raw, fallback) {
    if (!raw) return fallback;
    try {
      const parsed = JSON.parse(raw);
      return parsed === null ? fallback : parsed;
    } catch (_) {
      return fallback;
    }
  }

  function normalizeCategories(value) {
    if (!Array.isArray(value)) return [...DEFAULT_CATEGORIES];
    const unique = [];
    value.forEach((category) => {
      const name = typeof category === 'string' ? category.trim() : '';
      if (
        name &&
        name.length <= 60 &&
        !unique.some((item) => item.toLowerCase() === name.toLowerCase())
      ) {
        unique.push(name);
      }
    });
    return unique.length ? unique : [...DEFAULT_CATEGORIES];
  }

  function normalizeContacts(value) {
    if (!Array.isArray(value)) return [];
    const ids = new Set();
    return value.reduce((result, item) => {
      if (!item || typeof item !== 'object') return result;
      const contact = Validation.sanitizeContact(item);
      if (Object.keys(Validation.validateContact(contact)).length || ids.has(contact.id)) {
        return result;
      }
      ids.add(contact.id);
      result.push(contact);
      return result;
    }, []);
  }

  // ── column-name mapping: JS camelCase ↔ DB snake_case ────────────────────

  function _toRow(contact, userId) {
    return {
      id:                contact.id,
      user_id:           userId,
      full_name:         contact.fullName          || '',
      company:           contact.company           || '',
      job_title:         contact.jobTitle          || '',
      email:             contact.email             || '',
      phone:             contact.phone             || '',
      website:           contact.website           || '',
      address:           contact.address           || '',
      notes:             contact.notes             || '',
      category:          contact.category          || '',
      photo:             contact.photo             || null,
      favorite:          Boolean(contact.favorite),
      priority:          contact.priority          || 'medium',
      status:            contact.status            || 'active',
      last_contacted_at: contact.lastContactedAt   || null,
      next_follow_up_at: contact.nextFollowUpAt    || null,
      created_at:        contact.createdAt         || new Date().toISOString(),
      updated_at:        contact.updatedAt         || new Date().toISOString(),
    };
  }

  function _fromRow(row) {
    return {
      id:              row.id,
      fullName:        row.full_name        || '',
      company:         row.company          || '',
      jobTitle:        row.job_title        || '',
      email:           row.email            || '',
      phone:           row.phone            || '',
      website:         row.website          || '',
      address:         row.address          || '',
      notes:           row.notes            || '',
      category:        row.category         || '',
      photo:           row.photo            || null,
      favorite:        Boolean(row.favorite),
      priority:        row.priority         || 'medium',
      status:          row.status           || 'active',
      lastContactedAt: row.last_contacted_at || null,
      nextFollowUpAt:  row.next_follow_up_at || null,
      createdAt:       row.created_at,
      updatedAt:       row.updated_at,
    };
  }

  // ── per-user contacts ─────────────────────────────────────────────────────

  /**
   * Fetch all contacts for a user, ordered newest-first.
   * @param {string} userId
   * @returns {Promise<Contact[]>}
   */
  async function getContactsForUser(userId) {
    const { data, error } = await supabase
      .from('contacts')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false });

    if (error) throw new Error('Could not load contacts.');
    return (data || []).map(_fromRow);
  }

  /**
   * Persist the full in-memory contacts array for a user.
   * Uses upsert for adds/edits and deletes rows that are no longer present.
   * @param {string} userId
   * @param {Contact[]} contacts
   * @returns {Promise<void>}
   */
  async function saveContactsForUser(userId, contacts) {
    if (!Array.isArray(contacts)) throw new Error('Contacts must be an array.');

    if (contacts.length > 0) {
      const rows = contacts.map((c) => _toRow(c, userId));
      const { error: upsertErr } = await supabase
        .from('contacts')
        .upsert(rows, { onConflict: 'id' });
      if (upsertErr) throw new Error('Could not save contacts.');
    }

    // Remove rows that exist in the DB but are no longer in the array.
    const ids = contacts.map((c) => c.id);
    if (ids.length > 0) {
      const { error: delErr } = await supabase
        .from('contacts')
        .delete()
        .eq('user_id', userId)
        .not('id', 'in', `(${ids.join(',')})`);
      if (delErr) throw new Error('Could not sync contacts.');
    } else {
      // Array is empty — delete everything for this user.
      const { error: delErr } = await supabase
        .from('contacts')
        .delete()
        .eq('user_id', userId);
      if (delErr) throw new Error('Could not clear contacts.');
    }
  }

  // ── per-user categories ───────────────────────────────────────────────────

  /**
   * Fetch the ordered category name list for a user.
   * @param {string} userId
   * @returns {Promise<string[]>}
   */
  async function getCategoriesForUser(userId) {
    const { data, error } = await supabase
      .from('categories')
      .select('name')
      .eq('user_id', userId)
      .order('position', { ascending: true });

    if (error) return [...DEFAULT_CATEGORIES];
    const names = (data || []).map((r) => r.name);
    return names.length ? names : [...DEFAULT_CATEGORIES];
  }

  /**
   * Replace the category list for a user.
   * Deletes all existing rows then inserts the new list in position order.
   * @param {string} userId
   * @param {string[]} categories
   * @returns {Promise<void>}
   */
  async function saveCategoriesForUser(userId, categories) {
    const normalized = normalizeCategories(categories);

    await supabase.from('categories').delete().eq('user_id', userId);

    if (normalized.length > 0) {
      const { error } = await supabase.from('categories').insert(
        normalized.map((name, i) => ({ user_id: userId, name, position: i }))
      );
      if (error) throw new Error('Could not save categories.');
    }
  }

  // ── per-user settings ─────────────────────────────────────────────────────

  /**
   * Fetch settings for a user.  Returns DEFAULT_SETTINGS if no row exists.
   * @param {string} userId
   * @returns {Promise<object>}
   */
  async function getSettingsForUser(userId) {
    const { data, error } = await supabase
      .from('settings')
      .select('theme')
      .eq('user_id', userId)
      .maybeSingle();

    if (error || !data) return { ...DEFAULT_SETTINGS };
    return { theme: data.theme || 'light', schemaVersion: SCHEMA_VERSION };
  }

  /**
   * Persist settings for a user.
   * @param {string} userId
   * @param {object} settings
   * @returns {Promise<void>}
   */
  async function saveSettingsForUser(userId, settings) {
    const theme = (settings && settings.theme === 'dark') ? 'dark' : 'light';
    const { error } = await supabase
      .from('settings')
      .upsert({ user_id: userId, theme }, { onConflict: 'user_id' });
    if (error) throw new Error('Could not save settings.');
  }

  // ── per-user export ───────────────────────────────────────────────────────

  /**
   * Build a JSON-exportable snapshot of the user's data.
   * @param {string} userId
   * @returns {Promise<object>}
   */
  async function exportForUser(userId) {
    const [contacts, categories, settings] = await Promise.all([
      getContactsForUser(userId),
      getCategoriesForUser(userId),
      getSettingsForUser(userId),
    ]);
    return {
      contacts,
      categories,
      settings,
      exportedAt: new Date().toISOString(),
      version: SCHEMA_VERSION,
    };
  }

  // ── per-user import ───────────────────────────────────────────────────────

  /**
   * Analyse import data against the user's existing contacts.
   * Does NOT persist anything.
   * @param {string} userId
   * @param {{ contacts: any[] }} data
   * @returns {Promise<{ totalRecords, newContacts, duplicateRecords, invalidRecords }>}
   */
  async function inspectImportForUser(userId, data) {
    if (!data || typeof data !== 'object' || !Array.isArray(data.contacts)) {
      throw new Error('The import file must contain a contacts array.');
    }
    const existing    = await getContactsForUser(userId);
    const importIds   = new Set();
    const newContacts = [];
    let duplicateRecords = 0;
    let invalidRecords   = 0;

    data.contacts.forEach((item) => {
      if (!item || typeof item !== 'object') { invalidRecords += 1; return; }
      const contact = Validation.sanitizeContact(item);
      if (
        Object.keys(Validation.validateContact(contact)).length ||
        importIds.has(contact.id)
      ) {
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
   * Merge valid, non-duplicate contacts from data into the user's store.
   * @param {string} userId
   * @param {{ contacts: any[] }} data
   * @returns {Promise<{ totalRecords, newContacts, duplicateRecords, invalidRecords }>}
   */
  async function importAllForUser(userId, data) {
    const preview = await inspectImportForUser(userId, data);
    if (preview.newContacts.length > 0) {
      const existing = await getContactsForUser(userId);
      await saveContactsForUser(userId, [...existing, ...preview.newContacts]);

      // Merge any new categories from the import file.
      if (Array.isArray(data.categories) && data.categories.length) {
        const existingCats = await getCategoriesForUser(userId);
        const merged = normalizeCategories([...existingCats, ...data.categories]);
        await saveCategoriesForUser(userId, merged);
      }
    }
    return preview;
  }

  // ── per-user reset ────────────────────────────────────────────────────────

  /**
   * Wipe the user's contacts, reset categories to defaults, reset theme to light.
   * Does NOT delete the auth account.
   * @param {string} userId
   * @returns {Promise<void>}
   */
  async function resetUser(userId) {
    await Promise.all([
      supabase.from('contacts').delete().eq('user_id', userId),
      saveCategoriesForUser(userId, [...DEFAULT_CATEGORIES]),
      saveSettingsForUser(userId, { theme: 'light' }),
    ]);
  }

  // ── legacy LocalStorage migration helpers ─────────────────────────────────
  // These exist solely to handle users who still have data in the old
  // chp_users / bco_* keys from the LocalStorage-only version.
  // They are purely LocalStorage reads — no Supabase writes here; callers
  // (app.js showMigrationPrompt) handle the Supabase writes themselves.

  /**
   * True when the legacy bco_contacts key exists AND chp_users is absent.
   * This is the "upgrading from the original single-user build" scenario.
   * @returns {boolean}
   */
  function detectLegacyData() {
    try {
      return (
        localStorage.getItem(LEGACY_KEYS.CONTACTS) !== null &&
        localStorage.getItem(LEGACY_KEYS.USERS)    === null
      );
    } catch (_) {
      return false;
    }
  }

  /**
   * True when the old multi-user chp_users key is present.
   * This means the user ran the LocalStorage multi-user version before and
   * has account + contact data to migrate into Supabase.
   * @returns {boolean}
   */
  function detectLocalStorageUsers() {
    try {
      return localStorage.getItem(LEGACY_KEYS.USERS) !== null;
    } catch (_) {
      return false;
    }
  }

  /**
   * Read all user records from the legacy chp_users key.
   * Returns [] if the key is absent or corrupt.
   * @returns {object[]}
   */
  function getLegacyUsers() {
    try {
      return safeParse(localStorage.getItem(LEGACY_KEYS.USERS), []) || [];
    } catch (_) {
      return [];
    }
  }

  /**
   * Read legacy bco_* contacts (the very old single-user format).
   * Returns normalised Contact[].
   */
  function getLegacyContacts() {
    try {
      const raw = safeParse(localStorage.getItem(LEGACY_KEYS.CONTACTS), []);
      return normalizeContacts(raw);
    } catch (_) {
      return [];
    }
  }

  /**
   * Read legacy bco_* categories.
   * Returns normalised string[].
   */
  function getLegacyCategories() {
    try {
      const raw = safeParse(localStorage.getItem(LEGACY_KEYS.CATEGORIES), []);
      return normalizeCategories(raw);
    } catch (_) {
      return [...DEFAULT_CATEGORIES];
    }
  }

  /**
   * Remove all legacy LocalStorage keys (bco_* and chp_*).
   * Call only after a successful Supabase migration.
   */
  function clearLegacyData() {
    [
      LEGACY_KEYS.CONTACTS,
      LEGACY_KEYS.CATEGORIES,
      LEGACY_KEYS.SETTINGS,
      LEGACY_KEYS.USERS,
      LEGACY_KEYS.SESSION,
    ].forEach((key) => {
      try { localStorage.removeItem(key); } catch (_) { /* best-effort */ }
    });
  }

  // ── kept for backward-compat with app.js migration overlay ───────────────
  // The old app.js migration prompt calls these directly.

  function discardLegacyData() {
    [LEGACY_KEYS.CONTACTS, LEGACY_KEYS.CATEGORIES, LEGACY_KEYS.SETTINGS].forEach((key) => {
      try { localStorage.removeItem(key); } catch (_) { /* best-effort */ }
    });
  }

  // getContacts() is kept so showMigrationPrompt() (app.js) can read the
  // legacy contact count without changes to that code path.
  function getContacts() {
    return getLegacyContacts();
  }

  return {
    SCHEMA_VERSION,
    DEFAULT_CATEGORIES,
    DEFAULT_SETTINGS,
    LEGACY_KEYS,
    // helpers
    normalizeContacts,
    normalizeCategories,
    // per-user async API
    getContactsForUser,
    saveContactsForUser,
    getCategoriesForUser,
    saveCategoriesForUser,
    getSettingsForUser,
    saveSettingsForUser,
    exportForUser,
    inspectImportForUser,
    importAllForUser,
    resetUser,
    // legacy migration helpers (LocalStorage reads only)
    detectLegacyData,
    detectLocalStorageUsers,
    getLegacyUsers,
    getLegacyContacts,
    getLegacyCategories,
    clearLegacyData,
    discardLegacyData,
    getContacts,
  };
})();
