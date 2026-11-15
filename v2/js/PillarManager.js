import * as THREE from 'three';

/**
 * PillarManager
 * -------------
 * The Pillar of Cloud by day and Fire by night. It stands over the next
 * station of the journey and visibly crosses the wilderness when the camp
 * moves on. It doubles as the player's compass landmark.
 */
export class PillarManager {
  constructor(game) {
    this.game = game;
    this.scene = game.scene;
    this.group = new THREE.Group();
    this.group.visible = false;
    this.scene.add(this.group);

    this.cloud = null;
    this.fire = null;
    this.light = null;
    this.halo = null;
    this.target = null;
    this.time = 0;
    this.daylight = 1;

    this._build();
  }

  _build() {
    // Ground halo — a soft ring that marks the place the pillar stands.
    const haloGeo = new THREE.RingGeometry(5.2, 8.4, 48);
    const haloMat = new THREE.MeshBasicMaterial({
      color: 0xffd98a, transparent: true, opacity: 0.28,
      side: THREE.DoubleSide, depthWrite: false, blending: THREE.AdditiveBlending,
    });
    this.halo = new THREE.Mesh(haloGeo, haloMat);
    this.halo.rotation.x = -Math.PI / 2;
    this.halo.position.y = 0.25;
    this.group.add(this.halo);

    // ---- Cloud by day -------------------------------------------------
    this.cloud = new THREE.Group();
    const cloudMat = new THREE.MeshBasicMaterial({
      color: 0xf6f1e4, transparent: true, opacity: 0.5, depthWrite: false,
    });
    this.cloudPuffs = [];
    const puffCount = 14;
    for (let i = 0; i < puffCount; i++) {
      const t = i / (puffCount - 1);
      const radius = 2.4 + Math.sin(t * Math.PI) * 2.8 + Math.random() * 1.6;
      const geo = new THREE.IcosahedronGeometry(radius, 1);
      const puff = new THREE.Mesh(geo, cloudMat.clone());
      const angle = Math.random() * Math.PI * 2;
      const spread = 1.8 + Math.sin(t * Math.PI) * 1.4;
      puff.position.set(
        Math.cos(angle) * spread,
        2.5 + t * 15 + Math.random() * 1.2,
        Math.sin(angle) * spread
      );
      puff.userData = {
        baseX: puff.position.x, baseZ: puff.position.z, baseY: puff.position.y,
        angle, speed: 0.18 + Math.random() * 0.22, bob: Math.random() * Math.PI * 2,
        baseRadius: radius,
      };
      this.cloud.add(puff);
      this.cloudPuffs.push(puff);
    }
    this.group.add(this.cloud);

    // ---- Fire by night ------------------------------------------------
    this.fire = new THREE.Group();
    const fireCoreGeo = new THREE.ConeGeometry(1.9, 13, 16, 1, true);
    const fireCoreMat = new THREE.MeshBasicMaterial({
      color: 0xffb347, transparent: true, opacity: 0.75,
      side: THREE.DoubleSide, depthWrite: false, blending: THREE.AdditiveBlending,
    });
    this.fireCore = new THREE.Mesh(fireCoreGeo, fireCoreMat);
    this.fireCore.position.y = 9;
    this.fire.add(this.fireCore);

    const fireInnerGeo = new THREE.ConeGeometry(0.9, 8, 12, 1, true);
    const fireInnerMat = new THREE.MeshBasicMaterial({
      color: 0xfff1b8, transparent: true, opacity: 0.9,
      side: THREE.DoubleSide, depthWrite: false, blending: THREE.AdditiveBlending,
    });
    this.fireInner = new THREE.Mesh(fireInnerGeo, fireInnerMat);
    this.fireInner.position.y = 6;
    this.fire.add(this.fireInner);

    // Rising flame tongues around the base.
    this.flames = [];
    for (let i = 0; i < 9; i++) {
      const geo = new THREE.ConeGeometry(0.45 + Math.random() * 0.5, 3 + Math.random() * 4, 6, 1, true);
      const mat = new THREE.MeshBasicMaterial({
        color: 0xff8a2a, transparent: true, opacity: 0.7,
        depthWrite: false, blending: THREE.AdditiveBlending,
      });
      const flame = new THREE.Mesh(geo, mat);
      const a = (i / 9) * Math.PI * 2;
      const r = 1.2 + Math.random() * 1.6;
      flame.position.set(Math.cos(a) * r, 1.8 + Math.random() * 4, Math.sin(a) * r);
      flame.userData = { angle: a, radius: r, speed: 1 + Math.random(), phase: Math.random() * Math.PI * 2, baseY: flame.position.y };
      this.fire.add(flame);
      this.flames.push(flame);
    }
    this.fire.visible = false;
    this.group.add(this.fire);

    this.light = new THREE.PointLight(0xffa347, 0, 46, 1.15);
    this.light.position.y = 6;
    this.group.add(this.light);

    // A tall, fog-ignoring shaft so the pillar can be seen across the desert.
    this.beam = new THREE.Mesh(
      new THREE.CylinderGeometry(1.1, 1.8, 44, 10, 1, true),
      new THREE.MeshBasicMaterial({
        color: 0xffe4a8, transparent: true, opacity: 0.13,
        side: THREE.DoubleSide, depthWrite: false,
        blending: THREE.AdditiveBlending, fog: false,
      })
    );
    this.beam.position.y = 22;
    this.group.add(this.beam);
  }

  setVisible(visible) {
    this.group.visible = visible;
  }

  setTarget(target, snap = false) {
    this.target = target;
    if (!target) return;
    this.setVisible(true);
    if (snap) {
      this.group.position.set(target.x, target.y, target.z);
    }
  }

  update(dt, daylightFactor = 1) {
    if (!this.group.visible) return;
    this.time += dt;
    this.daylight = daylightFactor;

    if (this.target) {
      // The pillar glides across the desert rather than teleporting.
      const dx = this.target.x - this.group.position.x;
      const dz = this.target.z - this.group.position.z;
      const distance = Math.hypot(dx, dz);
      const k = Math.min(1, (1.5 + distance * 0.04) * dt);
      this.group.position.x += dx * k;
      this.group.position.z += dz * k;
      this.group.position.y += (this.target.y - this.group.position.y) * Math.min(1, 5 * dt);
    }

    // 1 = full day, 0 = night. Blend cloud and fire around dusk.
    const fireAmount = Math.max(0, Math.min(1, (0.62 - daylightFactor) / 0.32));
    const cloudAmount = 1 - fireAmount;

    this.cloud.visible = cloudAmount > 0.03;
    this.fire.visible = fireAmount > 0.03;
    if (this.cloud.visible) {
      for (const puff of this.cloudPuffs) {
        const d = puff.userData;
        const a = d.angle + this.time * d.speed;
        puff.position.x = d.baseX + Math.cos(a) * 0.7;
        puff.position.z = d.baseZ + Math.sin(a) * 0.7;
        puff.position.y = d.baseY + Math.sin(this.time * d.speed * 1.4 + d.bob) * 0.5;
        puff.material.opacity = 0.42 * cloudAmount;
      }
      this.cloud.rotation.y = this.time * 0.08;
    }
    if (this.fire.visible) {
      const flicker = 0.82 + Math.sin(this.time * 9.3) * 0.1 + Math.sin(this.time * 17.1) * 0.06;
      this.fireCore.material.opacity = 0.62 * fireAmount * flicker;
      this.fireInner.material.opacity = 0.9 * fireAmount * flicker;
      this.fireCore.scale.set(1 + Math.sin(this.time * 6) * 0.08, 1 + Math.sin(this.time * 7.7) * 0.13, 1);
      this.fireInner.scale.set(1 + Math.sin(this.time * 8.3) * 0.12, 1 + Math.sin(this.time * 11) * 0.16, 1);
      for (const flame of this.flames) {
        const d = flame.userData;
        flame.position.y = d.baseY + Math.sin(this.time * d.speed * 2 + d.phase) * 0.7;
        flame.scale.y = 1 + Math.sin(this.time * d.speed * 3 + d.phase) * 0.35;
        flame.material.opacity = 0.5 * fireAmount * flicker;
      }
      this.light.intensity = 4.2 * fireAmount * flicker;
      this.light.color.setHex(0xffa347);
    } else {
      this.light.intensity = 0;
    }

    // The distant shaft keeps the pillar visible through fog, but fades out
    // when the player is standing at the station so it never whites out the view.
    if (this.beam) {
      const player = this.game?.player;
      const dist = player ? Math.hypot(player.position.x - this.group.position.x, player.position.z - this.group.position.z) : 100;
      const nearFade = Math.max(0, Math.min(1, (dist - 16) / 54));
      const base = 0.035 + 0.035 * cloudAmount + 0.03 * fireAmount + Math.sin(this.time * 1.2) * 0.008;
      this.beam.material.opacity = base * nearFade;
      this.beam.material.color.setHex(fireAmount > 0.5 ? 0xffa347 : 0xffe4a8);
      this.beam.rotation.y = this.time * 0.15;
      this.beam.visible = nearFade > 0.02;
    }

    // Halo breathes and shifts with the pillar's nature.
    const pulse = 1 + Math.sin(this.time * 1.6) * 0.06;
    this.halo.scale.set(pulse, pulse, 1);
    this.halo.material.opacity = (0.16 + 0.12 * fireAmount) * Math.max(0.25, dayLightClamp(daylightFactor));
    this.halo.material.color.setHex(fireAmount > 0.5 ? 0xff8a2a : 0xffe4a8);
  }

  /** A soft beam of light visible from far away during the day. */
  getBearingPosition() {
    return this.group.position;
  }
}

function dayLightClamp(f) {
  return Math.max(0.35, Math.min(1, f));
}
