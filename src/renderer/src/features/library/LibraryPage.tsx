import { memo, useRef, useState, useEffect, useMemo, useCallback, useLayoutEffect } from "react";
import { AnimatePresence, motion } from "motion/react";
import { useTranslation } from "react-i18next";
import { Search, Layers, RefreshCw, ChevronLeft, ChevronRight } from "lucide-react";
import { spring, makeStagger } from "../../shared/springs";
import { useApi } from "../../app/ApiContext";
import { useAccounts } from "../../app/AccountsContext";
import { useNavigation } from "../../app/NavigationContext";
import { useQuery } from "../../shared/hooks/useQuery";
import { useDebounce } from "../../shared/hooks/useDebounce";
import { EmptyState } from "../../shared/components/EmptyState";
import { Spinner } from "../../shared/components/Spinner";
import { ModelCard } from "./ModelCard";
import { CloudAccountSelector } from "./CloudAccountSelector";
import { ImportDropZone } from "./ImportDropZone";
import { DetailPanel } from "./DetailPanel";
import type { ArtifactSummary } from "../../contracts/artifacts";
import type { MyAvatarSummary } from "../../contracts/my-avatars";

type Tab = "all" | "local" | "cloud";
type SelectedItem = { type: "local" | "cloud"; id: string; accountId?: string; imageUrl?: string | null } | null;

const CLOUD_BATCH_SIZE = 50;
const CLOUD_PAGE_SIZE = 20;
const listStagger = makeStagger();

const TAB_KEYS: Tab[] = ["all", "local", "cloud"];

const PaginationBar = memo(function PaginationBar({
  page,
  hasMore,
  pageSize,
  onPageChange,
}: {
  page: number;
  hasMore: boolean;
  pageSize: number;
  onPageChange: (page: number) => void;
}) {
  const { t } = useTranslation(["library"]);
  const [editing, setEditing] = useState(false);
  const [editValue, setEditValue] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  function startEditing() {
    setEditValue(String(page));
    setEditing(true);
  }

  useEffect(() => {
    if (editing) inputRef.current?.select();
  }, [editing]);

  function commit() {
    setEditing(false);
    const n = parseInt(editValue, 10);
    if (Number.isFinite(n) && n >= 1 && n !== page) {
      onPageChange(n);
    }
  }

  return (
    <div className="pagination-bar">
      <button
        className="btn btn-ghost btn-icon"
        disabled={page <= 1}
        onClick={() => onPageChange(page - 1)}
      >
        <ChevronLeft size={16} strokeWidth={1.75} />
      </button>
      {editing ? (
        <input
          ref={inputRef}
          className="pagination-page-input"
          type="text"
          inputMode="numeric"
          value={editValue}
          onChange={(e) => setEditValue(e.target.value.replace(/\D/g, ""))}
          onKeyDown={(e) => { if (e.key === "Enter") commit(); if (e.key === "Escape") setEditing(false); }}
          onBlur={commit}
          autoFocus
        />
      ) : (
        <button className="pagination-page-btn" onClick={startEditing}>
          {t("library:pagination.page", { page })}
        </button>
      )}
      <button
        className="btn btn-ghost btn-icon"
        disabled={!hasMore}
        onClick={() => onPageChange(page + 1)}
      >
        <ChevronRight size={16} strokeWidth={1.75} />
      </button>
    </div>
  );
});

const LibraryTabBar = memo(function LibraryTabBar({
  activeTab,
  onTabChange,
}: {
  activeTab: Tab;
  onTabChange: (tab: Tab) => void;
}) {
  const { t } = useTranslation(["library"]);
  const barRef = useRef<HTMLDivElement>(null);
  const tabRefs = useRef<(HTMLButtonElement | null)[]>([]);
  const [indicatorStyle, setIndicatorStyle] = useState({ left: 0, width: 0 });

  const updateIndicator = useCallback(() => {
    const idx = TAB_KEYS.indexOf(activeTab);
    const el = tabRefs.current[idx];
    if (!el || !barRef.current) {
      return;
    }

    const barRect = barRef.current.getBoundingClientRect();
    const elRect = el.getBoundingClientRect();
    setIndicatorStyle({ left: elRect.left - barRect.left, width: elRect.width });
  }, [activeTab]);

  useLayoutEffect(() => {
    updateIndicator();
  }, [updateIndicator, t]);

  useEffect(() => {
    updateIndicator();

    const bar = barRef.current;
    const activeElement = tabRefs.current[TAB_KEYS.indexOf(activeTab)];
    const resizeObserver =
      typeof ResizeObserver !== "undefined"
        ? new ResizeObserver(() => {
            updateIndicator();
          })
        : null;

    if (resizeObserver && bar) {
      resizeObserver.observe(bar);
      if (activeElement) {
        resizeObserver.observe(activeElement);
      }
    }

    function handleWindowResize() {
      updateIndicator();
    }

    window.addEventListener("resize", handleWindowResize);
    return () => {
      resizeObserver?.disconnect();
      window.removeEventListener("resize", handleWindowResize);
    };
  }, [activeTab, updateIndicator]);

  const tabs: { key: Tab; label: string }[] = [
    { key: "all", label: t("library:tabs.all") },
    { key: "local", label: t("library:tabs.local") },
    { key: "cloud", label: t("library:tabs.cloud") },
  ];
  return (
    <div className="tab-bar" ref={barRef}>
      <div
        className="tab-indicator"
        style={{ left: indicatorStyle.left, width: indicatorStyle.width }}
      />
      {tabs.map((tab, i) => (
        <button
          key={tab.key}
          ref={(el) => { tabRefs.current[i] = el; }}
          className="tab-item"
          data-active={activeTab === tab.key || undefined}
          onClick={() => onTabChange(tab.key)}
        >
          {tab.label}
        </button>
      ))}
    </div>
  );
});

export function LibraryPage() {
  const { t } = useTranslation(["library"]);
  const api = useApi();
  const { defaultAccount, accounts } = useAccounts();
  const { activePage, navigationTick, consumePayload } = useNavigation();

  const [activeTab, setActiveTab] = useState<Tab>("all");
  const [searchText, setSearchText] = useState("");
  const debouncedSearch = useDebounce(searchText, 300);
  const [cloudAccountId, setCloudAccountId] = useState<string | null>(null);
  const [cloudOffset, setCloudOffset] = useState(0);
  const [selected, setSelected] = useState<SelectedItem>(null);

  // --- 云端全量缓存 (替代旧的 allCloudItems + 服务端分页) ---
  const [cloudCache, setCloudCache] = useState<MyAvatarSummary[]>([]);
  const [cloudCacheLoading, setCloudCacheLoading] = useState(false);
  const cloudGenRef = useRef(0);

  // Sidebar 账号点击: 切换到云端 tab + 指定账号
  // navigationTick 确保同页面内重复导航也能触发
  useEffect(() => {
    if (activePage !== "library") return;
    const payload = consumePayload();
    if (payload?.cloudAccountId) {
      // React 18 自动批处理，一次渲染
      setCloudAccountId(payload.cloudAccountId);
      setActiveTab("cloud");
    }
  }, [navigationTick]); // eslint-disable-line react-hooks/exhaustive-deps

  // 优先用户手选，其次默认账号（如果 session 有效），再其次第一个有效账号
  const firstValidAccount = accounts.find((a) => a.sessionValid);
  const effectiveCloudAccountId =
    cloudAccountId
    ?? (defaultAccount?.sessionValid ? defaultAccount.accountId : null)
    ?? firstValidAccount?.accountId
    ?? null;

  const { data: artifactsData, refetch: refetchArtifacts } = useQuery(
    (signal) => api.artifacts.list(signal),
    [],
  );
  const artifacts = artifactsData?.items ?? [];

  // --- 后台全量加载云端头像 (不传 search，与 VRCX 策略一致) ---
  const loadAllCloud = useCallback(async (accountId: string) => {
    cloudGenRef.current += 1;
    const gen = cloudGenRef.current;
    setCloudCache([]);
    setCloudCacheLoading(true);

    let offset = 0;
    const accumulated: MyAvatarSummary[] = [];
    try {
      while (true) {
        const result = await api.myAvatars.list({
          accountId,
          limit: CLOUD_BATCH_SIZE,
          offset,
        });
        if (gen !== cloudGenRef.current) return; // 账号已切换，丢弃
        accumulated.push(...result.items);
        setCloudCache([...accumulated]);
        if (!result.pagination.hasMore || result.items.length === 0) break;
        offset = result.pagination.nextOffset ?? offset + CLOUD_BATCH_SIZE;
      }
    } catch {
      // 网络错误 — 保留已加载的部分数据
    } finally {
      if (gen === cloudGenRef.current) {
        setCloudCacheLoading(false);
      }
    }
  }, [api]);

  // 账号变化时重新全量加载
  useEffect(() => {
    if (effectiveCloudAccountId) {
      loadAllCloud(effectiveCloudAccountId);
    } else {
      setCloudCache([]);
      setCloudCacheLoading(false);
    }
  }, [effectiveCloudAccountId, loadAllCloud]);

  const refetchAvatars = useCallback(() => {
    if (effectiveCloudAccountId) {
      loadAllCloud(effectiveCloudAccountId);
    }
  }, [effectiveCloudAccountId, loadAllCloud]);

  // 搜索词变化时重置云端分页 offset
  useEffect(() => {
    setCloudOffset(0);
  }, [debouncedSearch]);

  // --- 前端过滤 (本地 + 云端统一) ---
  const filteredArtifacts = useMemo(() => {
    if (!debouncedSearch) return artifacts;
    const q = debouncedSearch.toLowerCase();
    return artifacts.filter((a) => a.name.toLowerCase().includes(q));
  }, [artifacts, debouncedSearch]);

  const filteredCloudCache = useMemo(() => {
    if (!debouncedSearch) return cloudCache;
    const q = debouncedSearch.toLowerCase();
    return cloudCache.filter((a) => a.name.toLowerCase().includes(q));
  }, [cloudCache, debouncedSearch]);

  // --- 云端 Tab 前端分页 ---
  const cloudPagination = useMemo(() => {
    const total = filteredCloudCache.length;
    const hasMore = cloudOffset + CLOUD_PAGE_SIZE < total;
    return {
      limit: CLOUD_PAGE_SIZE,
      offset: cloudOffset,
      returnedCount: Math.min(CLOUD_PAGE_SIZE, Math.max(0, total - cloudOffset)),
      hasMore,
      nextOffset: hasMore ? cloudOffset + CLOUD_PAGE_SIZE : null,
    };
  }, [filteredCloudCache.length, cloudOffset]);

  const cloudPage = Math.floor(cloudOffset / CLOUD_PAGE_SIZE) + 1;
  const showPagination = activeTab === "cloud" && (cloudPagination.hasMore || cloudPagination.offset > 0);

  const accountNameMap = useMemo(() => {
    const map = new Map<string, string>();
    for (const acc of accounts) {
      map.set(acc.accountId, acc.displayName || acc.accountId.slice(0, 8));
    }
    return map;
  }, [accounts]);

  const displayModels = useMemo(() => {
    const localCards = (activeTab === "cloud" ? [] : filteredArtifacts).map(
      (a: ArtifactSummary) => ({
        key: `local-${a.artifactId}`,
        type: "local" as const,
        id: a.artifactId,
        name: a.name,
        imageUrl: a.thumbnailPath ? `file://${a.thumbnailPath}` : null,
        sourceLabel: t("library:source.local"),
        sourceIcon: "local" as const,
      }),
    );

    let cloudSource: MyAvatarSummary[];
    if (activeTab === "all") {
      cloudSource = filteredCloudCache;
    } else if (activeTab === "cloud") {
      const start = cloudOffset;
      const end = start + CLOUD_PAGE_SIZE;
      cloudSource = filteredCloudCache.slice(start, end);
    } else {
      cloudSource = [];
    }

    const cloudCards = cloudSource.map(
      (a: MyAvatarSummary) => ({
        key: `cloud-${a.avatarId}`,
        type: "cloud" as const,
        id: a.avatarId,
        accountId: a.accountId,
        name: a.name,
        imageUrl: a.thumbnailImageUrl ?? a.imageUrl,
        sourceLabel: accountNameMap.get(a.accountId) ?? a.accountId.slice(0, 8),
        sourceIcon: "cloud" as const,
      }),
    );
    return [...localCards, ...cloudCards];
  }, [activeTab, filteredArtifacts, filteredCloudCache, cloudOffset, accountNameMap, t]);

  const modelsRef = useRef(displayModels);
  modelsRef.current = displayModels;

  const handleCardSelect = useCallback((modelKey: string) => {
    const model = modelsRef.current.find((m) => m.key === modelKey);
    if (!model) return;
    setSelected((prev) => {
      if (prev?.id === model.id && prev?.type === model.type) return null;
      return {
        type: model.type,
        id: model.id,
        accountId: "accountId" in model ? model.accountId : undefined,
        imageUrl: model.imageUrl,
      };
    });
  }, []);

  function handlePanelDeleted() {
    const wasLocal = selected?.type === "local";
    setSelected(null);
    if (wasLocal) refetchArtifacts();
    else refetchAvatars();
  }

  const hasCloudAccounts = accounts.some((a) => a.sessionValid);

  const handleTabChange = useCallback((tab: Tab) => {
    setActiveTab(tab);
    setSelected(null);
  }, []);

  const isPageLoading = cloudCacheLoading && cloudCache.length === 0;

  return (
    <div className="library">
      <div className="library-header">
        <h1>{t("library:title")}</h1>
        <div className="library-toolbar">
          {hasCloudAccounts && (
            <CloudAccountSelector
              selectedAccountId={effectiveCloudAccountId}
              onAccountChange={setCloudAccountId}
            />
          )}
          <LibraryTabBar activeTab={activeTab} onTabChange={handleTabChange} />
          <div className="search-box">
            <Search size={14} strokeWidth={1.75} />
            <input
              type="text"
              placeholder={t("library:searchPlaceholder")}
              value={searchText}
              onChange={(e) => setSearchText(e.target.value)}
            />
          </div>
          <motion.button
            className="btn btn-ghost btn-icon"
            title={t("library:refreshTitle")}
            onClick={() => { refetchArtifacts(); refetchAvatars(); }}
            disabled={cloudCacheLoading}
            whileTap={{ scale: 0.97 }}
            transition={spring.snappy}
          >
            <RefreshCw size={14} strokeWidth={1.75} className={cloudCacheLoading ? "animate-spin" : ""} />
          </motion.button>
        </div>
      </div>

      <div className="library-content">
        {activeTab === "cloud" && !hasCloudAccounts ? (
          <EmptyState
            icon={<Layers size={32} strokeWidth={1.5} />}
            message={t("library:emptyCloudRequired")}
          />
        ) : displayModels.length === 0 && isPageLoading ? (
          <div style={{ display: "flex", justifyContent: "center", padding: 48 }}>
            <Spinner />
          </div>
        ) : displayModels.length === 0 && !isPageLoading ? (
          <EmptyState
            icon={<Layers size={32} strokeWidth={1.5} />}
            message={debouncedSearch ? t("library:emptyNoResults") : t("library:emptyNoModels")}
          />
        ) : (
          <motion.div
            className="model-grid"
            variants={listStagger}
            initial="hidden"
            animate="show"
            key={`${activeTab}-${effectiveCloudAccountId}`}
          >
            {displayModels.map((model) => (
              <ModelCard
                key={model.key}
                modelKey={model.key}
                name={model.name}
                imageUrl={model.imageUrl}
                sourceLabel={model.sourceLabel}
                sourceIcon={model.sourceIcon}
                selected={selected?.id === model.id && selected?.type === model.type}
                onSelect={handleCardSelect}
              />
            ))}

            {activeTab !== "cloud" && (
              <ImportDropZone onImported={refetchArtifacts} />
            )}

            {cloudCacheLoading && cloudCache.length > 0 && activeTab !== "local" && (
              <div style={{ gridColumn: "1 / -1", display: "flex", justifyContent: "center", padding: 24 }}>
                <Spinner />
              </div>
            )}
          </motion.div>
        )}

        {showPagination && (
          <PaginationBar
            page={cloudPage}
            hasMore={cloudPagination.hasMore}
            pageSize={cloudPagination.limit}
            onPageChange={(p) => setCloudOffset((p - 1) * cloudPagination.limit)}
          />
        )}
      </div>

      <AnimatePresence>
        {selected && (
          <DetailPanel
            type={selected.type}
            id={selected.id}
            accountId={selected.accountId}
            previewImageUrl={selected.imageUrl}
            onClose={() => setSelected(null)}
            onDeleted={handlePanelDeleted}
            onImported={refetchArtifacts}
            onUpdated={refetchArtifacts}
          />
        )}
      </AnimatePresence>
    </div>
  );
}
