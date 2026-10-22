import { createRootRouteWithContext } from "@tanstack/react-router";

import { AppShell } from "@/app/layout/AppShell";
import { FalhaPortal } from "@/app/layout/FalhaPortal";
import type { WebContext } from "@/app/router";

export const Route = createRootRouteWithContext<WebContext>()({
  component: AppShell,
  errorComponent: FalhaPortal,
});
