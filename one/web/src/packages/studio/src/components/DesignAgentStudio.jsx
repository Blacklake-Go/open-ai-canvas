"use client";

import { useState, useEffect } from 'react';
import { CreativeCanvas } from 'design-agent';

import { getUserBalance } from '../muapi';
import enCopy from '../messages/en/agentStudio.json';
import zhCopy from '../messages/zh/agentStudio.json';
import jaCopy from '../messages/ja-JP/agentStudio.json';
import koCopy from '../messages/ko-KR/agentStudio.json';
import zhTwCopy from '../messages/zh-TW/agentStudio.json';
import esCopy from '../messages/es/agentStudio.json';
import { resolveCopy } from '../i18nUtils';

const DESIGN_AGENT_MESSAGES = {
  'zh-CN': zhCopy,
  'ja-JP': jaCopy,
  'ko-KR': koCopy,
  'zh-TW': zhTwCopy,
  es: esCopy,
  'es-ES': esCopy,
};

export default function DesignAgentStudio({
  apiKey,
  locale = 'en',
  userEmail,
  balance,
  isHeaderVisible,
  onToggleHeader,
  onGenerationStart,
  onGenerationEnd,
  onGenerationComplete,
  onGenerationError,
}) {
  const [userData, setUserData] = useState(null);
  const copy = resolveCopy(enCopy, DESIGN_AGENT_MESSAGES, locale);

  // Written synchronously during render (not inside an effect below) so it's already in
  // localStorage before CreativeCanvas's own mount effects read it — passive effects run
  // child-before-parent within a commit, so setting this from *our* useEffect ran after
  // CreativeCanvas's first sessions/agent-skills fetch had already gone out unauthenticated.
  if (typeof window !== 'undefined' && apiKey) {
    sessionStorage.setItem("fromDesignAgent", "true");
    localStorage.setItem("token", apiKey);
  }

  useEffect(() => {
    if (!apiKey) return undefined;
    return () => sessionStorage.removeItem("fromDesignAgent");
  }, [apiKey]);

  useEffect(() => {
    if (!apiKey) return;

    // White-label shells already know the end user's identity/credit balance (fetched via
    // /api/whitelabel/balance) and pass them in directly — GET /account/balance explicitly
    // 403s for white-label end users, so getUserBalance() below must stay BYOK-only.
    if (userEmail !== undefined || balance !== undefined) {
      setUserData({
        username: userEmail?.split('@')[0] || 'Studio User',
        email: userEmail,
        balance: balance || 0,
      });
      return;
    }

    const fetchUser = async () => {
      try {
        const data = await getUserBalance(apiKey);
        setUserData({
          username: data.email?.split('@')[0] || 'Studio User',
          email: data.email,
          balance: data.balance || 0
        });
      } catch (err) {
        console.error('Failed to fetch user data for Design Agent:', err);
      }
    };

    fetchUser();
  }, [apiKey, userEmail, balance]);

  return (
    <div className="h-full w-full bg-transparent overflow-hidden design-agent-studio">
      <CreativeCanvas 
        user={userData}
        unavailableCopy={copy.unavailable}
        isAuthorized={!!userData}
        creditConversionRate={200}
        theme="dark"
        onToggleHeader={onToggleHeader}
        isHeaderVisible={isHeaderVisible}
        onGenerationStart={onGenerationStart}
        onGenerationEnd={onGenerationEnd}
        onGenerationComplete={onGenerationComplete}
        onGenerationError={onGenerationError}
      />
    </div>
  );
}
