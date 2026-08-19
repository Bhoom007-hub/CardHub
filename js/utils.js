const Utils = (() => {

  function generateId() {
    return 'c_' + Date.now().toString(36) + '_' + Math.random().toString(36).slice(2, 9);
  }

  function debounce(fn, delay = 250) {
    let timer = null;
    return function debounced(...args) {
      clearTimeout(timer);
      timer = setTimeout(() => fn.apply(this, args), delay);
    };
  }

  function escapeHtml(str) {
    if (str === undefined || str === null) return '';
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

  function initials(name) {
    if (!name) return '?';
    const parts = name.trim().split(/\s+/).filter(Boolean);
    if (parts.length === 0) return '?';
    if (parts.length === 1) return parts[0][0].toUpperCase();
    return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  }

  function formatDate(iso) {
    if (!iso) return '—';
    const d = new Date(iso);
    if (isNaN(d.getTime())) return '—';
    return d.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });
  }

  function normalizeUrl(url) {
    if (!url) return '';
    if (/^https?:\/\//i.test(url)) return url;
    return `https://${url}`;
  }

  function showToast(message, type = 'default') {
    const stack = document.getElementById('toastStack');
    if (!stack) return;

    const iconMap = {
      success: '<svg class="toast-icon" aria-hidden="true"><use href="#icon-check"/></svg>',
      error:   '<svg class="toast-icon" aria-hidden="true"><use href="#icon-alert"/></svg>',
      default: '',
    };

    const toast = document.createElement('div');
    toast.className = `toast${type === 'error' ? ' toast-error' : ''}${type === 'success' ? ' toast-success' : ''}`;
    toast.innerHTML = (iconMap[type] || '') + escapeHtml(message);
    stack.appendChild(toast);

    setTimeout(() => {
      toast.style.transition = 'opacity 0.28s ease, transform 0.28s ease';
      toast.style.opacity = '0';
      toast.style.transform = 'translateX(12px)';
      setTimeout(() => toast.remove(), 290);
    }, 2800);
  }

  async function copyToClipboard(text) {
    if (!text) {
      showToast('Nothing to copy.', 'error');
      return false;
    }
    try {
      await navigator.clipboard.writeText(text);
      return true;
    } catch (e) {
      // Fallback for older/insecure contexts
      try {
        const ta = document.createElement('textarea');
        ta.value = text;
        ta.style.position = 'fixed';
        ta.style.opacity = '0';
        document.body.appendChild(ta);
        ta.select();
        document.execCommand('copy');
        document.body.removeChild(ta);
        return true;
      } catch (err) {
        return false;
      }
    }
  }

  function downloadFile(filename, content, mime = 'application/json') {
    const blob = new Blob([content], { type: mime });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  function readFileAsText(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result);
      reader.onerror = () => reject(reader.error);
      reader.readAsText(file);
    });
  }

  function readFileAsDataUrl(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result);
      reader.onerror = () => reject(reader.error);
      reader.readAsDataURL(file);
    });
  }

  function vCardFor(contact) {
    const escapeVCard = (value) => String(value || '').replace(/\\/g, '\\\\').replace(/;/g, '\\;').replace(/,/g, '\\,').replace(/\r?\n/g, '\\n');
    const lines = [
      'BEGIN:VCARD',
      'VERSION:3.0',
      `FN:${escapeVCard(contact.fullName)}`,
      contact.company ? `ORG:${escapeVCard(contact.company)}` : '',
      contact.jobTitle ? `TITLE:${escapeVCard(contact.jobTitle)}` : '',
      contact.email ? `EMAIL:${escapeVCard(contact.email)}` : '',
      contact.phone ? `TEL:${escapeVCard(contact.phone)}` : '',
      contact.website ? `URL:${normalizeUrl(contact.website)}` : '',
      contact.address ? `ADR:;;${escapeVCard(contact.address)};;;;` : '',
      contact.notes ? `NOTE:${escapeVCard(contact.notes)}` : '',
      'END:VCARD',
    ].filter(Boolean);
    return lines.join('\n');
  }

  return {
    generateId,
    debounce,
    escapeHtml,
    initials,
    formatDate,
    normalizeUrl,
    showToast,
    copyToClipboard,
    downloadFile,
    readFileAsText,
    readFileAsDataUrl,
    vCardFor,
  };
})();
