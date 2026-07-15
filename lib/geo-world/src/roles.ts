import {
  GameplayLocationRoleSchema,
  type GameplayLocationRole,
  type GameplayLocationRoleName,
  type ImportedPlace,
} from "./types";

const FICTION_ONLY_ROLES = new Set<GameplayLocationRoleName>(["safehouse", "stashhouse"]);

export function validateGameplayLocationRole(
  place: ImportedPlace,
  roleInput: GameplayLocationRole,
): GameplayLocationRole {
  const role = GameplayLocationRoleSchema.parse(roleInput);
  if (role.placeId !== place.sourceId) throw new Error("Gameplay role placeId does not match the imported place.");

  if (FICTION_ONLY_ROLES.has(role.role)) {
    if (!role.fictionalized) {
      throw new Error(`${role.role} must be explicitly fictionalized.`);
    }
    if (place.publicCategory === "residence") {
      throw new Error(`A real residential place cannot be assigned the ${role.role} gameplay role.`);
    }
  }

  if (role.role === "residence" && place.publicCategory !== "residence" && !role.fictionalized) {
    throw new Error("A non-residential public feature can only become a residence in a fictionalized scenario.");
  }

  if (role.role === "hospital" && place.publicCategory !== "hospital" && !role.fictionalized) {
    throw new Error("Hospital gameplay roles must originate from a public hospital category or be fictionalized.");
  }

  if (role.role === "police" && place.publicCategory !== "police" && !role.fictionalized) {
    throw new Error("Police gameplay roles must originate from a public police category or be fictionalized.");
  }

  return role;
}

export function deriveDefaultGameplayRole(place: ImportedPlace): GameplayLocationRole {
  const role: GameplayLocationRoleName = place.publicCategory === "hospital"
    ? "hospital"
    : place.publicCategory === "police"
      ? "police"
      : place.publicCategory === "warehouse"
        ? "warehouse"
        : place.publicCategory === "residence"
          ? "residence"
          : "business";

  return {
    placeId: place.sourceId,
    role,
    fictionalized: false,
    assignedBy: "generator",
  };
}

export function isFictionOnlyRole(role: GameplayLocationRoleName): boolean {
  return FICTION_ONLY_ROLES.has(role);
}
