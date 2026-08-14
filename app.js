(() => {

  function switchView(viewName) {
    document.querySelectorAll('.view').forEach((v) => v.classList.remove('is-active'));
    document.querySelectorAll('.tab-btn').forEach((b) => {
      b.classList.remove('is-active');
      b.removeAttribute('aria-current');
    });

    const target = document.getElementById(`view-${viewName}`);
    if (target) target.classList.add('is-active');

    const btn = document.querySelector(`.tab-btn[data-view="${viewName}"]`);
    if (btn) { btn.classList.add('is-active'); btn.setAttribute('aria-current', 'page'); }

    document.getElementById('sidebar').classList.remove('is-open');
    document.getElementById('mobileNavToggle').setAttribute('aria-expanded', 'false');
  }

  function initNav() {
    document.querySelectorAll('.tab-btn').forEach((btn) => {
      btn.addEventListener('click', () => switchView(btn.dataset.view));
    });

    document.getElementById('mobileNavToggle').addEventListener('click', () => {
      const sidebar = document.getElementById('sidebar');
      const isOpen = sidebar.classList.toggle('is-open');
      document.getElementById('mobileNavToggle').setAttribute('aria-expanded', String(isOpen));
    });
  }

  function applyTheme(theme) {
    document.documentElement.setAttribute('data-theme', theme === 'dark' ? 'dark' : 'light');
    const toggle = document.getElementById('themeToggle');
    toggle.setAttribute('aria-pressed', theme === 'dark' ? 'true' : 'false');
  }

  function initTheme() {
    const settings = Storage.getSettings();
    applyTheme(settings.theme);

    document.getElementById('themeToggle').addEventListener('click', () => {
      const current = Storage.getSettings();
      const next = current.theme === 'dark' ? 'light' : 'dark';
      Storage.saveSettings({ ...current, theme: next });
      applyTheme(next);
    });
  }

  function initAddContactButtons() {
    document.getElementById('btnAddContactSidebar').addEventListener('click', () => {
      switchView('contacts');
      ContactManager.openAddModal();
    });
  }

  function initSearchAndFilters() {
    const searchInput = document.getElementById('searchInput');
    const filterCategory = document.getElementById('filterCategory');
    const sortBy = document.getElementById('sortBy');
    const favBtn = document.getElementById('btnFavFilter');
    const viewSwitch = document.getElementById('viewSwitch');

    const debouncedSearch = Utils.debounce((value) => {
      ContactManager.setFilter({ query: value });
    }, 200);

    searchInput.addEventListener('input', (e) => debouncedSearch(e.target.value));

    filterCategory.addEventListener('change', (e) => {
      ContactManager.setFilter({ category: e.target.value });
    });

    sortBy.addEventListener('change', (e) => {
      ContactManager.setFilter({ sortBy: e.target.value });
    });

    favBtn.addEventListener('click', () => {
      const nowActive = favBtn.getAttribute('aria-pressed') !== 'true';
      favBtn.setAttribute('aria-pressed', String(nowActive));
      ContactManager.setFilter({ favoritesOnly: nowActive });
    });

    viewSwitch.querySelectorAll('.view-switch-btn').forEach((btn) => {
      btn.addEventListener('click', () => {
        viewSwitch.querySelectorAll('.view-switch-btn').forEach((b) => b.classList.remove('is-active'));
        btn.classList.add('is-active');
        ContactManager.setFilter({ layout: btn.dataset.layout });
      });
    });
  }

  function initSettingsActions() {
    document.getElementById('btnExportJson').addEventListener('click', () => {
      const data = Storage.exportAll();
      const stamp = new Date().toISOString().slice(0, 10);
      Utils.downloadFile(`task2-export-${stamp}.json`, JSON.stringify(data, null, 2));
      Utils.showToast('Contacts exported.', 'success');
    });

    document.getElementById('importFileInput').addEventListener('change', async (e) => {
      const file = e.target.files[0];
      if (!file) return;
      try {
        const text = await Utils.readFileAsText(file);
        const data = JSON.parse(text);
        const preview = Storage.inspectImport(data);
        const proceed = window.confirm(`Import preview: ${preview.totalRecords} total, ${preview.newContacts.length} new, ${preview.duplicateRecords} duplicate, ${preview.invalidRecords} invalid. Import only the new valid contacts?`);
        if (!proceed) return;
        Storage.importAll(data);
        ContactManager.refreshFromStorage();
        Utils.showToast(`${preview.newContacts.length} contact${preview.newContacts.length === 1 ? '' : 's'} imported.`, 'success');
      } catch (err) {
        console.error(err);
        Utils.showToast('That file could not be imported.', 'error');
      } finally {
        e.target.value = '';
      }
    });

    document.getElementById('btnResetData').addEventListener('click', () => {
      const exportFirst = window.confirm('Download a backup before resetting?');
      if (exportFirst) {
        const stamp = new Date().toISOString().slice(0, 10);
        Utils.downloadFile(`cardhub-backup-${stamp}.json`, JSON.stringify(Storage.exportAll(), null, 2));
      }
      const confirmed = window.confirm('Reset all data? This deletes every contact, category, and setting.');
      if (!confirmed) return;
      Storage.resetAll();
      ContactManager.refreshFromStorage();
      applyTheme(Storage.getSettings().theme);
      Utils.showToast('All data has been reset.', 'success');
    });
  }

  function init() {
    try {
      Storage.init();
    } catch (err) {
      Utils.showToast(err.message || 'Browser storage is unavailable.', 'error');
    }
    initNav();
    initTheme();
    initAddContactButtons();
    initSearchAndFilters();
    initSettingsActions();
    ContactManager.init();
  }

  document.addEventListener('DOMContentLoaded', init);
})();
