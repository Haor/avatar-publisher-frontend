import { startTransition, useState, useCallback, useRef, useEffect } from "react";

import { useTranslation } from "react-i18next";
import { ApiProvider } from "./ApiContext";
import { ConnectionProvider, useConnection } from "./ConnectionContext";
import { AccountsProvider } from "./AccountsContext";
import { ActivePublishProvider } from "./ActivePublishContext";
import { NavigationProvider, useNavigation } from "./NavigationContext";
import { ToastProvider } from "./ToastContext";
import { Sidebar } from "./Sidebar";
import { SearchPalette } from "../features/search/SearchPalette";
import { useKeyboardShortcuts } from "../shared/hooks/useKeyboardShortcuts";
import type { PageKey } from "./navigation";
import { HomePage } from "../features/home/HomePage";
import { LibraryPage } from "../features/library/LibraryPage";
import { PublishPage } from "../features/publish/PublishPage";
import { HistoryPage } from "../features/history/HistoryPage";
import { AccountsPage } from "../features/accounts/AccountsPage";
import { SettingsPage } from "../features/settings/SettingsPage";
import { RuntimeServiceBanner } from "../shared/components/RuntimeServiceBanner";
import { RuntimeBootstrapScreenInner } from "../shared/components/RuntimeBootstrapScreen";
import { useApi } from "./ApiContext";
import i18n from "../i18n";
import { applyLanguagePreference } from "../i18n";

const pageEntries: { key: PageKey; component: React.ComponentType }[] = [
  { key: "home", component: HomePage },
  { key: "library", component: LibraryPage },
  { key: "publish", component: PublishPage },
  { key: "history", component: HistoryPage },
  { key: "accounts", component: AccountsPage },
  { key: "settings", component: SettingsPage },
];

/**
 * 页面容器 — 每次切入时播放 CSS 进场动画
 * Page 组件始终保持同一实例 (KeepAlive)
 */
function PageSlot({ pageKey, active, children }: { pageKey: string; active: boolean; children: React.ReactNode }) {
  const [animating, setAnimating] = useState(false);

  useEffect(() => {
    if (!active) return;
    setAnimating(true);
    const timer = setTimeout(() => setAnimating(false), 420);
    return () => clearTimeout(timer);
  }, [active]);

  return (
    <div
      className={`page ${active ? "" : "page--hidden"} ${animating ? "page--entering" : ""}`}
      data-page={pageKey}
    >
      {children}
    </div>
  );
}

function AppChrome({
  searchOpen,
  onOpenSearch,
  onCloseSearch,
}: {
  searchOpen: boolean;
  onOpenSearch: () => void;
  onCloseSearch: () => void;
}) {
  const { activePage, navigate } = useNavigation();
  const [visited] = useState(() => new Set<PageKey>(["home"]));
  visited.add(activePage);

  useKeyboardShortcuts(navigate, onOpenSearch);

  return (
    <>
      <Sidebar active={activePage} onNavigate={navigate} />
      <main className="main">
        {pageEntries.map(({ key, component: Page }) =>
          visited.has(key) ? (
            <PageSlot key={key} pageKey={key} active={key === activePage}>
              <Page />
            </PageSlot>
          ) : null,
        )}
      </main>
      <SearchPalette open={searchOpen} onClose={onCloseSearch} />
    </>
  );
}

function AppShell() {
  const [activePage, setActivePage] = useState<PageKey>("home");
  const [searchOpen, setSearchOpen] = useState(false);

  const openSearch = useCallback(() => setSearchOpen(true), []);
  const closeSearch = useCallback(() => setSearchOpen(false), []);

  return (
    <NavigationProvider activePage={activePage} setActivePage={setActivePage}>
      <RuntimeServiceBanner />
      <AppChrome searchOpen={searchOpen} onOpenSearch={openSearch} onCloseSearch={closeSearch} />
    </NavigationProvider>
  );
}

export function App() {
  return (
    <ApiProvider>
      <ConnectionProvider>
        <LanguageSettingsSync />
        <RuntimeBootstrapGate>
          <AccountsProvider>
            <ActivePublishProvider>
              <ToastProvider>
                <AppShell />
              </ToastProvider>
            </ActivePublishProvider>
          </AccountsProvider>
        </RuntimeBootstrapGate>
      </ConnectionProvider>
    </ApiProvider>
  );
}

export default App;

function LanguageSettingsSync() {
  const api = useApi();
  const { runtimeMode, serviceState } = useConnection();
  const attemptedRef = useRef(false);
  const retryTimerRef = useRef<number | null>(null);
  const [retryTick, setRetryTick] = useState(0);

  useEffect(() => {
    if (attemptedRef.current) {
      return;
    }

    if (runtimeMode === "desktop-release" && serviceState !== "ready") {
      return;
    }

    let cancelled = false;

    async function syncLanguage() {
      try {
        const settings = await api.settings.getLanguage();
        if (cancelled) {
          return;
        }

        const locale = applyLanguagePreference(settings.locale);
        startTransition(() => {
          void i18n.changeLanguage(locale);
        });
        attemptedRef.current = true;
      } catch {
        // 初始化失败时沿用本地 bootstrap cache，并在短暂延迟后重试。
        if (!cancelled) {
          retryTimerRef.current = window.setTimeout(() => {
            retryTimerRef.current = null;
            setRetryTick((value) => value + 1);
          }, 2000);
        }
      }
    }

    void syncLanguage();

    return () => {
      cancelled = true;
      if (retryTimerRef.current !== null) {
        window.clearTimeout(retryTimerRef.current);
        retryTimerRef.current = null;
      }
    };
  }, [api, retryTick, runtimeMode, serviceState]);

  return null;
}

function RuntimeBootstrapGate({ children }: { children: React.ReactNode }) {
  const { t } = useTranslation("runtime");
  const { runtimeMode, serviceState } = useConnection();
  const api = useApi();
  const [bootstrapComplete, setBootstrapComplete] = useState(runtimeMode !== "desktop-release");
  const [bootstrapMessage, setBootstrapMessage] = useState<{ key: string; values?: Record<string, string | number> } | null>(null);

  useEffect(() => {
    if (runtimeMode !== "desktop-release") {
      setBootstrapComplete(true);
      return;
    }

    if (serviceState !== "ready") {
      setBootstrapComplete(false);
      setBootstrapMessage(null);
      return;
    }

    let cancelled = false;

    async function bootstrapSessions() {
      setBootstrapComplete(false);
      setBootstrapMessage({ key: "bootstrap.validatingSessions" });

      try {
        const response = await api.accounts.list();
        const refreshTargets = response.items.filter((account) => account.hasStoredCredential);

        for (let index = 0; index < refreshTargets.length; index += 1) {
          if (cancelled) {
            return;
          }

          const account = refreshTargets[index];
          setBootstrapMessage(
            refreshTargets.length > 1
              ? {
                  key: "bootstrap.validatingSessionMulti",
                  values: {
                    current: index + 1,
                    total: refreshTargets.length,
                    name: account.displayName || account.loginName,
                  },
                }
              : {
                  key: "bootstrap.validatingSessionSingle",
                  values: {
                    name: account.displayName || account.loginName,
                  },
                }
          );

          try {
            await api.accounts.refresh(account.accountId);
          } catch {
            // 这里故意吞掉，后续页面会读取刷新后的账号状态并决定是否要求重登。
          }
        }
      } finally {
        if (!cancelled) {
          setBootstrapComplete(true);
          setBootstrapMessage(null);
        }
      }
    }

    void bootstrapSessions();

    return () => {
      cancelled = true;
    };
  }, [api, runtimeMode, serviceState]);

  if (runtimeMode === "desktop-release" && (serviceState !== "ready" || !bootstrapComplete)) {
    return (
      <RuntimeBootstrapScreenInner
        messageOverride={serviceState === "ready" && bootstrapMessage ? t(bootstrapMessage.key, bootstrapMessage.values) : null}
        progressCopyOverride={serviceState === "ready" ? t("bootstrap.syncingSessions") : null}
      />
    );
  }

  return <>{children}</>;
}
