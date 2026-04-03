import { useState } from "react";
import { motion } from "motion/react";
import { useTranslation } from "react-i18next";
import { Users, LogIn, Download } from "lucide-react";
import { spring, makeStagger, fadeIn } from "../../shared/springs";
import { useApi } from "../../app/ApiContext";
import { useAccounts } from "../../app/AccountsContext";
import { Spinner } from "../../shared/components/Spinner";
import { EmptyState } from "../../shared/components/EmptyState";
import { ErrorBanner } from "../../shared/components/ErrorBanner";
import { useToast } from "../../app/ToastContext";
import { AccountListItem } from "./AccountListItem";
import { LoginModal } from "./LoginModal";
import { ImportModal } from "./ImportModal";
import { resolveLocalizedText } from "../../i18n/localized-text";

const listStagger = makeStagger();

export function AccountsPage() {
  const { t } = useTranslation(["accounts"]);
  const api = useApi();
  const { accounts, loading, error, refetch } = useAccounts();
  const { toast } = useToast();
  const [modal, setModal] = useState<"login" | "import" | null>(null);
  const [reloginUsername, setReloginUsername] = useState<string | undefined>(undefined);

  async function handleRefresh(id: string) {
    try {
      await api.accounts.refresh(id);
      refetch();
    } catch { /* swallow — UI will reflect stale state */ }
  }

  async function handleSetDefault(id: string) {
    try {
      await api.accounts.setDefault(id);
      refetch();
    } catch { /* swallow */ }
  }

  async function handleRepair(id: string) {
    try {
      const result = await api.accounts.repair(id);
      toast({
        tone: result.recovered ? "ok" : "warn",
        title: t("accounts:repairResult.toastTitle"),
        detail: resolveLocalizedText(result.messageText, result.message) ?? undefined,
      });
      refetch();
    } catch { /* swallow */ }
  }

  async function handleLogout(id: string) {
    try {
      await api.accounts.logout(id);
      refetch();
    } catch { /* swallow */ }
  }

  async function handleRemove(id: string) {
    try {
      await api.accounts.remove(id);
      refetch();
    } catch { /* swallow */ }
  }

  return (
    <div className="accounts-page">
      <motion.div
        className="accounts-page-header"
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={spring.gentle}
      >
        <h1>{t("accounts:title")}</h1>
        <div className="accounts-page-actions">
          <motion.button
            className="btn btn-primary"
            onClick={() => setModal("login")}
            whileTap={{ scale: 0.97 }}
            transition={spring.snappy}
          >
            <LogIn size={14} strokeWidth={1.75} /> {t("accounts:login")}
          </motion.button>
          <motion.button
            className="btn btn-secondary"
            onClick={() => setModal("import")}
            whileTap={{ scale: 0.97 }}
            transition={spring.snappy}
          >
            <Download size={14} strokeWidth={1.75} /> {t("accounts:import")}
          </motion.button>
        </div>
      </motion.div>

      {loading && accounts.length === 0 ? (
        <div className="accounts-loading"><Spinner size={24} /></div>
      ) : error && accounts.length === 0 ? (
        <ErrorBanner error={error} onRetry={refetch} />
      ) : accounts.length === 0 ? (
        <EmptyState
          icon={<Users size={32} strokeWidth={1.5} />}
          message={t("accounts:emptyMessage")}
          action={{ label: t("accounts:emptyAction"), onClick: () => setModal("login") }}
        />
      ) : (
        <motion.div
          className="account-list"
          variants={listStagger}
          initial="hidden"
          animate="show"
        >
          {accounts.map((account) => (
            <motion.div key={account.accountId} variants={fadeIn}>
              <AccountListItem
                account={account}
                onRefresh={handleRefresh}
                onSetDefault={handleSetDefault}
                onRepair={handleRepair}
                onLogout={handleLogout}
                onRemove={handleRemove}
                onRelogin={(id) => {
                  const account = accounts.find((a) => a.accountId === id);
                  setReloginUsername(account?.loginName);
                  setModal("login");
                }}
              />
            </motion.div>
          ))}
        </motion.div>
      )}

      <LoginModal
        open={modal === "login"}
        prefillUsername={reloginUsername}
        onClose={() => { setModal(null); setReloginUsername(undefined); }}
        onSuccess={refetch}
      />
      <ImportModal
        open={modal === "import"}
        onClose={() => setModal(null)}
        onSuccess={refetch}
      />
    </div>
  );
}
