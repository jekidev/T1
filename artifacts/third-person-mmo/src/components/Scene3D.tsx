import { useEffect, useRef } from 'react';
import * as THREE from 'three';

export interface SceneEntity {
  id: string;
  name?: string;
  faction?: string;
  category?: string;
  x?: number;
  y?: number;
}

function colorForFaction(faction?: string): number {
  const f = (faction ?? '').toLowerCase();
  if (f.includes('police') || f.includes('blue')) return 0x3b82f6;
  if (f.includes('criminal') || f.includes('red')) return 0xef4444;
  if (f.includes('neutral')) return 0x9ca3af;
  return 0x22c55e;
}

function lerpColor(a: THREE.Color, b: THREE.Color, t: number, out: THREE.Color) {
  out.r = a.r + (b.r - a.r) * t;
  out.g = a.g + (b.g - a.g) * t;
  out.b = a.b + (b.b - a.b) * t;
  return out;
}

export default function Scene3D({
  entities = [],
  selectedNpcId,
  onSelectNpc,
  hour = 12,
}: {
  entities?: SceneEntity[];
  selectedNpcId?: string;
  onSelectNpc?: (id: string) => void;
  hour?: number;
}) {
  const containerRef = useRef<HTMLDivElement>(null);

  // Store latest props in refs so the animation loop doesn't need to recreate objects.
  const propsRef = useRef({ entities, selectedNpcId, onSelectNpc, hour });
  useEffect(() => {
    propsRef.current = { entities, selectedNpcId, onSelectNpc, hour };
  }, [entities, selectedNpcId, onSelectNpc, hour]);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const width = container.clientWidth || 800;
    const height = container.clientHeight || 600;

    const scene = new THREE.Scene();
    const renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setSize(width, height);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    container.appendChild(renderer.domElement);

    const camera = new THREE.PerspectiveCamera(75, width / height, 0.1, 1000);
    camera.position.set(0, 12, 18);
    camera.lookAt(0, 0, 0);

    const ground = new THREE.Mesh(
      new THREE.PlaneGeometry(30, 30),
      new THREE.MeshStandardMaterial({ color: 0x1e293b, roughness: 0.9 }),
    );
    ground.rotation.x = -Math.PI / 2;
    ground.position.y = -0.5;
    scene.add(ground);

    const ambient = new THREE.AmbientLight(0xffffff, 0.4);
    scene.add(ambient);
    const directional = new THREE.DirectionalLight(0xffffff, 1.2);
    scene.add(directional);

    const fogColor = new THREE.Color(0x0f172a);
    scene.background = fogColor.clone();
    scene.fog = new THREE.Fog(fogColor.getHex(), 20, 80);

    const geometry = new THREE.BoxGeometry(0.8, 0.8, 0.8);
    const meshes = new Map<string, THREE.Mesh>();

    function syncEntities() {
      const currentIds = new Set(propsRef.current.entities.map((e) => e.id));
      // Remove stale meshes.
      for (const [id, mesh] of meshes.entries()) {
        if (!currentIds.has(id)) {
          scene.remove(mesh);
          (mesh.material as THREE.Material).dispose();
          meshes.delete(id);
        }
      }
      // Add or update meshes.
      for (const entity of propsRef.current.entities) {
        let mesh = meshes.get(entity.id);
        if (!mesh) {
          const material = new THREE.MeshStandardMaterial({ color: colorForFaction(entity.faction) });
          mesh = new THREE.Mesh(geometry, material);
          mesh.userData = { entityId: entity.id };
          scene.add(mesh);
          meshes.set(entity.id, mesh);
        }
        const x = ((entity.x ?? 500) - 500) / 50;
        const z = ((entity.y ?? 500) - 500) / 50;
        mesh.position.set(x, 0, z);
      }
    }

    function updateEnvironment() {
      const h = propsRef.current.hour % 24;
      const angle = ((h - 6) / 12) * Math.PI;
      const radius = 20;
      const sunX = Math.cos(angle) * radius;
      const sunY = Math.sin(angle) * radius;
      directional.position.set(sunX, Math.max(sunY, -2), 5);

      const dayColor = new THREE.Color(0xfff8e7);
      const sunsetColor = new THREE.Color(0xffaa55);
      const nightColor = new THREE.Color(0x1a2b4d);
      const dawnColor = new THREE.Color(0x6b5b95);

      let target = new THREE.Color();
      if (sunY > 10) {
        target = dayColor;
      } else if (sunY > 0) {
        target = lerpColor(sunsetColor, dayColor, sunY / 10, new THREE.Color());
      } else if (sunY > -10) {
        target = lerpColor(nightColor, sunsetColor, (sunY + 10) / 10, new THREE.Color());
      } else {
        target = lerpColor(dawnColor, nightColor, Math.min(1, (sunY + 20) / 10), new THREE.Color());
      }

      directional.color.copy(target);
      ambient.color.copy(target);
      ambient.intensity = Math.max(0.15, Math.min(0.6, sunY / 20 + 0.3));
      directional.intensity = Math.max(0.2, Math.min(1.2, sunY / 15 + 0.4));

      const bgNight = new THREE.Color(0x0f172a);
      const bgDay = new THREE.Color(0x1e293b);
      const bg = lerpColor(bgNight, bgDay, Math.max(0, Math.min(1, (sunY + 5) / 20)), new THREE.Color());
      scene.background = bg;
      if (scene.fog) scene.fog.color = bg;
    }

    const raycaster = new THREE.Raycaster();
    const pointer = new THREE.Vector2();

    function onPointerDown(event: PointerEvent) {
      const rect = renderer.domElement.getBoundingClientRect();
      pointer.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
      pointer.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
      raycaster.setFromCamera(pointer, camera);
      const intersects = raycaster.intersectObjects(Array.from(meshes.values()));
      if (intersects.length > 0) {
        const id = intersects[0].object.userData['entityId'] as string | undefined;
        if (id && propsRef.current.onSelectNpc) propsRef.current.onSelectNpc(id);
      }
    }
    renderer.domElement.addEventListener('pointerdown', onPointerDown);

    let frameId = 0;
    function animate() {
      frameId = requestAnimationFrame(animate);
      syncEntities();
      updateEnvironment();
      for (const [id, mesh] of meshes) {
        const isSelected = id === propsRef.current.selectedNpcId;
        mesh.scale.setScalar(isSelected ? 1.4 : 1);
        mesh.rotation.y += 0.01;
      }
      renderer.render(scene, camera);
    }
    animate();

    function handleResize() {
      if (!container) return;
      const w = container.clientWidth || 800;
      const h = container.clientHeight || 600;
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      renderer.setSize(w, h);
    }
    window.addEventListener('resize', handleResize);

    return () => {
      cancelAnimationFrame(frameId);
      renderer.domElement.removeEventListener('pointerdown', onPointerDown);
      window.removeEventListener('resize', handleResize);
      geometry.dispose();
      for (const mesh of meshes.values()) (mesh.material as THREE.Material).dispose();
      renderer.dispose();
      if (renderer.domElement.parentNode === container) {
        container.removeChild(renderer.domElement);
      }
    };
  }, []);

  return <div ref={containerRef} className="w-full h-[60vh] rounded-lg bg-slate-900" />;
}
