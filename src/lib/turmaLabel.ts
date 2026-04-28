const GENERIC_TURMA_NAME_PATTERNS = [
  /^Turma\s+[a-f0-9]{8}$/i,
  /^Turma(?:\s+\d+)?$/i,
];

function isGenericTurmaName(name: string) {
  const trimmed = name.trim();
  return GENERIC_TURMA_NAME_PATTERNS.some((pattern) => pattern.test(trimmed));
}

function extractTurmaNumber(name: string) {
  const match = name.trim().match(/^Turma\s+(\d+)$/i);
  return match ? Number(match[1]) : null;
}

export function formatTurmaInviteLabel(
  turmaName: string,
  options?: {
    programName?: string | null;
    turmaNumber?: number | null;
    mode?: 'preserve' | 'standard';
  }
) {
  const mode = options?.mode ?? 'preserve';
  const trimmedName = turmaName.trim();
  if (mode === 'preserve' && trimmedName && !isGenericTurmaName(trimmedName)) {
    return trimmedName;
  }

  const programLabel = options?.programName?.trim() || 'Treinamento';
  const parsedNumber = extractTurmaNumber(trimmedName);
  const turmaNumber =
    parsedNumber && parsedNumber > 0
      ? parsedNumber
      : options?.turmaNumber && options.turmaNumber > 0
        ? options.turmaNumber
        : 1;
  return `Turma ${turmaNumber} - ${programLabel}`;
}
