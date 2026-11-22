'use client';

let tencentCaptchaScriptPromise = null;

async function getFirebaseAuth(config, locale) {
  const [{ getApps, initializeApp }, { getAuth }] = await Promise.all([
    import('firebase/app'),
    import('firebase/auth'),
  ]);
  const appName = 'supdance-phone-auth-web';
  let app = getApps().find((candidate) => candidate.name === appName);
  if (!app) app = initializeApp(config, appName);
  const auth = getAuth(app);
  auth.languageCode = locale || 'en';
  return auth;
}

export async function getFirebasePhoneRecaptchaToken({ config, container, locale }) {
  if (!container) throw new Error('安全验证组件尚未就绪，请重试');
  const [{ RecaptchaVerifier }, auth] = await Promise.all([
    import('firebase/auth'),
    getFirebaseAuth(config, locale),
  ]);
  const verifier = new RecaptchaVerifier(auth, container, { size: 'invisible' });
  try {
    return await verifier.verify();
  } finally {
    verifier.clear();
  }
}

function loadTencentCaptchaScript() {
  if (typeof window === 'undefined') return Promise.reject(new Error('安全验证仅支持 Web 浏览器'));
  if (typeof window.TencentCaptcha === 'function') return Promise.resolve();
  if (!tencentCaptchaScriptPromise) {
    tencentCaptchaScriptPromise = new Promise((resolve, reject) => {
      const existing = document.querySelector('script[data-supdance-tencent-captcha="true"]');
      if (existing) {
        existing.addEventListener('load', resolve, { once: true });
        existing.addEventListener('error', () => reject(new Error('安全验证暂不可用，请稍后重试')), { once: true });
        return;
      }
      const script = document.createElement('script');
      script.src = 'https://turing.captcha.qcloud.com/TJCaptcha.js';
      script.async = true;
      script.dataset.supdanceTencentCaptcha = 'true';
      script.onload = resolve;
      script.onerror = () => reject(new Error('安全验证暂不可用，请稍后重试'));
      document.head.appendChild(script);
    }).catch((error) => {
      tencentCaptchaScriptPromise = null;
      throw error;
    });
  }
  return tencentCaptchaScriptPromise;
}

export async function getTencentCaptchaTicket(appId) {
  if (!appId) throw new Error('安全验证暂不可用，请稍后重试');
  await loadTencentCaptchaScript();
  if (typeof window.TencentCaptcha !== 'function') throw new Error('安全验证暂不可用，请稍后重试');

  return new Promise((resolve, reject) => {
    let settled = false;
    const timer = window.setTimeout(() => {
      if (settled) return;
      settled = true;
      reject(new Error('安全验证超时，请重试'));
    }, 120000);
    const finish = (callback, value) => {
      if (settled) return;
      settled = true;
      window.clearTimeout(timer);
      callback(value);
    };

    try {
      const captcha = new window.TencentCaptcha(String(appId), (result) => {
        if (result?.ret === 0 && result.ticket && result.randstr) {
          finish(resolve, { ticket: result.ticket, randstr: result.randstr });
        } else {
          finish(reject, new Error('安全验证未完成，请重试'));
        }
      }, { needFeedBack: false });
      captcha.show();
    } catch {
      finish(reject, new Error('安全验证暂不可用，请稍后重试'));
    }
  });
}

export async function completePhoneCaptchaChallenge(challenge, { postSendCode, locale, container }) {
  let verification;
  if (challenge?.captchaType === 'firebase') {
    try {
      verification = {
        recaptchaToken: await getFirebasePhoneRecaptchaToken({
          config: challenge.firebaseConfig,
          container,
          locale,
        }),
      };
    } catch {
      throw new Error('SECURITY_CHALLENGE_FAILED');
    }
  } else if (challenge?.captchaType === 'tencent') {
    try {
      verification = await getTencentCaptchaTicket(challenge.captchaAppId);
    } catch {
      throw new Error('SECURITY_CHALLENGE_FAILED');
    }
  } else {
    throw new Error('SECURITY_CHALLENGE_FAILED');
  }
  return postSendCode({ challengeId: challenge.challengeId, ...verification });
}
