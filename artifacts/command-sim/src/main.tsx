import { createRoot } from "react-dom/client";

import App from "./App";
import { installAdvisorRequestGuard } from "./lib/advisor-request-guard";
import { installNetworkPermissionGuard } from "./lib/network-permission-guard";

import "./index.css";

installNetworkPermissionGuard();
installAdvisorRequestGuard();

createRoot(document.getElementById("root")!).render(<App />);
