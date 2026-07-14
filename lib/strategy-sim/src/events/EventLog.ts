export interface GameEvent<TPayload = unknown> {
  id: string;
  tick: number;
  simulationTimeMs: number;
  type: string;
  actorId?: string;
  payload: TPayload;
  schemaVersion: 1;
}

export class EventLog {
  private events: GameEvent[] = [];
  private sequence = 0;

  append<TPayload>(input: {
    tick: number;
    tickDurationMs: number;
    type: string;
    actorId?: string;
    payload: TPayload;
  }): GameEvent<TPayload> {
    this.sequence += 1;
    const event: GameEvent<TPayload> = {
      id: `event-${String(this.sequence).padStart(8, "0")}`,
      tick: input.tick,
      simulationTimeMs: input.tick * input.tickDurationMs,
      type: input.type,
      actorId: input.actorId,
      payload: structuredClone(input.payload),
      schemaVersion: 1,
    };
    this.events.push(event);
    return event;
  }

  all(): readonly GameEvent[] {
    return this.events;
  }

  sinceTick(tick: number): readonly GameEvent[] {
    return this.events.filter(event => event.tick >= tick);
  }

  exportState(): { sequence: number; events: GameEvent[] } {
    return {
      sequence: this.sequence,
      events: this.events.map(event => structuredClone(event)),
    };
  }

  importState(state: { sequence: number; events: GameEvent[] }): void {
    this.sequence = state.sequence;
    this.events = state.events.map(event => structuredClone(event));
  }

  clear(): void {
    this.sequence = 0;
    this.events = [];
  }
}
