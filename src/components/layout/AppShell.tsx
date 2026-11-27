"use client";

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  AlertTriangle,
  Bell,
  Building2,
  ClipboardCheck,
  CreditCard,
  Globe,
  LayoutDashboard,
  LogOut,
  Search,
  ShieldCheck,
  Sparkles,
  UserPlus,
  Users,
  X,
} from "lucide-react";
import {
  AddSquare,
  Buildings,
  ClipboardTick,
  Crown,
  DocumentText,
  MoneyRecive,
  NotificationBing,
  Profile2User,
  SecuritySafe,
  Setting2,
  Speedometer,
  UserSquare,
} from "iconsax-reactjs";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarInset,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarProvider,
  SidebarTrigger,
} from "@/components/ui/sidebar";
import { useI18n } from "@/lib/i18n";
import { useAuth } from "@/components/providers/AuthProvider";
import { createClient } from "@/lib/supabase/client";
import {
  emitDormSync,
  getCached,
  invalidateCache,
  isCacheFresh,
  setCached,
} from "@/lib/cache";
import { CommandPalette } from "@/components/layout/CommandPalette";
import { formatDateTime, getInitials } from "@/lib/utils";

interface AlertSummary {
  unpaidCount: number;
  notReturnedCount: number;
  pendingViolationsCount: number;
  recentAnnouncements: { id: string; title: string; published_at: string }[];
}

const EMPTY_ALERTS: AlertSummary = {
  unpaidCount: 0,
  notReturnedCount: 0,
  pendingViolationsCount: 0,
  recentAnnouncements: [],
};

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const { t, lang, setLang } = useI18n();
  const { profile, profileError, role, signOut } = useAuth();
  const [notifOpen, setNotifOpen] = useState(false);
  const [cmdOpen, setCmdOpen] = useState(false);
  const [sidebarSearch, setSidebarSearch] = useState("");
  const searchInputRef = useRef<HTMLInputElement>(null);
  const [syncState, setSyncState] = useState<"live" | "connecting" | "offline">(
    "connecting"
  );
  const [alerts, setAlerts] = useState<AlertSummary>(
    () => getCached<AlertSummary>("alerts", 120_000) ?? EMPTY_ALERTS
  );

  // Eagerly prefetch core routes in background for instant navigation transitions
  useEffect(() => {
    const routes = [
      "/",
      "/members",
      "/rooms",
      "/attendance",
      "/fees",
      "/violations",
      "/announcements",
      "/reports",
      "/profile",
      "/settings",
      "/glassy-demo",
    ];
    const timer = window.setTimeout(() => {
      routes.forEach((route) => {
        if (route !== pathname) {
          router.prefetch(route);
        }
      });
    }, 350);
    return () => window.clearTimeout(timer);
  }, [pathname, router]);

  // Ctrl+K opens Command Palette; "/" focuses sidebar search when not typing
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setCmdOpen((prev) => !prev);
      } else if (
        e.key === "/" &&
        !(
          document.activeElement instanceof HTMLInputElement ||
          document.activeElement instanceof HTMLTextAreaElement ||
          document.activeElement instanceof HTMLSelectElement
        )
      ) {
        e.preventDefault();
        searchInputRef.current?.focus();
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  const loadAlerts = useCallback(
    async (force = false) => {
      const supabase = createClient();
      if (!supabase || !profile) return;

      if (!force && isCacheFresh("alerts", 25_000)) {
        const cached = getCached<AlertSummary>("alerts", 120_000);
        if (cached) {
          setAlerts(cached);
          return;
        }
      }

      const [unpaidRes, violRes, annRes, logsRes] = await Promise.all([
        supabase
          .from("payments")
          .select("id", { count: "exact", head: true })
          .neq("status", "paid"),
        supabase
          .from("violations")
          .select("id", { count: "exact", head: true })
          .eq("status", "pending"),
        supabase
          .from("announcements")
          .select("id, title, published_at")
          .order("published_at", { ascending: false })
          .limit(3),
        supabase
          .from("attendance_logs")
          .select("member_id, log_type, recorded_at")
          .order("recorded_at", { ascending: false })
          .limit(150),
      ]);

      const latestByMember = new Map<string, string>();
      (logsRes.data ?? []).forEach(
        (log: { member_id: string; log_type: string }) => {
          if (!latestByMember.has(log.member_id)) {
            latestByMember.set(log.member_id, log.log_type);
          }
        }
      );
      let notReturned = 0;
      latestByMember.forEach((lt) => {
        if (lt === "check_out" || lt === "absent" || lt === "late") {
          notReturned += 1;
        }
      });

      const next: AlertSummary = {
        unpaidCount: unpaidRes.count ?? 0,
        notReturnedCount: notReturned,
        pendingViolationsCount: violRes.count ?? 0,
        recentAnnouncements: annRes.data ?? [],
      };
      setAlerts(next);
      setCached("alerts", next);
    },
    [profile]
  );

  useEffect(() => {
    loadAlerts(false);
  }, [loadAlerts]);

  useEffect(() => {
    const onRefresh = () => loadAlerts(true);
    window.addEventListener("dorm:refresh-alerts", onRefresh);
    return () => window.removeEventListener("dorm:refresh-alerts", onRefresh);
  }, [loadAlerts]);

  // Supabase Realtime multi-device auto-sync + window focus / online refresh
  useEffect(() => {
    const supabase = createClient();
    const updateOnline = () => {
      if (!navigator.onLine) setSyncState("offline");
    };
    window.addEventListener("offline", updateOnline);

    const onFocusOrOnline = () => {
      if (navigator.onLine) {
        if (!isCacheFresh("alerts", 25_000)) {
          loadAlerts(true);
          emitDormSync();
        }
      }
    };
    window.addEventListener("online", onFocusOrOnline);
    const onVisibility = () => {
      if (document.visibilityState === "visible") onFocusOrOnline();
    };
    document.addEventListener("visibilitychange", onVisibility);

    if (!supabase || !profile) {
      return () => {
        window.removeEventListener("offline", updateOnline);
        window.removeEventListener("online", onFocusOrOnline);
        document.removeEventListener("visibilitychange", onVisibility);
      };
    }

    let debounceTimer: number | null = null;
    const scheduleSync = (table?: string) => {
      if (debounceTimer !== null) window.clearTimeout(debounceTimer);
      debounceTimer = window.setTimeout(() => {
        invalidateCache();
        loadAlerts(true);
        emitDormSync(table);
      }, 450);
    };

    const tables = [
      "members",
      "rooms",
      "buildings",
      "payments",
      "attendance_logs",
      "violations",
      "announcements",
    ];
    let channel = supabase.channel("dorm-live-sync");
    tables.forEach((table) => {
      channel = channel.on(
        "postgres_changes",
        { event: "*", schema: "public", table },
        () => scheduleSync(table)
      );
    });
    channel.subscribe((status) => {
      if (status === "SUBSCRIBED") setSyncState("live");
      else if (status === "CHANNEL_ERROR" || status === "TIMED_OUT")
        setSyncState(navigator.onLine ? "connecting" : "offline");
    });

    return () => {
      if (debounceTimer !== null) window.clearTimeout(debounceTimer);
      window.removeEventListener("offline", updateOnline);
      window.removeEventListener("online", onFocusOrOnline);
      document.removeEventListener("visibilitychange", onVisibility);
      supabase.removeChannel(channel);
    };
  }, [profile, loadAlerts]);

  const handleToggleLanguage = async () => {
    const next = lang === "th" ? "vi" : "th";
    setLang(next);
    const supabase = createClient();
    if (supabase && profile) {
      await supabase
        .from("profiles")
        .update({ preferred_language: next })
        .eq("id", profile.id);
    }
  };

  const mainNav = useMemo(
    () => [
      {
        href: "/",
        label: t.nav.dashboard,
        icon: Speedometer,
        badge: null as string | null,
      },
      {
        href: "/members",
        label: t.nav.members,
        icon: Profile2User,
        badge: null as string | null,
      },
      {
        href: "/rooms",
        label: t.nav.rooms,
        icon: Buildings,
        badge: null as string | null,
      },
      {
        href: "/attendance",
        label: t.nav.attendance,
        icon: ClipboardTick,
        badge:
          alerts.notReturnedCount > 0 ? String(alerts.notReturnedCount) : null,
      },
      {
        href: "/fees",
        label: t.nav.fees,
        icon: MoneyRecive,
        badge: alerts.unpaidCount > 0 ? String(alerts.unpaidCount) : null,
      },
      {
        href: "/violations",
        label: t.nav.violations,
        icon: SecuritySafe,
        badge:
          alerts.pendingViolationsCount > 0
            ? String(alerts.pendingViolationsCount)
            : null,
      },
      {
        href: "/announcements",
        label: t.nav.announcements,
        icon: NotificationBing,
        badge: null as string | null,
      },
      {
        href: "/reports",
        label: t.nav.reports,
        icon: DocumentText,
        badge: null as string | null,
      },
    ],
    [t, alerts]
  );

  const systemNav = useMemo(
    () => [
      {
        href: "/profile",
        label: t.nav.profile,
        icon: UserSquare,
        badge: null as string | null,
      },
      {
        href: "/users",
        label: t.nav.users,
        icon: SecuritySafe,
        badge: null as string | null,
      },
      {
        href: "/settings",
        label: t.nav.settings,
        icon: Setting2,
        badge: null as string | null,
      },
      {
        href: "/glassy-demo",
        label: t.nav.glassyView,
        icon: Crown,
        badge: "Pro",
      },
    ],
    [t]
  );

  const q = sidebarSearch.trim().toLowerCase();
  const filteredMainNav = q
    ? mainNav.filter((item) => item.label.toLowerCase().includes(q))
    : mainNav;
  const filteredSystemNav = q
    ? systemNav.filter((item) => item.label.toLowerCase().includes(q))
    : systemNav;

  const allNavLabels = [
    ...mainNav.map((i) => ({ href: i.href, label: i.label })),
    ...systemNav.map((i) => ({ href: i.href, label: i.label })),
  ];

  const currentPageLabel =
    allNavLabels.find((item) =>
      item.href === "/" ? pathname === "/" : pathname.startsWith(item.href)
    )?.label ?? t.appName;

  const totalNotifCount =
    (alerts.unpaidCount > 0 ? 1 : 0) +
    (alerts.notReturnedCount > 0 ? 1 : 0) +
    (alerts.pendingViolationsCount > 0 ? 1 : 0);

  return (
    <SidebarProvider
      style={{ "--sidebar-width": "18rem" } as React.CSSProperties}
      className="min-h-screen w-full bg-slate-50/90 text-slate-900"
    >
      {/* Sidebar5 Pro Architecture */}
      <Sidebar className="no-print border-r border-slate-200/80 bg-white/85 backdrop-blur-md">
        <SidebarHeader className="border-b border-slate-200/70 px-5 py-4">
          <div className="flex items-center justify-between gap-2">
            <Link href="/" className="flex items-center gap-2.5 min-w-0">
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-primary text-primary-foreground shadow-sm">
                <ShieldCheck className="h-5 w-5" />
              </div>
              <div className="min-w-0">
                <p className="text-sm font-bold tracking-tight text-slate-900 truncate">
                  {t.appName}
                </p>
                <p className="text-[10px] font-medium text-slate-500 truncate">
                  {t.appSubtitle}
                </p>
              </div>
            </Link>

            <Button
              variant="ghost"
              size="icon"
              type="button"
              onClick={() => setNotifOpen((prev) => !prev)}
              className="relative h-8 w-8 rounded-full text-slate-500 hover:bg-slate-100 hover:text-slate-900"
              aria-label="Notifications"
            >
              <Bell className="size-4" />
              {totalNotifCount > 0 && (
                <span className="absolute right-1 top-1 h-2 w-2 rounded-full bg-rose-600" />
              )}
            </Button>
          </div>

          <div className="relative mt-3 w-full">
            <Search className="absolute top-2.5 left-3 h-4 w-4 text-slate-400" />
            <Input
              ref={searchInputRef}
              value={sidebarSearch}
              onChange={(e) => setSidebarSearch(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && filteredMainNav[0]) {
                  router.push(filteredMainNav[0].href);
                } else if (e.key === "Escape") {
                  setSidebarSearch("");
                  e.currentTarget.blur();
                }
              }}
              placeholder={t.common.search}
              className="h-9 bg-slate-50/80 pl-9 pr-14 text-xs shadow-none border-slate-200 focus-visible:bg-white"
            />
            {sidebarSearch ? (
              <button
                type="button"
                onClick={() => setSidebarSearch("")}
                aria-label="Clear search"
                className="absolute right-2.5 top-2 rounded p-0.5 text-slate-400 hover:bg-slate-200/70 hover:text-slate-700"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            ) : (
              <kbd className="pointer-events-none absolute right-2.5 top-2 hidden rounded border border-slate-200 bg-white px-1.5 py-0.5 text-[10px] font-medium text-slate-400 lg:inline-block">
                /
              </kbd>
            )}
          </div>
        </SidebarHeader>

        <SidebarContent className="px-3 py-3">
          <SidebarGroup>
            <SidebarGroupLabel className="px-2 text-[11px] font-semibold tracking-wider text-slate-400 uppercase">
              {t.nav.mainMenu}
            </SidebarGroupLabel>
            <SidebarGroupContent className="mt-1.5">
              <SidebarMenu className="gap-1">
                {filteredMainNav.map((item) => {
                  const active =
                    item.href === "/"
                      ? pathname === "/"
                      : pathname.startsWith(item.href);
                  const Icon = item.icon;
                  return (
                    <SidebarMenuItem key={item.href}>
                      <SidebarMenuButton
                        asChild
                        isActive={active}
                        className="group flex h-10 w-full items-center justify-between rounded-xl px-3 transition-all hover:bg-primary/5 data-[active=true]:bg-primary data-[active=true]:text-primary-foreground data-[active=true]:hover:bg-primary/90"
                      >
                        <Link href={item.href} prefetch>
                          <div className="flex items-center gap-3 min-w-0">
                            <Icon
                              className="size-5 shrink-0 transition-transform group-hover:scale-105"
                              variant={active ? "Bulk" : "Linear"}
                            />
                            <span className="font-medium truncate">
                              {item.label}
                            </span>
                          </div>
                          {item.badge && (
                            <Badge
                              variant={active ? "secondary" : "amber"}
                              className="ml-auto h-5 px-1.5 text-[10px]"
                            >
                              {item.badge}
                            </Badge>
                          )}
                        </Link>
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                  );
                })}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>

          <SidebarGroup className="mt-3">
            <SidebarGroupLabel className="px-2 text-[11px] font-semibold tracking-wider text-slate-400 uppercase">
              {t.nav.systemViews}
            </SidebarGroupLabel>
            <SidebarGroupContent className="mt-1.5">
              <SidebarMenu className="gap-1">
                {filteredSystemNav.map((item) => {
                  const active = pathname.startsWith(item.href);
                  const Icon = item.icon;
                  return (
                    <SidebarMenuItem key={item.href}>
                      <SidebarMenuButton
                        asChild
                        isActive={active}
                        className="group flex h-10 w-full items-center justify-between rounded-xl px-3 transition-all hover:bg-primary/5 data-[active=true]:bg-primary data-[active=true]:text-primary-foreground data-[active=true]:hover:bg-primary/90"
                      >
                        <Link href={item.href} prefetch>
                          <div className="flex items-center gap-3 min-w-0">
                            <Icon
                              className="size-5 shrink-0 transition-transform group-hover:scale-105"
                              variant={active ? "Bulk" : "Linear"}
                            />
                            <span className="font-medium truncate">
                              {item.label}
                            </span>
                          </div>
                          {item.badge && (
                            <Badge
                              variant={active ? "secondary" : "navy"}
                              className="ml-auto h-5 px-1.5 text-[10px]"
                            >
                              {item.badge}
                            </Badge>
                          )}
                        </Link>
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                  );
                })}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>

          {/* Dormitory Quick Action Card (Sidebar5 Pro Card Style) */}
          <div className="px-2 pt-3 mt-auto">
            <div className="rounded-xl border border-primary/20 bg-gradient-to-br from-primary/10 via-primary/5 to-blue-500/10 p-3.5">
              <div className="mb-1.5 flex items-center gap-2">
                <Crown className="size-4.5 text-primary" variant="Bulk" />
                <h5 className="text-xs font-bold text-slate-900">
                  {t.nav.quickCardTitle}
                </h5>
              </div>
              <p className="mb-3 text-[11px] text-slate-600 leading-relaxed">
                {t.nav.quickCardDesc}
              </p>
              <Button asChild variant="default" size="sm" className="w-full gap-1.5 rounded-lg text-xs">
                <Link href="/attendance" prefetch>
                  <AddSquare className="size-4" variant="Bold" />
                  {t.nav.quickCardBtn}
                </Link>
              </Button>
            </div>
          </div>
        </SidebarContent>

        <SidebarFooter className="border-t border-slate-200/70 p-3.5 space-y-2">
          {profile && (
            <div className="flex w-full items-center gap-3 rounded-xl p-2 bg-slate-50/80 border border-slate-200/60">
              <Avatar className="h-9 w-9 shrink-0">
                <AvatarFallback className="bg-primary/10 font-bold text-primary text-xs">
                  {getInitials(profile.full_name)}
                </AvatarFallback>
              </Avatar>
              <div className="flex flex-1 flex-col overflow-hidden">
                <span className="truncate text-xs font-bold text-slate-900">
                  {profile.full_name}
                </span>
                <span className="truncate text-[10px] text-slate-500">
                  {t.roles[role]}
                </span>
              </div>
              <Link
                href="/profile"
                className="text-slate-400 hover:text-slate-700 p-1"
                title={t.nav.profile}
              >
                <Setting2 className="size-4" />
              </Link>
            </div>
          )}

          <button
            type="button"
            onClick={signOut}
            className="flex w-full items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-medium text-slate-700 hover:bg-rose-50 hover:border-rose-200 hover:text-rose-700 transition-colors"
          >
            <LogOut className="h-3.5 w-3.5" />
            {t.common.logout}
          </button>
        </SidebarFooter>
      </Sidebar>

      {/* Main Inset Content */}
      <SidebarInset className="flex-1 flex flex-col min-w-0 bg-slate-50/90">
        {/* Top Bar */}
        <header className="no-print sticky top-0 z-30 flex items-center justify-between gap-3 border-b border-slate-200/80 bg-white/95 backdrop-blur-md px-4 py-3 sm:px-6">
          <div className="flex items-center gap-3 min-w-0">
            <SidebarTrigger className="rounded-xl border border-slate-200 h-9 w-9 text-slate-700 hover:bg-slate-100" />
            <div className="min-w-0">
              <p className="text-[11px] font-medium text-slate-400 hidden sm:block">
                {t.appName}
              </p>
              <p className="text-sm sm:text-base font-bold text-navy-950 truncate">
                {currentPageLabel}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setCmdOpen(true)}
              className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-slate-50/90 px-2.5 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-100 hover:text-slate-900 transition-colors"
              aria-label="Quick Search"
            >
              <Search className="h-3.5 w-3.5 text-slate-400" />
              <span className="hidden sm:inline">
                {lang === "vi" ? "Tìm nhanh" : "ค้นหาด่วน"}
              </span>
              <kbd className="hidden lg:inline-block rounded border border-slate-200 bg-white px-1 py-0.2 text-[10px] text-slate-400">
                Ctrl K
              </kbd>
            </button>

            <span
              title={
                syncState === "live"
                  ? "Realtime Sync Active"
                  : syncState === "offline"
                    ? "Offline"
                    : "Connecting..."
              }
              className={`hidden sm:inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-medium transition-colors ${
                syncState === "live"
                  ? "border-emerald-200 bg-emerald-50/90 text-emerald-700"
                  : syncState === "offline"
                    ? "border-rose-200 bg-rose-50 text-rose-700"
                    : "border-slate-200 bg-slate-50 text-slate-500"
              }`}
            >
              <span
                className={`h-1.5 w-1.5 rounded-full ${
                  syncState === "live"
                    ? "bg-emerald-500 animate-pulse"
                    : syncState === "offline"
                      ? "bg-rose-500"
                      : "bg-slate-400"
                }`}
              />
              <span>
                {syncState === "live"
                  ? "Live"
                  : syncState === "offline"
                    ? "Offline"
                    : "Sync"}
              </span>
            </span>

            <Link
              href="/glassy-demo"
              prefetch
              className="hidden lg:inline-flex items-center gap-1.5 rounded-xl border border-indigo-200 bg-indigo-50 px-3 py-1.5 text-xs font-semibold text-indigo-800 hover:bg-indigo-100 transition-colors"
            >
              <Sparkles className="h-3.5 w-3.5" />
              {t.nav.glassyView}
            </Link>
            <Link
              href="/members"
              prefetch
              className="hidden md:inline-flex items-center gap-1.5 rounded-xl bg-primary px-3 py-1.5 text-xs font-semibold text-primary-foreground hover:bg-primary/90 transition-colors"
            >
              <UserPlus className="h-3.5 w-3.5" />
              {t.nav.members}
            </Link>

            <button
              type="button"
              onClick={handleToggleLanguage}
              className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs font-semibold text-navy-900 hover:bg-navy-50 hover:border-navy-200 transition-colors"
              title="Switch Language (TH / VI)"
            >
              <Globe className="h-3.5 w-3.5 text-navy-600" />
              <span>{lang === "th" ? "🇹🇭 ไทย" : "🇻🇳 Tiếng Việt"}</span>
            </button>

            <div className="relative">
              <button
                type="button"
                onClick={() => setNotifOpen((prev) => !prev)}
                className="relative rounded-xl border border-slate-200 bg-white p-2 text-slate-600 hover:bg-slate-50 transition-colors"
                aria-label="Notifications"
              >
                <Bell className="h-4 w-4" />
                {totalNotifCount > 0 && (
                  <span className="absolute -right-1 -top-1 flex h-4 w-4 items-center justify-center rounded-full bg-rose-600 text-[10px] font-bold text-white">
                    {totalNotifCount}
                  </span>
                )}
              </button>

              {notifOpen && (
                <>
                  <div
                    className="fixed inset-0 z-30"
                    onClick={() => setNotifOpen(false)}
                  />
                  <div className="absolute right-0 z-40 mt-2 w-80 rounded-2xl border border-slate-200 bg-white p-4 shadow-xl">
                    <div className="flex items-center justify-between pb-2 border-b border-slate-100">
                      <h4 className="text-sm font-semibold text-slate-900">
                        {t.common.notifications}
                      </h4>
                      <button
                        type="button"
                        onClick={() => setNotifOpen(false)}
                        className="text-slate-400 hover:text-slate-600"
                      >
                        <X className="h-4 w-4" />
                      </button>
                    </div>
                    <div className="mt-3 space-y-2 text-xs">
                      {alerts.unpaidCount > 0 && (
                        <Link
                          href="/fees"
                          onClick={() => setNotifOpen(false)}
                          className="block rounded-xl bg-amber-50 border border-amber-200 px-3 py-2 text-amber-900 hover:bg-amber-100"
                        >
                          {t.dashboard.unpaidMembers}:{" "}
                          <strong className="font-bold">
                            {alerts.unpaidCount}
                          </strong>
                        </Link>
                      )}
                      {alerts.notReturnedCount > 0 && (
                        <Link
                          href="/attendance"
                          onClick={() => setNotifOpen(false)}
                          className="block rounded-xl bg-rose-50 border border-rose-200 px-3 py-2 text-rose-900 hover:bg-rose-100"
                        >
                          {t.attendance.notReturnedTitle}:{" "}
                          <strong className="font-bold">
                            {alerts.notReturnedCount}
                          </strong>
                        </Link>
                      )}
                      {alerts.pendingViolationsCount > 0 && (
                        <Link
                          href="/violations"
                          onClick={() => setNotifOpen(false)}
                          className="block rounded-xl bg-purple-50 border border-purple-200 px-3 py-2 text-purple-900 hover:bg-purple-100"
                        >
                          {t.violations.statusPending}:{" "}
                          <strong className="font-bold">
                            {alerts.pendingViolationsCount}
                          </strong>
                        </Link>
                      )}
                      {totalNotifCount === 0 && (
                        <p className="text-slate-500 py-2">
                          {t.common.noNotifications}
                        </p>
                      )}
                      {alerts.recentAnnouncements.length > 0 && (
                        <div className="pt-2 border-t border-slate-100">
                          <p className="font-semibold text-slate-700 mb-1.5">
                            {t.dashboard.latestAnnouncements}
                          </p>
                          <div className="space-y-1.5">
                            {alerts.recentAnnouncements.map((a) => (
                              <Link
                                key={a.id}
                                href="/announcements"
                                onClick={() => setNotifOpen(false)}
                                className="block rounded-lg bg-slate-50 px-2.5 py-1.5 hover:bg-slate-100"
                              >
                                <p className="font-medium text-slate-800 truncate">
                                  {a.title}
                                </p>
                                <p className="text-[10px] text-slate-400">
                                  {formatDateTime(a.published_at, lang)}
                                </p>
                              </Link>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                </>
              )}
            </div>
          </div>
        </header>

        {profileError && (
          <div className="no-print mx-4 mt-4 sm:mx-6 rounded-2xl border border-rose-300 bg-rose-50 px-4 py-3 text-xs sm:text-sm text-rose-900 flex items-start gap-3">
            <AlertTriangle className="h-5 w-5 text-rose-600 shrink-0 mt-0.5" />
            <div>
              <p className="font-semibold">
                {lang === "vi"
                  ? "Chưa thể tải hồ sơ quyền hạn từ Supabase"
                  : "ไม่สามารถโหลดสิทธิ์ผู้ใช้งานจาก Supabase ได้"}
                {" "}({profileError})
              </p>
              <p className="text-xs text-rose-700 mt-0.5">
                {lang === "vi"
                  ? "Vui lòng chạy phần GRANT SQL ở cuối file supabase/schema.sql trong Supabase SQL Editor rồi tải lại trang."
                  : "กรุณารันคำสั่ง GRANT ในส่วนท้ายของไฟล์ supabase/schema.sql ใน Supabase SQL Editor แล้วกด Refresh (F5) ครับ"}
              </p>
            </div>
          </div>
        )}

        <main
          key={pathname}
          className="animate-fade-up flex-1 p-4 sm:p-6 pb-20 md:pb-8 max-w-7xl w-full mx-auto"
        >
          {children}
        </main>

        {/* Mobile Bottom Quick Control Bar */}
        <nav className="no-print fixed bottom-0 inset-x-0 z-30 flex items-center justify-around border-t border-slate-200 bg-white/95 backdrop-blur-md py-1.5 md:hidden">
          {[
            { href: "/", icon: LayoutDashboard, label: t.nav.dashboard },
            { href: "/members", icon: Users, label: t.nav.members },
            { href: "/rooms", icon: Building2, label: t.nav.rooms },
            { href: "/attendance", icon: ClipboardCheck, label: t.nav.attendance },
            { href: "/fees", icon: CreditCard, label: t.nav.fees },
          ].map((item) => {
            const Icon = item.icon;
            const active =
              item.href === "/"
                ? pathname === "/"
                : pathname.startsWith(item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                prefetch
                className={`flex flex-col items-center gap-0.5 px-2 py-1 rounded-lg text-[10px] font-medium ${
                  active ? "text-primary font-semibold" : "text-slate-500"
                }`}
              >
                <Icon className="h-4 w-4" />
                <span className="max-w-[64px] truncate">{item.label}</span>
              </Link>
            );
          })}
        </nav>
      </SidebarInset>
      <CommandPalette open={cmdOpen} onClose={() => setCmdOpen(false)} />
    </SidebarProvider>
  );
}
