export class DeterministicRandom {
  constructor(private state: number) {
    this.state = state >>> 0 || 1;
  }

  next(): number {
    let x = this.state;
    x ^= x << 13;
    x ^= x >>> 17;
    x ^= x << 5;
    this.state = x >>> 0;
    return this.state / 4294967296;
  }

  nextInt(minInclusive: number, maxExclusive: number): number {
    if (maxExclusive <= minInclusive) throw new Error("Invalid random range.");
    return minInclusive + Math.floor(this.next() * (maxExclusive - minInclusive));
  }

  exportState(): number {
    return this.state;
  }

  importState(state: number): void {
    this.state = state >>> 0 || 1;
  }
}
