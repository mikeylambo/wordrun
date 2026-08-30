import TUNING from './TUNING.js';
import { Player } from './sim/player.js';

// Final contact-entry guard. v1-finalize already latches named landmarks; this
// outer layer extends the exact same rule to generated trees, rocks and gate
// poles. No object may drain multiple hearts simply because the runner remains
// overlapping it after the generic hit cooldown expires.
//
// Ship polish: after any physical-world hit, grant a short deterministic grace
// window against OTHER terrain/structure hits only. Beast One / Beast Two do
// not use Player._collide(), so they remain fully lethal during this window.

const TERRAIN_GRACE = 0.55;

function contactKey(c) {
  if (!c) return null;
  if (c.id) return `id:${c.id}`;
  if (!Number.isFinite(c.x) || !Number.isFinite(c.d)) return null;
  return `geo:${c.type || 'solid'}:${c.x.toFixed(3)}:${c.d.toFixed(3)}:${c.gateId ?? ''}:${c.side ?? ''}`;
}

function stillNear(player, c) {
  const dx = Math.abs(player.x - (c.x || 0));
  const dd = Math.abs(player.d - (c.d || 0));
  if (c.type === 'box') {
    return dx <= (c.halfX || 0.5) + 2.0 && dd <= (c.halfD || 0.5) + 2.0;
  }
  if (c.type === 'ring' || c.type === 'flatRing') {
    return dd <= (c.depthR || c.tubeR || 1) + 4.0;
  }
  const reach = (c.r || 0.8) + 3.0;
  return dx <= reach && dd <= reach;
}

function nearestHitCollider(player, vicinity, event) {
  let best = null;
  let bestD2 = Infinity;
  for (const c of vicinity) {
    if (event?.structureId && c.id !== event.structureId) continue;
    if (!event?.structureId && event?.kind && c.type !== event.kind) continue;
    const dx = player.x - (c.x || 0);
    const dd = player.d - (c.d || 0);
    const d2 = dx * dx + dd * dd;
    if (d2 < bestD2) {
      bestD2 = d2;
      best = c;
    }
  }
  return best;
}

if (!Player.prototype.__v1AllPhysicalContactDamage) {
  Player.prototype.__v1AllPhysicalContactDamage = true;

  const baseReset = Player.prototype.reset;
  Player.prototype.reset = function resetV1PhysicalContact(...args) {
    const out = baseReset.apply(this, args);
    this.__v1AllPhysicalLocks?.clear?.();
    this.__v1TerrainGrace = 0;
    return out;
  };

  const baseCollide = Player.prototype._collide;

  Player.prototype._collide = function collideV1AllPhysical(events) {
    // Fixed-step timer keeps this deterministic and independent of render FPS.
    if ((this.__v1TerrainGrace || 0) > 0) {
      this.__v1TerrainGrace = Math.max(0, this.__v1TerrainGrace - TUNING.SIM.DT);
      return;
    }

    const terrain = this.terrain;
    const original = terrain.collidersNear;
    if (typeof original !== 'function') return baseCollide.call(this, events);

    const locks = this.__v1AllPhysicalLocks || (this.__v1AllPhysicalLocks = new Set());
    const vicinity = original.call(terrain, this.d, 8, 8);

    // Release only after the runner has genuinely cleared the object's physical
    // neighborhood. Re-entering later is a new contact and can cost one heart.
    for (const key of [...locks]) {
      const live = vicinity.some((c) => contactKey(c) === key && stillNear(this, c));
      if (!live) locks.delete(key);
    }

    const hadOwn = Object.prototype.hasOwnProperty.call(terrain, 'collidersNear');
    terrain.collidersNear = function collidersWithoutLatchedContact(d, back = 6, fwd = 8) {
      return original.call(this, d, back, fwd).filter((c) => {
        const key = contactKey(c);
        return !key || !locks.has(key);
      });
    };

    const beforeHits = this.obstaclesHit;
    const beforeEvents = events?.length || 0;
    try {
      baseCollide.call(this, events);
    } finally {
      if (hadOwn) terrain.collidersNear = original;
      else delete terrain.collidersNear;
    }

    if (this.obstaclesHit <= beforeHits) return;

    // The physical hit itself still costs exactly one heart through RC5. This
    // grace only suppresses a second terrain hit during the recovery beat.
    this.__v1TerrainGrace = TERRAIN_GRACE;

    let hitEvent = null;
    for (let i = (events?.length || 0) - 1; i >= beforeEvents; i--) {
      if (events[i]?.t === 'hit') { hitEvent = events[i]; break; }
    }
    const collider = nearestHitCollider(this, vicinity, hitEvent);
    const key = contactKey(collider);
    if (key) locks.add(key);
  };
}

globalThis.__DASH_CONTACT = {
  version: '1.0-rc',
  oneHeartPerPhysicalContact: true,
  generatedPropsIncluded: true,
  terrainGraceSeconds: TERRAIN_GRACE,
  beastsIgnoreTerrainGrace: true,
};
