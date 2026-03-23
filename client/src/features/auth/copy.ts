type AuthLang = "en" | "zh";

const AUTH_COPY = {
  en: {
    gate: {
      title: "Sign in to continue",
      description:
        "Access to this dashboard requires authentication. Continue with email verification code.",
      cta: "Sign in with Email",
    },
    menu: {
      signOut: "Sign out",
    },
    manusDialog: {
      description: "Please login with email verification code to continue",
      cta: "Login with Email",
    },
    loginModal: {
      title: "Welcome to MediBridge",
      emailStepDescription: "Enter your email to receive a secure login code.",
      otpStepDescription: "Code sent to {email}",
      otpStepDescriptionFallback: "your email",
      otpSent: "Verification code sent. Please check your email.",
      otpRequestFailed: "Failed to send verification code.",
      signInSuccess: "Signed in successfully",
      verifyFailed: "Verification failed.",
      deviceIdMissing: "Cannot read device id. Please refresh and try again.",
      sendCode: "Send Verification Code",
      sending: "Sending...",
      signingIn: "Signing in...",
      confirmSignIn: "Confirm and sign in",
      backToEmail: "Back to email",
    },
  },
  zh: {
    gate: {
      title: "登录后继续",
      description: "此页面需要登录后访问，请使用邮箱验证码继续。",
      cta: "邮箱登录",
    },
    menu: {
      signOut: "退出登录",
    },
    manusDialog: {
      description: "请使用邮箱验证码登录后继续",
      cta: "邮箱登录",
    },
    loginModal: {
      title: "登录或注册",
      emailStepDescription: "输入邮箱获取验证码，无需设置密码即可快速进入。",
      otpStepDescription: "验证码已发送至 {email}",
      otpStepDescriptionFallback: "你的邮箱",
      otpSent: "验证码已发送，请查看邮箱。",
      otpRequestFailed: "验证码发送失败。",
      signInSuccess: "登录成功",
      verifyFailed: "验证码校验失败。",
      deviceIdMissing: "无法获取设备标识，请刷新页面后重试。",
      sendCode: "获取验证码",
      sending: "发送中...",
      signingIn: "登录中...",
      confirmSignIn: "确认并登录",
      backToEmail: "返回修改邮箱",
    },
  },
} as const;

export const getAuthCopy = (lang: AuthLang) => AUTH_COPY[lang];
