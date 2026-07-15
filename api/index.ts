import { installModelNetworkGuard } from "../artifacts/api-server/src/lib/model-network-guard";
import { initializeTelemetry } from "../artifacts/api-server/src/lib/telemetry";

installModelNetworkGuard();
await initializeTelemetry();
const { default: app } = await import("../artifacts/api-server/src/app");

export default app;
