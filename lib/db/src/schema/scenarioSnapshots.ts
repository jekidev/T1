import { pgTable, text, serial, timestamp, jsonb, integer } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { scenariosTable } from "./scenarios";

export const scenarioSnapshotsTable = pgTable("scenario_snapshots", {
  id: serial("id").primaryKey(),
  scenarioId: integer("scenario_id")
    .notNull()
    .references(() => scenariosTable.id, { onDelete: "cascade" }),
  label: text("label").notNull(),
  board: jsonb("board").notNull().default({}),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export const insertScenarioSnapshotSchema = createInsertSchema(
  scenarioSnapshotsTable,
).omit({ id: true, createdAt: true });
export type InsertScenarioSnapshot = z.infer<
  typeof insertScenarioSnapshotSchema
>;
export type ScenarioSnapshot = typeof scenarioSnapshotsTable.$inferSelect;
