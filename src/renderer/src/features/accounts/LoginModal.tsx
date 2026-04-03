import { useState, useRef, useEffect } from "react";
import { AnimatePresence, motion } from "motion/react";
import { useTranslation } from "react-i18next";
import { spring } from "../../shared/springs";
import { Modal } from "../../shared/components/Modal";
import { Input } from "../../shared/components/Input";
import { Spinner } from "../../shared/components/Spinner";
import { ErrorBanner } from "../../shared/components/ErrorBanner";
import { useApi } from "../../app/ApiContext";
import { useMutation } from "../../shared/hooks/useMutation";
import { resolveLocalizedText } from "../../i18n/localized-text";

interface LoginModalProps {
  open: boolean;
  prefillUsername?: string;
  onClose: () => void;
  onSuccess: () => void;
}

export function LoginModal({ open, prefillUsername, onClose, onSuccess }: LoginModalProps) {
  const { t } = useTranslation(["accounts", "common"]);
  const api = useApi();
  const [step, setStep] = useState<"credentials" | "twoFactor">("credentials");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [challengeId, setChallengeId] = useState<string | null>(null);
  const [code, setCode] = useState("");
  const [serverPrompt, setServerPrompt] = useState<string | null>(null);
  const codeRef = useRef<HTMLInputElement>(null);

  const login = useMutation(
    (input: { userNameOrEmail: string; password: string }) =>
      api.accounts.login(input),
  );

  const verify = useMutation(
    (input: { challengeId: string; code: string }) =>
      api.accounts.verifyTwoFactor(input),
  );

  const cancel = useMutation(
    (input: { challengeId: string }) =>
      api.accounts.cancelLogin(input),
  );

  useEffect(() => {
    if (!open) {
      setStep("credentials");
      setUsername("");
      setPassword("");
      setChallengeId(null);
      setCode("");
      setServerPrompt(null);
      login.reset();
      verify.reset();
    } else if (prefillUsername) {
      setUsername(prefillUsername);
    }
  }, [open]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (step === "twoFactor") codeRef.current?.focus();
  }, [step]);

  async function handleLogin() {
    try {
      const result = await login.execute({ userNameOrEmail: username, password });
      if (result.status === "completed" || result.account) {
        onSuccess();
        onClose();
      } else if (result.status === "requires_totp" || result.status === "requires_email_otp") {
        setChallengeId(result.challengeId);
        setServerPrompt(resolveLocalizedText(result.messageText, result.message));
        setStep("twoFactor");
      }
    } catch { /* error shown via login.error */ }
  }

  async function handleVerify() {
    if (!challengeId) return;
    try {
      const result = await verify.execute({ challengeId, code });
      if (result.status === "completed" || result.account) {
        onSuccess();
        onClose();
      }
    } catch { /* error shown via verify.error */ }
  }

  async function handleCancel() {
    if (challengeId) {
      try { await cancel.execute({ challengeId }); } catch { /* ignore */ }
    }
    setStep("credentials");
    setChallengeId(null);
    setCode("");
    setServerPrompt(null);
    verify.reset();
  }

  return (
    <Modal open={open} onClose={onClose} width={400}>
      <h2 style={{ font: "600 16px var(--font)", color: "var(--fg)", margin: "0 0 20px" }}>
        {step === "credentials" ? t("accounts:loginModal.credentialsTitle") : t("accounts:loginModal.twoFactorTitle")}
      </h2>

      <AnimatePresence mode="wait">
        {step === "credentials" ? (
          <motion.div
            key="credentials"
            className="login-form"
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            transition={spring.smooth}
          >
            <Input
              label={t("accounts:loginModal.usernameOrEmail")}
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              autoFocus
              onKeyDown={(e) => e.key === "Enter" && handleLogin()}
            />
            <Input
              label={t("accounts:loginModal.password")}
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleLogin()}
            />
            {login.error && <ErrorBanner error={login.error} />}
            <div className="login-form-actions">
              <motion.button
                className="btn btn-secondary"
                onClick={onClose}
                whileTap={{ scale: 0.97 }}
                transition={spring.snappy}
              >
                {t("common:cancel")}
              </motion.button>
              <motion.button
                className="btn btn-primary"
                onClick={handleLogin}
                disabled={!username || !password || login.loading}
                whileTap={{ scale: 0.97 }}
                transition={spring.snappy}
              >
                {login.loading ? <Spinner size={14} /> : t("accounts:login")}
              </motion.button>
            </div>
          </motion.div>
        ) : (
          <motion.div
            key="twoFactor"
            className="login-form"
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: 20 }}
            transition={spring.smooth}
          >
            <p style={{ font: "400 14px var(--font)", color: "var(--fg-muted)", margin: 0 }}>
              {serverPrompt ?? t("accounts:loginModal.codePrompt")}
            </p>
            <Input
              ref={codeRef}
              label={t("accounts:loginModal.codeLabel")}
              value={code}
              onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
              maxLength={6}
              inputMode="numeric"
              autoComplete="one-time-code"
              onKeyDown={(e) => e.key === "Enter" && code.length === 6 && handleVerify()}
            />
            {verify.error && <ErrorBanner error={verify.error} />}
            <div className="login-form-actions">
              <motion.button
                className="btn btn-secondary"
                onClick={handleCancel}
                disabled={cancel.loading}
                whileTap={{ scale: 0.97 }}
                transition={spring.snappy}
              >
                {t("accounts:loginModal.back")}
              </motion.button>
              <motion.button
                className="btn btn-primary"
                onClick={handleVerify}
                disabled={code.length < 6 || verify.loading}
                whileTap={{ scale: 0.97 }}
                transition={spring.snappy}
              >
                {verify.loading ? <Spinner size={14} /> : t("accounts:loginModal.verify")}
              </motion.button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </Modal>
  );
}
