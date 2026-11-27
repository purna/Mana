import * as THREE from 'three';
import { config as gameConfig } from './config.js';

function createTextSprite(text, options = {}) {
  const fontSize = options.fontSize || 64;
  const fontFamily = options.fontFamily || 'Cinzel, serif';
  const color = options.color || '#3b2a16';
  const outlineColor = options.outlineColor || '#f1e3bf';
  const outlineWidth = options.outlineWidth || 4;
  const strokeColor = options.strokeColor || '#5a3f22';
  const strokeWidth = options.strokeWidth || 2;

  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d');
  ctx.font = `${fontSize}px ${fontFamily}`;
  const metrics = ctx.measureText(text);
  const padding = outlineWidth + strokeWidth + 10;
  canvas.width = Math.ceil(metrics.width) + padding * 2;
  canvas.height = fontSize + padding * 2;

  ctx.font = `${fontSize}px ${fontFamily}`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';

  if (outlineWidth > 0) {
    ctx.strokeStyle = outlineColor;
    ctx.lineWidth = outlineWidth * 2;
    ctx.lineJoin = 'round';
    ctx.strokeText(text, canvas.width / 2, canvas.height / 2);
  }

  if (strokeWidth > 0) {
    ctx.strokeStyle = strokeColor;
    ctx.lineWidth = strokeWidth * 2;
    ctx.lineJoin = 'round';
    ctx.globalAlpha = 0.8;
    ctx.strokeText(text, canvas.width / 2, canvas.height / 2);
    ctx.globalAlpha = 1;
  }

  ctx.fillStyle = color;
  ctx.fillText(text, canvas.width / 2, canvas.height / 2);

  const texture = new THREE.CanvasTexture(canvas);
  texture.minFilter = THREE.LinearFilter;
  const material = new THREE.SpriteMaterial({ map: texture, transparent: true });
  const sprite = new THREE.Sprite(material);
  const scale = options.scale || 4;
  sprite.scale.set(scale * (canvas.width / canvas.height), scale, 1);
  return sprite;
}

function contactShadow(radius = 0.6, opacity = 0.2) {
  const shadow = new THREE.Mesh(
    new THREE.CircleGeometry(radius, 16),
    new THREE.MeshBasicMaterial({ color: 0x1a1008, transparent: true, opacity, depthWrite: false })
  );
  shadow.rotation.x = -Math.PI / 2;
  shadow.position.y = 0.035;
  shadow.renderOrder = 1;
  return shadow;
}

function groundAnchor(object, offset = 0) {
  if (!object) return object;
  object.userData = object.userData || {};
  object.userData.groundAnchored = true;
  object.userData.groundOffset = offset;
  return object;
}

export class SceneManager {
  constructor(game) {
    this.game = game;
  }

  createLandscape() {
    const locations = [
      { name: 'Camp', pos: [20, 0, -20], color: 0x5a2d0c },
      { name: 'Oasis', pos: [-25, 0, -15], color: 0x115511 },
      { name: 'Split Rock', pos: [0, 0, 25], color: 0x555555 },
      { name: 'Temple', pos: [-20, 0, 20], color: 0x997300 },
      { name: 'Wilderness', pos: [25, 0, 15], color: 0x5a4a35 },
    ];

    locations.forEach((loc) => {
      const locY = this.game.getSurfaceHeight(loc.pos[0], loc.pos[2]);

      const markerGeometry = new THREE.CylinderGeometry(1.5, 1.5, 0.3, 8);
      const markerMaterial = new THREE.MeshLambertMaterial({
        color: loc.color,
        emissive: loc.color,
        emissiveIntensity: 0.3,
      });
      const marker = new THREE.Mesh(markerGeometry, markerMaterial);
      marker.position.set(loc.pos[0], locY + 0.15, loc.pos[2]);
      groundAnchor(marker, 0.15);
      this.game.scenery.push(marker);
      this.game.scene.add(marker);

      const flagGroup = this.createLocationFlag(loc.name, loc.pos[0], locY, loc.pos[2]);
      flagGroup.visible = false;
      Object.assign(flagGroup.userData, { targetX: loc.pos[0], targetZ: loc.pos[2], radius: 12 });

      this.game.scene.add(flagGroup);
      this.game.locationSprites.push(flagGroup);
      if (loc.name === 'Oasis' && this.game.particleManager) {
        this.game.particleManager.createEmitter('oasis', new THREE.Vector3(loc.pos[0], locY + 0.3, loc.pos[2]));
      }

      if (loc.name === 'Camp') {
        const groundAt = (x, z) => this.game.getSurfaceHeight(x, z);
        const fireX = loc.pos[0] + 2;
        const fireZ = loc.pos[2] - 2;
        this.createCampfire(fireX, groundAt(fireX, fireZ), fireZ);
        // Add some tents and market stalls, each grounded at its own position.
        const tent1X = loc.pos[0] - 2;
        const tent1Z = loc.pos[2] + 1;
        this.createTent(tent1X, groundAt(tent1X, tent1Z), tent1Z, Math.PI / 4);
        const tent2X = loc.pos[0] + 1;
        const tent2Z = loc.pos[2] + 3;
        this.createTent(tent2X, groundAt(tent2X, tent2Z), tent2Z, -Math.PI / 3);
        const stall1X = loc.pos[0] + 4;
        const stall1Z = loc.pos[2];
        this.createMarketStall(stall1X, groundAt(stall1X, stall1Z), stall1Z, -Math.PI / 2);
        const stall2X = loc.pos[0] + 4;
        const stall2Z = loc.pos[2] + 2.5;
        this.createMarketStall(stall2X, groundAt(stall2X, stall2Z), stall2Z, -Math.PI / 2);
        this.createCampPeople(loc.pos[0], loc.pos[2], 14);

        if (this.game.particleManager) {
          const marketPosition = new THREE.Vector3(stall1X, groundAt(stall1X, stall1Z) + 2.2, stall1Z + 1.25);
          this.game.particleManager.createEmitter('confetti', marketPosition);
        }
      } else if (loc.name === 'Split Rock') {
        this.createSplitRock(loc.pos[0], locY, loc.pos[2]);
      } else if (loc.name === 'Temple') {
        this.createTemple(loc.pos[0], locY, loc.pos[2]);
      } else {
        // Generic scenery for Oasis and Wilderness
        for (let i = 0; i < 9; i++) {
          const angle = Math.random() * Math.PI * 2;
          const dist = 3 + Math.random() * 5;
          const itemX = loc.pos[0] + Math.cos(angle) * dist;
          const itemZ = loc.pos[2] + Math.sin(angle) * dist;
          if (this.game.isWaterAt?.(itemX, itemZ)) continue;
          const itemY = this.game.getSurfaceHeight(itemX, itemZ);

          const roll = Math.random();
          if (roll < 0.45) {
            this.createRock(itemX, itemY, itemZ);
          } else if (roll < 0.75) {
            this.createRoundTree(itemX, itemY, itemZ);
          } else {
            this.createPalmTree(itemX, itemY, itemZ);
          }
        }
      }
    });

    this.scatterRocks();
  }

  createLocationFlag(name, x, y, z) {
    const group = new THREE.Group();

    // Pole
    const poleGeometry = new THREE.CylinderGeometry(0.09, 0.12, 7.5, 8);
    const poleMaterial = new THREE.MeshLambertMaterial({ color: 0x5a3f22 });
    const pole = new THREE.Mesh(poleGeometry, poleMaterial);
    pole.position.y = 3.75;
    pole.castShadow = true;
    group.add(pole);

    // Gold finial
    const finialGeometry = new THREE.SphereGeometry(0.22, 8, 8);
    const finialMaterial = new THREE.MeshLambertMaterial({ color: 0xb8862f, emissive: 0x6b4f1a, emissiveIntensity: 0.25 });
    const finial = new THREE.Mesh(finialGeometry, finialMaterial);
    finial.position.y = 7.6;
    finial.castShadow = true;
    group.add(finial);

    // Parchment banner canvas texture
    const canvas = document.createElement('canvas');
    canvas.width = 512;
    canvas.height = 320;
    const ctx = canvas.getContext('2d');

    ctx.fillStyle = '#e8d4a3';
    ctx.fillRect(0, 0, 512, 320);
    const grd = ctx.createRadialGradient(256, 110, 40, 256, 160, 320);
    grd.addColorStop(0, 'rgba(255,248,220,0.55)');
    grd.addColorStop(1, 'rgba(120,80,30,0.25)');
    ctx.fillStyle = grd;
    ctx.fillRect(0, 0, 512, 320);

    ctx.strokeStyle = '#5a3f22';
    ctx.lineWidth = 10;
    ctx.strokeRect(10, 10, 492, 300);
    ctx.strokeStyle = '#b8862f';
    ctx.lineWidth = 3;
    ctx.strokeRect(22, 22, 468, 276);

    ctx.fillStyle = '#3b2a16';
    ctx.font = 'bold 70px "Cinzel", Georgia, serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(name, 256, 160);

    ctx.strokeStyle = '#7a2118';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(70, 210);
    ctx.lineTo(442, 210);
    ctx.stroke();

    const texture = new THREE.CanvasTexture(canvas);

    // Cloth-style flag mesh, segmented so it can ripple like a waving flag
    const flagWidth = 3.6;
    const flagHeight = 2.3;
    const flagGeometry = new THREE.PlaneGeometry(flagWidth, flagHeight, 16, 10);
    const flagMaterial = new THREE.MeshLambertMaterial({
      map: texture,
      side: THREE.DoubleSide,
    });
    const flagMesh = new THREE.Mesh(flagGeometry, flagMaterial);
    flagMesh.position.set(flagWidth / 2 + 0.12, 6.0, 0);
    flagMesh.castShadow = true;
    flagMesh.userData.basePositions = Float32Array.from(flagGeometry.attributes.position.array);
    flagMesh.userData.waveSeed = Math.random() * 100;
    group.add(flagMesh);

    group.position.set(x, y, z);
    groundAnchor(group, 0);
    // Face roughly toward the camp center so flags read naturally in the world
    group.rotation.y = Math.atan2(-x, -z);

    group.userData.flagMesh = flagMesh;
    group.userData.name = name;
    return group;
  }

  createCampfire(x, y, z) {
    const firePitGroup = new THREE.Group();
    firePitGroup.position.set(x, y, z);
    groundAnchor(firePitGroup, 0);

    // Create some rocks for the fire pit
    const rockMaterial = new THREE.MeshLambertMaterial({ color: 0x4a3a25 });
    for (let i = 0; i < 8; i++) {
      const angle = (i / 8) * Math.PI * 2;
      const rockRadius = 0.7;
      const rockX = Math.cos(angle) * rockRadius;
      const rockZ = Math.sin(angle) * rockRadius;
      const rockSize = 0.2 + Math.random() * 0.15;
      const rockGeometry = new THREE.IcosahedronGeometry(rockSize, 0);
      const rock = new THREE.Mesh(rockGeometry, rockMaterial);
      rock.position.set(rockX, rockSize * 0.4, rockZ);
      rock.rotation.set(Math.random() * Math.PI, Math.random() * Math.PI, Math.random() * Math.PI);
      rock.castShadow = true;
      firePitGroup.add(rock);
    }

    // Create some logs
    const logMaterial = new THREE.MeshLambertMaterial({ color: 0x3a230e });
    const logGeometry = new THREE.CylinderGeometry(0.08, 0.08, 1.0, 5);

    const log1 = new THREE.Mesh(logGeometry, logMaterial);
    log1.position.y = 0.1;
    log1.rotation.set(0.2, Math.PI / 4, Math.PI / 2);
    log1.castShadow = true;
    firePitGroup.add(log1);

    const log2 = new THREE.Mesh(logGeometry, logMaterial);
    log2.position.y = 0.2;
    log2.rotation.set(-0.2, -Math.PI / 3, Math.PI / 2);
    log2.castShadow = true;
    firePitGroup.add(log2);

    this.game.scenery.push(firePitGroup);
    this.game.scene.add(firePitGroup);

    // Add particle effects for smoke, embers, and the flames themselves
    const firePosition = new THREE.Vector3(x, y + 0.2, z);
    if (this.game.particleManager) {
      this.game.particleManager.createEmitter('smoke', firePosition);
      this.game.particleManager.createEmitter('embers', firePosition);
      this.game.particleManager.createEmitter('campfire', firePosition);
    }
  }

  animateFlagWave(flagMesh, time) {
    if (!flagMesh || !flagMesh.geometry || !flagMesh.userData.basePositions) return;

    const geometry = flagMesh.geometry;
    const posAttr = geometry.attributes.position;
    const base = flagMesh.userData.basePositions;
    const seed = flagMesh.userData.waveSeed;
    const halfWidth = geometry.parameters.width / 2;

    for (let i = 0; i < posAttr.count; i++) {
      const bx = base[i * 3];
      const by = base[i * 3 + 1];
      // 0 at the pole edge, 1 at the free-flying edge
      const ratio = (bx + halfWidth) / (halfWidth * 2);
      const wave = Math.sin(time * 0.06 + seed + bx * 1.6 + by * 0.6) * 0.22 * ratio
        + Math.sin(time * 0.1 + seed * 1.7 + bx * 0.8) * 0.08 * ratio;
      posAttr.setZ(i, wave);
      posAttr.setY(i, by - ratio * 0.04 * Math.sin(time * 0.04 + seed));
    }
    posAttr.needsUpdate = true;
    geometry.computeVertexNormals();
  }

  createRock(x, y, z, sizeOverride) {
    const sizeRoll = Math.random();
    let rockSize;
    if (sizeOverride) {
      rockSize = sizeOverride;
    } else if (sizeRoll < 0.4) {
      rockSize = 0.2 + Math.random() * 0.25; // pebble
    } else if (sizeRoll < 0.8) {
      rockSize = 0.5 + Math.random() * 0.5; // medium
    } else {
      rockSize = 1.1 + Math.random() * 0.9; // boulder
    }
    const rockColors = [0x4a3a25, 0x6b5a42, 0x5c4a32, 0x3a3a3a];
    const rockGeometry = new THREE.IcosahedronGeometry(rockSize, 1);
    const rockMaterial = new THREE.MeshStandardMaterial({
      color: 0xffffff, // Use white and tint with vertex colors
      vertexColors: true,
    });
    const rock = new THREE.Mesh(rockGeometry, rockMaterial);
    rock.position.set(x, y + rockSize * 0.45, z);
    groundAnchor(rock, rockSize * 0.45);
    rock.rotation.set(Math.random() * Math.PI, Math.random() * Math.PI, Math.random() * Math.PI);
    rock.scale.y *= 0.7 + Math.random() * 0.3;
    rock.castShadow = true;
    rock.receiveShadow = true;
    this.game.scenery.push(rock);
    this.game.scene.add(rock);

    // Add vertex colors to the rock for variation
    const baseColor = new THREE.Color(rockColors[Math.floor(Math.random() * rockColors.length)]);
    const colors = [];
    for (let i = 0; i < rockGeometry.attributes.position.count; i++) {
      const c = baseColor.clone().multiplyScalar(0.8 + Math.random() * 0.4);
      colors.push(c.r, c.g, c.b);
    }
    rockGeometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));

    const colliderGeometry = new THREE.SphereGeometry(rockSize * 0.6, 8, 8);
    const colliderMaterial = new THREE.MeshBasicMaterial({ visible: false });
    const collider = new THREE.Mesh(colliderGeometry, colliderMaterial);
    collider.position.copy(rock.position);
    collider.userData.isCollider = true;
    groundAnchor(collider, rockSize * 0.45);
    this.game.scene.add(collider);
    this.game.obstacleColliders.push(collider);

    return rock;
  }
    

  createRoundTree(x, y, z) {
    const trunkGeometry = new THREE.CylinderGeometry(0.2, 0.3, 2, 8);
    const trunkMaterial = new THREE.MeshLambertMaterial({ color: 0x4a2306 });
    const trunk = new THREE.Mesh(trunkGeometry, trunkMaterial);
    trunk.position.set(x, y + 1, z);
    trunk.castShadow = true;
    groundAnchor(trunk, 1);
    this.game.scenery.push(trunk);
    this.game.scene.add(trunk);

    const foliageGeometry = new THREE.SphereGeometry(1, 8, 8);
    const foliageMaterial = new THREE.MeshLambertMaterial({ color: 0x115511 });
    const foliage = new THREE.Mesh(foliageGeometry, foliageMaterial);
    foliage.position.set(x, y + 2, z);
    foliage.castShadow = true;
    groundAnchor(foliage, 2);
    this.game.scenery.push(foliage);
    this.game.scene.add(foliage);

    const treeColliderGeometry = new THREE.CylinderGeometry(0.8, 0.8, 2.5, 8);
    const treeColliderMaterial = new THREE.MeshBasicMaterial({ visible: false });
    const treeCollider = new THREE.Mesh(treeColliderGeometry, treeColliderMaterial);
    treeCollider.position.set(x, y + 1.25, z);
    treeCollider.userData.isCollider = true;
    groundAnchor(treeCollider, 1.25);
    this.game.scene.add(treeCollider);
    this.game.obstacleColliders.push(treeCollider);
  }

  createPalmTree(x, y, z) {
    const group = new THREE.Group();
    const lean = (Math.random() - 0.5) * 0.25;

    const trunkGeometry = new THREE.CylinderGeometry(0.12, 0.25, 3.2, 6);
    const trunkMaterial = new THREE.MeshLambertMaterial({ color: 0x6b4423 });
    const trunk = new THREE.Mesh(trunkGeometry, trunkMaterial);
    trunk.position.y = 1.6;
    trunk.rotation.z = lean;
    trunk.castShadow = true;
    group.add(trunk);

    const frondMaterial = new THREE.MeshLambertMaterial({ color: 0x2d6a1f, side: THREE.DoubleSide });
    const frondCount = 6;
    for (let i = 0; i < frondCount; i++) {
      const frondGeometry = new THREE.ConeGeometry(0.35, 2.2, 4, 1, true);
      const frond = new THREE.Mesh(frondGeometry, frondMaterial);
      const a = (Math.PI * 2 * i) / frondCount;
      frond.position.set(Math.sin(lean) * 3.2, 3.15, 0);
      frond.rotation.z = Math.PI / 2 + Math.sin(a) * 0.9 + lean;
      frond.rotation.y = a;
      frond.castShadow = true;
      group.add(frond);
    }

    group.position.set(x, y, z);
    group.rotation.y = Math.random() * Math.PI * 2;
    groundAnchor(group, 0);
    this.game.scenery.push(group);
    this.game.scene.add(group);

    const palmColliderGeometry = new THREE.CylinderGeometry(0.5, 0.5, 3.5, 6);
    const palmColliderMaterial = new THREE.MeshBasicMaterial({ visible: false });
    const palmCollider = new THREE.Mesh(palmColliderGeometry, palmColliderMaterial);
    palmCollider.position.set(x, y + 1.75, z);
    palmCollider.userData.isCollider = true;
    groundAnchor(palmCollider, 1.75);
    this.game.scene.add(palmCollider);
    this.game.obstacleColliders.push(palmCollider);
  }

  scatterRocks() {
    for (let i = 0; i < 28; i++) {
      const angle = Math.random() * Math.PI * 2;
      const dist = 8 + Math.random() * 40;
      const x = Math.cos(angle) * dist;
      const z = Math.sin(angle) * dist;
      if (this.game.isWaterAt?.(x, z)) continue;
      const y = this.game.getSurfaceHeight(x, z);
      this.createRock(x, y, z);
    }
  }

createBirds() {
    const birdCount = gameConfig.scene.birds.count.min + Math.floor(Math.random() * (gameConfig.scene.birds.count.max - gameConfig.scene.birds.count.min + 1));
    for (let i = 0; i < birdCount; i++) {
      const birdGroup = new THREE.Group();
      const wingGeometry = new THREE.BoxGeometry(2, 0.2, 0.5);
      const wingMaterial = new THREE.MeshLambertMaterial({ color: 0x111111 });
      const wings = new THREE.Mesh(wingGeometry, wingMaterial);
      birdGroup.add(wings);

      const bodyGeometry = new THREE.SphereGeometry(0.3, 6, 6);
      const bodyMaterial = new THREE.MeshLambertMaterial({ color: 0x050505 });
      const body = new THREE.Mesh(bodyGeometry, bodyMaterial);
      body.scale.set(1, 0.8, 0.6);
      birdGroup.add(body);

      const startX = (Math.random() - 0.5) * 100;
      const startZ = (Math.random() - 0.5) * 100;
      const baseHeight = gameConfig.scene.birds.flightHeight.min + Math.random() * (gameConfig.scene.birds.flightHeight.max - gameConfig.scene.birds.flightHeight.min);
      birdGroup.position.set(startX, baseHeight, startZ);

      // Give each bird its own gentle random heading and flight rhythm
      const heading = Math.random() * Math.PI * 2;
      const speed = gameConfig.scene.birds.speed.min + Math.random() * (gameConfig.scene.birds.speed.max - gameConfig.scene.birds.speed.min);
      birdGroup.userData.vx = Math.sin(heading) * speed;
      birdGroup.userData.vz = Math.cos(heading) * speed;
      birdGroup.userData.baseHeight = baseHeight;
      birdGroup.userData.wingRotation = Math.random() * Math.PI * 2;
      birdGroup.userData.flapSpeed = 8 + Math.random() * 6;
      birdGroup.userData.bobSpeed = 0.4 + Math.random() * 0.3;
      birdGroup.userData.turnSeed = Math.random() * 1000;
      birdGroup.userData.wings = wings;

      this.game.scene.add(birdGroup);
      this.game.birds.push(birdGroup);
    }
  }

  /**
   * Animate the flock of birds: gentle wandering flight, wing flapping, and a slow bob.
   * @param {number} deltaTime - Seconds since the last frame.
   */
  updateBirds(deltaTime) {
    const bounds = gameConfig.scene.birds.bounds;
    const frameScale = deltaTime * 60;
    this.game.birds.forEach((bird) => {
      const data = bird.userData;

      // Occasionally drift the heading so birds wander instead of flying dead straight
      const driftAngle = Math.sin(this.game.animationTime * gameConfig.scene.birds.turn.speed + data.turnSeed) * gameConfig.scene.birds.turn.amount;
      const speed = Math.hypot(data.vx, data.vz);
      const currentHeading = Math.atan2(data.vx, data.vz) + driftAngle * frameScale;
      data.vx = Math.sin(currentHeading) * speed;
      data.vz = Math.cos(currentHeading) * speed;

      bird.position.x += data.vx * frameScale;
      bird.position.z += data.vz * frameScale;

      // Wrap around when a bird flies past the edge of the flyable area
      if (bird.position.x > bounds) bird.position.x = -bounds;
      if (bird.position.x < -bounds) bird.position.x = bounds;
      if (bird.position.z > bounds) bird.position.z = -bounds;
      if (bird.position.z < -bounds) bird.position.z = bounds;

      // Face the direction of travel
      bird.rotation.y = Math.atan2(data.vx, data.vz);

      // Flap wings and bob gently up and down
      data.wingRotation += deltaTime * data.flapSpeed;
      if (data.wings) {
        data.wings.rotation.z = Math.sin(data.wingRotation) * gameConfig.scene.birds.flapAmount;
      }
      bird.position.y = data.baseHeight + Math.sin(data.wingRotation * data.bobSpeed) * gameConfig.scene.birds.bobAmount;
    });
  }

  findClearPosition(x, z) {
    for (let attempt = 0; attempt < 100; attempt++) {
      const radius = attempt * 0.55;
      const angle = attempt * 2.399963;
      const px = x + Math.cos(angle) * radius;
      const pz = z + Math.sin(angle) * radius;
      const blocked = this.game.obstacleColliders.some(c => {
        const shape = c.geometry.parameters;
        const r = (shape.radius || Math.max(shape.radiusTop || 0, shape.radiusBottom || 0)) * Math.max(Math.abs(c.scale.x), Math.abs(c.scale.z)) + 1.8;
        return Math.hypot(px - c.position.x, pz - c.position.z) < r;
      });
      if (!blocked && !this.game.isWaterAt?.(px, pz)) return [px, pz];
    }
    return [100 + Math.random() * 10, 100 + Math.random() * 10];
  }

  spawnPickups() {
    const settings = this.game.getDifficultySettings();
    // Manna falls around the camp's current position, not the map origin, so
    // the gathering loop keeps working at every station of the journey.
    const center = this.game.player?.position || { x: 0, z: 0 };
    for (let i = 0; i < settings.manaCount; i++) {
      const angle = (Math.PI * 2 * i) / settings.manaCount + Math.random() * 0.4;
      const distance = 10 + Math.random() * 22;
      const [px, pz] = this.findClearPosition(center.x + Math.cos(angle) * distance, center.z + Math.sin(angle) * distance);
      const py = this.game.getSurfaceHeight(px, pz) + gameConfig.scene.manaPickup.bobOffset;

      const mana = this.createManaPickup(px, py, pz);
      this.game.scene.add(mana);
      this.game.manaPickups.push(mana);
    }

    // Health-recovery collectibles at sacred places (see config.healthCollectibles).
    this.spawnHealthPickups('water', this.game.waterPickups);
    this.spawnHealthPickups('rest', this.game.restPickups);
  }

  /**
   * Move the day's existing manna so it lies around the camp's new position.
   * Used when the pillar leads the camp onward; keeps the count (and balance)
   * identical instead of spawning an extra harvest.
   */
  relocateManna(center) {
    const pickups = this.game.manaPickups || [];
    if (!center || !pickups.length) return;
    pickups.forEach((pickup, i) => {
      const angle = (Math.PI * 2 * i) / pickups.length + Math.random() * 0.5;
      const distance = 11 + Math.random() * 20;
      const [px, pz] = this.findClearPosition(center.x + Math.cos(angle) * distance, center.z + Math.sin(angle) * distance);
      pickup.position.set(px, this.game.getSurfaceHeight(px, pz) + gameConfig.scene.manaPickup.bobOffset, pz);
    });
  }

  spawnHealthPickups(type, targetArray) {
    const cfg = gameConfig.gameplay.healthCollectibles[type];
    if (!cfg) return;
    const loc = this.game.locationSprites.find((s) => s.userData.name === cfg.location);
    if (!loc) return;
    const cx = loc.userData.targetX;
    const cz = loc.userData.targetZ;
    for (let i = 0; i < cfg.count; i++) {
      const angle = Math.random() * Math.PI * 2;
      const dist = 2 + Math.random() * cfg.spawnRadius;
      const [px, pz] = this.findClearPosition(cx + Math.cos(angle) * dist, cz + Math.sin(angle) * dist);
      const py = this.game.getSurfaceHeight(px, pz) + gameConfig.scene.manaPickup.bobOffset;
      const pickup = type === 'water'
        ? this.createWaterPickup(px, py, pz)
        : this.createRestPickup(px, py, pz);
      this.game.scene.add(pickup);
      targetArray.push(pickup);
    }
  }

  createManaPickup(x, y, z) {
    const geometry = new THREE.OctahedronGeometry(0.5, 0);
    const material = new THREE.MeshPhongMaterial({ color: 0xffffff, emissive: 0xeeeeff });
    const mana = new THREE.Mesh(geometry, material);
    // Manna falls from the sky at dawn, then settles into its bob.
    mana.position.set(x, y + 14 + Math.random() * 12, z);
    mana.castShadow = true;
    mana.userData = {
      isPickup: true,
      drop: true,
      points: 1,
      sickness: 5,
      vx: (Math.random() - 0.5) * 0.02,
      vz: (Math.random() - 0.5) * 0.02,
    };
    return mana;
  }

  createWaterPickup(x, y, z) {
    // A small blue droplet — health restored at the Split Rock (waters from the rock).
    const geometry = new THREE.SphereGeometry(0.42, 12, 12);
    const material = new THREE.MeshPhongMaterial({ color: 0x3fb6ff, emissive: 0x1c6fb0, emissiveIntensity: 0.6 });
    const drop = new THREE.Mesh(geometry, material);
    drop.position.set(x, y, z);
    drop.userData = { isHealthPickup: true, type: 'water' };
    return drop;
  }

  createRestPickup(x, y, z) {
    // A small green gem — rest restored at the Temple.
    const geometry = new THREE.OctahedronGeometry(0.45, 0);
    const material = new THREE.MeshPhongMaterial({ color: 0x8be36b, emissive: 0x3f8f2c, emissiveIntensity: 0.6 });
    const rest = new THREE.Mesh(geometry, material);
    rest.position.set(x, y, z);
    rest.userData = { isHealthPickup: true, type: 'rest' };
    return rest;
  }

  createTile(centerX, centerZ) {
    const size = this.game.TILE_SIZE;
    const segments = 80;
    const geometry = new THREE.PlaneGeometry(size, size, segments, segments);
    const posAttr = geometry.getAttribute('position');
    const heights = [];
    let maxH = -Infinity,
      minH = Infinity;

    for (let i = 0; i < posAttr.count; i++) {
      const localX = posAttr.getX(i);
      const localY = posAttr.getY(i);
      const worldX = localX + centerX;
      const worldZ = -localY + centerZ;
      const h = this.game.getTerrainHeight(worldX, worldZ);
      posAttr.setZ(i, h);
      heights.push(h);
      if (h > maxH) maxH = h;
      if (h < minH) minH = h;
    }

    const range = maxH - minH || 1;
    const colorArray = [];
    const hasVariation = range > 0.01;
    // 4x4 Bayer ordered-dither matrix — jitters the height-band threshold so the
    // sand colours stipple/blend between bands instead of showing hard contour lines.
    const BAYER_4X4 = [
      [0, 8, 2, 10],
      [12, 4, 14, 6],
      [3, 11, 1, 9],
      [15, 7, 13, 5],
    ];
    // World-space dither cell size (smaller = finer stipple). Using world position
    // (not vertex index) keeps the pattern seamless across tile edges.
    const DITHER_CELL = 0.6;
    const DITHER_STRENGTH = 0.14; // how far the banding threshold can jitter
    for (let i = 0; i < heights.length; i++) {
      const worldX = posAttr.getX(i) + centerX;
      const worldZ = -posAttr.getY(i) + centerZ;
      const norm = Math.max(0, Math.min(1, (heights[i] + 2) / 4)); // Normalize height

      const bx = ((Math.floor(worldX / DITHER_CELL) % 4) + 4) % 4;
      const bz = ((Math.floor(worldZ / DITHER_CELL) % 4) + 4) % 4;
      const ditherOffset = (BAYER_4X4[bz][bx] / 16 - 0.5) * DITHER_STRENGTH;
      const dNorm = norm + ditherOffset;

      const c = new THREE.Color(); // Re-use the color object
      const palette = [gameConfig.scene.colors.terrainColor1, gameConfig.scene.colors.terrainColor2, gameConfig.scene.colors.terrainColor3, gameConfig.scene.colors.terrainColor4];
      const band = Math.max(0, Math.min(2.999, dNorm * 3));
      const index = Math.floor(band);
      c.set(palette[index]).lerp(new THREE.Color(palette[index + 1]), band - index);
      const uv = geometry.getAttribute('uv');
      uv.setXY(i, worldX / 12, -worldZ / 12);
      colorArray.push(c.r, c.g, c.b); // Push the RGB components
    }

    geometry.setAttribute('color', new THREE.BufferAttribute(new Float32Array(colorArray), 3));
    posAttr.needsUpdate = true;
    geometry.computeVertexNormals();

    const material = new THREE.MeshStandardMaterial({
      vertexColors: true,
      map: this.game.sandTexture,
      roughness: 0.95, // Sand is very matte
      metalness: 0.0,  // Sand is not metallic
    });
    const mesh = new THREE.Mesh(geometry, material);
    mesh.rotation.x = -Math.PI / 2;
    mesh.position.set(centerX, 0, centerZ);
    mesh.receiveShadow = true;

    // Cache the height grid for fast getSurfaceHeight() lookups
    const gridSize = segments + 1;
    const tileGrid = { grid: heights, gridSize, segmentSize: size / segments, size, centerX, centerZ };
    const gx = Math.round(centerX / size);
    const gz = Math.round(centerZ / size);
    const key = `${gx},${gz}`;
    this.game.tileHeightGrids[key] = tileGrid;
    this.game.tiles[key] = mesh;
    this.game.scene.add(mesh);
  }

  createTent(x, y, z, rotationY) {
    const group = new THREE.Group();
    group.position.set(x, y, z);
    group.rotation.y = rotationY;
    groundAnchor(group, 0);

    const tentMaterial = new THREE.MeshLambertMaterial({
      color: 0xd2b48c, // Tan color
      side: THREE.DoubleSide,
    });

    const tentPoleMaterial = new THREE.MeshLambertMaterial({ color: 0x5a3f22 });

    // Main tent fabric
    const tentGeometry = new THREE.ConeGeometry(1.5, 2, 4, 1, true);
    const tentMesh = new THREE.Mesh(tentGeometry, tentMaterial);
    tentMesh.rotation.y = Math.PI / 4; // Align flat side forward
    tentMesh.position.y = 1;
    tentMesh.scale.z = 0.7; // Make it less deep
    tentMesh.castShadow = true;
    group.add(tentMesh);

    // Center pole
    group.add(contactShadow(1.9, 0.18));

    const poleGeometry = new THREE.CylinderGeometry(0.05, 0.05, 2.2, 6);
    const pole = new THREE.Mesh(poleGeometry, tentPoleMaterial);
    pole.position.y = 1.1;
    group.add(pole);

    this.game.scenery.push(group);
    this.game.scene.add(group);

    const tentColliderGeometry = new THREE.CylinderGeometry(1, 1, 2, 8);
    const tentColliderMaterial = new THREE.MeshBasicMaterial({ visible: false });
    const tentCollider = new THREE.Mesh(tentColliderGeometry, tentColliderMaterial);
    tentCollider.position.set(x, y + 1, z);
    tentCollider.userData.isCollider = true;
    groundAnchor(tentCollider, 1);
    this.game.scene.add(tentCollider);
    this.game.obstacleColliders.push(tentCollider);
  }

  createSplitRock(x, y, z) {
    const group = new THREE.Group();
    group.position.set(x, y, z);
    groundAnchor(group, 0);

    const rockMaterial = new THREE.MeshLambertMaterial({ color: 0x555555 });
    const rockGeometry = new THREE.IcosahedronGeometry(6, 1);

    // Deform the geometry vertices for a more natural look
    const pos = rockGeometry.attributes.position;
    for (let i = 0; i < pos.count; i++) {
      const v = new THREE.Vector3().fromBufferAttribute(pos, i);
      v.multiplyScalar(1 + (Math.random() - 0.5) * 0.3);
      pos.setXYZ(i, v.x, v.y, v.z);
    }
    rockGeometry.computeVertexNormals();

    // Create two halves
    const rock1 = new THREE.Mesh(rockGeometry, rockMaterial);
    rock1.position.x = -0.4;
    rock1.rotation.set(0.1, 0.2, 0.3);
    rock1.castShadow = true;
    rock1.receiveShadow = true;
    group.add(rock1);

    const rock2 = rock1.clone();
    rock2.position.x = 0.4;
    rock2.rotation.set(-0.1, -0.2, -0.3);
    group.add(rock2);

    this.game.scenery.push(group);
    this.game.scene.add(group);

    // Add a collider
    const colliderGeometry = new THREE.CylinderGeometry(6, 6, 8, 12);
    const colliderMaterial = new THREE.MeshBasicMaterial({ visible: false });
    const collider = new THREE.Mesh(colliderGeometry, colliderMaterial);
    collider.position.set(x, y + 4, z);
    collider.userData.isCollider = true;
    groundAnchor(collider, 4);
    this.game.scene.add(collider);
    this.game.obstacleColliders.push(collider);
  }

  createTemple(x, y, z) {
    const group = new THREE.Group();
    group.position.set(x, y, z);
    groundAnchor(group, 0);

    const templeMaterial = new THREE.MeshLambertMaterial({ color: 0x997300 });
    const roofMaterial = new THREE.MeshLambertMaterial({ color: 0x7a5c00 });

    // Base
    const baseGeometry = new THREE.BoxGeometry(12, 1, 12);
    const base = new THREE.Mesh(baseGeometry, templeMaterial);
    base.position.y = 0.5;
    base.receiveShadow = true;
    group.add(base);

    // Roof
    const roofGeometry = new THREE.BoxGeometry(13, 1, 13);
    const roof = new THREE.Mesh(roofGeometry, roofMaterial);
    roof.position.y = 4.5;
    roof.castShadow = true;
    group.add(roof);

    // Pillars
    const pillarGeometry = new THREE.CylinderGeometry(0.4, 0.4, 3, 8);
    for (let i = 0; i < 4; i++) {
      for (let j = 0; j < 4; j++) {
        if (i === 0 || i === 3 || j === 0 || j === 3) {
          const pillar = new THREE.Mesh(pillarGeometry, templeMaterial);
          pillar.position.set((i - 1.5) * 3, 2.5, (j - 1.5) * 3);
          pillar.castShadow = true;
          group.add(pillar);
        }
      }
    }

    // Courtyard Walls
    const wallGeometry = new THREE.BoxGeometry(18, 1.5, 0.5);
    const wallPositions = [
      { pos: [0, 0.75, 9], rot: 0 },
      { pos: [0, 0.75, -9], rot: 0 },
      { pos: [9, 0.75, 0], rot: Math.PI / 2 },
      { pos: [-9, 0.75, 0], rot: Math.PI / 2 },
    ];
    wallPositions.forEach(w => {
      const wall = new THREE.Mesh(wallGeometry, templeMaterial);
      wall.position.set(w.pos[0], w.pos[1], w.pos[2]);
      wall.rotation.y = w.rot;
      wall.castShadow = true;
      group.add(wall);
    });

    this.game.scenery.push(group);
    this.game.scene.add(group);

    // Add a collider for the whole temple area
    const colliderGeometry = new THREE.CylinderGeometry(9, 9, 4, 16);
    const colliderMaterial = new THREE.MeshBasicMaterial({ visible: false });
    const collider = new THREE.Mesh(colliderGeometry, colliderMaterial);
    collider.position.set(x, y + 2, z);
    collider.userData.isCollider = true;
    groundAnchor(collider, 2);
    this.game.scene.add(collider);
    this.game.obstacleColliders.push(collider);

    // Golden sparkles drifting up around the temple roof
    if (this.game.particleManager) {
      this.game.particleManager.createEmitter('sparkle', new THREE.Vector3(x, y + 5.5, z));
    }
  }

  createMarketStall(x, y, z, rotationY) {
    const group = new THREE.Group();
    group.position.set(x, y, z);
    group.rotation.y = rotationY;
    groundAnchor(group, 0);

    const woodMaterial = new THREE.MeshLambertMaterial({ color: 0x6b4423 });
    const clothMaterial = new THREE.MeshLambertMaterial({ color: 0xa03333 });

    const shadow = new THREE.Mesh(
      new THREE.PlaneGeometry(2.8, 1.8),
      new THREE.MeshBasicMaterial({ color: 0x1a1008, transparent: true, opacity: 0.16, depthWrite: false })
    );
    shadow.rotation.x = -Math.PI / 2;
    shadow.position.y = 0.03;
    group.add(shadow);

    // Table
    const tableTopGeo = new THREE.BoxGeometry(2, 0.2, 1);
    const tableTop = new THREE.Mesh(tableTopGeo, woodMaterial);
    tableTop.position.y = 0.8;
    tableTop.castShadow = true;
    group.add(tableTop);

    const legGeo = new THREE.CylinderGeometry(0.08, 0.08, 0.8, 4);
    const legPositions = [
      { x: -0.8, z: 0.35 }, { x: 0.8, z: 0.35 },
      { x: -0.8, z: -0.35 }, { x: 0.8, z: -0.35 }
    ];
    legPositions.forEach(p => {
      const leg = new THREE.Mesh(legGeo, woodMaterial);
      leg.position.set(p.x, 0.4, p.z);
      leg.castShadow = true;
      group.add(leg);
    });

    // Awning
    const awningGeo = new THREE.PlaneGeometry(2.2, 1.2);
    const awning = new THREE.Mesh(awningGeo, clothMaterial);
    awning.position.set(0, 1.8, 0);
    awning.rotation.x = -0.2;
    awning.castShadow = true;
    group.add(awning);
    this.game.scenery.push(group);
    this.game.scene.add(group);

    const colliderGeometry = new THREE.CylinderGeometry(1, 1, 2, 8);
    const colliderMaterial = new THREE.MeshBasicMaterial({ visible: false });
    const collider = new THREE.Mesh(colliderGeometry, colliderMaterial);
    collider.position.set(x, y + 1, z);
    collider.userData.isCollider = true;
    groundAnchor(collider, 1);
    this.game.scene.add(collider);
    this.game.obstacleColliders.push(collider);
  }

  /** Build the landmarks for every station of the 40-year journey. */
  createStations(stations = []) {
    this.stationGroups = [];
    stations.forEach((station) => {
      this.stationGroups.push(this.createStationMonument(station));
    });
    return this.stationGroups;
  }

  /**
   * A station is a stone circle, a standing altar, a glowing ring and a
   * floating name banner. The Pillar of Cloud & Fire stands at its centre.
   */
  createStationMonument(station) {
    const [x, z] = station.pos;
    const y = this.game.getSurfaceHeight(x, z);
    const group = new THREE.Group();
    group.position.set(x, y, z);
    groundAnchor(group, 0);
    group.userData.stationId = station.id;
    const localAnchors = [];

    // Ring of weathered standing stones.
    const stoneMat = new THREE.MeshStandardMaterial({ color: 0x8a7658, roughness: 0.95, metalness: 0 });
    const stoneColors = [0x9a8668, 0x7a674c, 0xa89576];
    for (let i = 0; i < 9; i++) {
      const a = (i / 9) * Math.PI * 2;
      const r = 6 + Math.random() * 0.8;
      const h = 1.4 + Math.random() * 2.2;
      const geo = new THREE.CylinderGeometry(0.45 + Math.random() * 0.25, 0.7, h, 5);
      const mat = stoneMat.clone();
      mat.color.setHex(stoneColors[i % stoneColors.length]);
      const stone = new THREE.Mesh(geo, mat);
      const sx = Math.cos(a) * r;
      const sz = Math.sin(a) * r;
      const localGround = (this.game.getSurfaceHeight?.(x + sx, z + sz) ?? y) - y;
      stone.position.set(sx, localGround + h / 2 - 0.08, sz);
      stone.rotation.y = Math.random() * Math.PI;
      stone.rotation.z = (Math.random() - 0.5) * 0.12;
      stone.castShadow = true;
      stone.receiveShadow = true;
      group.add(stone);
      localAnchors.push({ object: stone, lx: sx, lz: sz, yOffset: h / 2 - 0.08 });
    }

    // Central altar stone.
    const altar = new THREE.Mesh(
      new THREE.CylinderGeometry(1.3, 1.6, 0.75, 6),
      new THREE.MeshStandardMaterial({ color: 0x6b5a42, roughness: 0.9 })
    );
    altar.position.y = (this.game.getSurfaceHeight?.(x, z) ?? y) - y + 0.4;
    altar.castShadow = true;
    group.add(altar);
    localAnchors.push({ object: altar, lx: 0, lz: 0, yOffset: 0.4 });

    // Glowing covenant ring.
    const ringColor = new THREE.Color(station.color || '#c99a3a');
    const ring = new THREE.Mesh(
      new THREE.RingGeometry(3.1, 3.7, 48),
      new THREE.MeshBasicMaterial({
        color: ringColor, transparent: true, opacity: 0.55,
        side: THREE.DoubleSide, depthWrite: false, blending: THREE.AdditiveBlending,
      })
    );
    ring.rotation.x = -Math.PI / 2;
    ring.position.y = (this.game.getSurfaceHeight?.(x, z) ?? y) - y + 0.08;
    group.add(ring);
    group.userData.ring = ring;
    localAnchors.push({ object: ring, lx: 0, lz: 0, yOffset: 0.08 });

    // Floating station name.
    const label = createTextSprite(station.name, { fontSize: 54, scale: 2.1, color: '#fff2cb', outlineColor: '#5a3f22', strokeColor: '#3b2a16' });
    label.position.y = 7.5;
    group.add(label);
    group.userData.label = label;

    // Kind-specific scenery. Water sits away from the stone circle so no
    // monument, palm, rock or pickup is placed in the sea/spring.
    if (station.water) {
      const water = new THREE.Mesh(
        new THREE.CircleGeometry(station.water.r, 48),
        new THREE.MeshPhongMaterial({ color: 0x2f8fb0, emissive: 0x0e3b52, emissiveIntensity: 0.35, transparent: true, opacity: 0.84, shininess: 90 })
      );
      water.rotation.x = -Math.PI / 2;
      const waterGround = (this.game.getSurfaceHeight?.(x + station.water.x, z + station.water.z) ?? y) - y;
      water.position.set(station.water.x, waterGround + 0.05, station.water.z);
      group.add(water);
      localAnchors.push({ object: water, lx: station.water.x, lz: station.water.z, yOffset: 0.05 });
      // A pale shoreline ring makes the water edge readable.
      const shore = new THREE.Mesh(
        new THREE.RingGeometry(station.water.r - 0.6, station.water.r + 0.6, 48),
        new THREE.MeshBasicMaterial({ color: 0xd8c79b, transparent: true, opacity: 0.35, side: THREE.DoubleSide })
      );
      shore.rotation.x = -Math.PI / 2;
      shore.position.set(station.water.x, waterGround + 0.07, station.water.z);
      group.add(shore);
      localAnchors.push({ object: shore, lx: station.water.x, lz: station.water.z, yOffset: 0.07 });
    }
    if (station.kind === 'waters' || station.kind === 'palms' || station.kind === 'shore') {
      const palms = station.kind === 'palms' ? 7 : 3;
      for (let i = 0; i < palms; i++) {
        const a = (i / palms) * Math.PI * 2 + 0.4;
        const r = 11 + Math.random() * 4;
        const px = x + Math.cos(a) * r;
        const pz = z + Math.sin(a) * r;
        if (this.game.isWaterAt?.(px, pz)) continue;
        this.createPalmTree(px, this.game.getSurfaceHeight(px, pz), pz);
      }
    } else if (station.kind === 'rock') {
      this.createSplitRock(x + 12, this.game.getSurfaceHeight(x + 12, z + 10), z + 10);
      this.createRock(x - 10, this.game.getSurfaceHeight(x - 10, z - 7), z - 7, 1.6);
    } else if (station.kind === 'mountain') {
      const mountain = new THREE.Mesh(
        new THREE.ConeGeometry(24, 30, 7),
        new THREE.MeshStandardMaterial({ color: 0x5a4d63, roughness: 1 })
      );
      mountain.position.set(0, 15, -30);
      mountain.castShadow = true;
      mountain.receiveShadow = true;
      group.add(mountain);
      const cloudCap = new THREE.Mesh(
        new THREE.SphereGeometry(10, 12, 8),
        new THREE.MeshBasicMaterial({ color: 0xded6ea, transparent: true, opacity: 0.4, depthWrite: false })
      );
      cloudCap.position.set(0, 30, -30);
      cloudCap.scale.y = 0.45;
      group.add(cloudCap);
    } else if (station.kind === 'moab') {
      this.createTent(x + 9, this.game.getSurfaceHeight(x + 9, z + 7), z + 7, Math.PI / 4);
      this.createTent(x - 8, this.game.getSurfaceHeight(x - 8, z + 9), z + 9, -Math.PI / 5);
      for (let i = 0; i < 4; i++) {
        const a = Math.random() * Math.PI * 2;
        const r = 12 + Math.random() * 7;
        const px = x + Math.cos(a) * r;
        const pz = z + Math.sin(a) * r;
        this.createPalmTree(px, this.game.getSurfaceHeight(px, pz), pz);
      }
    } else if (station.kind === 'manna') {
      for (let i = 0; i < 10; i++) {
        const a = Math.random() * Math.PI * 2;
        const r = 8 + Math.random() * 10;
        const px = x + Math.cos(a) * r;
        const pz = z + Math.sin(a) * r;
        this.createRock(px, this.game.getSurfaceHeight(px, pz), pz, 0.35);
      }
    } else if (station.kind === 'spy') {
      for (let i = 0; i < 3; i++) this.createRock(x - 10 + i * 5, y, z - 10 - i * 2, 1.2);
    }

    group.userData.baseY = y;
    group.userData.localAnchors = localAnchors;
    this.game.scenery.push(group);
    this.game.scene.add(group);
    return group;
  }

  /** A small crowd of Israelites around the camp — the people Moses leads. */
  createCampPeople(cx, cz, count = 12) {
    this.campPeople = [];
    const cloaks = [0xb5643c, 0x8c6a3f, 0x6b7d9a, 0xa88b5a, 0x7d5a7a, 0x94714a];
    for (let i = 0; i < count; i++) {
      const angle = Math.random() * Math.PI * 2;
      const radius = 4 + Math.random() * 9;
      const x = cx + Math.cos(angle) * radius;
      const z = cz + Math.sin(angle) * radius;
      const y = this.game.getSurfaceHeight(x, z);
      const group = new THREE.Group();
      group.position.set(x, y, z);
      groundAnchor(group, 0);
      const cloakColor = cloaks[i % cloaks.length];

      group.add(contactShadow(0.5, 0.2));
      const body = new THREE.Mesh(
        new THREE.ConeGeometry(0.36, 1.1, 6),
        new THREE.MeshLambertMaterial({ color: cloakColor })
      );
      body.position.y = 0.53;
      body.castShadow = true;
      group.add(body);

      const head = new THREE.Mesh(
        new THREE.SphereGeometry(0.19, 7, 7),
        new THREE.MeshLambertMaterial({ color: 0x8a6038 })
      );
      head.position.y = 1.22;
      head.castShadow = true;
      group.add(head);

      const scarf = new THREE.Mesh(
        new THREE.CylinderGeometry(0.2, 0.2, 0.09, 7),
        new THREE.MeshLambertMaterial({ color: 0x4a3320 })
      );
      scarf.position.y = 1.3;
      group.add(scarf);

      group.rotation.y = Math.random() * Math.PI * 2;
      group.userData = { phase: Math.random() * Math.PI * 2, baseY: y, speed: 0.3 + Math.random() * 0.4 };
      this.game.scenery.push(group);
      this.game.scene.add(group);
      this.campPeople.push(group);
    }
  }

  /** Slow rotation/pulse for station rings, plus the breathing camp crowd. */
  animateStations(time, playerPosition = null) {
    if (this.campPeople) {
      for (const person of this.campPeople) {
        const d = person.userData;
        person.position.y = d.baseY + Math.sin(time * 0.02 * d.speed + d.phase) * 0.03;
        person.rotation.y += Math.sin(time * 0.005 + d.phase) * 0.002;
      }
    }
    if (!this.stationGroups) return;
    for (const group of this.stationGroups) {
      const ring = group.userData.ring;
      if (!ring) continue;
      ring.rotation.z = time * 0.12;
      ring.material.opacity = 0.4 + Math.sin(time * 0.02) * 0.14;
      const label = group.userData.label;
      if (label && playerPosition) {
        const d = Math.hypot(playerPosition.x - group.position.x, playerPosition.z - group.position.z);
        const fade = Math.max(0, Math.min(1, (d - 18) / 22));
        label.material.opacity = fade;
        label.visible = fade > 0.02;
      }
    }
  }
}