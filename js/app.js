(() => {
  // ── theme ──────────────────────────────────────────────────────────────────

  function applyTheme(theme) {
    document.documentElement.setAttribute('data-theme', theme === 'dark' ? 'dark' : 'light');
    const toggle = document.getElementById('themeToggle');
    if (toggle) toggle.setAttribute('aria-pressed', theme === 'dark' ? 'true' : 'false');
  }

  function initTheme() {
    const toggle = document.getElementById('themeToggle');
    if (!toggle) return;
    toggle.addEventListener('click', async () => {
      const currentUser = await Auth.getCurrentUser();
      if (!currentUser) return;
      const current = await Storage.getSettingsForUser(currentUser.id);
      const next = current.theme === 'dark' ? 'light' : 'dark';
      await Storage.saveSettingsForUser(currentUser.id, { ...current, theme: next });
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
    const searchInput   = document.getElementById('searchInput');
    const filterCategory = document.getElementById('filterCategory');
    const sortBy        = document.getElementById('sortBy');
    const favBtn        = document.getElementById('btnFavFilter');
    const viewSwitch    = document.getElementById('viewSwitch');

    const debouncedSearch = Utils.debounce((value) => {
      ContactManager.setFilter({ query: value });
    }, 200);

    searchInput.addEventListener('input', (e) => debouncedSearch(e.target.value));
    filterCategory.addEventListener('change', (e) => ContactManager.setFilter({ category: e.target.value }));
    sortBy.addEventListener('change', (e) => ContactManager.setFilter({ sortBy: e.target.value }));

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
    // ── Export ──
    document.getElementById('btnExportJson').addEventListener('click', async () => {
      const user = await Auth.getCurrentUser();
      if (!user) return;
      try {
        const data = await Storage.exportForUser(user.id);
        const stamp = new Date().toISOString().slice(0, 10);
        Utils.downloadFile(`cardhub-export-${stamp}.json`, JSON.stringify(data, null, 2));
        Utils.showToast('Contacts exported.', 'success');
      } catch (err) {
        console.error(err);
        Utils.showToast('Export failed.', 'error');
      }
    });

    // ── Import ──
    document.getElementById('importFileInput').addEventListener('change', async (e) => {
      const file = e.target.files[0];
      if (!file) return;
      try {
        const text = await Utils.readFileAsText(file);
        const data = JSON.parse(text);
        const user = await Auth.getCurrentUser();
        if (!user) return;
        const preview = await Storage.inspectImportForUser(user.id, data);
        const proceed = window.confirm(
          `Import preview: ${preview.totalRecords} total, ${preview.newContacts.length} new, ` +
          `${preview.duplicateRecords} duplicate, ${preview.invalidRecords} invalid. ` +
          `Import only the new valid contacts?`
        );
        if (!proceed) return;
        await Storage.importAllForUser(user.id, data);
        await ContactManager.refreshFromStorage();
        Utils.showToast(
          `${preview.newContacts.length} contact${preview.newContacts.length === 1 ? '' : 's'} imported.`,
          'success'
        );
      } catch (err) {
        console.error(err);
        Utils.showToast('That file could not be imported.', 'error');
      } finally {
        e.target.value = '';
      }
    });

    // ── Reset ──
    document.getElementById('btnResetData').addEventListener('click', async () => {
      const user = await Auth.getCurrentUser();
      if (!user) return;

      const exportFirst = window.confirm('Download a backup before resetting?');
      if (exportFirst) {
        try {
          const data = await Storage.exportForUser(user.id);
          const stamp = new Date().toISOString().slice(0, 10);
          Utils.downloadFile(`cardhub-backup-${stamp}.json`, JSON.stringify(data, null, 2));
        } catch (_) { /* non-fatal */ }
      }

      const confirmed = window.confirm('Reset all data? This deletes every contact, category, and setting.');
      if (!confirmed) return;

      try {
        await Storage.resetUser(user.id);
        await ContactManager.refreshFromStorage();
        const settings = await Storage.getSettingsForUser(user.id);
        applyTheme(settings.theme);
        Utils.showToast('All data has been reset.', 'success');
      } catch (err) {
        console.error(err);
        Utils.showToast('Reset failed.', 'error');
      }
    });
  }

  // ── form helpers ───────────────────────────────────────────────────────────

  function clearFormErrors(form) {
    form.querySelectorAll('.form-error').forEach((el) => { el.textContent = ''; });
    form.querySelectorAll('[aria-invalid="true"]').forEach((el) => el.removeAttribute('aria-invalid'));
  }

  function showFieldError(form, field, errorId, message) {
    field.setAttribute('aria-invalid', 'true');
    const errEl = document.getElementById(errorId);
    if (errEl) errEl.textContent = message;
    field.focus();
  }

  // ── auth forms ─────────────────────────────────────────────────────────────

  function initAuthForms() {
    const signupForm  = document.getElementById('signupForm');
    const loginForm   = document.getElementById('loginForm');
    const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

    // ── Sign Up ──
    signupForm.addEventListener('submit', async (event) => {
      event.preventDefault();
      clearFormErrors(signupForm);

      const name            = document.getElementById('signupName');
      const email           = document.getElementById('signupEmail');
      const password        = document.getElementById('signupPassword');
      const confirmPassword = document.getElementById('signupConfirmPassword');
      const values = {
        name:            name.value.trim(),
        email:           email.value.trim(),
        password:        password.value,
        confirmPassword: confirmPassword.value,
      };

      const validation = [
        [name,            'signupNameError',            Validation.validateUserName(values.name)],
        [email,           'signupEmailError',           !values.email ? 'Email is required.' : (!emailPattern.test(values.email) ? 'Enter a valid email address.' : null)],
        [password,        'signupPasswordError',        Validation.validatePassword(values.password)],
        [confirmPassword, 'signupConfirmPasswordError', values.password !== values.confirmPassword ? 'Passwords do not match.' : null],
      ];
      const firstError = validation.find(([,, msg]) => msg);
      if (firstError) { showFieldError(signupForm, firstError[0], firstError[1], firstError[2]); return; }

      // Disable the submit button while the request is in flight.
      const submitBtn = signupForm.querySelector('[type="submit"]');
      if (submitBtn) submitBtn.disabled = true;

      try {
        const result = await Auth.register(values.name, values.email, values.password);
        if (!result.ok) {
          const formError = document.getElementById('signupFormError');
          if (formError) formError.textContent = result.error;
          email.focus();
          return;
        }
        // onAuthStateChange will fire SIGNED_IN and drive the rest of startup.
        Utils.showToast('Account created. Welcome!', 'success');
      } finally {
        if (submitBtn) submitBtn.disabled = false;
      }
    });

    // ── Log In ──
    loginForm.addEventListener('submit', async (event) => {
      event.preventDefault();
      clearFormErrors(loginForm);

      const email    = document.getElementById('loginEmail');
      const password = document.getElementById('loginPassword');
      const emailValue = email.value.trim();

      const validation = [
        [email,    'loginEmailError',    !emailValue ? 'Email is required.' : (!emailPattern.test(emailValue) ? 'Enter a valid email address.' : null)],
        [password, 'loginPasswordError', !password.value ? 'Password is required.' : null],
      ];
      const firstError = validation.find(([,, msg]) => msg);
      if (firstError) { showFieldError(loginForm, firstError[0], firstError[1], firstError[2]); return; }

      const submitBtn = loginForm.querySelector('[type="submit"]');
      if (submitBtn) submitBtn.disabled = true;

      try {
        const result = await Auth.login(emailValue, password.value);
        if (!result.ok) {
          const formError = document.getElementById('loginFormError');
          if (formError) formError.textContent = 'Invalid email or password.';
          email.focus();
        }
        // On success onAuthStateChange fires SIGNED_IN → _onSignedIn() runs.
      } finally {
        if (submitBtn) submitBtn.disabled = false;
      }
    });
  }

  function updateUserDisplay(user) {
    const nameEl   = document.getElementById('sidebarUserName');
    const welcomeEl = document.getElementById('dashWelcome');
    if (nameEl)    nameEl.textContent    = user ? user.name : '';
    if (welcomeEl) welcomeEl.textContent = user ? `Welcome back, ${user.name}.` : 'Dashboard';
  }

  function initLogout() {
    const logoutButton = document.getElementById('btn-logout');
    if (!logoutButton) return;
    logoutButton.addEventListener('click', async () => {
      await Auth.logout();
      // onAuthStateChange fires SIGNED_OUT → _onSignedOut() handles cleanup.
    });
  }

  // ── auth state reactions ───────────────────────────────────────────────────

  async function _onSignedIn() {
    const user = await Auth.getCurrentUser();
    if (!user) return;

    // Ensure default settings and categories rows exist before loading data.
    // Uses idempotent upserts so it is safe to call on every sign-in.
    await Auth.initNewUser(user.id);

    // Apply the user's saved theme before anything renders.
    try {
      const settings = await Storage.getSettingsForUser(user.id);
      applyTheme(settings.theme);
    } catch (_) {
      applyTheme('light');
    }

    updateUserDisplay(user);
    await ContactManager.init();
    Router.navigate('dashboard');
  }

  async function _onSignedOut() {
    updateUserDisplay(null);
    applyTheme('light');
    // ContactManager clears itself when loadData() finds no user.
    await ContactManager.refreshFromStorage();
    Router.navigate('home');
    Router.renderNav();
  }

  // ── legacy LocalStorage migration ──────────────────────────────────────────
  // Kept for users who still have data in the old chp_users / bco_* keys.

  let migrationFocusTrapAttached = false;

  function migrationFocusableElements() {
    const overlay = document.getElementById('migrationOverlay');
    if (!overlay) return [];
    return [...overlay.querySelectorAll('button, input, [href], select, textarea, [tabindex]:not([tabindex="-1"])')]
      .filter((el) => !el.disabled && !el.hidden && !el.closest('[hidden]'));
  }

  function restoreMigrationOptions() {
    const title       = document.getElementById('migrationTitle');
    const description = document.getElementById('migrationDescription');
    const options     = document.getElementById('migrationOptions');
    const form        = document.getElementById('migrationSignupForm');
    const count       = document.getElementById('migrationContactCount');
    if (title)       title.textContent = 'We found existing CardHub data.';
    if (description) description.innerHTML =
      `We found <strong id="migrationContactCount">${count ? count.textContent : '0'}</strong> existing contacts. Create an account to keep them, or start fresh.`;
    if (options) options.hidden = false;
    if (form)    form.hidden    = true;
  }

  function clearMigrationErrors(form) {
    form.querySelectorAll('.form-error').forEach((el) => { el.textContent = ''; });
    form.querySelectorAll('[aria-invalid="true"]').forEach((el) => el.removeAttribute('aria-invalid'));
  }

  function validateMigrationForm(form) {
    clearMigrationErrors(form);
    const name            = document.getElementById('migrationName');
    const email           = document.getElementById('migrationEmail');
    const password        = document.getElementById('migrationPassword');
    const confirmPassword = document.getElementById('migrationConfirmPassword');
    const emailValue      = email.value.trim();
    const emailPattern    = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    const validation = [
      [name,            'migrationNameError',            Validation.validateUserName(name.value.trim())],
      [email,           'migrationEmailError',           !emailValue ? 'Email is required.' : (!emailPattern.test(emailValue) ? 'Enter a valid email address.' : null)],
      [password,        'migrationPasswordError',        Validation.validatePassword(password.value)],
      [confirmPassword, 'migrationConfirmPasswordError', password.value !== confirmPassword.value ? 'Passwords do not match.' : null],
    ];
    const firstError = validation.find(([,, msg]) => msg);
    if (!firstError) return { name: name.value.trim(), email: emailValue, password: password.value };
    firstError[0].setAttribute('aria-invalid', 'true');
    const errEl = document.getElementById(firstError[1]);
    if (errEl) errEl.textContent = firstError[2];
    firstError[0].focus();
    return null;
  }

  function showMigrationPrompt() {
    const overlay      = document.getElementById('migrationOverlay');
    const countElement = document.getElementById('migrationContactCount');
    const options      = document.getElementById('migrationOptions');
    const keepButton   = document.getElementById('btnMigrationKeep');
    const freshButton  = document.getElementById('btnMigrationFresh');
    const cancelButton = document.getElementById('btnMigrationCancel');
    const form         = document.getElementById('migrationSignupForm');
    const formError    = document.getElementById('migrationFormError');
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
        const last  = focusable[focusable.length - 1];
        if (event.shiftKey && document.activeElement === first) {
          event.preventDefault(); last.focus();
        } else if (!event.shiftKey && document.activeElement === last) {
          event.preventDefault(); first.focus();
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
      const confirmed = window.confirm(
        `This will permanently delete your existing ${contactCount} contact${contactCount === 1 ? '' : 's'}. This cannot be undone.`
      );
      if (!confirmed) { freshButton.focus(); return; }
      Storage.discardLegacyData();
      overlay.hidden = true;
      // Continue as unauthenticated — Router already shows home.
    };

    form.onsubmit = async (event) => {
      event.preventDefault();
      const values = validateMigrationForm(form);
      if (!values) return;
      try {
        const result = await Auth.register(values.name, values.email, values.password);
        if (!result.ok) {
          if (formError) formError.textContent = result.error;
          document.getElementById('migrationEmail').focus();
          return;
        }
        // The user is now signed in.  Migrate their old LocalStorage contacts
        // to Supabase, then clear the old keys.
        const legacyContacts    = Storage.getLegacyContacts();
        const legacyCategories  = Storage.getLegacyCategories();
        const userId            = result.user.id;

        if (legacyContacts.length) {
          const existing = await Storage.getContactsForUser(userId);
          const merged   = [...existing, ...legacyContacts.filter(
            (lc) => !Validation.findDuplicate(lc, existing)
          )];
          await Storage.saveContactsForUser(userId, merged);
        }

        if (legacyCategories.length) {
          const existingCats = await Storage.getCategoriesForUser(userId);
          const mergedCats   = Storage.normalizeCategories([...existingCats, ...legacyCategories]);
          await Storage.saveCategoriesForUser(userId, mergedCats);
        }

        Storage.clearLegacyData();
        overlay.hidden = true;

        Utils.showToast(
          `${legacyContacts.length} existing contact${legacyContacts.length === 1 ? '' : 's'} moved to your account.`,
          'success'
        );
        // onAuthStateChange already fired SIGNED_IN → _onSignedIn() ran.
        // Refresh so the newly migrated contacts appear.
        await ContactManager.refreshFromStorage();
      } catch (error) {
        if (formError) formError.textContent =
          error.message || 'Existing data could not be moved. No legacy data was removed.';
      }
    };

    keepButton.focus();
  }

  // ── bootstrap ──────────────────────────────────────────────────────────────

  function init() {
    // Wire up all UI listeners that don't depend on auth state.
    initTheme();
    Router.init();
    initAddContactButtons();
    initSearchAndFilters();
    initSettingsActions();
    initAuthForms();
    initLogout();

    // The auth state listener is the single driver of the authenticated
    // vs unauthenticated startup path.  It fires synchronously with
    // INITIAL_SESSION on the first call after page load, so there is no
    // flash of the wrong view.
    supabase.auth.onAuthStateChange(async (event, session) => {
      if (event === 'SIGNED_IN' || event === 'INITIAL_SESSION') {
        if (session) {
          // Authenticated — check for old LocalStorage data first.
          if (Storage.detectLegacyData() || Storage.detectLocalStorageUsers()) {
            showMigrationPrompt();
            // Still continue with normal sign-in so the app is usable.
          }
          await _onSignedIn();
        } else {
          // No session on initial load.
          if (Storage.detectLegacyData() || Storage.detectLocalStorageUsers()) {
            showMigrationPrompt();
          }
          Router.navigate('home');
          Router.renderNav();
        }
      } else if (event === 'SIGNED_OUT') {
        await _onSignedOut();
      }
      // TOKEN_REFRESHED, USER_UPDATED etc. require no UI action.
    });
  }

  document.addEventListener('DOMContentLoaded', init);
})();
