const Auth = (() => {
  // Supabase-backed Auth layer.
  // All methods that touch the network are async and return
  // { ok: true, user } | { ok: false, error: string }.
  //
  // isAuthenticated() is kept synchronous by maintaining a module-level
  // session variable that is updated by onAuthStateChange.  This means
  // Router.navigate() (which calls isAuthenticated()) does not need to
  // become async.

  // ---- module-level session cache ----
  let _session = null;

  // Seed the cache from whatever Supabase has stored locally, then keep
  // it in sync for the lifetime of the page.
  supabase.auth.getSession().then(({ data }) => {
    _session = data.session;
  });

  supabase.auth.onAuthStateChange((_event, session) => {
    _session = session;
  });

  // ---- helpers ----

  /** Map a Supabase user object to the slim shape the rest of the app uses. */
  function _toAppUser(supabaseUser) {
    return {
      id:    supabaseUser.id,
      name:  (supabaseUser.user_metadata && supabaseUser.user_metadata.name) || '',
      email: supabaseUser.email,
    };
  }

  // ---- public API ----

  /**
   * Register a new account.
   * Client-side validation is still run by the caller (app.js) before
   * this function is reached, so we only need to handle Supabase errors here.
   *
   * @param {string} name
   * @param {string} email
   * @param {string} password
   * @returns {Promise<{ ok: true, user: object } | { ok: false, error: string }>}
   */
  async function register(name, email, password) {
    const { data, error } = await supabase.auth.signUp({
      email: email.trim().toLowerCase(),
      password,
      options: { data: { name: name.trim() } },
    });

    if (error) {
      // Map Supabase error messages to the expected UI strings.
      const msg = error.message || '';
      if (/already registered/i.test(msg) || /already exists/i.test(msg)) {
        return { ok: false, error: 'An account with that email already exists.' };
      }
      return { ok: false, error: msg || 'Registration failed. Please try again.' };
    }

    if (!data.user) {
      // Supabase returns a user object even when email confirmation is
      // required.  If it is genuinely absent something unexpected happened.
      return { ok: false, error: 'Registration failed. Please try again.' };
    }

    // Insert default settings and categories rows for the new user.
    // Errors here are non-fatal — Storage methods fall back to defaults.
    await _initNewUser(data.user.id);

    return { ok: true, user: _toAppUser(data.user) };
  }

  /**
   * Insert the default settings row and default categories for a brand-new
   * user.  Called once, immediately after signUp succeeds.
   */
  async function _initNewUser(userId) {
    const defaultCategories = Storage.DEFAULT_CATEGORIES;

    // settings row — upsert so a duplicate call is harmless
    await supabase.from('settings').upsert(
      { user_id: userId, theme: 'light' },
      { onConflict: 'user_id' }
    );

    // categories — insert only if the user has no rows yet
    const { data: existing } = await supabase
      .from('categories')
      .select('id')
      .eq('user_id', userId)
      .limit(1);

    if (!existing || existing.length === 0) {
      await supabase.from('categories').insert(
        defaultCategories.map((name, i) => ({ user_id: userId, name, position: i }))
      );
    }
  }

  /**
   * Sign in with email + password.
   *
   * @param {string} email
   * @param {string} password
   * @returns {Promise<{ ok: true, user: object } | { ok: false, error: string }>}
   */
  async function login(email, password) {
    const { data, error } = await supabase.auth.signInWithPassword({
      email: email.trim().toLowerCase(),
      password,
    });

    if (error) {
      // Always return the same message regardless of whether the email or
      // password was wrong, to avoid leaking account existence.
      return { ok: false, error: 'Invalid email or password.' };
    }

    return { ok: true, user: _toAppUser(data.user) };
  }

  /**
   * Sign out the current user.
   *
   * @returns {Promise<void>}
   */
  async function logout() {
    await supabase.auth.signOut();
    // _session is cleared automatically by onAuthStateChange
  }

  /**
   * Return the currently authenticated app-user object, or null.
   * Prefers the module-level session cache to avoid an extra network round
   * trip, but falls back to supabase.auth.getUser() for freshness.
   *
   * @returns {Promise<object|null>}
   */
  async function getCurrentUser() {
    if (!_session) return null;
    const { data, error } = await supabase.auth.getUser();
    if (error || !data.user) return null;
    return _toAppUser(data.user);
  }

  /**
   * Synchronous check based on the cached session.
   * Safe to call from Router.navigate() without async/await.
   *
   * @returns {boolean}
   */
  function isAuthenticated() {
    return Boolean(_session);
  }

  return { register, login, logout, getCurrentUser, isAuthenticated, initNewUser: _initNewUser };
})();
