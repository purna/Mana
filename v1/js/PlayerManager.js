import * as THREE from 'three';
import { GameState } from './GameState.js';
import { config as gameConfig } from './config.js';

// Rotate a horizontal (x,z) vector around the Y axis by `angle` radians, then re-normalize.
function rotateHeadingY(vec, angle) {
  const cos = Math.cos(angle);
  const sin = Math.sin(angle);
  const x = vec.x * cos + vec.z * sin;
  const z = -vec.x * sin + vec.z * cos;
  vec.x = x;
  vec.z = z;
  vec.normalize();
}

export class PlayerManager {
  constructor(game) {
    this.game = game;
    this.player = null;
    this.animationTime = 0;
    this.dustEmitter = null;
    this.velocityY = 0;   // vertical velocity for jumping
    this.jumpOffset = 0;  // current height above the ground while airborne
    this.isJumping = false;
  }

  createPlayer() {
    const group = new THREE.Group();
    const robeColor = new THREE.Color(GameState.player.dressColor);
    const robeMat = new THREE.MeshStandardMaterial({ color: robeColor, roughness: 0.92, metalness: 0 });
    const robeDark = new THREE.MeshStandardMaterial({ color: robeColor.clone().multiplyScalar(0.68), roughness: 0.96 });
    const tunicMat = new THREE.MeshStandardMaterial({ color: robeColor.clone().offsetHSL(0, -0.06, 0.12), roughness: 0.9 });
    const sashMat = new THREE.MeshStandardMaterial({ color: 0x7a2f22, roughness: 0.85 });
    const skinMat = new THREE.MeshStandardMaterial({ color: GameState.player.headColor || 0x8a5a33, roughness: 0.86 });
    const hairMat = new THREE.MeshStandardMaterial({ color: 0x2a1a10, roughness: 1 });
    const woodMat = new THREE.MeshStandardMaterial({ color: 0x5a3a1d, roughness: 0.9 });
    const leatherMat = new THREE.MeshStandardMaterial({ color: 0x3a2413, roughness: 0.95 });
    const sandalMat = new THREE.MeshStandardMaterial({ color: 0x3d2817, roughness: 1 });

    const robe = new THREE.Mesh(new THREE.CylinderGeometry(0.30, 0.44, 0.98, 14, 1, false), robeMat);
    robe.position.y = 0.49;
    robe.castShadow = true;
    robe.receiveShadow = true;
    group.add(robe);
    const hem = new THREE.Mesh(new THREE.CylinderGeometry(0.445, 0.47, 0.10, 14), robeDark);
    hem.position.y = 0.05;
    hem.castShadow = true;
    group.add(hem);
    const hemTrim = new THREE.Mesh(new THREE.TorusGeometry(0.44, 0.025, 6, 18), new THREE.MeshStandardMaterial({ color: 0xb8862f, roughness: 0.6, metalness: 0.35 }));
    hemTrim.rotation.x = Math.PI / 2;
    hemTrim.position.y = 0.11;
    group.add(hemTrim);

    const torso = new THREE.Mesh(new THREE.CylinderGeometry(0.235, 0.31, 0.44, 12), tunicMat);
    torso.position.y = 1.08;
    torso.castShadow = true;
    group.add(torso);
    const mantle = new THREE.Mesh(new THREE.CylinderGeometry(0.27, 0.43, 0.26, 12, 1, true), robeDark);
    mantle.position.y = 1.21;
    mantle.castShadow = true;
    group.add(mantle);
    const belt = new THREE.Mesh(new THREE.CylinderGeometry(0.315, 0.315, 0.085, 14), sashMat);
    belt.position.y = 0.91;
    belt.castShadow = true;
    group.add(belt);
    const beltKnot = new THREE.Mesh(new THREE.IcosahedronGeometry(0.06, 0), sashMat);
    beltKnot.position.set(0.22, 0.88, 0.18);
    group.add(beltKnot);
    const pouch = new THREE.Mesh(new THREE.SphereGeometry(0.09, 7, 5), leatherMat);
    pouch.scale.set(1, 1.15, 0.65);
    pouch.position.set(-0.28, 0.8, 0.12);
    group.add(pouch);

    const neck = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.11, 0.13, 8), skinMat);
    neck.position.y = 1.31;
    group.add(neck);
    const head = new THREE.Mesh(new THREE.SphereGeometry(0.205, 14, 12), skinMat);
    head.position.y = 1.49;
    head.scale.set(1, 1.08, 0.94);
    head.castShadow = true;
    group.add(head);
    const nose = new THREE.Mesh(new THREE.ConeGeometry(0.045, 0.12, 5), skinMat);
    nose.position.set(0, 1.48, 0.195);
    nose.rotation.x = Math.PI / 2;
    group.add(nose);
    const eyeMat = new THREE.MeshStandardMaterial({ color: 0x1b120a, roughness: 0.35 });
    for (const side of [-1, 1]) {
      const eye = new THREE.Mesh(new THREE.SphereGeometry(0.028, 7, 5), eyeMat);
      eye.position.set(side * 0.075, 1.54, 0.175);
      group.add(eye);
      const brow = new THREE.Mesh(new THREE.BoxGeometry(0.075, 0.018, 0.03), hairMat);
      brow.position.set(side * 0.075, 1.585, 0.17);
      brow.rotation.z = side * -0.1;
      group.add(brow);
    }
    const beard = new THREE.Mesh(new THREE.ConeGeometry(0.145, 0.36, 7), hairMat);
    beard.position.set(0, 1.34, 0.16);
    beard.rotation.x = Math.PI;
    beard.scale.z = 0.72;
    beard.castShadow = true;
    group.add(beard);
    const moustache = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.025, 0.04), hairMat);
    moustache.position.set(0, 1.405, 0.19);
    group.add(moustache);

    const wrapMat = new THREE.MeshStandardMaterial({ color: 0x6b2f1a, roughness: 0.92 });
    const wrap = new THREE.Mesh(new THREE.CylinderGeometry(0.212, 0.235, 0.17, 12), wrapMat);
    wrap.position.y = 1.64;
    wrap.castShadow = true;
    group.add(wrap);
    const wrapTop = new THREE.Mesh(new THREE.SphereGeometry(0.215, 12, 8, 0, Math.PI * 2, 0, Math.PI * 0.55), wrapMat);
    wrapTop.position.y = 1.70;
    wrapTop.scale.y = 0.7;
    group.add(wrapTop);
    const wrapTail = new THREE.Mesh(new THREE.BoxGeometry(0.13, 0.38, 0.035), robeDark);
    wrapTail.position.set(0.05, 1.45, -0.18);
    wrapTail.rotation.x = 0.24;
    wrapTail.castShadow = true;
    group.add(wrapTail);

    const makeArm = (side) => {
      const arm = new THREE.Group();
      arm.position.set(side * 0.29, 1.23, 0);
      const upper = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.082, 0.34, 7), robeMat);
      upper.position.y = -0.17;
      upper.castShadow = true;
      arm.add(upper);
      const sleeve = new THREE.Mesh(new THREE.CylinderGeometry(0.105, 0.13, 0.20, 8, 1, true), robeDark);
      sleeve.position.y = -0.34;
      sleeve.castShadow = true;
      arm.add(sleeve);
      const forearm = new THREE.Mesh(new THREE.CylinderGeometry(0.047, 0.058, 0.28, 6), skinMat);
      forearm.position.y = -0.53;
      forearm.castShadow = true;
      arm.add(forearm);
      const hand = new THREE.Mesh(new THREE.SphereGeometry(0.065, 7, 6), skinMat);
      hand.position.y = -0.69;
      hand.castShadow = true;
      arm.add(hand);
      arm.rotation.z = side * 0.16;
      arm.rotation.x = side * -0.04;
      group.add(arm);
      return arm;
    };
    const leftArm = makeArm(-1);
    const rightArm = makeArm(1);

    const makeFoot = (side) => {
      const foot = new THREE.Group();
      foot.position.set(side * 0.135, 0.055, 0.10);
      const sole = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.045, 0.30), sandalMat);
      sole.castShadow = true;
      foot.add(sole);
      const strap = new THREE.Mesh(new THREE.BoxGeometry(0.15, 0.022, 0.035), leatherMat);
      strap.position.set(0, 0.035, 0.04);
      foot.add(strap);
      const ankle = new THREE.Mesh(new THREE.CylinderGeometry(0.055, 0.055, 0.07, 6), skinMat);
      ankle.position.set(0, 0.07, -0.06);
      foot.add(ankle);
      group.add(foot);
      return foot;
    };
    const leftFoot = makeFoot(-1);
    const rightFoot = makeFoot(1);

    const staff = new THREE.Group();
    const shaft = new THREE.Mesh(new THREE.CylinderGeometry(0.032, 0.045, 1.82, 7), woodMat);
    shaft.position.y = 0.91;
    shaft.castShadow = true;
    staff.add(shaft);
    for (const y of [0.55, 1.25]) {
      const band = new THREE.Mesh(new THREE.TorusGeometry(0.042, 0.012, 5, 12), leatherMat);
      band.rotation.x = Math.PI / 2;
      band.position.y = y;
      staff.add(band);
    }
    const staffHead = new THREE.Mesh(
      new THREE.OctahedronGeometry(0.105, 0),
      new THREE.MeshStandardMaterial({ color: 0xffd98a, emissive: 0x9a6218, emissiveIntensity: 0.9, roughness: 0.25, metalness: 0.4 })
    );
    staffHead.position.y = 1.95;
    staff.add(staffHead);
    const staffGlow = new THREE.PointLight(0xffc870, 0.45, 4.5, 2);
    staffGlow.position.y = 1.95;
    staff.add(staffGlow);
    staff.position.set(0.48, 0, 0.08);
    staff.rotation.z = -0.07;
    group.add(staff);

    const scarf = new THREE.Mesh(new THREE.BoxGeometry(0.13, 0.55, 0.035), robeDark);
    scarf.position.set(-0.32, 1.06, -0.10);
    scarf.rotation.z = 0.10;
    scarf.castShadow = true;
    group.add(scarf);

    group.userData = { leftFoot, rightFoot, staff, staffHead, head, beard, leftArm, rightArm };
    group.position.set(0, 0, 0);
    this.player = group;
    return this.player;
  }

  updatePlayerAppearance() {
    if (!this.player || !this.game) return;
    const oldPosition = this.player.position.clone();
    const oldRotation = this.player.quaternion.clone();

    // If dust trail is active, destroy it before replacing the player object
    if (this.dustEmitter) {
      this.game.particleManager.stopEmitter(this.dustEmitter, false);
      this.dustEmitter = null;
    }

    this.game.scene.remove(this.player);
    this.player = this.createPlayer();
    this.player.position.copy(oldPosition);
    this.player.quaternion.copy(oldRotation);
    this.game.scene.add(this.player);
    // Keep Game's player reference in sync — the camera and other systems read
    // `game.player`, so a stale reference here would make the camera follow the
    // old (removed) group instead of the visible one.
    this.game.player = this.player;
  }

  update() {
    if (!this.player) return;

    this.animationTime += this.game.frameScale;
    this.handleMovement();
    this.updateStamina();
    this.checkCollisions();
    this.animateBob();
    this.handleDustTrail();
    Object.assign(GameState.player.position, this.player.position);
  }

  updateStamina() {
    const cfg = gameConfig.survival || {};
    const dt = this.game.frameScale / 60;
    let stamina = GameState.player.stamina ?? 100;
    if (this.isSprinting && this.isMoving) {
      stamina -= (cfg.staminaDrain ?? 26) * dt;
    } else {
      stamina += (cfg.staminaRegen ?? 15) * dt;
    }
    GameState.player.stamina = Math.max(0, Math.min(100, stamina));
  }

  handleMovement() {
    const settings = this.game.getDifficultySettings();
    const heading = this.game.cameraHeading; // persistent horizontal facing (Vector3)
    const Y = new THREE.Vector3(0, 1, 0);

    const isMovingWithKeys = this.game.input.up || this.game.input.down || this.game.input.left || this.game.input.right;
    if (isMovingWithKeys) {
      // Steering: left/right yaw the heading at a controlled rate. This is stable (no
      // camera-relative feedback loop that made the view spin when strafing).
      const turn = gameConfig.player.turnSpeed * this.game.frameScale;
      if (this.game.input.left) rotateHeadingY(heading, turn);
      if (this.game.input.right) rotateHeadingY(heading, -turn);

      const moveDir = new THREE.Vector3();
      if (this.game.input.up) moveDir.add(heading);
      if (this.game.input.down) moveDir.sub(heading);

      // Face the heading when steering in place, otherwise face the move direction.
      const faceDir = moveDir.length() > 0 ? moveDir.clone().normalize() : heading.clone().normalize();
      const targetAngle = Math.atan2(faceDir.x, faceDir.z);
      const targetQuaternion = new THREE.Quaternion().setFromAxisAngle(Y, targetAngle);
      this.player.quaternion.slerp(targetQuaternion, gameConfig.player.rotateSpeed);

      if (moveDir.length() > 0) {
        moveDir.normalize();
        const canSprint = this.game.sprint && (GameState.player.stamina ?? 0) > (gameConfig.survival?.sprintMin ?? 8);
        const speed = settings.moveSpeed * (canSprint ? (gameConfig.survival?.sprintMultiplier ?? 1.6) : 1);
        this.isSprinting = !!canSprint;
        this.isMoving = true;
        this.player.position.add(moveDir.multiplyScalar(speed * this.game.frameScale));

        this.game.clickTarget = null;
        GameState.player.position.x = this.player.position.x;
        GameState.player.position.y = this.player.position.y;
        GameState.player.position.z = this.player.position.z;
        this.game.drainHealthFromMovement(settings);
      } else {
        this.isMoving = false;
        this.isSprinting = false;
      }

      this.game.cameraHeading.copy(heading).normalize();
    } else if (this.game.clickTarget) {
      this.isSprinting = false;
      this.isMoving = true;
      const clickDir = new THREE.Vector3().subVectors(this.game.clickTarget, this.player.position);
      clickDir.y = 0;
      const clickDist = clickDir.length();
      clickDir.y = 0;
      const canSprint = this.game.sprint && (GameState.player.stamina ?? 0) > (gameConfig.survival?.sprintMin ?? 8);
      this.isSprinting = !!canSprint;
      const step = Math.min(settings.moveSpeed * (canSprint ? (gameConfig.survival?.sprintMultiplier ?? 1.6) : 1) * this.game.frameScale, Math.hypot(clickDir.x, clickDir.z));
      if (clickDist > 0) clickDir.normalize();

      this.player.position.add(clickDir.multiplyScalar(step));
      const targetAngle = Math.atan2(clickDir.x, clickDir.z);
      const targetQuaternion = new THREE.Quaternion().setFromAxisAngle(Y, targetAngle);
      this.player.quaternion.slerp(targetQuaternion, gameConfig.player.rotateSpeed);
      this.game.cameraHeading.copy(clickDir);
      this.player.rotation.y = Math.atan2(clickDir.x, clickDir.z);
      if (clickDist <= step + 0.1) {
        this.game.clickTarget = null;
        this.isMoving = false;
        this.isSprinting = false;
      }
      this.game.drainHealthFromMovement(settings);
    } else {
      this.isSprinting = false;
      this.isMoving = false;
    }
  }

  jump() {
    if (this.isJumping) return; // ignore if already airborne
    this.isJumping = true;
    this.velocityY = gameConfig.player.jumpVelocity;
  }

  animateBob() {
    const t = this.animationTime;
    const isMoving = this.game.input.up || this.game.input.down || this.game.input.left || this.game.input.right || (this.game.clickTarget && this.player.position.distanceTo(this.game.clickTarget) > 0.2);

    // Calculate the desired Y position based on the actual rendered terrain mesh
    // (raycast, not the analytic noise function) so the player never floats or sinks
    // relative to what's visually on screen.
    const groundY = this.game.getSurfaceHeight(this.player.position.x, this.player.position.z);
    let bobOffset = 0;
    if (isMoving) {
      bobOffset = Math.sin(t * gameConfig.player.bob.speed) * gameConfig.player.bob.amount;
    } else {
      bobOffset = Math.sin(t * gameConfig.player.idle.speed) * gameConfig.player.idle.amount;
    }

    // Jump arc: integrate vertical velocity with gravity; land back on the ground.
    if (this.isJumping) {
      this.jumpOffset += this.velocityY * this.game.frameScale;
      this.velocityY -= gameConfig.player.gravity * this.game.frameScale;
      if (this.jumpOffset <= 0) {
        this.jumpOffset = 0;
        this.velocityY = 0;
        this.isJumping = false;
      }
    }

    this.player.position.y = groundY + 0.02 + this.jumpOffset + bobOffset; // feet rest on the surface

    // Simple contrapposto walk: feet and staff swing with the stride.
    const parts = this.player.userData || {};
    const stride = isMoving ? Math.sin(t * gameConfig.player.bob.speed * 1.8) : 0;
    if (parts.leftFoot) {
      parts.leftFoot.position.z = 0.15 + stride * 0.2;
      parts.leftFoot.position.y = 0.08 + Math.max(0, stride) * 0.07;
    }
    if (parts.rightFoot) {
      parts.rightFoot.position.z = 0.15 - stride * 0.2;
      parts.rightFoot.position.y = 0.08 + Math.max(0, -stride) * 0.07;
    }
    if (parts.staff) {
      parts.staff.rotation.x = stride * 0.12;
      parts.staff.position.y = Math.abs(stride) * 0.03;
    }
    if (parts.head) parts.head.rotation.z = stride * 0.04;
    if (parts.leftArm) {
      parts.leftArm.rotation.x = -stride * 0.45 + 0.04;
      parts.leftArm.rotation.z = -0.16;
    }
    if (parts.rightArm) {
      parts.rightArm.rotation.x = stride * 0.22 - 0.04;
      parts.rightArm.rotation.z = 0.16;
    }
  }

  handleDustTrail() {
    if (!this.game.particleManager) return;

    // Emit a trail while the player is walking OR airborne (jumping).
    const isWalking = this.game.input.up || this.game.input.down || this.game.input.left || this.game.input.right || this.game.clickTarget;
    const isMoving = isWalking || this.isJumping;

    if (isMoving && !this.dustEmitter) {
      // Player started moving / jumping, create the dust trail and attach it to the player model
      this.dustEmitter = this.game.particleManager.createEmitter('dust', this.player);
    } else if (!isMoving && this.dustEmitter) {
      // Player stopped, gracefully stop the emitter and clean up
      this.game.particleManager.stopEmitter(this.dustEmitter, true);
      this.dustEmitter = null;
    }
  }

  checkCollisions() {
    // Two passes let the player slide along overlapping rocks without oscillation.
    for (let pass = 0; pass < 2; pass++) {
      for (const collider of this.game.obstacleColliders) {
        const center = collider.getWorldPosition(new THREE.Vector3());
        const scale = collider.getWorldScale(new THREE.Vector3());
        const shape = collider.geometry.parameters;
        const radius = (shape.radius || Math.max(shape.radiusTop || 0, shape.radiusBottom || 0)) * Math.max(Math.abs(scale.x), Math.abs(scale.z)) + 0.45;
        if (!radius) continue;
        const dx = this.player.position.x - center.x;
        const dz = this.player.position.z - center.z;
        const distance = Math.hypot(dx, dz);
        if (distance >= radius) continue;
        const nx = distance > 0.0001 ? dx / distance : 1;
        const nz = distance > 0.0001 ? dz / distance : 0;
        this.player.position.x = center.x + nx * (radius + 0.005);
        this.player.position.z = center.z + nz * (radius + 0.005);
        if (this.game.clickTarget && Math.hypot(this.game.clickTarget.x - center.x, this.game.clickTarget.z - center.z) < radius) this.game.clickTarget = null;
      }
    }
  }
}
