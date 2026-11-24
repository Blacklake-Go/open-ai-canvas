"use client";

import { CreativeCanvas } from 'design-agent';
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
  accountUser,
  locale = 'en',
  balance,
  authChecked = false,
  onRequireAuth,
  isHeaderVisible,
  onToggleHeader,
  onGenerationStart,
  onGenerationEnd,
  onGenerationComplete,
  onGenerationError,
}) {
  const copy = resolveCopy(enCopy, DESIGN_AGENT_MESSAGES, locale);
  const user = accountUser?.id ? {
    ...accountUser,
    username: accountUser.username || accountUser.email?.split('@')[0],
  } : null;

  return (
    <div className="h-full w-full bg-transparent overflow-hidden design-agent-studio">
      <CreativeCanvas
        key={user?.id || 'guest'}
        user={user}
        platformSession
        authChecked={authChecked}
        onRequireAuth={onRequireAuth}
        locale={locale}
        unavailableCopy={copy.unavailable}
        userBalanceLabel={balance === null || balance === undefined ? '' : new Intl.NumberFormat(locale).format(balance)}
        creditConversionRate={200}
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
