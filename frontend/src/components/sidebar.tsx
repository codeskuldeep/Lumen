"use client";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useQueryClient } from "@tanstack/react-query";
import { LayoutGrid, LogOut, Settings } from "lucide-react";
import { AlertsBell } from "@/components/alerts-bell";
import { Logo } from "@/components/logo";
import { tokenStore } from "@/lib/api";
import { useClients } from "@/lib/hooks";
import type { User } from "@/lib/types";
import { cn } from "@/lib/utils";

export function Sidebar({ user }: { user: User }) {
  const path = usePathname();
  const router = useRouter();
  const qc = useQueryClient();
  const clients = useClients();

  const logout = () => { tokenStore.clear(); qc.clear(); router.replace("/login"); };
  const item = (href: string, active: boolean) =>
    cn("flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm transition-all", active ? "bg-white/10 text-fg shadow-[inset_0_1px_0_rgba(255,255,255,.12)]" : "text-muted hover:bg-white/6 hover:text-fg");

  return (
    <>
      <aside className="glass sticky top-5 hidden h-[calc(100dvh-2.5rem)] w-64 shrink-0 flex-col p-4 md:flex">
        <div className="flex items-center justify-between px-2 pb-5 pt-1"><Logo href="/dashboard" /><AlertsBell /></div>
        <nav className="space-y-1">
          <Link href="/dashboard" className={item("/dashboard", path === "/dashboard")}><LayoutGrid className="size-4" /> Dashboard</Link>
          <Link href="/settings" className={item("/settings", path === "/settings")}><Settings className="size-4" /> Settings</Link>
        </nav>
        <div className="mb-2 mt-6 px-3 text-[11px] font-medium uppercase tracking-wider text-muted/70">Clients</div>
        <div className="-mx-1 flex-1 space-y-0.5 overflow-y-auto px-1">
          {clients.data?.map((c) => (
            <Link key={c.id} href={`/clients/${c.id}`} className={item("", path.startsWith(`/clients/${c.id}`))}>
              <span className="grid size-6 shrink-0 place-items-center rounded-md bg-gradient-to-br from-accent/60 to-accent2/50 text-[11px] font-semibold text-white">{c.name[0]?.toUpperCase()}</span>
              <span className="truncate">{c.name}</span>
            </Link>
          ))}
          {clients.data?.length === 0 && <p className="px-3 text-xs text-muted/70">No clients yet</p>}
        </div>
        <div className="mt-3 flex items-center gap-3 rounded-xl bg-white/5 p-3">
          <div className="grid size-9 place-items-center rounded-full bg-gradient-to-br from-accent to-accent2 text-sm font-semibold">{user.name[0]?.toUpperCase()}</div>
          <div className="min-w-0 flex-1">
            <div className="truncate text-sm font-medium">{user.name}</div>
            <div className="truncate text-xs text-muted">{user.agency.name}</div>
          </div>
          <button onClick={logout} aria-label="Sign out" className="rounded-lg p-2 text-muted transition hover:bg-white/10 hover:text-fg"><LogOut className="size-4" /></button>
        </div>
      </aside>

      <nav className="glass fixed inset-x-3 bottom-3 z-40 flex items-center justify-around !rounded-2xl p-2 md:hidden">
        <Link href="/dashboard" className={cn("flex flex-col items-center gap-0.5 rounded-xl px-5 py-1.5 text-[11px]", path.startsWith("/dashboard") || path.startsWith("/clients") ? "text-fg" : "text-muted")}><LayoutGrid className="size-5" />Clients</Link>
        <Link href="/settings" className={cn("flex flex-col items-center gap-0.5 rounded-xl px-5 py-1.5 text-[11px]", path === "/settings" ? "text-fg" : "text-muted")}><Settings className="size-5" />Settings</Link>
        <button onClick={logout} className="flex flex-col items-center gap-0.5 rounded-xl px-5 py-1.5 text-[11px] text-muted"><LogOut className="size-5" />Sign out</button>
      </nav>
    </>
  );
}
