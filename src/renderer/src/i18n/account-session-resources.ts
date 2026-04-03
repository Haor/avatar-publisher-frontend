export const accountSessionResources = {
  "zh-CN": {
    accounts: {
      loginFlow: {
        status: {
          requiresEmailOtp: "请输入邮箱中收到的 6 位验证码继续。",
          requiresTotp: "请输入身份验证器中的 6 位验证码继续。",
          completed: "已登录 {{name}}。",
        },
      },
      repairResult: {
        noRepairNeeded: "账号会话仍然有效，无需修复。",
        missingSessionMaterial: "本地没有可复用的会话材料，需要重新登录。",
        recovered: "已重新验证账号会话。",
        recoveredFromSnapshot: "已通过历史快照恢复账号会话。",
        reloginRequired: "自动修复未恢复会话，需要重新登录。",
        notRecovered: "自动修复已完成，但会话仍不可用。",
        exhausted: "所有自动恢复手段已用尽，需要重新登录。",
        toastTitle: "账号修复结果",
      },
      sessionIssue: {
        invalidSession: "账号会话已失效，请重新登录。",
        reloginRequired: "需要重新登录后才能继续。",
        refreshFailed: "会话检查未通过。",
      },
    },
  },
  "zh-TW": {
    accounts: {
      loginFlow: {
        status: {
          requiresEmailOtp: "請輸入信箱中收到的 6 位驗證碼繼續。",
          requiresTotp: "請輸入驗證器中的 6 位驗證碼繼續。",
          completed: "已登入 {{name}}。",
        },
      },
      repairResult: {
        noRepairNeeded: "帳號會話仍然有效，無需修復。",
        missingSessionMaterial: "本機沒有可重用的會話資料，需要重新登入。",
        recovered: "已重新驗證帳號會話。",
        recoveredFromSnapshot: "已透過歷史快照恢復帳號會話。",
        reloginRequired: "自動修復未恢復會話，需要重新登入。",
        notRecovered: "自動修復已完成，但會話仍不可用。",
        exhausted: "所有自動恢復手段已用盡，需要重新登入。",
        toastTitle: "帳號修復結果",
      },
      sessionIssue: {
        invalidSession: "帳號會話已失效，請重新登入。",
        reloginRequired: "需要重新登入後才能繼續。",
        refreshFailed: "會話檢查未通過。",
      },
    },
  },
  ja: {
    accounts: {
      loginFlow: {
        status: {
          requiresEmailOtp: "メールで受け取った 6 桁のコードを入力して続行してください。",
          requiresTotp: "認証アプリの 6 桁コードを入力して続行してください。",
          completed: "{{name}} としてログインしました。",
        },
      },
      repairResult: {
        noRepairNeeded: "アカウントのセッションはまだ有効です。修復は不要です。",
        missingSessionMaterial: "再利用できるローカルセッション情報がありません。再ログインしてください。",
        recovered: "アカウントのセッションを再検証しました。",
        recoveredFromSnapshot: "過去のスナップショットからアカウントのセッションを復元しました。",
        reloginRequired: "自動修復ではセッションを回復できませんでした。再ログインしてください。",
        notRecovered: "自動修復は完了しましたが、セッションはまだ利用できません。",
        exhausted: "すべての自動回復手段を使い果たしました。再ログインしてください。",
        toastTitle: "アカウント修復結果",
      },
      sessionIssue: {
        invalidSession: "アカウントのセッションが無効です。再ログインしてください。",
        reloginRequired: "続行するには再ログインが必要です。",
        refreshFailed: "セッション確認に失敗しました。",
      },
    },
  },
  en: {
    accounts: {
      loginFlow: {
        status: {
          requiresEmailOtp: "Enter the 6-digit code that was sent to your email to continue.",
          requiresTotp: "Enter the 6-digit code from your authenticator app to continue.",
          completed: "Signed in as {{name}}.",
        },
      },
      repairResult: {
        noRepairNeeded: "The account session is still valid. No repair is needed.",
        missingSessionMaterial: "No reusable local session data was found. Sign in again.",
        recovered: "The account session has been validated again.",
        recoveredFromSnapshot: "The account session was restored from a previous snapshot.",
        reloginRequired: "Automatic repair did not recover the session. Sign in again.",
        notRecovered: "Automatic repair finished, but the session is still unavailable.",
        exhausted: "All automatic recovery methods have been exhausted. Sign in again.",
        toastTitle: "Account repair result",
      },
      sessionIssue: {
        invalidSession: "This account session is no longer valid. Sign in again.",
        reloginRequired: "Sign in again to continue.",
        refreshFailed: "The session check did not pass.",
      },
    },
  },
} as const;
