import React from 'react';
import { motion } from 'motion/react';
import { Sparkles } from 'lucide-react';
import { useGamification } from '../hooks/useData';
import { cn } from '../lib/utils';
import { getBadgeIcon } from '../lib/badgeIcons';

export default function BadgesGrid() {
  const { badges, availableBadges, loading } = useGamification();

  if (loading) {
    return (
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
        {Array.from({ length: 6 }).map((_, index) => (
          <div
            key={index}
            className="p-4 rounded-[24px] border border-white/5 bg-black/50 flex flex-col items-center text-center animate-pulse"
          >
            <div className="w-12 h-12 rounded-2xl mb-3 bg-white/5" />
            <div className="h-3 w-20 rounded bg-white/5 mb-2" />
            <div className="h-2 w-full max-w-[120px] rounded bg-white/5" />
          </div>
        ))}
      </div>
    );
  }

  if (availableBadges.length === 0) {
    return (
      <div className="rounded-[28px] border border-dashed border-[#1a1a1a] bg-[#050505] p-8 flex flex-col items-center text-center gap-3">
        <Sparkles className="w-8 h-8 text-brand-green" />
        <h3 className="text-sm font-black uppercase tracking-[0.2em] text-white">
          Nenhuma badge cadastrada
        </h3>
        <p className="text-[10px] text-neutral-500 uppercase tracking-widest max-w-md leading-relaxed">
          O banco de dev ainda não recebeu a seed de gamificação completa. Quando as badges entrarem,
          este bloco passa a exibir progresso real de desbloqueio.
        </p>
      </div>
    );
  }

  const unlockedCount = badges.length;
  const totalCount = availableBadges.length;
  const orderedBadges = [...availableBadges].sort((badgeA, badgeB) => {
    const badgeAUnlocked = badges.some((userBadge) => userBadge.badge_id === badgeA.id);
    const badgeBUnlocked = badges.some((userBadge) => userBadge.badge_id === badgeB.id);
    return Number(badgeBUnlocked) - Number(badgeAUnlocked);
  });

  return (
    <div className="space-y-4">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
        <div>
          <p className="text-[10px] font-black uppercase tracking-[0.3em] text-neutral-600">
            Progresso da gamificação
          </p>
          <p className="text-xs uppercase tracking-widest text-neutral-500 mt-1">
            {unlockedCount}/{totalCount} badges desbloqueadas
          </p>
        </div>
        <div className="px-3 py-1 rounded-full border border-brand-green/20 bg-brand-green/10 text-[9px] font-black uppercase tracking-[0.2em] text-brand-green">
          {unlockedCount === 0 ? 'Nenhuma badge conquistada ainda' : `${totalCount - unlockedCount} badge(s) pendente(s)`}
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
        {orderedBadges.map((badge) => {
          const isUnlocked = badges.some((userBadge) => userBadge.badge_id === badge.id);
          const IconComponent = getBadgeIcon(badge.icon);

          return (
            <motion.div
              key={badge.id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className={cn(
                'p-4 rounded-[24px] border flex flex-col items-center text-center transition-all group',
                isUnlocked
                  ? 'bg-[#0a0a0a] border-brand-green/20 shadow-lg shadow-brand-green/5'
                  : 'bg-black/50 border-white/5 opacity-40 grayscale'
              )}
            >
              <div
                className={cn(
                  'w-12 h-12 rounded-2xl flex items-center justify-center mb-3 transition-all',
                  isUnlocked ? 'brand-gradient text-black scale-110 shadow-lg shadow-brand-green/20' : 'bg-neutral-900 text-neutral-600'
                )}
              >
                <IconComponent className="w-6 h-6" />
              </div>
              <h4 className="text-[10px] font-black uppercase tracking-widest text-white mb-1">{badge.name}</h4>
              <p className="text-[8px] font-bold text-neutral-500 leading-tight uppercase px-2">
                {badge.description || 'Sem descrição cadastrada'}
              </p>

              {isUnlocked ? (
                <motion.div
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  className="mt-3 px-2 py-0.5 bg-brand-green/10 border border-brand-green/20 rounded-full"
                >
                  <span className="text-[7px] font-black text-brand-green uppercase tracking-tighter">
                    Conquistado
                  </span>
                </motion.div>
              ) : null}
            </motion.div>
          );
        })}
      </div>
    </div>
  );
}
