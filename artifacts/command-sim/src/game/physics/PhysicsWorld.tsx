import type { PropsWithChildren } from "react";
import { Physics } from "@react-three/rapier";

interface PhysicsWorldProps extends PropsWithChildren {
  debug?: boolean;
  paused?: boolean;
}

export function PhysicsWorld({ children, debug = false, paused = false }: PhysicsWorldProps) {
  return (
    <Physics
      gravity={[0, -9.81, 0]}
      timeStep="vary"
      interpolate
      paused={paused}
      debug={debug && import.meta.env.DEV}
    >
      {children}
    </Physics>
  );
}
