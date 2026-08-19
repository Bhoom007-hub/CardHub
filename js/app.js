(() => {
  function applyTheme(theme) {
    document.documentElement.setAttribute('data-theme', theme === 'dark' ? 'dark' : 'light');
    const toggle = document.getElementById('themeToggle');
    if (toggle) toggle.setAttribute('aria-pressed', theme === 'dark' ? 'true' : 'false');
  }

  function initTheme() {
    const user = Auth.getCurrentUser();
    const settings = user ? Storage.getSettingsForUser(user.id) : { theme: 'light' };
    applyTheme(settings.theme);

    const toggle = document.getElementById('themeToggle');
    if (!toggle) return;
    toggle.addEventListener('click', () => {
      const currentUser = Auth.getCurrentUser();
      if (!currentUser) return;
      const current = Storage.getSettingsForUser(currentUser.id);
      const next = current.theme === 'dark' ? 'light' : 'dark';
      Storage.saveSettingsForUser(currentUser.id, { ...current, theme: next });
      applyTheme(next);
    });
  }

  function initAddContactButtons() {
    document.getElementById('btnAddContactSidebar').addEventListener('click', () => {
      Router.navigate('contacts');
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
      const user = Auth.getCurrentUser();
      if (!user) return;
      const data = Storage.exportForUser(user.id);
      const stamp = new Date().toISOString().slice(0, 10);
      Utils.downloadFile(`cardhub-export-${stamp}.json`, JSON.stringify(data, null, 2));
      Utils.showToast('Contacts exported.', 'success');
    });

    document.getElementById('importFileInput').addEventListener('change', async (e) => {
      const file = e.target.files[0];
      if (!file) return;
      try {
        const text = await Utils.readFileAsText(file);
        const data = JSON.parse(text);
        const user = Auth.getCurrentUser();
        if (!user) return;
        const preview = Storage.inspectImportForUser(user.id, data);
        const proceed = window.confirm(`Import preview: ${preview.totalRecords} total, ${preview.newContacts.length} new, ${preview.duplicateRecords} duplicate, ${preview.invalidRecords} invalid. Import only the new valid contacts?`);
        if (!proceed) return;
        Storage.importAllForUser(user.id, data);
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
        const user = Auth.getCurrentUser();
        if (!user) return;
        Utils.downloadFile(`cardhub-backup-${stamp}.json`, JSON.stringify(Storage.exportForUser(user.id), null, 2));
      }
      const confirmed = window.confirm('Reset all data? This deletes every contact, category, and setting.');
      if (!confirmed) return;
      const user = Auth.getCurrentUser();
      if (!user) return;
      Storage.resetUser(user.id);
      ContactManager.refreshFromStorage();
      applyTheme(Storage.getSettingsForUser(user.id).theme);
      Utils.showToast('All data has been reset.', 'success');
    });
  }

  function clearFormErrors(form) {
    form.querySelectorAll('.form-error').forEach((error) => { error.textContent = ''; });
    form.querySelectorAll('[aria-invalid="true"]').forEach((field) => field.removeAttribute('aria-invalid'));
  }

  function showFieldError(form, field, errorId, message) {
    field.setAttribute('aria-invalid', 'true');
    const error = document.getElementById(errorId);
    if (error) error.textContent = message;
    field.focus();
  }

  function initAuthForms() {
    const signupForm = document.getElementById('signupForm');
    const loginForm = document.getElementById('loginForm');
    const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

    signupForm.addEventListener('submit', (event) => {
      event.preventDefault();
      clearFormErrors(signupForm);

      const name = document.getElementById('signupName');
      const email = document.getElementById('signupEmail');
      const password = document.getElementById('signupPassword');
      const confirmPassword = document.getElementById('signupConfirmPassword');
      const values = {
        name: name.value.trim(),
        email: email.value.trim(),
        password: password.value,
        confirmPassword: confirmPassword.value,
      };
      const validation = [
        [name, 'signupNameError', Validation.validateUserName(values.name)],
        [email, 'signupEmailError', !values.email ? 'Email is required.' : (!emailPattern.test(values.email) ? 'Enter a valid email address.' : null)],
        [password, 'signupPasswordError', Validation.validatePassword(values.password)],
        [confirmPassword, 'signupConfirmPasswordError', values.password !== values.confirmPassword ? 'Passwords do not match.' : null],
      ];
      const firstError = validation.find(([, , message]) => message);
      if (firstError) {
        showFieldError(signupForm, firstError[0], firstError[1], firstError[2]);
        return;
      }

      const result = Auth.register(values.name, values.email, values.password);
      if (!result.ok) {
        const formError = document.getElementById('signupFormError');
        if (formError) formError.textContent = result.error;
        email.focus();
        return;
      }

      updateUserDisplay(result.user);
      Utils.showToast('Account created. Welcome!', 'success');
      Router.navigate('dashboard');
      ContactManager.init();
    });

    loginForm.addEventListener('submit', (event) => {
      event.preventDefault();
      clearFormErrors(loginForm);

      const email = document.getElementById('loginEmail');
      const password = document.getElementById('loginPassword');
      const emailValue = email.value.trim();
      const validation = [
        [email, 'loginEmailError', !emailValue ? 'Email is required.' : (!emailPattern.test(emailValue) ? 'Enter a valid email address.' : null)],
        [password, 'loginPasswordError', !password.value ? 'Password is required.' : null],
      ];
      const firstError = validation.find(([, , message]) => message);
      if (firstError) {
        showFieldError(loginForm, firstError[0], firstError[1], firstError[2]);
        return;
      }

      const result = Auth.login(emailValue, password.value);
      if (!result.ok) {
        const formError = document.getElementById('loginFormError');
        if (formError) formError.textContent = 'Invalid email or password.';
        email.focus();
        return;
      }

      applyTheme(Storage.getSettingsForUser(result.user.id).theme);
      updateUserDisplay(result.user);
      Router.navigate('dashboard');
      ContactManager.init();
    });
  }

  function updateUserDisplay(user) {
    const name = document.getElementById('sidebarUserName');
    if (name) name.textContent = user ? user.name : '';
    const welcome = document.getElementById('dashWelcome');
    if (welcome) welcome.textContent = user ? `Welcome back, ${user.name}.` : 'Dashboard';
  }

  function initLogout() {
    const logoutButton = document.getElementById('btn-logout');
    if (!logoutButton) return;
    logoutButton.addEventListener('click', () => {
      Auth.logout();
      ContactManager.refreshFromStorage();
      updateUserDisplay(null);
      applyTheme('light');
      Router.navigate('home');
      Router.renderNav();
    });
  }

  let migrationFocusTrapAttached = false;

  function migrationFocusableElements() {
    const overlay = document.getElementById('migrationOverlay');
    if (!overlay) return [];
    return [...overlay.querySelectorAll('button, input, [href], select, textarea, [tabindex]:not([tabindex="-1"])')]
      .filter((element) => !element.disabled && !element.hidden && !element.closest('[hidden]'));
  }

  function restoreMigrationOptions() {
    const title = document.getElementById('migrationTitle');
    const description = document.getElementById('migrationDescription');
    const options = document.getElementById('migrationOptions');
    const form = document.getElementById('migrationSignupForm');
    const count = document.getElementById('migrationContactCount');
    if (title) title.textContent = 'We found existing CardHub data.';
    if (description) description.innerHTML = `We found <strong id="migrationContactCount">${count ? count.textContent : '0'}</strong> existing contacts. Create an account to keep them, or start fresh.`;
    if (options) options.hidden = false;
    if (form) form.hidden = true;
  }

  function clearMigrationErrors(form) {
    form.querySelectorAll('.form-error').forEach((error) => { error.textContent = ''; });
    form.querySelectorAll('[aria-invalid="true"]').forEach((field) => field.removeAttribute('aria-invalid'));
  }

  function validateMigrationForm(form) {
    clearMigrationErrors(form);
    const name = document.getElementById('migrationName');
    const email = document.getElementById('migrationEmail');
    const password = document.getElementById('migrationPassword');
    const confirmPassword = document.getElementById('migrationConfirmPassword');
    const emailValue = email.value.trim();
    const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    const validation = [
      [name, 'migrationNameError', Validation.validateUserName(name.value.trim())],
      [email, 'migrationEmailError', !emailValue ? 'Email is required.' : (!emailPattern.test(emailValue) ? 'Enter a valid email address.' : null)],
      [password, 'migrationPasswordError', Validation.validatePassword(password.value)],
      [confirmPassword, 'migrationConfirmPasswordError', password.value !== confirmPassword.value ? 'Passwords do not match.' : null],
    ];
    const firstError = validation.find(([, , message]) => message);
    if (!firstError) return { name: name.value.trim(), email: emailValue, password: password.value };

    firstError[0].setAttribute('aria-invalid', 'true');
    const error = document.getElementById(firstError[1]);
    if (error) error.textContent = firstError[2];
    firstError[0].focus();
    return null;
  }

  function showMigrationPrompt() {
    const overlay = document.getElementById('migrationOverlay');
    const countElement = document.getElementById('migrationContactCount');
    const options = document.getElementById('migrationOptions');
    const keepButton = document.getElementById('btnMigrationKeep');
    const freshButton = document.getElementById('btnMigrationFresh');
    const cancelButton = document.getElementById('btnMigrationCancel');
    const form = document.getElementById('migrationSignupForm');
    const formError = document.getElementById('migrationFormError');
    if (!overlay || !form || !keepButton || !freshButton) return;

    const contactCount = Storage.getContacts().length;
    if (countElement) countElement.textContent = String(contactCount);
    restoreMigrationOptions();
    overlay.hidden = false;

    if (!migrationFocusTrapAttached) {
      overlay.addEventListener('keydown', (event) => {
        if (event.key !== 'Tab') return;
        const focusable = migrationFocusableElements();
        if (!focusable.length) return;
        const first = focusable[0];
        const last = focusable[focusable.length - 1];
        if (event.shiftKey && document.activeElement === first) {
          event.preventDefault();
          last.focus();
        } else if (!event.shiftKey && document.activeElement === last) {
          event.preventDefault();
          first.focus();
        }
      });
      migrationFocusTrapAttached = true;
    }

    keepButton.onclick = () => {
      if (options) options.hidden = true;
      form.hidden = false;
      clearMigrationErrors(form);
      document.getElementById('migrationName').focus();
    };

    if (cancelButton) {
      cancelButton.onclick = () => {
        form.reset();
        restoreMigrationOptions();
        keepButton.focus();
      };
    }

    freshButton.onclick = () => {
      const title = document.getElementById('migrationTitle');
      const description = document.getElementById('migrationDescription');
      if (title) title.textContent = 'Start fresh?';
      if (description) description.textContent = `This will permanently delete your existing ${contactCount} contact${contactCount === 1 ? '' : 's'}. This cannot be undone.`;
      const confirmed = window.confirm(`This will permanently delete your existing ${contactCount} contact${contactCount === 1 ? '' : 's'}. This cannot be undone.`);
      if (!confirmed) {
        restoreMigrationOptions();
        freshButton.focus();
        return;
      }
      Storage.discardLegacyData();
      overlay.hidden = true;
      init();
    };

    form.onsubmit = (event) => {
      event.preventDefault();
      const values = validateMigrationForm(form);
      if (!values) return;
      try {
        const result = Auth.register(values.name, values.email, values.password);
        if (!result.ok) {
          if (formError) formError.textContent = result.error;
          document.getElementById('migrationEmail').focus();
          return;
        }
        const migrated = Storage.claimLegacyData(result.user.id);
        overlay.hidden = true;
        Utils.showToast(`${migrated.contactCount} existing contact${migrated.contactCount === 1 ? '' : 's'} have been moved to your account.`, 'success');
        init();
      } catch (error) {
        if (formError) formError.textContent = error.message || 'Existing data could not be moved. No legacy data was removed.';
      }
    };

    keepButton.focus();
  }

  function init() {
    const user = Auth.getCurrentUser();

    if (Storage.detectLegacyData()) {
      showMigrationPrompt();
      return;
    }

    initTheme();
    Router.init();
    if (user) {
      updateUserDisplay(user);
      ContactManager.init();
    }
    initAddContactButtons();
    initSearchAndFilters();
    initSettingsActions();
    initAuthForms();
    initLogout();
  }

  document.addEventListener('DOMContentLoaded', init);
})();
