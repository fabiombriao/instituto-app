const LEGACY_ROLE_ALIASES: Record<string, string> = {
  admin: 'SUPER_ADMIN',
  coach: 'TREINADOR',
};

const FINANCIAL_ROI_ROLES = new Set(['ALUNO', 'TREINADOR', 'SUPER_ADMIN']);

export function normalizeRole(role?: string | null) {
  const raw = String(role ?? '').trim();
  if (!raw) return '';
  return LEGACY_ROLE_ALIASES[raw.toLowerCase()] ?? raw.toUpperCase();
}

export function canViewFinancialROI(role?: string | null) {
  return FINANCIAL_ROI_ROLES.has(normalizeRole(role));
}

