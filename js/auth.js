const Auth = (() => {
  // SECURITY NOTE: Passwords are stored as plain text in LocalStorage.
  // This is a client-side prototype only. Before any production deployment
  // replace this module with calls to an authenticated backend API.

  const SESSION_KEY = 'chp_session';

  const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

  /**
   * Registers a new user account.
   * Validates name, email, and password; checks for duplicate email;
   * creates a User record in the User_Store; establishes a session.
   *
   * @param {string} name
   * @param {string} email
   * @param {string} password
   * @returns {{ ok: true, user: object } | { ok: false, error: string }}
   */
  function register(name, email, password) {
    // Validate name
    const nameError = Validation.validateUserName(name);
    if (nameError) return { ok: false, error: nameError };

    // Validate email
    const trimmedEmail = typeof email === 'string' ? email.trim() : '';
    if (!trimmedEmail) return { ok: false, error: 'Email is required.' };
    if (!EMAIL_PATTERN.test(trimmedEmail)) return { ok: false, error: 'Enter a valid email address.' };

    // Validate password
    const passwordError = Validation.validatePassword(password);
    if (passwordError) return { ok: false, error: passwordError };

    // Check email uniqueness
    const normalizedEmail = trimmedEmail.toLowerCase();
    const existing = Storage.getUserByEmail(normalizedEmail);
    if (existing) return { ok: false, error: 'An account with that email already exists.' };

    // Generate user ID
    const id = 'u_' + Date.now().toString(36) + '_' + Math.random().toString(36).slice(2, 9);

    // Build User record
    const newUser = {
      id,
      name: name.trim(),
      email: normalizedEmail,
      password,
      contacts: [],
      categories: ['Clients', 'Vendors', 'Partners', 'Employees', 'Personal'],
      settings: { theme: 'light', schemaVersion: 2 },
    };

    // Persist to User_Store
    Storage.saveUsers([...Storage.getUsers(), newUser]);

    // Write session
    localStorage.setItem(SESSION_KEY, JSON.stringify({ userId: newUser.id }));

    return { ok: true, user: newUser };
  }

  /**
   * Logs in a user by email and password.
   * Uses the same error message for "not found" and "wrong password" to
   * avoid leaking whether an email address is registered (Req 13 AC 1).
   *
   * @param {string} email
   * @param {string} password
   * @returns {{ ok: true, user: object } | { ok: false, error: string }}
   */
  function login(email, password) {
    const normalizedEmail = typeof email === 'string' ? email.trim().toLowerCase() : '';
    const user = Storage.getUserByEmail(normalizedEmail);

    // Return identical error for missing user AND wrong password (Req 13 AC 1)
    if (!user || user.password !== password) {
      return { ok: false, error: 'Invalid email or password.' };
    }

    // Establish session
    localStorage.setItem(SESSION_KEY, JSON.stringify({ userId: user.id }));

    return { ok: true, user };
  }

  /**
   * Removes the current session from LocalStorage (Req 11 AC 1).
   */
  function logout() {
    localStorage.removeItem(SESSION_KEY);
  }

  /**
   * Returns the currently authenticated User object, or null.
   * Clears the session if it is missing, malformed, or references a userId
   * that no longer exists in the User_Store (Req 13 AC 3, Req 5 AC 2).
   *
   * @returns {object|null}
   */
  function getCurrentUser() {
    let session;
    try {
      const raw = localStorage.getItem(SESSION_KEY);
      if (!raw) return null;
      session = JSON.parse(raw);
    } catch (_) {
      // Malformed JSON — clear and treat as unauthenticated
      localStorage.removeItem(SESSION_KEY);
      return null;
    }

    if (!session || typeof session.userId !== 'string') {
      localStorage.removeItem(SESSION_KEY);
      return null;
    }

    const user = Storage.getUserById(session.userId);
    if (!user) {
      // userId not found in the User_Store — clear stale session
      localStorage.removeItem(SESSION_KEY);
      return null;
    }

    return user;
  }

  /**
   * Returns true if a valid session exists, false otherwise.
   *
   * @returns {boolean}
   */
  function isAuthenticated() {
    return Boolean(getCurrentUser());
  }

  // Public API — only the five required methods are exposed (Req 17 AC 1)
  return { register, login, logout, getCurrentUser, isAuthenticated };
})();
