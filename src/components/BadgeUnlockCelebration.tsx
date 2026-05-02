import React, { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { X, Sparkles } from 'lucide-react';
import { getBadgeIcon } from '../lib/badgeIcons';

interface Badge {
  id: string;
  name: string;
  description?: string;
  icon?: string;
}

interface BadgeUnlockCelebrationProps {
  badge: Badge | null;
  onClose: () => void;
}

export default function BadgeUnlockCelebration({ badge, onClose }: BadgeUnlockCelebrationProps) {
  const [isVisible, setIsVisible] = useState(!!badge);

  useEffect(() => {
    setIsVisible(!!badge);
    if (badge) {
      const timer = setTimeout(() => {
        handleClose();
      }, 5000); // Auto-close after 5 seconds

      return () => clearTimeout(timer);
    }
  }, [badge]);

  const handleClose = () => {
    setIsVisible(false);
    onClose();
  };

  if (!badge) return null;

  const IconComponent = getBadgeIcon(badge.icon);

  return (
    <AnimatePresence>
      {isVisible && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/40 backdrop-blur-sm z-40"
            onClick={handleClose}
          />

          {/* Celebration Modal */}
          <motion.div
            initial={{ opacity: 0, scale: 0.8, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.8, y: 20 }}
            transition={{ type: 'spring', damping: 20, stiffness: 300 }}
            className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-50 w-full max-w-sm"
          >
            <div className="rounded-[40px] border border-[#1a1a1a] bg-gradient-to-br from-[#050505] to-[#0a0a0a] p-8 shadow-2xl shadow-brand-green/20">
              {/* Close button */}
              <button
                onClick={handleClose}
                className="absolute top-4 right-4 p-2 rounded-full hover:bg-white/10 transition-colors"
              >
                <X className="w-5 h-5 text-neutral-500" />
              </button>

              {/* Content */}
              <div className="text-center space-y-6">
                {/* Badge Icon with Animation */}
                <motion.div
                  animate={{
                    scale: [1, 1.1, 1],
                    rotate: [0, 5, -5, 0],
                  }}
                  transition={{
                    duration: 2,
                    repeat: Infinity,
                    repeatType: 'loop',
                  }}
                  className="flex justify-center"
                >
                  <div className="w-24 h-24 rounded-3xl brand-gradient flex items-center justify-center text-white shadow-lg shadow-brand-green/40">
                    <IconComponent className="w-12 h-12" />
                  </div>
                </motion.div>

                {/* Badge sparkles animation */}
                <motion.div
                  animate={{
                    opacity: [0, 1, 0],
                  }}
                  transition={{
                    duration: 1.5,
                    repeat: Infinity,
                  }}
                  className="flex justify-center gap-4"
                >
                  {[0, 1, 2].map((i) => (
                    <motion.div
                      key={i}
                      animate={{
                        y: [0, -10, 0],
                      }}
                      transition={{
                        duration: 1.5,
                        delay: i * 0.2,
                        repeat: Infinity,
                      }}
                    >
                      <Sparkles className="w-5 h-5 text-brand-green" />
                    </motion.div>
                  ))}
                </motion.div>

                {/* Text */}
                <div className="space-y-3">
                  <p className="text-[10px] font-black uppercase tracking-[0.35em] text-brand-green">
                    Parabéns!
                  </p>
                  <h2 className="text-3xl font-black italic uppercase tracking-tighter text-white">
                    {badge.name}
                  </h2>
                  <p className="text-sm leading-relaxed text-neutral-400">
                    {badge.description || 'Você desbloqueou uma nova conquista!'}
                  </p>
                </div>

                {/* Buttons */}
                <div className="grid grid-cols-2 gap-3 pt-4">
                  <button
                    onClick={handleClose}
                    className="rounded-2xl border border-[#1a1a1a] bg-[#0a0a0a] px-4 py-3 text-[10px] font-black uppercase tracking-[0.2em] text-white hover:border-brand-green/20 transition-all"
                  >
                    Incrível!
                  </button>
                  <motion.button
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                    onClick={handleClose}
                    className="rounded-2xl border border-brand-green/20 bg-brand-green/10 px-4 py-3 text-[10px] font-black uppercase tracking-[0.2em] text-brand-green hover:bg-brand-green/20 transition-all"
                  >
                    Compartilhar
                  </motion.button>
                </div>

                {/* Progress indicator */}
                <motion.div
                  animate={{ scaleX: 1 }}
                  initial={{ scaleX: 0 }}
                  transition={{ duration: 5 }}
                  className="absolute bottom-0 left-0 right-0 h-1 bg-brand-green rounded-b-[40px] origin-left"
                />
              </div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
