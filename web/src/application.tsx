import React from "react";
import { createRoot } from "react-dom/client";
import "antd/dist/reset.css";
import "./styles/globals.css";
import "./styles/auth-input-fix.css";
import "./styles/shared/model-picker.css";
import "./styles/shared/overlays.css";
import "./styles/shared/scrollbars.css";
import { RouterProvider } from "react-router";

import { AppProviders } from "@/components/layout/app-providers";
import { router } from "@/router";
import { VisualEngineRuntimeHost } from "@/supdance/plugins/visual-engine/runtime/visual-engine-runtime-host";

document.body.style.fontFamily = '"SF Pro Display","SF Pro Text","PingFang SC","Microsoft YaHei","Helvetica Neue",sans-serif';

createRoot(document.getElementById("root")!).render(
    <React.StrictMode>
        <AppProviders>
            <VisualEngineRuntimeHost navigation={router} />
            <RouterProvider router={router} useTransitions={false} />
        </AppProviders>
    </React.StrictMode>,
);
