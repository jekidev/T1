export interface SimulationClockState {
  tickRate: number;
  tick: number;
  paused: boolean;
  speedMultiplier: number;
}

export class SimulationClock {
  private state: SimulationClockState;

  constructor(input?: Partial<SimulationClockState>) {
    this.state = {
      tickRate: input?.tickRate ?? 20,
      tick: input?.tick ?? 0,
      paused: input?.paused ?? false,
      speedMultiplier: input?.speedMultiplier ?? 1,
    };
    if (!Number.isFinite(this.state.tickRate) || this.state.tickRate <= 0) {
      throw new Error("tickRate must be greater than zero.");
    }
  }

  get tickRate(): number { return this.state.tickRate; }
  get tick(): number { return this.state.tick; }
  get paused(): boolean { return this.state.paused; }
  get speedMultiplier(): number { return this.state.speedMultiplier; }
  get tickDurationSeconds(): number { return 1 / this.state.tickRate; }
  get tickDurationMs(): number { return 1000 / this.state.tickRate; }

  setPaused(paused: boolean): void {
    this.state.paused = paused;
  }

  setSpeedMultiplier(multiplier: number): void {
    if (![0.25, 0.5, 1, 2, 4, 8].includes(multiplier)) {
      throw new Error("Unsupported simulation speed multiplier.");
    }
    this.state.speedMultiplier = multiplier;
  }

  advanceOneTick(): number {
    this.state.tick += 1;
    return this.state.tick;
  }

  exportState(): SimulationClockState {
    return { ...this.state };
  }

  importState(state: SimulationClockState): void {
    if (state.tickRate <= 0 || state.tick < 0) throw new Error("Invalid clock state.");
    this.state = { ...state };
  }
}
