import React from 'react';
import { Loader2, Filter, RefreshCw, ScrollText } from 'lucide-react';
import { useAuditLog } from '../hooks/useData';
import { useAuth } from '../context/AuthContext';
import { Navigate } from 'react-router-dom';

export default function AuditLog() {
  const { profile } = useAuth();
  const { entries, loading, filters, setFilters, refetch } = useAuditLog();
  const [draftFilters, setDraftFilters] = React.useState({
    action: filters.action ?? '',
    resourceType: filters.resourceType ?? '',
    actorUserId: filters.actorUserId ?? '',
    targetUserId: filters.targetUserId ?? '',
    from: filters.from ?? '',
    to: filters.to ?? '',
  });

  if (!profile) {
    return null;
  }
  if (profile.role !== 'SUPER_ADMIN') {
    return <Navigate to="/" replace />;
  }

  const applyFilters = () => {
    setFilters({
      ...filters,
      action: draftFilters.action.trim() || null,
      resourceType: draftFilters.resourceType.trim() || null,
      actorUserId: draftFilters.actorUserId.trim() || null,
      targetUserId: draftFilters.targetUserId.trim() || null,
      from: draftFilters.from || null,
      to: draftFilters.to || null,
    });
  };

  const clearFilters = () => {
    setDraftFilters({
      action: '',
      resourceType: '',
      actorUserId: '',
      targetUserId: '',
      from: '',
      to: '',
    });
    setFilters({
      ...filters,
      action: null,
      resourceType: null,
      actorUserId: null,
      targetUserId: null,
      from: null,
      to: null,
    });
  };

  return (
    <div className="space-y-10 pb-12 font-sans text-white">
      <header>
        <p className="text-[10px] font-black uppercase tracking-[0.4em] text-brand-green">
          M11 - Auditoria
        </p>
        <h1 className="mt-3 text-5xl font-black italic uppercase leading-none tracking-tighter md:text-6xl">
          Audit log
        </h1>
        <p className="mt-4 max-w-2xl text-sm text-neutral-500">
          Histórico de ações sensíveis: alterações de perfis, acessos a ROI,
          exportação e exclusão de dados, mudanças em coach notes, mensagens.
          Apenas SUPER_ADMIN pode visualizar.
        </p>
      </header>

      <section className="rounded-[32px] border border-[#1a1a1a] bg-[#050505] p-6">
        <div className="flex items-center gap-3">
          <Filter className="h-4 w-4 text-brand-green" />
          <h2 className="text-[10px] font-black uppercase tracking-[0.3em] text-brand-green">
            Filtros
          </h2>
        </div>
        <div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-3">
          <FilterInput
            label="Acao"
            placeholder="Ex: ROI_VIEW, profiles_UPDATE"
            value={draftFilters.action}
            onChange={(v) => setDraftFilters((d) => ({ ...d, action: v }))}
          />
          <FilterInput
            label="Recurso"
            placeholder="Ex: profile, roi, coach_notes"
            value={draftFilters.resourceType}
            onChange={(v) => setDraftFilters((d) => ({ ...d, resourceType: v }))}
          />
          <FilterInput
            label="Actor (user id)"
            placeholder="UUID do usuario que executou"
            value={draftFilters.actorUserId}
            onChange={(v) => setDraftFilters((d) => ({ ...d, actorUserId: v }))}
          />
          <FilterInput
            label="Target (user id)"
            placeholder="UUID do usuario alvo"
            value={draftFilters.targetUserId}
            onChange={(v) => setDraftFilters((d) => ({ ...d, targetUserId: v }))}
          />
          <FilterInput
            label="De"
            type="datetime-local"
            value={draftFilters.from}
            onChange={(v) => setDraftFilters((d) => ({ ...d, from: v }))}
          />
          <FilterInput
            label="Ate"
            type="datetime-local"
            value={draftFilters.to}
            onChange={(v) => setDraftFilters((d) => ({ ...d, to: v }))}
          />
        </div>
        <div className="mt-5 flex flex-wrap gap-3">
          <button
            type="button"
            onClick={applyFilters}
            className="inline-flex items-center gap-2 rounded-2xl border border-brand-green/30 bg-brand-green/10 px-5 py-3 text-[10px] font-black uppercase tracking-[0.2em] text-brand-green"
          >
            <Filter className="h-3 w-3" /> Aplicar
          </button>
          <button
            type="button"
            onClick={clearFilters}
            className="inline-flex items-center gap-2 rounded-2xl border border-[#1a1a1a] bg-[#0a0a0a] px-5 py-3 text-[10px] font-black uppercase tracking-[0.2em] text-neutral-400"
          >
            Limpar
          </button>
          <button
            type="button"
            onClick={() => void refetch()}
            className="inline-flex items-center gap-2 rounded-2xl border border-[#1a1a1a] bg-[#0a0a0a] px-5 py-3 text-[10px] font-black uppercase tracking-[0.2em] text-neutral-400"
          >
            <RefreshCw className="h-3 w-3" /> Recarregar
          </button>
        </div>
      </section>

      <section className="rounded-[32px] border border-[#1a1a1a] bg-[#050505] p-6">
        <header className="flex items-center gap-3">
          <ScrollText className="h-4 w-4 text-brand-green" />
          <h2 className="text-[10px] font-black uppercase tracking-[0.3em] text-brand-green">
            {entries.length} eventos
          </h2>
        </header>

        {loading ? (
          <div className="flex items-center gap-3 px-4 py-10 text-neutral-500">
            <Loader2 className="h-5 w-5 animate-spin text-brand-green" />
            <span className="text-[10px] font-black uppercase tracking-[0.25em]">
              Carregando audit log…
            </span>
          </div>
        ) : entries.length === 0 ? (
          <div className="px-4 py-10 text-center">
            <p className="text-[10px] font-black uppercase tracking-[0.25em] text-neutral-600">
              Nenhum evento encontrado para os filtros atuais.
            </p>
          </div>
        ) : (
          <div className="mt-4 overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead>
                <tr className="text-[9px] font-black uppercase tracking-[0.2em] text-neutral-500">
                  <th className="px-3 py-2 text-left">Quando</th>
                  <th className="px-3 py-2 text-left">Ação</th>
                  <th className="px-3 py-2 text-left">Recurso</th>
                  <th className="px-3 py-2 text-left">Actor</th>
                  <th className="px-3 py-2 text-left">Target</th>
                  <th className="px-3 py-2 text-left">Detalhes</th>
                </tr>
              </thead>
              <tbody>
                {entries.map((entry) => (
                  <tr key={entry.id} className="border-t border-[#1a1a1a] align-top">
                    <td className="px-3 py-3 text-xs text-neutral-400 whitespace-nowrap">
                      {new Date(entry.created_at).toLocaleString()}
                    </td>
                    <td className="px-3 py-3 text-[11px] font-black uppercase tracking-[0.15em] text-brand-green whitespace-nowrap">
                      {entry.action}
                    </td>
                    <td className="px-3 py-3 text-xs text-neutral-300 whitespace-nowrap">
                      {entry.resource_type}
                      {entry.resource_id ? (
                        <span className="ml-1 text-[9px] uppercase tracking-[0.2em] text-neutral-600">
                          ({entry.resource_id.slice(0, 8)})
                        </span>
                      ) : null}
                    </td>
                    <td className="px-3 py-3 text-xs text-neutral-400">
                      <div className="font-bold text-white">{entry.actor_name ?? '—'}</div>
                      <div className="text-[10px] text-neutral-600">{entry.actor_email ?? ''}</div>
                    </td>
                    <td className="px-3 py-3 text-xs text-neutral-400">
                      {entry.target_name ?? '—'}
                    </td>
                    <td className="px-3 py-3 text-[10px] text-neutral-500">
                      <DetailsCell details={entry.details} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}

function FilterInput({
  label,
  placeholder,
  value,
  onChange,
  type,
}: {
  label: string;
  placeholder?: string;
  value: string;
  onChange: (v: string) => void;
  type?: string;
}) {
  return (
    <label className="block">
      <span className="text-[9px] font-black uppercase tracking-[0.25em] text-neutral-500">
        {label}
      </span>
      <input
        type={type ?? 'text'}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        className="mt-1 w-full rounded-2xl border border-[#1a1a1a] bg-[#0a0a0a] px-3 py-2 text-xs text-white placeholder:text-neutral-700 focus:border-brand-green/40"
      />
    </label>
  );
}

function DetailsCell({ details }: { details: Record<string, unknown> | null }) {
  const [expanded, setExpanded] = React.useState(false);
  if (!details || Object.keys(details).length === 0) return <span>—</span>;
  const text = JSON.stringify(details, null, 2);
  if (text.length < 80 || expanded) {
    return (
      <pre
        className="max-h-48 overflow-auto whitespace-pre-wrap rounded bg-[#0a0a0a] p-2 text-[10px] text-neutral-400"
        onClick={() => setExpanded((v) => !v)}
      >
        {text}
      </pre>
    );
  }
  return (
    <button
      type="button"
      onClick={() => setExpanded(true)}
      className="text-left text-[10px] uppercase tracking-[0.2em] text-brand-green"
    >
      ver detalhes…
    </button>
  );
}
