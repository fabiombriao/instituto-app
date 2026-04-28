import React, { useEffect, useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import {
  AlertCircle,
  Calendar,
  Check,
  Edit2,
  Eye,
  EyeOff,
  Filter,
  Loader2,
  MessageSquare,
  Plus,
  Save,
  Tag,
  Trash2,
  X,
} from 'lucide-react';
import { format, formatDistanceToNowStrict } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { cn } from '../lib/utils';
import { supabase } from '../lib/supabase';
import { COACH_NOTE_TAGS, type CoachNote, type CoachNoteTag, type Profile } from '../types';

interface CoachNotesPanelProps {
  aluno: Profile;
  treinador?: Profile | null;
  onClose: () => void;
}

export default function CoachNotesPanel({ aluno, treinador, onClose }: CoachNotesPanelProps) {
  const [notes, setNotes] = useState<CoachNote[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [newNoteContent, setNewNoteContent] = useState('');
  const [newNoteTags, setNewNoteTags] = useState<CoachNoteTag[]>([]);
  const [editingNote, setEditingNote] = useState<string | null>(null);
  const [editContent, setEditContent] = useState('');
  const [editTags, setEditTags] = useState<CoachNoteTag[]>([]);
  const [filterTag, setFilterTag] = useState<CoachNoteTag | 'all'>('all');
  const [showUnreadOnly, setShowUnreadOnly] = useState(false);
  const [saving, setSaving] = useState(false);
  const [deletingNoteId, setDeletingNoteId] = useState<string | null>(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState<string | null>(null);

  useEffect(() => {
    fetchNotes();
  }, [aluno.id]);

  const fetchNotes = async () => {
    setLoading(true);
    setError(null);

    const { data, error: fetchError } = await supabase
      .from('coach_notes')
      .select(`
        *,
        profiles!coach_notes_treinador_id_fkey (full_name)
      `)
      .eq('aluno_id', aluno.id)
      .order('created_at', { ascending: false });

    if (fetchError) {
      setError('Não foi possível carregar as notas privadas deste perfil.');
      setNotes([]);
    } else {
      const notesWithNames = (data || []).map((note: any) => ({
        ...note,
        treinador_name: note.profiles?.full_name || 'Desconhecido',
      }));
      setNotes(notesWithNames);
    }

    setLoading(false);
  };

  const handleAddNote = async () => {
    if (!newNoteContent.trim() || saving) return;

    setSaving(true);
    setError(null);

    const { error: insertError } = await supabase.from('coach_notes').insert({
      treinador_id: treinador?.id,
      aluno_id: aluno.id,
      content: newNoteContent.trim(),
      tags: newNoteTags,
    });

    if (insertError) {
      setError('Não foi possível salvar a nota.');
    } else {
      setNewNoteContent('');
      setNewNoteTags([]);
      await fetchNotes();
    }

    setSaving(false);
  };

  const handleEditNote = async (noteId: string) => {
    if (!editContent.trim() || saving) return;

    setSaving(true);
    setError(null);

    const { error: updateError } = await supabase
      .from('coach_notes')
      .update({
        content: editContent.trim(),
        tags: editTags,
      })
      .eq('id', noteId);

    if (updateError) {
      setError('Não foi possível atualizar a nota.');
    } else {
      setEditingNote(null);
      await fetchNotes();
    }

    setSaving(false);
  };

  const handleDeleteNote = async (noteId: string) => {
    if (deletingNoteId) return;

    setDeletingNoteId(noteId);
    setError(null);

    const { error: deleteError } = await supabase.from('coach_notes').delete().eq('id', noteId);

    if (deleteError) {
      setError('Não foi possível excluir a nota.');
    } else {
      setShowDeleteConfirm(null);
      await fetchNotes();
    }

    setDeletingNoteId(null);
  };

  const handleMarkAsRead = async (noteId: string) => {
    const { error: updateError } = await supabase
      .from('coach_notes')
      .update({
        is_read: true,
        read_at: new Date().toISOString(),
      })
      .eq('id', noteId);

    if (!updateError) {
      await fetchNotes();
    }
  };

  const handleMarkAllAsRead = async () => {
    const { error: rpcError } = await supabase.rpc('mark_notes_as_read', {
      p_aluno_id: aluno.id,
    });

    if (!rpcError) {
      await fetchNotes();
    }
  };

  const startEditing = (note: CoachNote) => {
    setEditingNote(note.id);
    setEditContent(note.content);
    setEditTags(note.tags as CoachNoteTag[]);
  };

  const cancelEditing = () => {
    setEditingNote(null);
    setEditContent('');
    setEditTags([]);
  };

  const toggleTag = (tag: CoachNoteTag, isNewNote = false) => {
    if (isNewNote) {
      setNewNoteTags((prev) => (prev.includes(tag) ? prev.filter((t) => t !== tag) : [...prev, tag]));
    } else {
      setEditTags((prev) => (prev.includes(tag) ? prev.filter((t) => t !== tag) : [...prev, tag]));
    }
  };

  const filteredNotes = notes.filter((note) => {
    if (filterTag !== 'all' && !note.tags.includes(filterTag)) return false;
    if (showUnreadOnly && note.is_read) return false;
    return true;
  });

  const unreadCount = notes.filter((n) => !n.is_read).length;
  const recentNotesCount = notes.filter(
    (n) => new Date(n.created_at) > new Date(Date.now() - 24 * 60 * 60 * 1000)
  ).length;

  const isNewNote = (note: CoachNote) => {
    return new Date(note.created_at) > new Date(Date.now() - 24 * 60 * 60 * 1000);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h4 className="text-[10px] font-black uppercase tracking-[0.3em] text-neutral-500">
            Notas privadas do treinador
          </h4>
          <div className="mt-2 flex items-center gap-3">
            {unreadCount > 0 && (
              <span className="inline-flex items-center gap-1.5 rounded-lg border border-amber-500/20 bg-amber-500/10 px-2.5 py-1 text-[9px] font-black uppercase tracking-widest text-amber-400">
                <EyeOff className="w-3 h-3" />
                {unreadCount} não lida{unreadCount > 1 ? 's' : ''}
              </span>
            )}
            {recentNotesCount > 0 && (
              <span className="inline-flex items-center gap-1.5 rounded-lg border border-brand-green/20 bg-brand-green/10 px-2.5 py-1 text-[9px] font-black uppercase tracking-widest text-brand-green">
                <MessageSquare className="w-3 h-3" />
                {recentNotesCount} nova{recentNotesCount > 1 ? 's' : ''} (24h)
              </span>
            )}
            <span className="text-[8px] text-neutral-700 uppercase font-mono">
              Total: {notes.length}
            </span>
          </div>
        </div>
        {unreadCount > 0 && (
          <button
            onClick={handleMarkAllAsRead}
            className="rounded-lg border border-brand-green/20 bg-brand-green/10 px-3 py-1.5 text-[9px] font-black uppercase tracking-widest text-brand-green hover:border-brand-green/40 transition-all"
          >
            Marcar todas como lidas
          </button>
        )}
      </div>

      {/* Add New Note */}
      <div className="rounded-2xl border border-[#1a1a1a] bg-[#0a0a0a] p-4">
        <textarea
          value={newNoteContent}
          onChange={(e) => setNewNoteContent(e.target.value)}
          placeholder="Adicionar observação sobre o aluno..."
          className="w-full bg-transparent border-none outline-none text-sm placeholder:text-neutral-700 font-mono text-white resize-none min-h-[80px]"
          rows={3}
        />

        {/* Tags for new note */}
        <div className="mt-3 flex flex-wrap gap-2">
          {COACH_NOTE_TAGS.map((tag) => (
            <button
              key={tag.value}
              onClick={() => toggleTag(tag.value, true)}
              className={cn(
                'rounded-lg border px-2 py-1 text-[8px] font-black uppercase tracking-wider transition-all',
                newNoteTags.includes(tag.value)
                  ? tag.color
                  : 'border-[#1a1a1a] bg-[#050505] text-neutral-600 hover:border-neutral-700'
              )}
            >
              <Tag className="w-3 h-3 inline mr-1" />
              {tag.label}
            </button>
          ))}
        </div>

        <div className="mt-4 flex items-center justify-between">
          <span className="text-[8px] text-neutral-700 uppercase font-mono">
            {newNoteContent.length} caracteres
          </span>
          <button
            onClick={handleAddNote}
            disabled={!newNoteContent.trim() || saving}
            className={cn(
              'inline-flex items-center gap-2 rounded-xl px-4 py-2.5 text-[10px] font-black uppercase tracking-widest transition-all',
              !newNoteContent.trim() || saving
                ? 'bg-neutral-900 text-neutral-700 cursor-not-allowed'
                : 'brand-gradient text-black hover:opacity-90'
            )}
          >
            {saving ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Salvando...
              </>
            ) : (
              <>
                <Plus className="w-4 h-4" />
                Adicionar nota
              </>
            )}
          </button>
        </div>
      </div>

      {/* Error */}
      {error && (
        <div className="flex items-center gap-2 rounded-2xl border border-rose-500/20 bg-rose-500/10 px-4 py-3 text-rose-300">
          <AlertCircle className="w-4 h-4" />
          <p className="text-[10px] font-black uppercase tracking-widest">{error}</p>
        </div>
      )}

      {/* Filters */}
      <div className="flex items-center gap-3">
        <div className="flex items-center gap-2 rounded-lg border border-[#1a1a1a] bg-[#050505] px-3 py-2">
          <Filter className="w-3 h-3 text-neutral-600" />
          <select
            value={filterTag}
            onChange={(e) => setFilterTag(e.target.value as CoachNoteTag | 'all')}
            className="bg-transparent border-none outline-none text-[9px] font-black uppercase tracking-wider text-neutral-500"
          >
            <option value="all">Todas tags</option>
            {COACH_NOTE_TAGS.map((tag) => (
              <option key={tag.value} value={tag.value}>
                {tag.label}
              </option>
            ))}
          </select>
        </div>

        <button
          onClick={() => setShowUnreadOnly(!showUnreadOnly)}
          className={cn(
            'inline-flex items-center gap-2 rounded-lg border px-3 py-2 text-[9px] font-black uppercase tracking-wider transition-all',
            showUnreadOnly
              ? 'border-amber-500/30 bg-amber-500/10 text-amber-400'
              : 'border-[#1a1a1a] bg-[#050505] text-neutral-600 hover:border-neutral-700'
          )}
        >
          {showUnreadOnly ? <Eye className="w-3 h-3" /> : <EyeOff className="w-3 h-3" />}
          {showUnreadOnly ? 'Todas' : 'Não lidas'}
        </button>
      </div>

      {/* Notes List */}
      <div className="space-y-3">
        {loading ? (
          <div className="space-y-3 animate-pulse">
            <div className="h-24 rounded-2xl bg-white/5" />
            <div className="h-24 rounded-2xl bg-white/5" />
            <div className="h-24 rounded-2xl bg-white/5" />
          </div>
        ) : filteredNotes.length > 0 ? (
          filteredNotes.map((note) => (
            <div
              key={note.id}
              className={cn(
                'rounded-2xl border p-4 relative group transition-all',
                !note.is_read ? 'border-brand-green/20 bg-brand-green/5' : 'border-[#1a1a1a] bg-[#0a0a0a]'
              )}
            >
              {/* New note badge */}
              {isNewNote(note) && (
                <div className="absolute -top-2 -right-2 rounded-lg bg-brand-green text-black px-2 py-0.5 text-[8px] font-black uppercase tracking-wider">
                  NOVA
                </div>
              )}

              {/* Actions */}
              <div className="absolute top-3 right-3 opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-1">
                {!note.is_read && (
                  <button
                    onClick={() => handleMarkAsRead(note.id)}
                    className="w-7 h-7 rounded-lg border border-amber-500/20 bg-amber-500/10 flex items-center justify-center hover:border-amber-500/40 transition-all"
                    title="Marcar como lida"
                  >
                    <Eye className="w-3 h-3 text-amber-400" />
                  </button>
                )}
                {editingNote !== note.id && (
                  <>
                    <button
                      onClick={() => startEditing(note)}
                      className="w-7 h-7 rounded-lg border border-brand-green/20 bg-brand-green/10 flex items-center justify-center hover:border-brand-green/40 transition-all"
                      title="Editar nota"
                    >
                      <Edit2 className="w-3 h-3 text-brand-green" />
                    </button>
                    <button
                      onClick={() => setShowDeleteConfirm(note.id)}
                      className="w-7 h-7 rounded-lg border border-rose-500/20 bg-rose-500/10 flex items-center justify-center hover:border-rose-500/40 transition-all"
                      title="Excluir nota"
                    >
                      <Trash2 className="w-3 h-3 text-rose-400" />
                    </button>
                  </>
                )}
              </div>

              {editingNote === note.id ? (
                // Edit mode
                <div className="space-y-3">
                  <textarea
                    value={editContent}
                    onChange={(e) => setEditContent(e.target.value)}
                    className="w-full bg-transparent border-none outline-none text-sm font-mono text-white resize-none min-h-[60px]"
                    rows={3}
                  />

                  <div className="flex flex-wrap gap-2">
                    {COACH_NOTE_TAGS.map((tag) => (
                      <button
                        key={tag.value}
                        onClick={() => toggleTag(tag.value)}
                        className={cn(
                          'rounded-lg border px-2 py-1 text-[8px] font-black uppercase tracking-wider transition-all',
                          editTags.includes(tag.value)
                            ? tag.color
                            : 'border-[#1a1a1a] bg-[#050505] text-neutral-600 hover:border-neutral-700'
                        )}
                      >
                        <Tag className="w-3 h-3 inline mr-1" />
                        {tag.label}
                      </button>
                    ))}
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => handleEditNote(note.id)}
                      disabled={saving || !editContent.trim()}
                      className={cn(
                        'inline-flex items-center gap-2 rounded-lg px-3 py-2 text-[9px] font-black uppercase tracking-wider transition-all',
                        !editContent.trim() || saving
                          ? 'bg-neutral-900 text-neutral-700 cursor-not-allowed'
                          : 'brand-gradient text-black'
                      )}
                    >
                      {saving ? (
                        <Loader2 className="w-3 h-3 animate-spin" />
                      ) : (
                        <Save className="w-3 h-3" />
                      )}
                      Salvar
                    </button>
                    <button
                      onClick={cancelEditing}
                      className="inline-flex items-center gap-2 rounded-lg border border-[#1a1a1a] bg-[#050505] px-3 py-2 text-[9px] font-black uppercase tracking-wider text-neutral-500 hover:border-neutral-700 transition-all"
                    >
                      <X className="w-3 h-3" />
                      Cancelar
                    </button>
                  </div>
                </div>
              ) : (
                // View mode
                <>
                  <p className="text-xs text-neutral-300 leading-relaxed font-mono pr-16">{note.content}</p>

                  {/* Tags */}
                  {note.tags && note.tags.length > 0 && (
                    <div className="mt-3 flex flex-wrap gap-2">
                      {note.tags.map((tag) => {
                        const tagConfig = COACH_NOTE_TAGS.find((t) => t.value === tag);
                        return tagConfig ? (
                          <span
                            key={tag}
                            className={cn(
                              'rounded-lg border px-2 py-0.5 text-[8px] font-black uppercase tracking-wider',
                              tagConfig.color
                            )}
                          >
                            <Tag className="w-3 h-3 inline mr-1" />
                            {tagConfig.label}
                          </span>
                        ) : null;
                      })}
                    </div>
                  )}

                  <div className="mt-3 flex items-center justify-between border-t border-[#1a1a1a] pt-3">
                    <div className="flex items-center gap-3">
                      <div className="flex items-center gap-1.5">
                        <Calendar className="w-3 h-3 text-neutral-600" />
                        <span className="text-[8px] font-black text-neutral-600 uppercase tracking-wider">
                          {format(new Date(note.created_at), 'dd MMM yyyy HH:mm', { locale: ptBR })}
                        </span>
                      </div>

                      {note.edit_count > 0 && (
                        <span className="text-[8px] text-neutral-700 uppercase font-mono">
                          Editada {note.edit_count}x
                        </span>
                      )}
                    </div>

                    <div className="flex items-center gap-2">
                      <span className="text-[8px] text-neutral-700 uppercase font-mono">
                        por {note.treinador_name}
                      </span>
                    </div>
                  </div>

                  {/* Delete confirmation */}
                  <AnimatePresence>
                    {showDeleteConfirm === note.id && (
                      <motion.div
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: 'auto' }}
                        exit={{ opacity: 0, height: 0 }}
                        className="mt-3 pt-3 border-t border-rose-500/20"
                      >
                        <p className="text-[10px] font-black uppercase tracking-wider text-rose-300 mb-3">
                          Tem certeza que deseja excluir esta nota?
                        </p>
                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => handleDeleteNote(note.id)}
                            disabled={deletingNoteId === note.id}
                            className={cn(
                              'inline-flex items-center gap-2 rounded-lg px-3 py-2 text-[9px] font-black uppercase tracking-wider transition-all',
                              deletingNoteId === note.id
                                ? 'bg-rose-900/30 text-rose-300 cursor-wait'
                                : 'bg-rose-500/20 border border-rose-500/30 text-rose-300 hover:bg-rose-500/30'
                            )}
                          >
                            {deletingNoteId === note.id ? (
                              <Loader2 className="w-3 h-3 animate-spin" />
                            ) : (
                              <Trash2 className="w-3 h-3" />
                            )}
                            Sim, excluir
                          </button>
                          <button
                            onClick={() => setShowDeleteConfirm(null)}
                            className="inline-flex items-center gap-2 rounded-lg border border-[#1a1a1a] bg-[#050505] px-3 py-2 text-[9px] font-black uppercase tracking-wider text-neutral-500 hover:border-neutral-700 transition-all"
                          >
                            <X className="w-3 h-3" />
                            Cancelar
                          </button>
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </>
              )}
            </div>
          ))
        ) : (
          <div className="rounded-2xl border border-dashed border-[#1a1a1a] bg-[#0a0a0a] p-8 text-center">
            <MessageSquare className="w-8 h-8 text-neutral-900 mx-auto mb-3" />
            <p className="text-[10px] font-black uppercase tracking-widest text-neutral-500">
              {filterTag !== 'all' ? 'Nenhuma nota com esta tag' : showUnreadOnly ? 'Nenhuma nota não lida' : 'Nenhuma nota privada ainda'}
            </p>
            <p className="text-[10px] text-neutral-600 uppercase tracking-widest mt-2">
              {filterTag !== 'all' || showUnreadOnly ? 'Tente outros filtros' : 'Registre observações sobre este perfil'}
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
