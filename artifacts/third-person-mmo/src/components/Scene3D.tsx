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

export default function Scene3D({
  entities = [],
  selectedNpcId,
  onSelectNpc,
}: {
  entities?: SceneEntity[];
  selectedNpcId?: string;
  onSelectNpc?: (id: string) => void;
}) {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const width = container.clientWidth || 800;
    const height = container.clientHeight || 600;

    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x0f172a);

    const camera = new THREE.PerspectiveCamera(75, width / height, 0.1, 1000);
    camera.position.set(0, 12, 18);
    camera.lookAt(0, 0, 0);

    const renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setSize(width, height);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    container.appendChild(renderer.domElement);

    const ground = new THREE.Mesh(
      new THREE.PlaneGeometry(30, 30),
      new THREE.MeshStandardMaterial({ color: 0x1e293b, roughness: 0.9 }),
    );
    ground.rotation.x = -Math.PI / 2;
    ground.position.y = -0.5;
    scene.add(ground);

    const ambient = new THREE.AmbientLight(0xffffff, 0.5);
    scene.add(ambient);
    const directional = new THREE.DirectionalLight(0xffffff, 1);
    directional.position.set(10, 20, 10);
    scene.add(directional);

    const geometry = new THREE.BoxGeometry(0.8, 0.8, 0.8);
    const meshes: THREE.Mesh[] = [];
    const meshById = new Map<string, THREE.Mesh>();

    for (const entity of entities) {
      const x = ((entity.x ?? 500) - 500) / 50;
      const z = ((entity.y ?? 500) - 500) / 50;
      const material = new THREE.MeshStandardMaterial({ color: colorForFaction(entity.faction) });
      const mesh = new THREE.Mesh(geometry, material);
      mesh.position.set(x, 0, z);
      mesh.userData = { entityId: entity.id };
      scene.add(mesh);
      meshes.push(mesh);
      meshById.set(entity.id, mesh);
    }

    const raycaster = new THREE.Raycaster();
    const pointer = new THREE.Vector2();

    function onPointerDown(event: PointerEvent) {
      const rect = renderer.domElement.getBoundingClientRect();
      pointer.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
      pointer.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
      raycaster.setFromCamera(pointer, camera);
      const intersects = raycaster.intersectObjects(meshes);
      if (intersects.length > 0) {
        const id = intersects[0].object.userData['entityId'] as string | undefined;
        if (id && onSelectNpc) onSelectNpc(id);
      }
    }
    renderer.domElement.addEventListener('pointerdown', onPointerDown);

    let frameId = 0;
    function animate() {
      frameId = requestAnimationFrame(animate);
      for (const [id, mesh] of meshById) {
        mesh.scale.setScalar(id === selectedNpcId ? 1.4 : 1);
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
      renderer.dispose();
      geometry.dispose();
      for (const mesh of meshes) (mesh.material as THREE.Material).dispose();
      if (renderer.domElement.parentNode === container) {
        container.removeChild(renderer.domElement);
      }
    };
  }, [entities, selectedNpcId, onSelectNpc]);

  return <div ref={containerRef} className="w-full h-[60vh] rounded-lg bg-slate-900" />;
}
