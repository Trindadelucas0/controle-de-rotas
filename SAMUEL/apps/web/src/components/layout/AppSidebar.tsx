'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { NAV_ICONS } from '@/components/layout/app-icons';
import { isNavActive, visibleNavGroups } from '@/components/layout/AppNav';
import type { SessionUser } from '@/lib/auth';
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar,
} from '@/components/ui/sidebar';

export function AppSidebar({ user }: { user: SessionUser }) {
  const pathname = usePathname();
  const { isMobile, setOpenMobile } = useSidebar();
  const groups = visibleNavGroups(user);

  return (
    <Sidebar collapsible="offcanvas">
      <SidebarHeader className="border-b border-sidebar-border px-3 py-3">
        <p className="text-[15px] font-semibold tracking-tight text-sidebar-foreground">Rotas</p>
        <p className="truncate text-xs text-muted-foreground">{user.company.name}</p>
      </SidebarHeader>
      <SidebarContent>
        {groups.map((g) => (
          <SidebarGroup key={g.id}>
            <SidebarGroupLabel className="text-[10px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
              {g.label}
            </SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                {g.items.map((item) => {
                  const Icon = NAV_ICONS[item.href];
                  const active = isNavActive(pathname, item.href);
                  return (
                    <SidebarMenuItem key={item.href}>
                      <SidebarMenuButton
                        isActive={active}
                        tooltip={item.label}
                        className={
                          active
                            ? 'bg-sidebar-primary text-sidebar-primary-foreground hover:bg-sidebar-primary hover:text-sidebar-primary-foreground'
                            : undefined
                        }
                        render={<Link href={item.href} />}
                        onClick={() => {
                          if (isMobile) setOpenMobile(false);
                        }}
                      >
                        {Icon ? <Icon aria-hidden="true" /> : null}
                        <span>{item.label}</span>
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                  );
                })}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        ))}
      </SidebarContent>
    </Sidebar>
  );
}
