const Validation = (() => {
  const LIMITS = {
    fullName: 120,
    company: 120,
    jobTitle: 120,
    email: 254,
    phone: 40,
    website: 2048,
    address: 300,
    notes: 2000,
    category: 60,
    photoBytes: 1024 * 1024,
  };

  const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  const PHONE_PATTERN = /^[0-9+().\-\s]{6,40}$/;
  const IMAGE_TYPES = new Set(['image/jpeg', 'image/png', 'image/gif', 'image/webp']);

  function cleanText(value) {
    return typeof value === 'string' ? value.trim() : '';
  }

  function isValidDate(value) {
    return typeof value === 'string' && value !== '' && !Number.isNaN(new Date(value).getTime());
  }

  function normalizeWebsite(value) {
    const website = cleanText(value);
    if (!website) return '';
    const candidate = /^https?:\/\//i.test(website) ? website : `https://${website}`;
    try {
      const url = new URL(candidate);
      return /^https?:$/.test(url.protocol) && url.hostname ? url.href : '';
    } catch (_) {
      return '';
    }
  }

  function validateContact(contact) {
    const errors = {};
    const addLengthError = (field, label) => {
      if (cleanText(contact[field]).length > LIMITS[field]) errors[field] = `${label} must be ${LIMITS[field]} characters or fewer.`;
    };

    if (!cleanText(contact.fullName)) errors.fullName = 'Full name is required.';
    addLengthError('fullName', 'Full name');
    addLengthError('company', 'Company');
    addLengthError('jobTitle', 'Job title');
    addLengthError('address', 'Address');
    addLengthError('notes', 'Notes');
    if (cleanText(contact.email) && !EMAIL_PATTERN.test(cleanText(contact.email))) errors.email = 'Enter a valid email address.';
    if (cleanText(contact.email).length > LIMITS.email) errors.email = `Email must be ${LIMITS.email} characters or fewer.`;
    if (cleanText(contact.phone) && !PHONE_PATTERN.test(cleanText(contact.phone))) errors.phone = 'Enter a valid phone number.';
    if (cleanText(contact.website) && !normalizeWebsite(contact.website)) errors.website = 'Enter a valid http(s) website address.';
    if (contact.nextFollowUpAt && !isValidDate(contact.nextFollowUpAt)) errors.nextFollowUpAt = 'Enter a valid follow-up date.';
    return errors;
  }

  function findDuplicate(contact, contacts, excludedId = null) {
    const email = cleanText(contact.email).toLowerCase();
    const name = cleanText(contact.fullName).toLowerCase();
    const company = cleanText(contact.company).toLowerCase();
    return contacts.find((candidate) => {
      if (!candidate || candidate.id === excludedId) return false;
      const candidateEmail = cleanText(candidate.email).toLowerCase();
      return (email && candidateEmail === email) || (name && company && name === cleanText(candidate.fullName).toLowerCase() && company === cleanText(candidate.company).toLowerCase());
    }) || null;
  }

  function validateImage(file) {
    if (!file) return '';
    if (!IMAGE_TYPES.has(file.type)) return 'Use a PNG, JPEG, GIF, or WebP image.';
    if (file.size > LIMITS.photoBytes) return 'Image must be 1 MB or smaller.';
    return '';
  }

  function isSafeImageDataUrl(value) {
    return typeof value === 'string' && /^data:image\/(?:png|jpeg|gif|webp);base64,[a-z0-9+/=\s]+$/i.test(value);
  }

  function validateUserName(name) {
    const trimmed = cleanText(name);
    if (!trimmed) return 'Name is required.';
    if (trimmed.length > 100) return 'Name must be 100 characters or fewer.';
    return null;
  }

  function validatePassword(password) {
    const value = typeof password === 'string' ? password : '';
    if (value.length < 8) return 'Password must be at least 8 characters.';
    if (!/[a-zA-Z]/.test(value) || !/[0-9]/.test(value)) return 'Password must contain at least one letter and one digit.';
    return null;
  }

  function sanitizeContact(input, existing = {}) {
    const now = new Date().toISOString();
    const contact = {
      id: typeof input.id === 'string' && /^[A-Za-z0-9_-]{1,80}$/.test(input.id) ? input.id : Utils.generateId(),
      fullName: cleanText(input.fullName),
      company: cleanText(input.company),
      jobTitle: cleanText(input.jobTitle),
      email: cleanText(input.email),
      phone: cleanText(input.phone),
      website: normalizeWebsite(input.website),
      address: cleanText(input.address),
      category: cleanText(input.category),
      notes: cleanText(input.notes),
      photo: isSafeImageDataUrl(input.photo) ? input.photo : null,
      favorite: Boolean(input.favorite),
      priority: ['low', 'medium', 'high'].includes(input.priority) ? input.priority : 'medium',
      status: ['active', 'follow-up', 'inactive'].includes(input.status) ? input.status : 'active',
      lastContactedAt: isValidDate(input.lastContactedAt) && input.lastContactedAt ? input.lastContactedAt : null,
      nextFollowUpAt: isValidDate(input.nextFollowUpAt) && input.nextFollowUpAt ? input.nextFollowUpAt : null,
      createdAt: isValidDate(existing.createdAt) ? existing.createdAt : (isValidDate(input.createdAt) ? input.createdAt : now),
      updatedAt: isValidDate(existing.updatedAt) ? now : (isValidDate(input.updatedAt) ? input.updatedAt : now),
    };
    return contact;
  }

  return { LIMITS, validateContact, findDuplicate, validateImage, isSafeImageDataUrl, sanitizeContact, normalizeWebsite, validateUserName, validatePassword };
})();
