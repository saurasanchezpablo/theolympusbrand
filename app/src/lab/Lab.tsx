// The lab: one bench per interface library the site may use, each drawn with
// the house's grays, so a new idea can be tried before it reaches a page.
// Development only — `npm run app`, then /lab.html; it is not in the build.
import { useEffect, useRef, useState, type ReactNode } from 'react';
import { motion, useReducedMotion } from 'motion/react';
import gsap from 'gsap';
import { Canvas, useFrame } from '@react-three/fiber';
import { ContactShadows, OrbitControls, RoundedBox } from '@react-three/drei';
import { Swiper, SwiperSlide } from 'swiper/react';
import { A11y, Keyboard, Pagination } from 'swiper/modules';
import 'swiper/css';
import 'swiper/css/pagination';
import { RuntimeLoader } from '@rive-app/react-canvas';
import riveWasm from '@rive-app/canvas/rive.wasm?url';
import type { Mesh } from 'three';
import { Button } from '@/components/ui/button';
import { TextGenerateEffect } from '@/components/aceternity/text-generate-effect';
import { fileUrl } from '../site/files.ts';

// Rive fetches its runtime from a CDN unless told otherwise; the site serves everything itself.
RuntimeLoader.setWasmUrl(riveWasm);

const SEALS = ['nextcloud', 'jellyfin', 'proxmox', 'minecraft', 'home-assistant'];

function Bench({ name, ready, children }: { name: string; ready: boolean; children: ReactNode }) {
  return (
    <section className="border-border bg-card rounded-md border p-5" data-bench={name} data-ready={ready ? 'yes' : 'no'}>
      <h2 className="text-muted-foreground mb-4 text-sm font-medium">{name}</h2>
      {children}
    </section>
  );
}

function Block() {
  const ref = useRef<Mesh>(null);
  useFrame((_, dt) => ref.current && (ref.current.rotation.y += dt * 0.4));
  return (
    <RoundedBox ref={ref} args={[1.6, 1.6, 0.4]} radius={0.08} position={[0, 0.9, 0]} castShadow>
      <meshStandardMaterial color="#d6d6d6" roughness={0.55} />
    </RoundedBox>
  );
}

export function Lab() {
  const still = useReducedMotion();
  const tween = useRef<HTMLDivElement>(null);
  const [ready, setReady] = useState({ gsap: false, three: false, rive: false });
  const mark = (k: keyof typeof ready) => setReady((r) => (r[k] ? r : { ...r, [k]: true }));

  useEffect(() => {
    const ctx = gsap.context(() => {
      gsap.fromTo('[data-bar]', { scaleX: 0 }, { scaleX: 1, duration: still ? 0 : 1.2, stagger: 0.15, ease: 'power3.out', transformOrigin: 'left center', onComplete: () => mark('gsap') });
    }, tween);
    return () => ctx.revert();
  }, [still]);

  useEffect(() => {
    RuntimeLoader.awaitInstance().then(() => mark('rive'));
  }, []);

  return (
    <main className="bg-background text-foreground mx-auto grid max-w-5xl grid-cols-1 gap-5 p-6 font-sans">
      <h1 className="font-serif text-3xl">Lab</h1>

      <Bench name="shadcn/ui" ready>
        <div className="flex flex-wrap gap-3">
          <Button>Save design</Button>
          <Button variant="outline">Export</Button>
          <Button variant="secondary">Duplicate</Button>
          <Button variant="ghost">Cancel</Button>
        </div>
      </Bench>

      <Bench name="Aceternity UI" ready>
        <TextGenerateEffect className="font-serif text-2xl" words="Every service is a god with a domain, and every god has its seal." />
      </Bench>

      <Bench name="Motion" ready>
        <motion.div className="bg-primary size-16 rounded-sm" whileHover={{ scale: 1.08 }} whileTap={{ scale: 0.95 }} animate={still ? undefined : { rotate: [0, 6, -6, 0] }} transition={{ duration: 2, repeat: Infinity }} />
      </Bench>

      <Bench name="GSAP" ready={ready.gsap}>
        <div ref={tween} className="grid gap-2">
          {[90, 70, 50].map((w) => (
            <div key={w} data-bar className="bg-muted-foreground h-2 rounded-xs" style={{ width: `${w}%` }} />
          ))}
        </div>
      </Bench>

      <Bench name="React Three Fiber · Drei" ready={ready.three}>
        <div className="bg-muted h-64 rounded-sm">
          <Canvas shadows camera={{ position: [2.5, 2, 3.5], fov: 40 }} onCreated={() => mark('three')}>
            <ambientLight intensity={0.6} />
            <directionalLight position={[3, 5, 2]} intensity={1.6} castShadow />
            <Block />
            <ContactShadows position={[0, 0, 0]} opacity={0.5} blur={2} />
            <OrbitControls enablePan={false} />
          </Canvas>
        </div>
      </Bench>

      <Bench name="Swiper" ready>
        <Swiper modules={[A11y, Keyboard, Pagination]} keyboard pagination={{ clickable: true }} slidesPerView={2} spaceBetween={16} breakpoints={{ 720: { slidesPerView: 3 } }}>
          {SEALS.map((id) => (
            <SwiperSlide key={id} className="pb-8">
              <img className="mx-auto size-28" src={fileUrl(`assets/services/${id}/svg/the-olympus-${id}-seal.svg`)} alt={`${id} seal`} />
            </SwiperSlide>
          ))}
        </Swiper>
      </Bench>

      <Bench name="Rive" ready={ready.rive}>
        <p className="text-muted-foreground text-sm">{ready.rive ? 'Runtime loaded from this server. Add a .riv file to play an animation.' : 'Loading the runtime…'}</p>
      </Bench>
    </main>
  );
}
