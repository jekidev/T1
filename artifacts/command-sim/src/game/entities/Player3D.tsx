import { useEffect, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import { CapsuleCollider, RigidBody, type RapierRigidBody } from "@react-three/rapier";

interface InputState {
  forward: boolean;
  backward: boolean;
  left: boolean;
  right: boolean;
  jump: boolean;
  sprint: boolean;
}

const input: InputState = {
  forward: false,
  backward: false,
  left: false,
  right: false,
  jump: false,
  sprint: false,
};

const keyMap: Record<string, keyof InputState> = {
  KeyW: "forward",
  ArrowUp: "forward",
  KeyS: "backward",
  ArrowDown: "backward",
  KeyA: "left",
  ArrowLeft: "left",
  KeyD: "right",
  ArrowRight: "right",
  Space: "jump",
  ShiftLeft: "sprint",
  ShiftRight: "sprint",
};

export function Player3D() {
  const bodyRef = useRef<RapierRigidBody>(null);
  const canJumpRef = useRef(false);

  useEffect(() => {
    const update = (event: KeyboardEvent, pressed: boolean) => {
      const key = keyMap[event.code];
      if (!key) return;
      input[key] = pressed;
      if (["Space", "ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight"].includes(event.code)) event.preventDefault();
    };
    const down = (event: KeyboardEvent) => update(event, true);
    const up = (event: KeyboardEvent) => update(event, false);
    window.addEventListener("keydown", down, { passive: false });
    window.addEventListener("keyup", up, { passive: false });
    return () => {
      window.removeEventListener("keydown", down);
      window.removeEventListener("keyup", up);
    };
  }, []);

  useFrame(() => {
    const body = bodyRef.current;
    if (!body) return;
    const velocity = body.linvel();
    const speed = input.sprint ? 7 : 4;
    const x = (Number(input.right) - Number(input.left)) * speed;
    const z = (Number(input.backward) - Number(input.forward)) * speed;
    body.setLinvel({ x, y: velocity.y, z }, true);
    if (input.jump && canJumpRef.current) {
      body.setLinvel({ x, y: 6.2, z }, true);
      canJumpRef.current = false;
    }
  });

  return (
    <RigidBody
      ref={bodyRef}
      position={[0, 2, 0]}
      colliders={false}
      enabledRotations={[false, false, false]}
      linearDamping={4}
      canSleep={false}
      onCollisionEnter={() => { canJumpRef.current = true; }}
    >
      <CapsuleCollider args={[0.55, 0.35]} />
      <mesh castShadow receiveShadow>
        <capsuleGeometry args={[0.35, 1.1, 8, 16]} />
        <meshStandardMaterial color="#d7e7f5" roughness={0.55} metalness={0.05} />
      </mesh>
    </RigidBody>
  );
}
