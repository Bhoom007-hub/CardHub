const Router = (() => {
  const PUBLIC_VIEWS = ['home', 'about', 'login', 'signup'];
  const PRIVATE_VIEWS = ['dashboard', 'contacts', 'categories', 'settings'];
  const AUTH_VIEWS = ['login', 'signup'];

  function getPrivateNav() {
    return document.getElementById('nav-private')
      || document.querySelector('[data-nav-id="nav-private"]')
      || document.getElementById('sidebar');
  }

  function renderNav() {
    const authenticated = Auth.isAuthenticated();
    const publicNav = document.getElementById('nav-public');
    const privateNav = getPrivateNav();
    const siteFooter = document.getElementById('site-footer');

    if (publicNav) publicNav.hidden = authenticated;
    if (privateNav) privateNav.hidden = !authenticated;
    if (siteFooter) siteFooter.hidden = authenticated;
  }

  function closeMobileNavigation() {
    const publicNav = document.getElementById('nav-public');
    const publicToggle = publicNav && publicNav.querySelector('.public-nav-toggle');
    const sidebar = document.getElementById('sidebar');
    const privateToggle = document.getElementById('mobileNavToggle');

    if (publicNav) publicNav.classList.remove('is-menu-open');
    if (publicToggle) publicToggle.setAttribute('aria-expanded', 'false');
    if (sidebar) sidebar.classList.remove('is-open');
    if (privateToggle) privateToggle.setAttribute('aria-expanded', 'false');
  }

  function updateActiveNavigation(viewName) {
    document.querySelectorAll('[data-view]').forEach((item) => {
      const isActive = item.dataset.view === viewName;
      item.classList.toggle('is-active', isActive);
      if (isActive) item.setAttribute('aria-current', 'page');
      else item.removeAttribute('aria-current');
    });
  }

  function showView(viewName) {
    document.querySelectorAll('.view').forEach((view) => {
      const isActive = view.id === `view-${viewName}`;
      view.classList.toggle('is-active', isActive);
      view.hidden = !isActive;
    });
  }

  function focusViewHeading(view) {
    const heading = view.querySelector('h1, [role="heading"]');
    if (!heading) return;
    if (!heading.hasAttribute('tabindex')) heading.setAttribute('tabindex', '-1');
    heading.focus({ preventScroll: true });
  }

  function navigate(viewName) {
    let targetView = viewName;

    if (!PUBLIC_VIEWS.includes(targetView) && !PRIVATE_VIEWS.includes(targetView)) {
      targetView = Auth.isAuthenticated() ? 'dashboard' : 'home';
    }

    if (PRIVATE_VIEWS.includes(targetView) && !Auth.isAuthenticated()) {
      targetView = 'login';
    } else if (AUTH_VIEWS.includes(targetView) && Auth.isAuthenticated()) {
      targetView = 'dashboard';
    }

    const target = document.getElementById(`view-${targetView}`);
    if (!target) return false;

    showView(targetView);
    updateActiveNavigation(targetView);
    renderNav();
    closeMobileNavigation();
    focusViewHeading(target);
    return true;
  }

  function init() {
    document.querySelectorAll('[data-view]').forEach((item) => {
      item.addEventListener('click', (event) => {
        event.preventDefault();
        navigate(item.dataset.view);
      });
    });

    const publicNav = document.getElementById('nav-public');
    const publicToggle = publicNav && publicNav.querySelector('.public-nav-toggle');
    if (publicNav && publicToggle) {
      publicToggle.addEventListener('click', () => {
        const isOpen = publicNav.classList.toggle('is-menu-open');
        publicToggle.setAttribute('aria-expanded', String(isOpen));
      });
    }

    renderNav();
    navigate(Auth.isAuthenticated() ? 'dashboard' : 'home');
  }

  return { PUBLIC_VIEWS, PRIVATE_VIEWS, navigate, renderNav, init };
})();
