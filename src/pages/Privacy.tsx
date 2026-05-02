import React from 'react';
import { Loader2, Download, Trash2, ShieldCheck, FileText, Eye } from 'lucide-react';
import {
  useConsents,
  useExportUserData,
  useDeleteUserData,
  useROIAccessSummary,
} from '../hooks/useData';
import { useAuth } from '../context/AuthContext';
import type { ConsentType } from '../types';

const CONSENT_LABELS: Record<ConsentType, { title: string; description: string }> = {
  terms_of_use: {
    title: 'Termos de uso',
    description: 'Aceito os termos de uso do Instituto Caminhos do Êxito.',
  },
  privacy_policy: {
    title: 'Política de privacidade',
    description: 'Aceito a política de privacidade e o tratamento de dados pessoais.',
  },
  data_processing: {
    title: 'Tratamento de dados',
    description: 'Permito o uso dos meus dados para personalização do meu plano e relatórios.',
  },
  marketing: {
    title: 'Comunicações de marketing',
    description: 'Aceito receber novidades, conteúdos e ofertas do Instituto.',
  },
};

const CONSENT_ORDER: ConsentType[] = [
  'terms_of_use',
  'privacy_policy',
  'data_processing',
  'marketing',
];

export default function Privacy() {
  const { profile, signOut } = useAuth();
  const { consents, loading: consentsLoading, setConsent, isGranted } = useConsents();
  const { loading: exportLoading, downloadJson } = useExportUserData();
  const { loading: deleteLoading, deleteAccount } = useDeleteUserData();
  const { summary, loading: accessLoading } = useROIAccessSummary(30);

  const [statusMsg, setStatusMsg] = React.useState<string | null>(null);
  const [confirmingDelete, setConfirmingDelete] = React.useState(false);
  const [deleteConfirmText, setDeleteConfirmText] = React.useState('');

  const handleConsentToggle = async (type: ConsentType, value: boolean) => {
    setStatusMsg(null);
    const err = await setConsent(type, value);
    if (err) {
      setStatusMsg(`Erro ao registrar consentimento: ${(err as any).message ?? err}`);
    } else {
      setStatusMsg(value ? 'Consentimento registrado.' : 'Consentimento revogado.');
    }
  };

  const handleExport = async () => {
    setStatusMsg(null);
    const err = await downloadJson();
    if (err) {
      setStatusMsg(`Falha ao exportar: ${(err as any).message ?? err}`);
    } else {
      setStatusMsg('Arquivo de exportação baixado. Confira a pasta de downloads.');
    }
  };

  const handleDelete = async () => {
    setStatusMsg(null);
    if (deleteConfirmText.trim() !== 'APAGAR') {
      setStatusMsg('Digite APAGAR no campo para confirmar.');
      return;
    }
    const err = await deleteAccount();
    if (err) {
      setStatusMsg(`Falha ao apagar dados: ${(err as any).message ?? err}`);
      return;
    }
    setStatusMsg('Conta anonimizada. Você será desconectado em 5 segundos.');
    window.setTimeout(() => {
      void signOut();
    }, 5000);
  };

  return (
    <div className="space-y-10 pb-12 font-sans text-white">
      <header>
        <p className="text-[10px] font-black uppercase tracking-[0.4em] text-brand-green">
          M11 - LGPD e Privacidade
        </p>
        <h1 className="mt-3 text-5xl font-black italic uppercase leading-none tracking-tighter md:text-6xl">
          Seus dados
        </h1>
        <p className="mt-4 max-w-2xl text-sm text-neutral-500">
          Você tem direito a saber o que registramos, exportar tudo e pedir
          a remoção a qualquer momento. Esta página coloca tudo isso na sua mão.
        </p>
      </header>

      {statusMsg ? (
        <div className="rounded-2xl border border-brand-green/20 bg-brand-green/10 px-4 py-3 text-[10px] font-black uppercase tracking-[0.25em] text-brand-green">
          {statusMsg}
        </div>
      ) : null}

      <section className="rounded-[32px] border border-[#1a1a1a] bg-[#050505] p-6">
        <header className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-brand-green/10 text-brand-green">
            <ShieldCheck className="h-5 w-5" />
          </div>
          <div>
            <p className="text-[10px] font-black uppercase tracking-[0.3em] text-brand-green">
              Consentimentos
            </p>
            <h2 className="mt-1 text-xl font-black italic uppercase tracking-tighter">
              O que você autoriza
            </h2>
          </div>
        </header>

        <div className="mt-5 space-y-3">
          {CONSENT_ORDER.map((type) => {
            const label = CONSENT_LABELS[type];
            const granted = isGranted(type);
            const record = consents.find((c) => c.consent_type === type);
            return (
              <div
                key={type}
                className="flex flex-col gap-3 rounded-2xl border border-[#1a1a1a] bg-[#0a0a0a] p-4 md:flex-row md:items-center md:justify-between"
              >
                <div>
                  <p className="text-[11px] font-black uppercase tracking-[0.2em] text-white">
                    {label.title}
                  </p>
                  <p className="mt-1 text-xs text-neutral-500">{label.description}</p>
                  {record?.granted_at ? (
                    <p className="mt-1 text-[9px] uppercase tracking-[0.2em] text-neutral-600">
                      Atualizado em {new Date(record.granted_at).toLocaleString()}
                    </p>
                  ) : null}
                </div>
                <label className="flex items-center gap-3">
                  <span className="text-[10px] font-black uppercase tracking-[0.2em] text-neutral-500">
                    {granted ? 'Concedido' : 'Não concedido'}
                  </span>
                  <input
                    type="checkbox"
                    checked={granted}
                    disabled={consentsLoading}
                    onChange={(event) => void handleConsentToggle(type, event.target.checked)}
                    className="h-5 w-5 rounded border-[#1f1f1f] bg-[#050505] text-brand-green focus:ring-brand-green"
                  />
                </label>
              </div>
            );
          })}
        </div>
      </section>

      <section className="rounded-[32px] border border-[#1a1a1a] bg-[#050505] p-6">
        <header className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-brand-green/10 text-brand-green">
            <Eye className="h-5 w-5" />
          </div>
          <div>
            <p className="text-[10px] font-black uppercase tracking-[0.3em] text-brand-green">
              Acessos ao seu ROI
            </p>
            <h2 className="mt-1 text-xl font-black italic uppercase tracking-tighter">
              Quem viu suas métricas (últimos 30 dias)
            </h2>
          </div>
        </header>

        <div className="mt-5 grid grid-cols-1 gap-3 md:grid-cols-3">
          <SummaryTile
            label="Visualizações"
            value={accessLoading ? '…' : String(summary.total_accesses)}
          />
          <SummaryTile
            label="Pessoas distintas"
            value={accessLoading ? '…' : String(summary.unique_accessors)}
          />
          <SummaryTile
            label="Última visualização"
            value={
              accessLoading
                ? '…'
                : summary.last_accessed_at
                  ? new Date(summary.last_accessed_at).toLocaleString()
                  : 'Nenhuma'
            }
          />
        </div>
        <p className="mt-3 text-[10px] uppercase tracking-[0.2em] text-neutral-600">
          Conta apenas acessos feitos por outras pessoas (treinador, monitor, super admin).
        </p>
      </section>

      <section className="rounded-[32px] border border-[#1a1a1a] bg-[#050505] p-6">
        <header className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-brand-green/10 text-brand-green">
            <Download className="h-5 w-5" />
          </div>
          <div>
            <p className="text-[10px] font-black uppercase tracking-[0.3em] text-brand-green">
              Portabilidade
            </p>
            <h2 className="mt-1 text-xl font-black italic uppercase tracking-tighter">
              Exportar meus dados
            </h2>
          </div>
        </header>
        <p className="mt-3 max-w-2xl text-xs text-neutral-500">
          Baixa um arquivo JSON com seu perfil, ciclos, hábitos, ROI, conquistas,
          notas e mensagens. É a sua cópia portátil. Nenhuma informação é compartilhada
          com terceiros.
        </p>
        <button
          type="button"
          onClick={() => void handleExport()}
          disabled={exportLoading}
          className="mt-5 inline-flex items-center gap-2 rounded-2xl border border-brand-green/30 bg-brand-green/10 px-5 py-3 text-[10px] font-black uppercase tracking-[0.2em] text-brand-green disabled:opacity-50"
        >
          {exportLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <FileText className="h-4 w-4" />}
          Baixar JSON
        </button>
      </section>

      <section className="rounded-[32px] border border-rose-500/20 bg-rose-500/5 p-6">
        <header className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-rose-500/10 text-rose-400">
            <Trash2 className="h-5 w-5" />
          </div>
          <div>
            <p className="text-[10px] font-black uppercase tracking-[0.3em] text-rose-400">
              Direito ao esquecimento
            </p>
            <h2 className="mt-1 text-xl font-black italic uppercase tracking-tighter text-white">
              Apagar minha conta
            </h2>
          </div>
        </header>
        <p className="mt-3 max-w-2xl text-xs text-neutral-400">
          Esta ação anonimiza seu perfil, remove ROI, mensagens, notas e
          inscrições. Os registros agregados (turma, ciclos) ficam preservados
          sem sua identificação. Não é possível desfazer.
        </p>

        {!confirmingDelete ? (
          <button
            type="button"
            onClick={() => setConfirmingDelete(true)}
            className="mt-5 inline-flex items-center gap-2 rounded-2xl border border-rose-500/30 bg-rose-500/10 px-5 py-3 text-[10px] font-black uppercase tracking-[0.2em] text-rose-400 hover:bg-rose-500/20"
          >
            <Trash2 className="h-4 w-4" />
            Quero apagar minha conta
          </button>
        ) : (
          <div className="mt-5 space-y-3">
            <label className="block text-[10px] font-black uppercase tracking-[0.25em] text-rose-400">
              Digite APAGAR para confirmar
              <input
                type="text"
                value={deleteConfirmText}
                onChange={(event) => setDeleteConfirmText(event.target.value.toUpperCase())}
                className="mt-2 block w-full rounded-2xl border border-rose-500/30 bg-[#0a0a0a] px-4 py-3 text-sm font-bold uppercase tracking-[0.2em] text-rose-300 placeholder:text-neutral-700"
                placeholder="APAGAR"
                autoFocus
              />
            </label>
            <div className="flex gap-3">
              <button
                type="button"
                onClick={() => {
                  setConfirmingDelete(false);
                  setDeleteConfirmText('');
                }}
                className="rounded-2xl border border-[#1a1a1a] bg-[#0a0a0a] px-5 py-3 text-[10px] font-black uppercase tracking-[0.2em] text-neutral-400"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={() => void handleDelete()}
                disabled={deleteLoading || deleteConfirmText.trim() !== 'APAGAR'}
                className="inline-flex items-center gap-2 rounded-2xl border border-rose-500/40 bg-rose-500/20 px-5 py-3 text-[10px] font-black uppercase tracking-[0.2em] text-rose-300 hover:bg-rose-500/30 disabled:opacity-40"
              >
                {deleteLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
                Confirmar exclusão
              </button>
            </div>
          </div>
        )}
      </section>

      <p className="text-[10px] uppercase tracking-[0.3em] text-neutral-700">
        Identificação atual: {profile?.full_name} · {profile?.email}
      </p>
    </div>
  );
}

function SummaryTile({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-[#1a1a1a] bg-[#0a0a0a] p-4">
      <p className="text-[10px] font-black uppercase tracking-[0.25em] text-neutral-500">{label}</p>
      <p className="mt-2 text-xl font-black italic uppercase tracking-tighter text-white">{value}</p>
    </div>
  );
}
