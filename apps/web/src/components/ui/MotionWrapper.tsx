'use client';

import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';

export interface PageTransitionProps {
  children: React.ReactNode;
  className?: string;
}

export const PageTransition: React.FC<PageTransitionProps> = ({ children, className }) => {
  return (
    <motion.div
      initial={{ opacity: 0, y: 4 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -4 }}
      transition={{ duration: 0.15, ease: 'easeOut' }}
      className={className}
    >
      {children}
    </motion.div>
  );
};

export interface FadeInProps {
  children: React.ReactNode;
  delay?: number;
  className?: string;
}

export const FadeIn: React.FC<FadeInProps> = ({ children, delay = 0, className }) => {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.18, delay, ease: 'easeOut' }}
      className={className}
    >
      {children}
    </motion.div>
  );
};

export interface SlideInProps {
  children: React.ReactNode;
  direction?: 'left' | 'right' | 'up' | 'down';
  className?: string;
}

export const SlideIn: React.FC<SlideInProps> = ({ children, direction = 'up', className }) => {
  const offsets = {
    left: { x: -8, y: 0 },
    right: { x: 8, y: 0 },
    up: { x: 0, y: 8 },
    down: { x: 0, y: -8 },
  };

  return (
    <motion.div
      initial={{ opacity: 0, ...offsets[direction] }}
      animate={{ opacity: 1, x: 0, y: 0 }}
      transition={{ duration: 0.16, ease: 'easeOut' }}
      className={className}
    >
      {children}
    </motion.div>
  );
};

export interface AnimatedContainerProps {
  children: React.ReactNode;
  className?: string;
}

export const AnimatedContainer: React.FC<AnimatedContainerProps> = ({ children, className }) => {
  return (
    <AnimatePresence mode="wait">
      <motion.div
        initial={{ opacity: 0, scale: 0.99 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.99 }}
        transition={{ duration: 0.15, ease: 'easeOut' }}
        className={className}
      >
        {children}
      </motion.div>
    </AnimatePresence>
  );
};
