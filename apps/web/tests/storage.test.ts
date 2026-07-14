import { describe, expect, it } from "vitest";
import { countWords } from "../src/lib/storage";
describe("countWords", () => {
  it("counts Danish words", () => expect(countWords("En mørk nat i København")).toBe(5));
  it("handles empty input", () => expect(countWords("   ")).toBe(0));
});
