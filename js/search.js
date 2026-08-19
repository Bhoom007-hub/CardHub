const Search = (() => {

  function matchesQuery(contact, query) {
    if (!query) return true;
    const q = query.trim().toLowerCase();
    if (!q) return true;
    return (
      (contact.fullName || '').toLowerCase().includes(q) ||
      (contact.company || '').toLowerCase().includes(q) ||
      (contact.email || '').toLowerCase().includes(q)
    );
  }

  function matchesCategory(contact, category) {
    if (!category || category === 'all') return true;
    return (contact.category || '') === category;
  }

  function matchesFavorite(contact, favoritesOnly) {
    if (!favoritesOnly) return true;
    return !!contact.favorite;
  }

  function sortContacts(contacts, sortBy) {
    const list = [...contacts];
    switch (sortBy) {
      case 'name-asc':
        list.sort((a, b) => (a.fullName || '').localeCompare(b.fullName || ''));
        break;
      case 'name-desc':
        list.sort((a, b) => (b.fullName || '').localeCompare(a.fullName || ''));
        break;
      case 'company-asc':
        list.sort((a, b) => (a.company || '').localeCompare(b.company || ''));
        break;
      case 'company-desc':
        list.sort((a, b) => (b.company || '').localeCompare(a.company || ''));
        break;
      case 'recent':
      default:
        list.sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0));
        break;
    }
    return list;
  }

  function apply(contacts, { query = '', category = 'all', favoritesOnly = false, sortBy = 'recent' } = {}) {
    const filtered = contacts.filter(
      (c) => matchesQuery(c, query) && matchesCategory(c, category) && matchesFavorite(c, favoritesOnly)
    );
    return sortContacts(filtered, sortBy);
  }

  return { apply, matchesQuery, matchesCategory, matchesFavorite, sortContacts };
})();
