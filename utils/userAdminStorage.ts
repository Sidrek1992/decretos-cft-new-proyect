import { UserRole } from '../types/roles';

export interface ManagedProfile {
  firstName: string;
  lastName: string;
}

export interface ManagedSecurity {
  blocked: boolean;
  forcePasswordChange: boolean;
  lastAccessAt: number | null;
}

const ROLES_STORAGE_KEY = 'gdp_user_roles';
const USER_PROFILES_STORAGE_KEY = 'gdp_user_profiles';
const USER_PASSWORDS_STORAGE_KEY = 'gdp_user_passwords';
const USER_SECURITY_STORAGE_KEY = 'gdp_user_security';
export const MANDATORY_ADMIN_EMAILS = [
  'mguzmanahumada@gmail.com',
  'a.gestiondepersonas@cftestatalaricayparinacota.cl'
] as const;

const mandatoryAdminSet = new Set<string>(MANDATORY_ADMIN_EMAILS);

const normalizeEmail = (email: string) => email.trim().toLowerCase();

export const isMandatoryAdminEmail = (email: string | undefined | null): boolean => {
  if (!email) return false;
  return mandatoryAdminSet.has(normalizeEmail(email));
};

const buildMandatoryAdminRoles = (): Record<string, UserRole> => {
  return MANDATORY_ADMIN_EMAILS.reduce<Record<string, UserRole>>((acc, email) => {
    acc[email] = 'admin';
    return acc;
  }, {});
};

const sanitizeSecurity = (email: string, sec: Partial<ManagedSecurity> | undefined): ManagedSecurity => {
  const normalized = normalizeEmail(email);
  const isProtected = isMandatoryAdminEmail(normalized);

  return {
    blocked: isProtected ? false : Boolean(sec?.blocked),
    forcePasswordChange: isProtected ? false : Boolean(sec?.forcePasswordChange),
    lastAccessAt: typeof sec?.lastAccessAt === 'number' ? sec.lastAccessAt : null,
  };
};

export const loadUserRoles = (): Record<string, UserRole> => {
  const mandatoryAdmins = buildMandatoryAdminRoles();

  try {
    const stored = localStorage.getItem(ROLES_STORAGE_KEY);
    if (stored) {
      const parsed = JSON.parse(stored) as Record<string, UserRole>;
      return {
        ...parsed,
        ...mandatoryAdmins
      };
    }
  } catch {
    // ignore
  }
  return mandatoryAdmins;
};

export const saveUserRoles = (roles: Record<string, UserRole>) => {
  const mandatoryAdmins = buildMandatoryAdminRoles();
  localStorage.setItem(ROLES_STORAGE_KEY, JSON.stringify({ ...roles, ...mandatoryAdmins }));
};

export const loadUserProfiles = (): Record<string, ManagedProfile> => {
  try {
    const raw = localStorage.getItem(USER_PROFILES_STORAGE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw) as Record<string, ManagedProfile>;
    return Object.entries(parsed).reduce<Record<string, ManagedProfile>>((acc, [email, p]) => {
      acc[normalizeEmail(email)] = {
        firstName: String(p?.firstName || '').trim(),
        lastName: String(p?.lastName || '').trim(),
      };
      return acc;
    }, {});
  } catch {
    return {};
  }
};

export const saveUserProfiles = (profiles: Record<string, ManagedProfile>) => {
  localStorage.setItem(USER_PROFILES_STORAGE_KEY, JSON.stringify(profiles));
};

export const loadUserPasswords = (): Record<string, string> => {
  try {
    const raw = localStorage.getItem(USER_PASSWORDS_STORAGE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw) as Record<string, string>;
    return Object.entries(parsed).reduce<Record<string, string>>((acc, [email, pwd]) => {
      acc[normalizeEmail(email)] = String(pwd || '');
      return acc;
    }, {});
  } catch {
    return {};
  }
};

export const saveUserPasswords = (passwords: Record<string, string>) => {
  localStorage.setItem(USER_PASSWORDS_STORAGE_KEY, JSON.stringify(passwords));
};

export const loadUserSecurity = (): Record<string, ManagedSecurity> => {
  try {
    const raw = localStorage.getItem(USER_SECURITY_STORAGE_KEY);
    if (!raw) {
      const mandatorySecurity = MANDATORY_ADMIN_EMAILS.reduce<Record<string, ManagedSecurity>>((acc, email) => {
        acc[email] = sanitizeSecurity(email, undefined);
        return acc;
      }, {});
      return mandatorySecurity;
    }

    const parsed = JSON.parse(raw) as Record<string, ManagedSecurity>;
    const normalized = Object.entries(parsed).reduce<Record<string, ManagedSecurity>>((acc, [email, sec]) => {
      const normalizedEmail = normalizeEmail(email);
      acc[normalizedEmail] = sanitizeSecurity(normalizedEmail, sec);
      return acc;
    }, {});

    MANDATORY_ADMIN_EMAILS.forEach((adminEmail) => {
      normalized[adminEmail] = sanitizeSecurity(adminEmail, normalized[adminEmail]);
    });

    return normalized;
  } catch {
    const mandatorySecurity = MANDATORY_ADMIN_EMAILS.reduce<Record<string, ManagedSecurity>>((acc, email) => {
      acc[email] = sanitizeSecurity(email, undefined);
      return acc;
    }, {});
    return mandatorySecurity;
  }
};

export const saveUserSecurity = (security: Record<string, ManagedSecurity>) => {
  const sanitized = Object.entries(security).reduce<Record<string, ManagedSecurity>>((acc, [email, sec]) => {
    const normalizedEmail = normalizeEmail(email);
    acc[normalizedEmail] = sanitizeSecurity(normalizedEmail, sec);
    return acc;
  }, {});

  MANDATORY_ADMIN_EMAILS.forEach((adminEmail) => {
    sanitized[adminEmail] = sanitizeSecurity(adminEmail, sanitized[adminEmail]);
  });

  localStorage.setItem(USER_SECURITY_STORAGE_KEY, JSON.stringify(sanitized));
};

export const getUserSecurityByEmail = (email: string): ManagedSecurity => {
  const normalized = normalizeEmail(email);
  const sec = loadUserSecurity()[normalized];

  if (isMandatoryAdminEmail(normalized)) {
    return {
      blocked: false,
      forcePasswordChange: false,
      lastAccessAt: sec?.lastAccessAt ?? null
    };
  }

  return sec || { blocked: false, forcePasswordChange: false, lastAccessAt: null };
};

export const touchUserLastAccess = (email: string) => {
  const normalized = normalizeEmail(email);
  const all = loadUserSecurity();
  const prev = all[normalized] || { blocked: false, forcePasswordChange: false, lastAccessAt: null };
  all[normalized] = { ...prev, lastAccessAt: Date.now() };
  saveUserSecurity(all);
};

export const updateUserSecurity = (email: string, partial: Partial<ManagedSecurity>) => {
  const normalized = normalizeEmail(email);
  const all = loadUserSecurity();
  const prev = all[normalized] || { blocked: false, forcePasswordChange: false, lastAccessAt: null };

  const next: ManagedSecurity = {
    ...prev,
    ...partial,
    blocked: isMandatoryAdminEmail(normalized) ? false : Boolean(partial.blocked ?? prev.blocked),
    forcePasswordChange: isMandatoryAdminEmail(normalized) ? false : Boolean(partial.forcePasswordChange ?? prev.forcePasswordChange),
    lastAccessAt: typeof (partial.lastAccessAt ?? prev.lastAccessAt) === 'number'
      ? (partial.lastAccessAt ?? prev.lastAccessAt) as number
      : null,
  };

  all[normalized] = next;
  saveUserSecurity(all);
};
