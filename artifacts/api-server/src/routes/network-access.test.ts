import test from "node:test";
import assert from "node:assert/strict";
import type { AddressInfo } from "node:net";
import express from "express";
import {
  NetworkApprovalRequiredError,
  requireNetworkAccess,
} from "../lib/network-access";
import networkRouter from "./network-access";

void test("Ultra and Ask First approval require the server-side permission token", async () => {
  const previous = process.env.NETWORK_PERMISSION_ADMIN_TOKEN;
  const adminToken = "network-permission-test-token-0001";
  process.env.NETWORK_PERMISSION_ADMIN_TOKEN = adminToken;

  const app = express();
  app.use(express.json());
  app.use("/api", networkRouter);
  const server = app.listen(0);
  await new Promise<void>((resolve, reject) => {
    server.once("listening", resolve);
    server.once("error", reject);
  });

  try {
    const address = server.address() as AddressInfo;
    const origin = `http://127.0.0.1:${address.port}`;

    const askResponse = await fetch(`${origin}/api/network/sessions`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ mode: "ask_first", ttlMinutes: 5 }),
    });
    assert.equal(askResponse.status, 201);
    const askBody = await askResponse.json() as {
      session: { id: string; mode: string };
      token: string;
    };
    assert.equal(askBody.session.mode, "ask_first");

    const ultraWithoutAdmin = await fetch(`${origin}/api/network/sessions`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        mode: "ultra",
        ttlMinutes: 5,
        ultraApproval: { confirmation: "ENABLE ULTRA" },
      }),
    });
    assert.equal(ultraWithoutAdmin.status, 401);

    const ultraWithWrongAdmin = await fetch(`${origin}/api/network/sessions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Network-Permission-Token": "wrong-network-permission-token",
      },
      body: JSON.stringify({
        mode: "ultra",
        ttlMinutes: 5,
        ultraApproval: { confirmation: "ENABLE ULTRA" },
      }),
    });
    assert.equal(ultraWithWrongAdmin.status, 403);

    const ultraWithAdmin = await fetch(`${origin}/api/network/sessions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Network-Permission-Token": adminToken,
        "X-Network-Permission-Actor": "route-test-user",
      },
      body: JSON.stringify({
        mode: "ultra",
        ttlMinutes: 5,
        ultraApproval: { confirmation: "ENABLE ULTRA" },
      }),
    });
    assert.equal(ultraWithAdmin.status, 201);
    const ultraBody = await ultraWithAdmin.json() as {
      session: { mode: string; ultraApprovedBy?: string };
    };
    assert.equal(ultraBody.session.mode, "ultra");
    assert.equal(ultraBody.session.ultraApprovedBy, "route-test-user");

    let approvalId = "";
    await assert.rejects(
      () => requireNetworkAccess({
        sessionId: askBody.session.id,
        token: askBody.token,
        capability: "web_fetch",
        targetUrl: "https://1.1.1.1/test",
        reason: "Create a deterministic pending approval without performing a network request.",
      }),
      error => {
        assert.ok(error instanceof NetworkApprovalRequiredError);
        approvalId = error.approval.id;
        return true;
      },
    );
    assert.ok(approvalId);

    const approvalWithoutAdmin = await fetch(
      `${origin}/api/network/sessions/${encodeURIComponent(askBody.session.id)}/approvals/${encodeURIComponent(approvalId)}`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Network-Session-Token": askBody.token,
        },
        body: JSON.stringify({ decision: "approved" }),
      },
    );
    assert.equal(approvalWithoutAdmin.status, 401);

    const approvalWithAdmin = await fetch(
      `${origin}/api/network/sessions/${encodeURIComponent(askBody.session.id)}/approvals/${encodeURIComponent(approvalId)}`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Network-Session-Token": askBody.token,
          "X-Network-Permission-Token": adminToken,
        },
        body: JSON.stringify({ decision: "approved" }),
      },
    );
    assert.equal(approvalWithAdmin.status, 200);
  } finally {
    await new Promise<void>(resolve => server.close(() => resolve()));
    if (previous === undefined) delete process.env.NETWORK_PERMISSION_ADMIN_TOKEN;
    else process.env.NETWORK_PERMISSION_ADMIN_TOKEN = previous;
  }
});
