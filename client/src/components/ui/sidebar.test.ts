import * as sidebar from "./sidebar";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

describe("sidebar public API", () => {
  it("preserves the shared component exports", () => {
    expect(Object.keys(sidebar).sort()).toEqual([
      "Sidebar",
      "SidebarContent",
      "SidebarFooter",
      "SidebarGroup",
      "SidebarGroupAction",
      "SidebarGroupContent",
      "SidebarGroupLabel",
      "SidebarHeader",
      "SidebarInput",
      "SidebarInset",
      "SidebarMenu",
      "SidebarMenuAction",
      "SidebarMenuBadge",
      "SidebarMenuButton",
      "SidebarMenuItem",
      "SidebarMenuSkeleton",
      "SidebarMenuSub",
      "SidebarMenuSubButton",
      "SidebarMenuSubItem",
      "SidebarProvider",
      "SidebarRail",
      "SidebarSeparator",
      "SidebarTrigger",
      "useSidebar",
    ]);
  });

  it("composes the provider, shell, layout, and menu modules", () => {
    const markup = renderToStaticMarkup(
      createElement(
        sidebar.SidebarProvider,
        null,
        createElement(
          sidebar.Sidebar,
          { collapsible: "none" },
          createElement(
            sidebar.SidebarContent,
            null,
            createElement(
              sidebar.SidebarMenu,
              null,
              createElement(
                sidebar.SidebarMenuItem,
                null,
                createElement(sidebar.SidebarMenuButton, null, "Overview")
              )
            )
          )
        )
      )
    );

    expect(markup).toContain('data-slot="sidebar-wrapper"');
    expect(markup).toContain('data-slot="sidebar"');
    expect(markup).toContain('data-slot="sidebar-menu-button"');
    expect(markup).toContain("Overview");
  });
});
