const ContactManager = (() => {

  let contacts = [];
  let categories = [];

  const filterState = {
    query: '',
    category: 'all',
    favoritesOnly: false,
    sortBy: 'recent',
    layout: 'grid',
  };

  let editingId = null;
  let pendingPhotoDataUrl = null;
  let photoRemoved = false;
  let pendingDeleteContactId = null;
  let pendingDeleteCategory = null;
  let detailContactId = null;

  // ---------- DOM refs (queried lazily so this file can load before app.js runs) ----------
  const el = {};
  function cacheEls() {
    el.cardDeck = document.getElementById('cardDeck');
    el.emptyState = document.getElementById('emptyState');
    el.filterCategory = document.getElementById('filterCategory');
    el.fieldCategory = document.getElementById('fieldCategory');
    el.categoryList = document.getElementById('categoryList');
    el.statTotal = document.getElementById('statTotal');
    el.statCompanies = document.getElementById('statCompanies');
    el.statFavorites = document.getElementById('statFavorites');
    el.statCategories = document.getElementById('statCategories');
    el.recentList = document.getElementById('recentList');
    el.categoryBreakdown = document.getElementById('categoryBreakdown');

    el.contactModalOverlay = document.getElementById('contactModalOverlay');
    el.contactModalTitle = document.getElementById('contactModalTitle');
    el.contactForm = document.getElementById('contactForm');
    el.contactId = document.getElementById('contactId');
    el.fieldFullName = document.getElementById('fieldFullName');
    el.fieldCompany = document.getElementById('fieldCompany');
    el.fieldJobTitle = document.getElementById('fieldJobTitle');
    el.fieldEmail = document.getElementById('fieldEmail');
    el.fieldPhone = document.getElementById('fieldPhone');
    el.fieldWebsite = document.getElementById('fieldWebsite');
    el.fieldAddress = document.getElementById('fieldAddress');
    el.fieldNotes = document.getElementById('fieldNotes');

    el.fieldPriority = document.getElementById('fieldPriority');
    el.fieldStatus = document.getElementById('fieldStatus');
    el.fieldNextFollowUp = document.getElementById('fieldNextFollowUp');
    el.fieldLastContacted = document.getElementById('fieldLastContacted');

    el.photoPreview = document.getElementById('photoPreview');
    el.photoInitials = document.getElementById('photoInitials');
    el.photoImg = document.getElementById('photoImg');
    el.photoInput = document.getElementById('photoInput');

    el.detailModalOverlay = document.getElementById('detailModalOverlay');
    el.detailPhoto = document.getElementById('detailPhoto');
    el.detailInitials = document.getElementById('detailInitials');
    el.detailName = document.getElementById('detailName');
    el.detailTitleCompany = document.getElementById('detailTitleCompany');
    el.detailCategory = document.getElementById('detailCategory');
    el.detailFields = document.getElementById('detailFields');

    el.confirmOverlay = document.getElementById('confirmOverlay');
    el.confirmMessage = document.getElementById('confirmMessage');
  }

  // ---------- Data load/save ----------
  function loadData() {
    contacts = Storage.getContacts();
    categories = Storage.getCategories();
  }

  function persistContacts() {
    try {
      Storage.saveContacts(contacts);
      contacts = Storage.getContacts();
      return true;
    } catch (err) {
      loadData();
      Utils.showToast(err.message || 'Could not save contacts.', 'error');
      return false;
    }
  }

  function persistCategories() {
    try {
      Storage.saveCategories(categories);
      return true;
    } catch (err) {
      loadData();
      Utils.showToast(err.message || 'Could not save categories.', 'error');
      return false;
    }
  }

  // ---------- Category select population ----------
  function populateCategorySelects() {
    const filterOptions = ['<option value="all">All categories</option>']
      .concat(categories.map((c) => `<option value="${Utils.escapeHtml(c)}">${Utils.escapeHtml(c)}</option>`));
    el.filterCategory.innerHTML = filterOptions.join('');
    el.filterCategory.value = filterState.category;

    el.fieldCategory.innerHTML = categories
      .map((c) => `<option value="${Utils.escapeHtml(c)}">${Utils.escapeHtml(c)}</option>`)
      .join('') || '<option value="">No categories yet</option>';
  }

  // ---------- Rendering: dashboard ----------
  function renderDashboard() {
    const total = contacts.length;
    const companies = new Set(contacts.map((c) => (c.company || '').trim()).filter(Boolean));
    const favorites = contacts.filter((c) => c.favorite).length;
    const usedCategories = new Set(contacts.map((c) => c.category).filter(Boolean));

    el.statTotal.textContent = total;
    el.statCompanies.textContent = companies.size;
    el.statFavorites.textContent = favorites;
    el.statCategories.textContent = usedCategories.size;

    const recent = [...contacts]
      .sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0))
      .slice(0, 6);

    el.recentList.innerHTML = recent.length
      ? recent.map((c) => `
        <div class="recent-item" data-id="${c.id}">
          <div class="recent-avatar">${Validation.isSafeImageDataUrl(c.photo) ? `<img src="${c.photo}" alt="" />` : Utils.escapeHtml(Utils.initials(c.fullName))}</div>
          <div class="recent-meta">
            <p class="recent-name">${Utils.escapeHtml(c.fullName || 'Untitled')}</p>
            <p class="recent-sub">${Utils.escapeHtml(c.company || '—')} · ${Utils.formatDate(c.createdAt)}</p>
          </div>
        </div>`).join('')
      : '<p class="empty-note">No cards filed yet. Add your first one from the Contacts tab.</p>';

    el.recentList.querySelectorAll('.recent-item').forEach((node) => {
      node.addEventListener('click', () => openDetailModal(node.dataset.id));
    });

    const counts = {};
    contacts.forEach((c) => {
      const cat = c.category || 'Uncategorized';
      counts[cat] = (counts[cat] || 0) + 1;
    });
    const maxCount = Math.max(1, ...Object.values(counts));
    const rows = Object.entries(counts).sort((a, b) => b[1] - a[1]);

    el.categoryBreakdown.innerHTML = rows.length
      ? rows.map(([name, count]) => `
        <div class="category-row">
          <span style="width:88px; flex-shrink:0;">${Utils.escapeHtml(name)}</span>
          <span class="category-row-bar"><span class="category-row-fill" style="width:${(count / maxCount) * 100}%"></span></span>
          <span class="category-row-count">${count}</span>
        </div>`).join('')
      : '<p class="empty-note">Categories will appear here once you file some cards.</p>';
  }

  // ---------- Rendering: contacts grid/list ----------
  function renderCardDeck() {
    const results = Search.apply(contacts, filterState);
    el.cardDeck.dataset.layout = filterState.layout;
    el.emptyState.hidden = results.length !== 0;
    el.cardDeck.hidden = results.length === 0;

    el.cardDeck.innerHTML = results.map((c) => cardTemplate(c)).join('');

    // Wire per-card interactions
    el.cardDeck.querySelectorAll('.bcard').forEach((node) => {
      const id = node.dataset.id;

      node.querySelector('.bcard-face:not(.is-back)').addEventListener('click', (e) => {
        if (e.target.closest('.bcard-fav')) return;
        if (filterState.layout === 'list') {
          openDetailModal(id);
        } else {
          node.classList.toggle('is-flipped');
        }
      });

      const backFace = node.querySelector('.bcard-face.is-back');

if (backFace) {
  backFace.addEventListener('click', (e) => {
    if (e.target.closest('button')) return;

    node.classList.toggle('is-flipped');
  });
}

node.querySelector('.bcard-fav').addEventListener('click', (e) => {
  e.preventDefault();
  e.stopPropagation();

  toggleFavorite(id);
});

const viewBtn = node.querySelector('[data-action="view"]');

if (viewBtn) {
  viewBtn.addEventListener('click', (e) => {
    e.preventDefault();
    e.stopPropagation();

    openDetailModal(id);
  });
}

      const callBtn = node.querySelector('[data-action="call"]');
      if (callBtn) callBtn.addEventListener('click', (e) => { e.stopPropagation(); });

      const editBtn = node.querySelector('[data-action="edit"]');
      if (editBtn) editBtn.addEventListener('click', (e) => { e.stopPropagation(); openEditModal(id); });

      const delBtn = node.querySelector('[data-action="delete"]');
      if (delBtn) delBtn.addEventListener('click', (e) => { e.stopPropagation(); requestDeleteContact(id); });
    });
  }

  function cardTemplate(c) {
    const avatar = Validation.isSafeImageDataUrl(c.photo)
      ? `<img src="${c.photo}" alt="" />`
      : Utils.escapeHtml(Utils.initials(c.fullName));

    return `
      <div class="bcard" data-id="${c.id}">
        <div class="bcard-inner">
          <div class="bcard-face">
            <div class="bcard-top">
              <div class="bcard-avatar">${avatar}</div>
              <button class="bcard-fav${c.favorite ? ' is-fav' : ''}" title="Toggle favorite" aria-label="Toggle favorite">${c.favorite ? '★' : '☆'}</button>
            </div>
            <p class="bcard-name">${Utils.escapeHtml(c.fullName || 'Untitled')}</p>
            <p class="bcard-role">${Utils.escapeHtml([c.jobTitle, c.company].filter(Boolean).join(' · ') || '—')}</p>
            <div class="bcard-bottom">
              <span class="bcard-category">${Utils.escapeHtml(c.category || 'Uncategorized')}</span>
              <span class="bcard-hint">flip ↻</span>
            </div>
          </div>
          <div class="bcard-face is-back">
            <div>
              <div class="bcard-back-row"><span>@</span>${Utils.escapeHtml(c.email || '—')}</div>
              <div class="bcard-back-row"><span>#</span>${Utils.escapeHtml(c.phone || '—')}</div>
              <div class="bcard-back-row"><span>~</span>${Utils.escapeHtml(c.website || '—')}</div>
            </div>
            <div class="bcard-back-actions">
              <button type="button" class="bcard-icon-btn" data-action="view">View</button>
              <button type="button" class="bcard-icon-btn" data-action="edit">Edit</button>
              <button type="button" class="bcard-icon-btn" data-action="delete">Delete</button>
            </div>
          </div>
        </div>
      </div>`;
  }

  // ---------- Rendering: categories view ----------
  function renderCategories() {
    const counts = {};
    contacts.forEach((c) => {
      if (c.category) counts[c.category] = (counts[c.category] || 0) + 1;
    });

    el.categoryList.innerHTML = categories.length
      ? categories.map((cat) => `
        <div class="category-tile" data-category="${Utils.escapeHtml(cat)}">
          <div>
            <div class="category-tile-name">${Utils.escapeHtml(cat)}</div>
            <div class="category-tile-count">${counts[cat] || 0} contact${counts[cat] === 1 ? '' : 's'}</div>
          </div>
          <button class="category-tile-remove" title="Remove category" aria-label="Remove category">✕</button>
        </div>`).join('')
      : '<p class="empty-note">No categories yet. Add one above.</p>';

    el.categoryList.querySelectorAll('.category-tile').forEach((node) => {
      node.querySelector('.category-tile-remove').addEventListener('click', () => {
        requestDeleteCategory(node.dataset.category);
      });
    });
  }

  function addCategory(name) {
    const trimmed = (name || '').trim();
    if (!trimmed) {
      Utils.showToast('Category name cannot be empty.', 'error');
      return false;
    }
    if (categories.some((c) => c.toLowerCase() === trimmed.toLowerCase())) {
      Utils.showToast('That category already exists.', 'error');
      return false;
    }
    categories.push(trimmed);
    persistCategories();
    populateCategorySelects();
    renderCategories();
    renderDashboard();
    Utils.showToast(`Added category "${trimmed}".`, 'success');
    return true;
  }

  function requestDeleteCategory(name) {
    pendingDeleteCategory = name;
    pendingDeleteContactId = null;
    el.confirmMessage.textContent = `Remove the "${name}" category? Contacts in it will become uncategorized.`;
    el.confirmOverlay.hidden = false;
  }

  function removeCategoryConfirmed(name) {
    categories = categories.filter((c) => c !== name);
    contacts = contacts.map((c) => (c.category === name ? { ...c, category: '' } : c));
    persistCategories();
    persistContacts();
    populateCategorySelects();
    renderCategories();
    renderCardDeck();
    renderDashboard();
    Utils.showToast(`Removed category "${name}".`, 'success');
  }

  // ---------- Favorites ----------
  function toggleFavorite(id) {
    const c = contacts.find((x) => x.id === id);
    if (!c) return;
    c.favorite = !c.favorite;
    persistContacts();
    renderCardDeck();
    renderDashboard();
  }

  // ---------- Add / Edit modal ----------
  function resetForm() {
    el.contactForm.reset();
    el.contactId.value = '';
    editingId = null;
    pendingPhotoDataUrl = null;
    photoRemoved = false;
    el.photoImg.hidden = true;
    el.photoImg.src = '';
    el.photoInitials.hidden = false;
    el.photoInitials.textContent = '?';
    document.querySelectorAll('#contactForm [aria-invalid="true"]').forEach((field) => field.removeAttribute('aria-invalid'));
    const formError = document.getElementById('contactFormError');
    formError.hidden = true;
    formError.textContent = '';
  }

  function openAddModal() {
    resetForm();
    el.contactModalTitle.textContent = 'New card';
    if (categories.length && !el.fieldCategory.value) {
      el.fieldCategory.value = categories[0];
    }
    el.contactModalOverlay.hidden = false;
    el.fieldFullName.focus();
  }

  function openEditModal(id) {
    const c = contacts.find((x) => x.id === id);
    if (!c) return;
    resetForm();
    editingId = id;
    el.contactId.value = id;
    el.contactModalTitle.textContent = 'Edit card';

    el.fieldFullName.value = c.fullName || '';
    el.fieldCompany.value = c.company || '';
    el.fieldJobTitle.value = c.jobTitle || '';
    el.fieldCategory.value = c.category || '';
    el.fieldEmail.value = c.email || '';
    el.fieldPhone.value = c.phone || '';
    el.fieldWebsite.value = c.website || '';
    el.fieldAddress.value = c.address || '';
    el.fieldNotes.value = c.notes || '';

    el.fieldPriority.value = c.priority || 'medium';
    el.fieldStatus.value = c.status || 'active';
    el.fieldNextFollowUp.value = c.nextFollowUpAt || '';
    el.fieldLastContacted.value = c.lastContactedAt || '';

    if (c.photo) {
      el.photoImg.src = c.photo;
      el.photoImg.hidden = false;
      el.photoInitials.hidden = true;
      pendingPhotoDataUrl = c.photo;
    } else {
      el.photoInitials.textContent = Utils.initials(c.fullName);
    }

    el.contactModalOverlay.hidden = false;
    el.fieldFullName.focus();
  }

  function closeContactModal() {
    el.contactModalOverlay.hidden = true;
    resetForm();
  }

  function handlePhotoSelected(file) {
    if (!file) return;
    const imageError = Validation.validateImage(file);
    if (imageError) {
      el.photoInput.value = '';
      Utils.showToast(imageError, 'error');
      return;
    }
    Utils.readFileAsDataUrl(file).then((dataUrl) => {
      pendingPhotoDataUrl = dataUrl;
      photoRemoved = false;
      el.photoImg.src = dataUrl;
      el.photoImg.hidden = false;
      el.photoInitials.hidden = true;
    }).catch(() => Utils.showToast('Could not read that image.', 'error'));
  }

  function removePhoto() {
    pendingPhotoDataUrl = null;
    photoRemoved = true;
    el.photoImg.hidden = true;
    el.photoImg.src = '';
    el.photoInitials.hidden = false;
    el.photoInitials.textContent = Utils.initials(el.fieldFullName.value);
  }

  function handleFormSubmit(e) {
    e.preventDefault();
    const fullName = el.fieldFullName.value.trim();
    const base = {
      fullName,
      company: el.fieldCompany.value.trim(),
      jobTitle: el.fieldJobTitle.value.trim(),
      category: el.fieldCategory.value,
      email: el.fieldEmail.value.trim(),
      phone: el.fieldPhone.value.trim(),
      website: el.fieldWebsite.value.trim(),
      address: el.fieldAddress.value.trim(),
      notes: el.fieldNotes.value.trim(),

  // New business-management fields
    priority: el.fieldPriority.value,
    status: el.fieldStatus.value,
    lastContactedAt: el.fieldLastContacted.value || null,
    nextFollowUpAt: el.fieldNextFollowUp.value || null,
    };

    const errors = Validation.validateContact(base);
    const firstInvalidField = Object.keys(errors)[0];
    document.querySelectorAll('#contactForm [aria-invalid="true"]').forEach((field) => field.removeAttribute('aria-invalid'));
    const formError = document.getElementById('contactFormError');
    if (firstInvalidField) {
      const field = el[`field${firstInvalidField.charAt(0).toUpperCase()}${firstInvalidField.slice(1)}`];
      if (field) { field.setAttribute('aria-invalid', 'true'); field.focus(); }
      formError.textContent = errors[firstInvalidField];
      formError.hidden = false;
      return;
    }
    formError.hidden = true;
    const duplicate = Validation.findDuplicate(base, contacts, editingId);
    if (duplicate) {
      formError.textContent = `Possible duplicate: ${duplicate.fullName}${duplicate.company ? ` at ${duplicate.company}` : ''}. Review the existing contact before saving.`;
      formError.hidden = false;
      el.fieldFullName.focus();
      return;
    }

    if (editingId) {
      const idx = contacts.findIndex((c) => c.id === editingId);

    if (idx !== -1) {
      const existingPhoto = contacts[idx].photo || null;
      const photo = photoRemoved ? null : (pendingPhotoDataUrl || existingPhoto);

      contacts[idx] = Validation.sanitizeContact({ ...contacts[idx], ...base, photo }, contacts[idx]);
    }

     Utils.showToast('Card updated.', 'success');
  } else {
      const now = new Date().toISOString();

      contacts.unshift(Validation.sanitizeContact({ id: Utils.generateId(), ...base, photo: photoRemoved ? null : pendingPhotoDataUrl, favorite: false, createdAt: now }, {}));
      Utils.showToast('Card added.', 'success');
    }

    if (!persistContacts()) return;
    closeContactModal();
    renderCardDeck();
    renderDashboard();
    renderCategories();
  }

  // ---------- Delete ----------
  function requestDeleteContact(id) {
    const c = contacts.find((x) => x.id === id);
    if (!c) return;
    pendingDeleteContactId = id;
    pendingDeleteCategory = null;
    el.confirmMessage.textContent = `Delete the card for "${c.fullName || 'this contact'}"? This cannot be undone.`;
    el.confirmOverlay.hidden = false;
  }

  function deleteContactConfirmed(id) {
    contacts = contacts.filter((c) => c.id !== id);
    persistContacts();
    renderCardDeck();
    renderDashboard();
    renderCategories();
    Utils.showToast('Card deleted.', 'success');
  }

  function confirmPendingAction() {
    if (pendingDeleteContactId) {
      deleteContactConfirmed(pendingDeleteContactId);
    } else if (pendingDeleteCategory) {
      removeCategoryConfirmed(pendingDeleteCategory);
    }
    pendingDeleteContactId = null;
    pendingDeleteCategory = null;
    el.confirmOverlay.hidden = true;
  }

  function cancelPendingAction() {
    pendingDeleteContactId = null;
    pendingDeleteCategory = null;
    el.confirmOverlay.hidden = true;
  }

  // ---------- Detail modal ----------
  function openDetailModal(id) {
    const c = contacts.find((x) => x.id === id);
    if (!c) return;
    detailContactId = id;

    if (Validation.isSafeImageDataUrl(c.photo)) {
      el.detailPhoto.innerHTML = `<img src="${c.photo}" alt="" />`;
    } else {
      el.detailPhoto.innerHTML = `<span>${Utils.escapeHtml(Utils.initials(c.fullName))}</span>`;
    }

    el.detailName.textContent = c.fullName || 'Untitled';
    el.detailTitleCompany.textContent = [c.jobTitle, c.company].filter(Boolean).join(' at ') || '—';
    el.detailCategory.textContent = c.category || 'Uncategorized';

    const rows = [
      ['Email', c.email],
      ['Phone', c.phone],
      ['Website', c.website],
      ['Address', c.address],
      ['Notes', c.notes],

      ['Priority', c.priority],
      ['Status', c.status],
      ['Last contacted', c.lastContactedAt ? Utils.formatDate(c.lastContactedAt) : null],
      ['Next follow-up', c.nextFollowUpAt
        ? Utils.formatDate(c.nextFollowUpAt)
        : null
      ],

      ['Added', Utils.formatDate(c.createdAt)],
      ['Last updated', c.updatedAt
        ? Utils.formatDate(c.updatedAt)
        : null
      ],
    ].filter(([, v]) => v);

    el.detailFields.innerHTML = rows.map(([label, value]) => `
      <div><dt>${Utils.escapeHtml(label)}</dt><dd>${Utils.escapeHtml(value)}</dd></div>
    `).join('');

    el.detailModalOverlay.hidden = false;
  }

  function closeDetailModal() {
    el.detailModalOverlay.hidden = true;
    detailContactId = null;
  }

  function getDetailContact() {
    return contacts.find((c) => c.id === detailContactId) || null;
  }

  // ---------- Filter state (used by app.js) ----------
  function setFilter(patch) {
    Object.assign(filterState, patch);
    renderCardDeck();
  }

  function getFilterState() {
    return { ...filterState };
  }

  // ---------- Import/export passthrough (state refresh) ----------
  function refreshFromStorage() {
    loadData();
    populateCategorySelects();
    renderDashboard();
    renderCardDeck();
    renderCategories();
  }

  function init() {
    cacheEls();
    loadData();
    populateCategorySelects();
    renderDashboard();
    renderCardDeck();
    renderCategories();

    el.contactForm.addEventListener('submit', handleFormSubmit);
    el.photoInput.addEventListener('change', (e) => handlePhotoSelected(e.target.files[0]));
    document.getElementById('btnRemovePhoto').addEventListener('click', removePhoto);
    document.getElementById('closeContactModal').addEventListener('click', closeContactModal);
    document.getElementById('cancelContactForm').addEventListener('click', closeContactModal);
    el.contactModalOverlay.addEventListener('click', (e) => { if (e.target === el.contactModalOverlay) closeContactModal(); });

    document.getElementById('closeDetailModal').addEventListener('click', closeDetailModal);
    el.detailModalOverlay.addEventListener('click', (e) => { if (e.target === el.detailModalOverlay) closeDetailModal(); });

    document.getElementById('detailCopyEmail').addEventListener('click', async () => {
      const c = getDetailContact();
      if (!c || !c.email) return Utils.showToast('No email on file.', 'error');
      const ok = await Utils.copyToClipboard(c.email);
      Utils.showToast(ok ? 'Email copied.' : 'Could not copy email.', ok ? 'success' : 'error');
    });

    document.getElementById('detailCopyPhone').addEventListener('click', async () => {
      const c = getDetailContact();
      if (!c || !c.phone) return Utils.showToast('No phone on file.', 'error');
      const ok = await Utils.copyToClipboard(c.phone);
      Utils.showToast(ok ? 'Phone number copied.' : 'Could not copy phone number.', ok ? 'success' : 'error');
    });

    document.getElementById('detailOpenWebsite').addEventListener('click', () => {
      const c = getDetailContact();
      if (!c || !c.website) return Utils.showToast('No website on file.', 'error');
      window.open(Utils.normalizeUrl(c.website), '_blank', 'noopener');
    });

    document.getElementById('detailExportVcard').addEventListener('click', () => {
      const c = getDetailContact();
      if (!c) return;
      const vcard = Utils.vCardFor(c);
      const filename = `${(c.fullName || 'contact').replace(/\s+/g, '_')}.vcf`;
      Utils.downloadFile(filename, vcard, 'text/vcard');
      Utils.showToast('vCard exported.', 'success');
    });

    document.getElementById('detailEdit').addEventListener('click', () => {
      const id = detailContactId;
      closeDetailModal();
      openEditModal(id);
    });

    document.getElementById('detailDelete').addEventListener('click', () => {
      const id = detailContactId;
      closeDetailModal();
      requestDeleteContact(id);
    });

    document.getElementById('confirmOk').addEventListener('click', confirmPendingAction);
    document.getElementById('confirmCancel').addEventListener('click', cancelPendingAction);
    el.confirmOverlay.addEventListener('click', (e) => { if (e.target === el.confirmOverlay) cancelPendingAction(); });

    document.getElementById('btnAddCategory').addEventListener('click', () => {
      const input = document.getElementById('newCategoryInput');
      if (addCategory(input.value)) input.value = '';
    });
    document.getElementById('newCategoryInput').addEventListener('keydown', (e) => {
      if (e.key === 'Enter') document.getElementById('btnAddCategory').click();
    });

    document.addEventListener('keydown', (e) => {
      if (e.key !== 'Escape') return;
      if (!el.confirmOverlay.hidden) cancelPendingAction();
      else if (!el.detailModalOverlay.hidden) closeDetailModal();
      else if (!el.contactModalOverlay.hidden) closeContactModal();
    });
  }

  return {
    init,
    openAddModal,
    openEditModal,
    closeContactModal,
    openDetailModal,
    closeDetailModal,
    setFilter,
    getFilterState,
    refreshFromStorage,
    renderCardDeck,
    renderDashboard,
    renderCategories,
    getContactsCount: () => contacts.length,
  };
})();
