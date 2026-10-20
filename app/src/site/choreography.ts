// The home page's scroll choreography — the only part of the site driven by
// GSAP, loaded after the page has drawn and never for visitors who ask for
// reduced motion. Each effect owns its elements alone:
//
// - the ascent: the opening scene holds while the words part, the medallion
//   rises and tips back, and the clouds climb over it;
// - the domain, unscrambled once as it comes into view;
// - the band of names, quickened by the speed of the scroll;
// - the pantheon, held while its gods pass sideways (wide screens only —
//   narrower ones swipe the same row natively).
//
// Everything it moves is laid out and readable without it.

import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { ScrambleTextPlugin } from 'gsap/ScrambleTextPlugin';

gsap.registerPlugin(ScrollTrigger, ScrambleTextPlugin);

export function choreograph(root: HTMLElement, { scroller, ascend }: { scroller: HTMLElement; ascend: (p: number) => void }): () => void {
  const q = <T extends Element = HTMLElement>(s: string) => root.querySelector<T>(s);
  const media = gsap.matchMedia();
  const ctx = gsap.context(() => {
    ScrollTrigger.defaults({ scroller });

    // The domain resolves out of noise, once.
    const domain = q('[data-scramble]');
    if (domain)
      gsap.to(domain, {
        scrambleText: { text: domain.textContent ?? '', chars: '·:—/.0123456789', speed: 0.5, revealDelay: 0.15 },
        duration: 1.6,
        ease: 'none',
        scrollTrigger: { trigger: domain, start: 'top 85%', once: true },
      });

    // The band runs faster, and backwards, with the scroll.
    const runs = Array.from(root.querySelectorAll<HTMLElement>('.band__run')).flatMap((el) => el.getAnimations());
    if (runs.length) {
      const drift = { rate: 1 };
      ScrollTrigger.create({
        trigger: q('.band'),
        start: 'top bottom',
        end: 'bottom top',
        onUpdate: (self) => {
          const push = Math.min(5, Math.abs(self.getVelocity()) / 400) * self.direction;
          gsap.to(drift, { rate: 1 + push, duration: 0.2, overwrite: true, onUpdate: () => runs.forEach((a) => (a.playbackRate = drift.rate)) });
          gsap.to(drift, { rate: 1, duration: 1.2, delay: 0.25, ease: 'power2.out', onUpdate: () => runs.forEach((a) => (a.playbackRate = drift.rate)) });
        },
      });
    }
  }, root);

  // Wide screens hold the ascent and the pantheon in place (position: sticky inside a taller run) while the scroll plays them.
  media.add('(min-width: 900px)', () => {
    root.classList.add('is-held');
    const ascentRun = q('.ascent-run');
    if (ascentRun) {
      gsap
        .timeline({
          defaults: { ease: 'none' },
          scrollTrigger: { trigger: ascentRun, scroller, start: 'top top', end: 'bottom bottom', scrub: 0.6, onUpdate: (self) => ascend(self.progress) },
        })
        .to(q('.ascent__word--the'), { xPercent: -45, opacity: 0.18 }, 0)
        .to(q('.ascent__word--olympus'), { xPercent: 22, opacity: 0.18 }, 0)
        .to(q('.ascent__stage'), { yPercent: -16, scale: 0.82 }, 0)
        .to(q('.ascent__intro'), { opacity: 0, y: -40, duration: 0.35 }, 0)
        .fromTo(q('.cloudbank--back'), { yPercent: 0 }, { yPercent: -70 }, 0)
        .fromTo(q('.cloudbank--front'), { yPercent: 0 }, { yPercent: -125 }, 0)
        .fromTo(q('.ascent__veil'), { opacity: 0 }, { opacity: 1, duration: 0.3 }, 0.7);
    }

    // The pantheon: vertical scrolling carries the gods sideways.
    const run = q('.pantheon-run');
    const section = q('.pantheon');
    const track = q('.pantheon__track');
    if (run && section && track) {
      section.classList.add('is-pinned');
      const distance = () => Math.max(0, track.scrollWidth - track.clientWidth);
      const size = () => run.style.setProperty('--travel', `${distance()}px`);
      size();
      const tween = gsap.to(track, {
        x: () => -distance(),
        ease: 'none',
        scrollTrigger: { trigger: run, scroller, start: 'top top', end: 'bottom bottom', scrub: 0.8, invalidateOnRefresh: true, onRefreshInit: size },
      });
      // A keyboard reaching a god off to the side scrolls the page to where it is shown.
      const onFocus = (e: FocusEvent) => {
        const card = (e.target as HTMLElement).closest<HTMLElement>('.deity');
        const st = tween.scrollTrigger;
        if (!card || !st || !distance()) return;
        const p = Math.min(1, Math.max(0, (card.offsetLeft - track.clientWidth / 2 + card.offsetWidth / 2) / distance()));
        scroller.scrollTop = st.start + p * (st.end - st.start);
      };
      track.addEventListener('focusin', onFocus);
      return () => {
        track.removeEventListener('focusin', onFocus);
        section.classList.remove('is-pinned');
        run.style.removeProperty('--travel');
        root.classList.remove('is-held');
      };
    }
    return () => root.classList.remove('is-held');
  });

  // Images and fonts arriving change the page's height: measure again once they have.
  const refresh = () => ScrollTrigger.refresh();
  document.fonts?.ready.then(refresh);
  const late = window.setTimeout(refresh, 1200);

  return () => {
    window.clearTimeout(late);
    media.revert();
    ctx.revert();
    ascend(0);
  };
}
