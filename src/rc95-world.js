import TUNING from './TUNING.js';
import { Terrain } from './sim/terrain.js';
import { Player } from './sim/player.js';

const F = TUNING.FEATURES;
const P = TUNING.PLAYER;
const B = TUNING.BOOST;
const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));

// Named stunt geography owns its own launch shape. Procedural Big-Air beats are
// cleared around these landmarks so a random cliff can never stack inside them.
const BRIDGE_D = 2380;
const BRIDGE_LAUNCH_D = 2334;
const BRIDGE_LAUNCH = {
  id: 'bridge-super-launch',
  halfX: 10.0,
  drop: 12.6,
  lip: 3.15,
};

const THROAT_D = 3020;
const THROAT_LAUNCH_D = 2918;
const THROAT_LAUNCH = {
  id: 'throat-entry-kicker',
  halfX: 8.8,
  drop: 5.8,
  lip: 1.55,
};

const TUNNEL_D = 5580;

// Landmark render meshes are intentionally cheap and stylized. These volumes
// are matching gameplay approximations, not a second high-detail physics mesh.
const STRUCTURES = [
  { type: 'structure', id: 'starting-house', x: -11, d: 170, r: 4.35, h: 7.1 },
  { type: 'structure', id: 'bridge-pillar-l', x: -19, d: BRIDGE_D, r: 1.05, h: 12.0 },
  { type: 'structure', id: 'bridge-pillar-r', x: 19, d: BRIDGE_D, r: 1.05, h: 12.0 },
  // Elevated bridge deck: minH lets a skier pass underneath while an airborne
  // skier who actually intersects the deck gets a physical hit.
  ...[-16, -8, 0, 8, 16].map((x, i) => ({
    type: 'structure', id: `bridge-deck-${i}`, x, d: BRIDGE_D, r: 4.25,
    minH: 8.0, h: 9.65,
  })),

  // THE THROAT is a sequence of heavy ribs. The central chute is still the
  // intended line; the stone legs and high arch are no longer ghost geometry.
  ...Array.from({ length: 7 }, (_, i) => {
    const d = THROAT_D + (i - 3) * 7;
    return [
      { type: 'structure', id: `throat-${i}-l`, x: -18.0, d, r: 1.35, h: 15.3 },
      { type: 'structure', id: `throat-${i}-r`, x: 18.0, d, r: 1.35, h: 15.3 },
      { type: 'structure', id: `throat-${i}-arch-l`, x: -10.5, d, r: 2.0, minH: 13.0, h: 17.6 },
      { type: 'structure', id: `throat-${i}-arch-c`, x: 0, d, r: 2.4, minH: 17.0, h: 20.8 },
      { type: 'structure', id: `throat-${i}-arch-r`, x: 10.5, d, r: 2.0, minH: 13.0, h: 17.6 },
    ];
  }).flat(),

  // THE TUNNEL is an open ring, not a wall. Represent every visible hoop as an
  // annulus in x/height space instead of a loose stack of spheres. The hole is
  // genuinely passable; the visible ice itself is genuinely solid at any air height.
  ...Array.from({ length: 8 }, (_, i) => ({
    type: 'ring',
    id: `tunnel-ring-${i}`,
    x: 0,
    d: TUNNEL_D + (i - 3.5) * 7,
    depthR: 1.28,
    centerH: 9.5,
    ringR: 16.8,
    tubeR: 0.88,
  })),

  { type: 'structure', id: 'sunken-lodge', x: 8, d: 19740, r: 7.1, h: 8.0 },
];

if (!Terrain.prototype.__rc95WorldPatched) {
  Terrain.prototype.__rc95WorldPatched = true;

  const baseHeightsOf = Terrain.prototype.heightsOf;
  Terrain.prototype.heightsOf = function heightsOfRC95(ci) {
    const h = baseHeightsOf.call(this, ci);
    if (h.__rc95World) return h;

    const d0 = ci * TUNING.TERRAIN.CHUNK_LEN;
    const d1 = d0 + TUNING.TERRAIN.CHUNK_LEN;

    // A generic RC6 Big-Air beat naturally lands almost on top of THE THROAT on
    // many seeds. Clear the whole authored chute so its entry/runout stay intentional.
    for (let i = h.length - 1; i >= 0; i--) {
      const f = h[i];
      if (f.type === 'cliff' && Math.abs(f.d - THROAT_D) < 185) h.splice(i, 1);
      else if (f.type === 'cliff' && Math.abs(f.d - BRIDGE_LAUNCH_D) < 86) h.splice(i, 1);
    }

    const addLaunch = (d, spec) => {
      if (d < d0 || d >= d1) return;
      const cx = clamp(
        this.corridorX(d),
        -TUNING.TERRAIN.HALF_WIDTH + spec.halfX + 0.6,
        TUNING.TERRAIN.HALF_WIDTH - spec.halfX - 0.6,
      );
      h.push({
        type: 'cliff', authored: true, hero: true,
        id: spec.id,
        x: cx, d,
        halfX: spec.halfX,
        drop: spec.drop,
        lip: spec.lip,
        infMin: d - 14,
        infMax: d + F.CLIFF_RECOVER_START + F.CLIFF_RECOVER_LEN + 4,
      });
    };

    addLaunch(BRIDGE_LAUNCH_D, BRIDGE_LAUNCH);
    addLaunch(THROAT_LAUNCH_D, THROAT_LAUNCH);
    h.sort((a, b) => a.d - b.d);

    Object.defineProperty(h, '__rc95World', { value: true, enumerable: false });
    return h;
  };

  const baseCollidersNear = Terrain.prototype.collidersNear;
  Terrain.prototype.collidersNear = function collidersNearRC95(d, back = 6, fwd = 8) {
    const out = baseCollidersNear.call(this, d, back, fwd);
    const lo = d - back;
    const hi = d + fwd;
    for (const c of STRUCTURES) {
      const reach = c.depthR ?? c.r ?? 1;
      if (c.d + reach < lo || c.d - reach > hi) continue;
      out.push(c);
    }
    return out;
  };
}

// Existing obstacle collisions are ground-up columns. Add minH support for
// elevated pieces plus annulus collision for THE TUNNEL's visible hoops.
if (!Player.prototype.__rc95StructureCollision) {
  Player.prototype.__rc95StructureCollision = true;
  Player.prototype._collide = function collideRC95(events) {
    if (this._hitCooldown > 0) return;
    const near = this.terrain.collidersNear(this.d, 3, 3);
    for (const c of near) {
      const dd = this.d - c.d;
      let groundAt;

      if (c.type === 'ring') {
        if (Math.abs(dd) > c.depthR + 0.55) continue;
        groundAt = this.terrain.heightAt(c.x, c.d);
        const relY = this.y - groundAt;
        const radial = Math.hypot(this.x - c.x, relY - c.centerH);
        // Player radius is folded into the tube thickness so grazing visible ice
        // reads as a hit while the centre of the hoop remains an honest opening.
        if (Math.abs(radial - c.ringR) > c.tubeR + 0.62) continue;
      } else {
        const dx = this.x - c.x;
        const rr = c.r + 0.55;
        if (dx * dx + dd * dd > rr * rr) continue;

        groundAt = this.terrain.heightAt(c.x, c.d);
        const relY = this.y - groundAt;
        if (Number.isFinite(c.minH)) {
          if (relY < c.minH - 0.45 || relY > c.h + 0.45) continue;
        } else if (this.airborne && this.y > groundAt + c.h) {
          continue;
        }
      }

      this.obstaclesHit++;
      this.speed *= 1 - P.HIT_SPEED_COST;
      this.staggerT = P.STAGGER_TIME;
      this._hitCooldown = 0.35;
      this._breakChain(events);
      if (this.airborne) {
        this.airborne = false;
        this.hangtime = 0;
        this.y = this.terrain.heightAt(this.x, this.d);
        this.vy = this._groundVy();
        this.yaw = 0;
        this.pitch = 0;
        this.boostMeter *= 1 - B.FLUB_METER_LOSS;
      }
      events?.push({ t: 'hit', kind: c.type, structureId: c.id || null, x: this.x, y: this.y, d: this.d });
      return;
    }
  };
}

globalThis.__RC95_WORLD = {
  version: '9.8',
  bridgeLaunchD: BRIDGE_LAUNCH_D,
  bridgeLaunchTrimmed: true,
  throatLaunchD: THROAT_LAUNCH_D,
  throatOwnsAirBeat: true,
  bridgePhysical: true,
  throatPhysical: true,
  tunnelPhysical: true,
  tunnelRingCollision: true,
  solidStructures: STRUCTURES.length,
};
