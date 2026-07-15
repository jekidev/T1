import test from "node:test";
import assert from "node:assert/strict";
import { createDefaultEnvironment, createEmptyBoard } from "./types";
import { getBoardEnvironment } from "./sceneEnvironment";

void test("new boards contain a usable local fallback environment", () => {
  const board = createEmptyBoard("custom");
  assert.deepEqual(board.environment, createDefaultEnvironment());
  assert.equal(board.environment?.mapMode, "local");
  assert.equal(board.environment?.weather, "cloudy");
});

void test("legacy boards without environment data receive safe defaults", () => {
  const board = createEmptyBoard("custom");
  delete board.environment;
  const environment = getBoardEnvironment(board);
  assert.equal(environment.sceneName, "Local fallback scene");
  assert.equal(environment.mapMode, "local");
  assert.equal(environment.temperatureC, 10);
});

void test("persisted values override only their matching defaults", () => {
  const board = createEmptyBoard("custom");
  board.environment = {
    ...createDefaultEnvironment(),
    sceneName: "Copenhagen night scene",
    weather: "rain",
    mapMode: "google",
  };
  const environment = getBoardEnvironment(board);
  assert.equal(environment.sceneName, "Copenhagen night scene");
  assert.equal(environment.weather, "rain");
  assert.equal(environment.mapMode, "google");
  assert.equal(environment.season, "autumn");
});
