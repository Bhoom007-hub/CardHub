const Storage = (() => {
  const KEYS = { CONTACTS: 'bco_contacts', CATEGORIES: 'bco_categories', SETTINGS: 'bco_settings' };
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
  return { KEYS, SCHEMA_VERSION, DEFAULT_CATEGORIES, init, getContacts, saveContacts, getCategories, saveCategories, getSettings, saveSettings, exportAll, inspectImport, importAll, resetAll };
})();
