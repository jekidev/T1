import { createRoot } from "react-dom/client";

import App from "./App";
import { installNetworkPermissionGuard } from "./lib/network-permission-guard";

import "./index.css";

installNetworkPermissionGuard();

createRoot(document.getElementById("root")!).render(<App />);
