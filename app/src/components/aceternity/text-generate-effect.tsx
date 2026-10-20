// Aceternity UI "Text Generate Effect", adapted to the house: the words come
// in one by one out of a blur, in the foreground ink; with reduced motion they
// are simply there.
import { useEffect } from 'react';
import { motion, stagger, useAnimate, useReducedMotion } from 'motion/react';
import { cn } from '@/lib/utils';

export function TextGenerateEffect({ words, className, filter = true, duration = 0.5 }: { words: string; className?: string; filter?: boolean; duration?: number }) {
  const [scope, animate] = useAnimate();
  const still = useReducedMotion();
  useEffect(() => {
    if (still) return;
    animate('span', { opacity: 1, filter: filter ? 'blur(0px)' : 'none' }, { duration, delay: stagger(0.2) });
  }, [animate, still, filter, duration, words]);

  return (
    <div className={cn('text-foreground leading-snug', className)}>
      <motion.div ref={scope}>
        {words.split(' ').map((word, i) => (
          <motion.span key={word + i} style={still ? undefined : { opacity: 0, filter: filter ? 'blur(10px)' : 'none' }}>
            {word}{' '}
          </motion.span>
        ))}
      </motion.div>
    </div>
  );
}
