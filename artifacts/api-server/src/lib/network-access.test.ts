import test from "node:test";
import assert from "node:assert/strict";
import {
  createNetworkSession,
  getNetworkSession,
  updateNetworkSession,
} from "./network-access";

void test("Ask First remains the default network mode", () => {
  const created = createNetworkSession({ ttlMinutes: 5 });
  assert.equal(created.session.mode, "ask_first");
  assert.equal(created.session.ultraApprovedBy, undefined);
  assert.equal(getNetworkSession(created.session.id, created.token).mode, "ask_first");
});

void test("Ultra session creation rejects missing or incorrect confirmation", () => {
  assert.throws(
    () => createNetworkSession({ mode: "ultra", ttlMinutes: 5 }),
    /ENABLE ULTRA/,
  );
  assert.throws(
    () => createNetworkSession({
      mode: "ultra",
      ttlMinutes: 5,
      ultraApproval: {
        approvedBy: "test-user",
        confirmation: "WRONG" as "ENABLE ULTRA",
      },
    }),
    /ENABLE ULTRA/,
  );
});

void test("Ultra records the explicit approver and can be revoked", () => {
  const created = createNetworkSession({
    mode: "ultra",
    ttlMinutes: 5,
    ultraApproval: {
      approvedBy: "test-user",
      confirmation: "ENABLE ULTRA",
    },
  });
  assert.equal(created.session.mode, "ultra");
  assert.equal(created.session.ultraApprovedBy, "test-user");
  assert.match(created.session.ultraApprovedAt ?? "", /^\d{4}-\d{2}-\d{2}T/);

  const revoked = updateNetworkSession({
    sessionId: created.session.id,
    token: created.token,
    mode: "ask_first",
  });
  assert.equal(revoked.mode, "ask_first");
  assert.equal(revoked.ultraApprovedBy, undefined);
  assert.equal(revoked.ultraApprovedAt, undefined);
});

void test("an existing Ask First session cannot upgrade without confirmation", () => {
  const created = createNetworkSession({ mode: "ask_first", ttlMinutes: 5 });
  assert.throws(
    () => updateNetworkSession({
      sessionId: created.session.id,
      token: created.token,
      mode: "ultra",
    }),
    /ENABLE ULTRA/,
  );

  const upgraded = updateNetworkSession({
    sessionId: created.session.id,
    token: created.token,
    mode: "ultra",
    ultraApproval: {
      approvedBy: "test-user",
      confirmation: "ENABLE ULTRA",
    },
  });
  assert.equal(upgraded.mode, "ultra");
  assert.equal(upgraded.ultraApprovedBy, "test-user");
});
