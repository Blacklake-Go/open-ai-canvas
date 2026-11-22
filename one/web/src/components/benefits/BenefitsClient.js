'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import {
  ArrowUpRight,
  BadgeCheck,
  Check,
  Coins,
  Gift,
  Heart,
  History,
  Loader2,
  MessageCircleHeart,
  MoonStar,
  Sparkles,
  Zap,
} from 'lucide-react';
import StudioHeader from '@/components/site/StudioHeader';
import AuthModal from '@/components/AuthModal';
import UserAvatar from '@/components/ui/UserAvatar';
import { Button } from '@/components/ui/button';
import { AVATAR_FRAMES, BENEFITS, CATEGORY_BY_ID, CATEGORY_TABS, ELEMENTS } from '@/lib/benefits/catalog';
import { usePathname } from 'next/navigation';
import { localizedHref } from '@/lib/client/localeSwitch';
import { normalizeLocale, resolveClientLocale } from '@/lib/locales';

const BENEFITS_I18N = {
  'zh-CN': {
    headerTitle: '硬币小铺',
    headerSubtitle: '攒下的硬币，在这儿换成一点心意',
    pocketLabel: '你的口袋',
    coinUnit: '枚 🪙',
    pocketDesc: '硬币是社区给你的小心意，不买卖、不转赠，只用来换下面这些。',
    claimedToday: '今天来过啦',
    checkinToday: '今天打个卡',
    dailyOnce: '每天来一次',
    dailyOnceDesc: '回来看看就好，1 枚硬币会自己落进口袋。北京时间零点算新的一天。',
    honestFeedback: '说句真话',
    honestFeedbackDesc: '遇到 bug、想吐槽、有更好的点子，都可以讲。被采纳的话送 2–20 枚当谢礼。',
    goToFeedback: '去说说',
    boostActive: '优先卡生效中',
    boostLeftDesc: (hours) => `还有约 ${hours} 小时，这段时间交的任务先出图。`,
    shopTitle: '兑换小铺',
    shopSubtitle: (count) => `${count} 件现在就能换，其余的还在准备中——先给你看看，别着急。`,
    wearingBadge: '戴着呢',
    wearBadge: '戴上',
    redeemWithCoins: (coins) => `换 · ${coins} 枚`,
    coinsCount: (coins) => `${coins} 枚`,
    takeOffFrame: '今天不戴',
    permanentRing: '常驻描边',
    inPreparation: '准备中',
    comingSoon: '敬请期待',
    redeemNow: '现在就换',
    saveMore: '再攒攒',
    ledgerTitle: '硬币日记',
    ledgerSubtitle: '每一枚的来处和去处，都替你记着。',
    ledgerAll: '全部',
    ledgerEarn: '进账',
    ledgerSpend: '花掉',
    ledgerLoading: '正在翻开你的小本本…',
    ledgerLoginPrompt: '登录后就能看到你自己的那一本。',
    ledgerEmpty: '这一页还空着。先去打个卡，或者来聊聊你的想法。',
    ledgerEmptyFilter: '这一类暂时没有记录。',
    ledgerMovement: '硬币动了一动',
    coinCountUnit: '枚',
    balanceRemain: (bal) => `还剩 ${bal}`,
    shopNotice: '小铺须知',
    noticeList: [
      '· 硬币一直在你口袋里，不会按月清零。',
      '· 换出去就不退回了，下单前再看一眼价格。',
      '· 给喜欢的作品投币也算花掉，投出去不会变成作者的收入，同一作品每人最多 2 枚。',
      '· 出图用的算力走会员和算力包，硬币不参与——它只负责这些让人开心的小东西。',
    ],
    myAssets: '看看我的资产',
    plansAndCredits: '会员与算力包',
    elements: { fire: '火象', earth: '土象', air: '风象', water: '水象' },
    categoryTabs: {
      outfit: { label: '头像装扮', blurb: '给头像换个心情，戴腻了随时换。' },
      speed: { label: '出图特权', blurb: '着急的时候，先轮到你。' },
      honor: { label: '社区荣誉', blurb: '让好作品在社区多待一会儿。' },
      creator: { label: '创作加成', blurb: '让灵感少卡一次壳。' },
      collect: { label: '限定收藏', blurb: '能拿在手里的 SupDance。' },
    },
    bizLabels: {
      DAILY_LOGIN: '今天来打了个卡',
      FEEDBACK_REWARD: '你说的建议被采纳了',
      POST_COIN_TIP: '给喜欢的作品投了币',
      BENEFIT_REDEEM: '在小铺换了点东西',
      EXCHANGE_CREDITS: '兑换创作算力（已停）',
    },
  },
  'zh-TW': {
    headerTitle: '硬幣小鋪',
    headerSubtitle: '攢下的硬幣，在這兒換成一點心意',
    pocketLabel: '你的口袋',
    coinUnit: '枚 🪙',
    pocketDesc: '硬幣是社區給你的小心意，不買賣、不轉贈，只用來換下面這些。',
    claimedToday: '今天來過啦',
    checkinToday: '今天打個卡',
    dailyOnce: '每天來一次',
    dailyOnceDesc: '回来看看就好，1 枚硬幣會自己落進口袋。北京時間零點算新的一天。',
    honestFeedback: '說句真話',
    honestFeedbackDesc: '遇到 bug、想吐槽、有更好的點子，都可以講。被採納的話送 2–20 枚當謝禮。',
    goToFeedback: '去說說',
    boostActive: '優先卡生效中',
    boostLeftDesc: (hours) => `還有約 ${hours} 小時，這段時間交的任務先出圖。`,
    shopTitle: '兌換小鋪',
    shopSubtitle: (count) => `${count} 件現在就能換，其餘的還在準備中——先給你看，別著急。`,
    wearingBadge: '戴著呢',
    wearBadge: '戴上',
    redeemWithCoins: (coins) => `換 · ${coins} 枚`,
    coinsCount: (coins) => `${coins} 枚`,
    takeOffFrame: '今天不戴',
    permanentRing: '常駐描邊',
    inPreparation: '準備中',
    comingSoon: '敬請期待',
    redeemNow: '現在就換',
    saveMore: '再攢攢',
    ledgerTitle: '硬幣日記',
    ledgerSubtitle: '每一枚的來處和去處，都替你記著。',
    ledgerAll: '全部',
    ledgerEarn: '進賬',
    ledgerSpend: '花掉',
    ledgerLoading: '正在翻開你的小本本…',
    ledgerLoginPrompt: '登入後就能看到你自己的那一本。',
    ledgerEmpty: '這一頁還空著。先去打個卡，或者來聊聊你的想法。',
    ledgerEmptyFilter: '這一類暫時沒有記錄。',
    ledgerMovement: '硬幣動了一動',
    coinCountUnit: '枚',
    balanceRemain: (bal) => `還剩 ${bal}`,
    shopNotice: '小鋪須知',
    noticeList: [
      '· 硬幣一直在你口袋裡，不會按月清零。',
      '· 換出去就不退回了，下單前再看一眼價格。',
      '· 給喜歡的作品投幣也算花掉，投出去不會變成作者的收入，同一作品每人最多 2 枚。',
      '· 出圖用的算力走會員和算力包，硬幣不參與——它只負責這些讓人開心的小東西。',
    ],
    myAssets: '看看我的資產',
    plansAndCredits: '會員與算力包',
    elements: { fire: '火象', earth: '土象', air: '風象', water: '水象' },
    categoryTabs: {
      outfit: { label: '頭像裝扮', blurb: '給頭像換個心情，戴膩了隨時換。' },
      speed: { label: '出圖特權', blurb: '著急的時候，先輪到你。' },
      honor: { label: '社區榮譽', blurb: '讓好作品在社區多待一會兒。' },
      creator: { label: '創作加成', blurb: '讓靈感少卡一次殼。' },
      collect: { label: '限定收藏', blurb: '能拿在手裡的 SupDance。' },
    },
    bizLabels: {
      DAILY_LOGIN: '今天來打了個卡',
      FEEDBACK_REWARD: '你說的建議被採納了',
      POST_COIN_TIP: '給喜歡的作品投了幣',
      BENEFIT_REDEEM: '在小鋪換了點東西',
      EXCHANGE_CREDITS: '兌換創作算力（已停）',
    },
  },
  'ja-JP': {
    headerTitle: 'コインショップ',
    headerSubtitle: '貯まったコインをステキな特典と交換',
    pocketLabel: 'あなたのウォレット',
    coinUnit: '枚 🪙',
    pocketDesc: 'コインはコミュニティからの贈り物です。売買や譲渡はできません。',
    claimedToday: '本日は受取済み',
    checkinToday: 'デイリーチェックイン',
    dailyOnce: '毎日ログイン',
    dailyOnceDesc: '毎日アクセスするだけで1コインがウォレットに届きます。',
    honestFeedback: 'フィードバック',
    honestFeedbackDesc: 'バグ報告や改善要望をお寄せください。採用されると2〜20コインをプレゼント。',
    goToFeedback: '提案する',
    boostActive: '優先カード適用中',
    boostLeftDesc: (hours) => `残り約 ${hours} 時間。タスクが優先処理されます。`,
    shopTitle: '交換ショップ',
    shopSubtitle: (count) => `${count} 件が今すぐ交換可能。残りは準備中です。`,
    wearingBadge: '装着中',
    wearBadge: '装着',
    redeemWithCoins: (coins) => `交換 · ${coins} 枚`,
    coinsCount: (coins) => `${coins} 枚`,
    takeOffFrame: 'フレームを外す',
    permanentRing: '常設フレーム',
    inPreparation: '準備中',
    comingSoon: 'お楽しみに',
    redeemNow: '今すぐ交換',
    saveMore: 'コインを貯める',
    ledgerTitle: 'コイン通帳',
    ledgerSubtitle: 'コインの獲得・使用履歴を確認できます。',
    ledgerAll: 'すべて',
    ledgerEarn: '獲得',
    ledgerSpend: '使用',
    ledgerLoading: '履歴を読み込み中…',
    ledgerLoginPrompt: 'ログインするとコイン通帳を確認できます。',
    ledgerEmpty: '履歴はまだありません。チェックインや提案を行ってみましょう。',
    ledgerEmptyFilter: 'このカテゴリには履歴がありません。',
    ledgerMovement: 'コインの変動',
    coinCountUnit: '枚',
    balanceRemain: (bal) => `残高 ${bal}`,
    shopNotice: 'ショップご利用案内',
    noticeList: [
      '· コインに有効期限はなく、月次リセットもありません。',
      '· 交換後のキャンセルや返品はできません。',
      '· お気に入り作品へのコイン投入は1作品につき最大2枚までです。',
      '· 生成クレジットはプランまたはチャージ枠が適用され、コインとは連動しません。',
    ],
    myAssets: 'マイ資産を見る',
    plansAndCredits: 'プラン＆クレジット',
    elements: { fire: '火のエレメント', earth: '地のエレメント', air: '風のエレメント', water: '水のエレメント' },
    categoryTabs: {
      outfit: { label: 'アバター装飾', blurb: '気分に合わせてアバターフレームを着せ替え。' },
      speed: { label: '生成特権', blurb: '急いでいる時に優先して生成。' },
      honor: { label: 'コミュニティ栄誉', blurb: '優れた作品を長く目立たせます。' },
      creator: { label: '制作ブースト', blurb: 'インスピレーションを加速。' },
      collect: { label: '限定コレクション', blurb: 'SupDance 限定アイテム。' },
    },
    bizLabels: {
      DAILY_LOGIN: 'デイリーログインボーナス',
      FEEDBACK_REWARD: 'フィードバック採用報酬',
      POST_COIN_TIP: '作品へコインを投入',
      BENEFIT_REDEEM: 'ショップでアイテム交換',
      EXCHANGE_CREDITS: 'クレジット交換（終了）',
    },
  },
  'ko-KR': {
    headerTitle: '코인 상점',
    headerSubtitle: '모은 코인으로 특별한 혜택을 만나보세요',
    pocketLabel: '내 지갑',
    coinUnit: '개 🪙',
    pocketDesc: '코인은 커뮤니티가 드리는 선물이며 거래나 양도는 불가능합니다.',
    claimedToday: '오늘 출석 완료',
    checkinToday: '오늘 출석체크',
    dailyOnce: '매일 한 번 방문',
    dailyOnceDesc: '방문하기만 해도 매일 1코인이 자동으로 적립됩니다.',
    honestFeedback: '피드백 보내기',
    honestFeedbackDesc: '버그나 제안을 공유해 주세요. 채택 시 2~20 코인을 드립니다.',
    goToFeedback: '의견 쓰기',
    boostActive: '우선 생성 적용 중',
    boostLeftDesc: (hours) => `약 ${hours}시간 남음. 생성 작업이 우선 배정됩니다.`,
    shopTitle: '교환 상점',
    shopSubtitle: (count) => `${count}개 아이템을 지금 교환할 수 있습니다.`,
    wearingBadge: '착용 중',
    wearBadge: '착용',
    redeemWithCoins: (coins) => `교환 · ${coins}개`,
    coinsCount: (coins) => `${coins}개`,
    takeOffFrame: '프레임 해제',
    permanentRing: '상시 프레임',
    inPreparation: '준비 중',
    comingSoon: '커밍 순',
    redeemNow: '지금 교환',
    saveMore: '코인 더 모으기',
    ledgerTitle: '코인 다이어리',
    ledgerSubtitle: '코인의 적립과 사용 내역을 모두 기록합니다.',
    ledgerAll: '전체',
    ledgerEarn: '적립',
    ledgerSpend: '사용',
    ledgerLoading: '기록을 불러오는 중…',
    ledgerLoginPrompt: '로그인 후 코인 다이어리를 확인할 수 있습니다.',
    ledgerEmpty: '아직 기록이 없습니다. 출석체크나 피드백을 시작해 보세요.',
    ledgerEmptyFilter: '해당 내역이 없습니다.',
    ledgerMovement: '코인 변동',
    coinCountUnit: '개',
    balanceRemain: (bal) => `잔여 ${bal}`,
    shopNotice: '상점 이용 안내',
    noticeList: [
      '· 코인은 유효기간 없이 영구 유지됩니다.',
      '· 교환 완료 후에는 취소나 환불이 불가합니다.',
      '· 작품 코인 후원은 동일 작품당 최대 2개까지 가능합니다.',
      '· 생성 크레딧은 멤버십이나 패키지에서 제공되며 코인과는 별개입니다.',
    ],
    myAssets: '내 자산 확인',
    plansAndCredits: '멤버십 및 크레딧 팩',
    elements: { fire: '불자리', earth: '흙자리', air: '바람자리', water: '물자리' },
    categoryTabs: {
      outfit: { label: '프로필 꾸미기', blurb: '프로필 아바타를 개성 있게 꾸며보세요.' },
      speed: { label: '생성 특권', blurb: '급할 때 우선 생성 대기열에 진입합니다.' },
      honor: { label: '커뮤니티 명예', blurb: '멋진 작품을 커뮤니티에 더 오래 노출하세요.' },
      creator: { label: '창작 부스트', blurb: '영감이 막힐 때 도움을 드립니다.' },
      collect: { label: '한정 컬렉션', blurb: '특별한 SupDance 한정판 아이템.' },
    },
    bizLabels: {
      DAILY_LOGIN: '일일 출석체크',
      FEEDBACK_REWARD: '피드백 채택 보상',
      POST_COIN_TIP: '작품 코인 후원',
      BENEFIT_REDEEM: '상점 아이템 교환',
      EXCHANGE_CREDITS: '크레딧 교환 (종료)',
    },
  },
  es: {
    headerTitle: 'Tienda de Monedas',
    headerSubtitle: 'Canjea las monedas que has acumulado por detalles exclusivos',
    pocketLabel: 'Tu saldo',
    coinUnit: '🪙',
    pocketDesc: 'Las monedas son un obsequio de la comunidad. No se venden ni se transfieren.',
    claimedToday: 'Reclamado hoy',
    checkinToday: 'Registrarse hoy',
    dailyOnce: 'Visítanos a diario',
    dailyOnceDesc: 'Basta con entrar cada día para recibir 1 moneda gratis en tu saldo.',
    honestFeedback: 'Danos tu opinión',
    honestFeedbackDesc: 'Reporta bugs o sugiere ideas. Si las adoptamos, recibirás de 2 a 20 monedas.',
    goToFeedback: 'Comentar',
    boostActive: 'Pase prioritario activo',
    boostLeftDesc: (hours) => `Quedan unas ${hours} horas. Tus generaciones se procesarán primero.`,
    shopTitle: 'Tienda de Canje',
    shopSubtitle: (count) => `${count} artículos disponibles ahora; los demás están en preparación.`,
    wearingBadge: 'En uso',
    wearBadge: 'Usar',
    redeemWithCoins: (coins) => `Canjear · ${coins}`,
    coinsCount: (coins) => `${coins} monedas`,
    takeOffFrame: 'Quitar marco',
    permanentRing: 'Borde permanente',
    inPreparation: 'Próximamente',
    comingSoon: 'Próximamente',
    redeemNow: 'Canjear ya',
    saveMore: 'Ahorrar más',
    ledgerTitle: 'Historial de Monedas',
    ledgerSubtitle: 'Registro detallado de todas tus monedas ganadas y gastadas.',
    ledgerAll: 'Todos',
    ledgerEarn: 'Ingresos',
    ledgerSpend: 'Gastos',
    ledgerLoading: 'Cargando tu historial…',
    ledgerLoginPrompt: 'Inicia sesión para ver tu historial de monedas.',
    ledgerEmpty: 'Aún no hay movimientos. Haz check-in o déjanos un comentario.',
    ledgerEmptyFilter: 'No hay registros en esta categoría.',
    ledgerMovement: 'Movimiento de monedas',
    coinCountUnit: 'monedas',
    balanceRemain: (bal) => `Quedan ${bal}`,
    shopNotice: 'Normas de la tienda',
    noticeList: [
      '· Las monedas no caducan ni se reinician al final del mes.',
      '· Una vez canjeado un artículo no hay devoluciones.',
      '· Las donaciones a creaciones están limitadas a un máximo de 2 monedas por obra.',
      '· Los créditos de generación se gestionan con membresías y paquetes, separados de las monedas.',
    ],
    myAssets: 'Ver mis activos',
    plansAndCredits: 'Membresías y Créditos',
    elements: { fire: 'Fuego', earth: 'Tierra', air: 'Aire', water: 'Agua' },
    categoryTabs: {
      outfit: { label: 'Marcos de avatar', blurb: 'Dale un nuevo aspecto a tu avatar cuando quieras.' },
      speed: { label: 'Pases rápidos', blurb: 'Prioridad de generación cuando tienes prisa.' },
      honor: { label: 'Honor comunitario', blurb: 'Destaca tus mejores creaciones en la comunidad.' },
      creator: { label: 'Impulso creativo', blurb: 'Recibe ayuda cuando te falte inspiración.' },
      collect: { label: 'Coleccionables', blurb: 'Artículos exclusivos de SupDance.' },
    },
    bizLabels: {
      DAILY_LOGIN: 'Check-in diario',
      FEEDBACK_REWARD: 'Recompensa por sugerencia',
      POST_COIN_TIP: 'Donación a creación',
      BENEFIT_REDEEM: 'Canje en tienda',
      EXCHANGE_CREDITS: 'Canje de créditos (finalizado)',
    },
  },
  en: {
    headerTitle: 'Coin Shop',
    headerSubtitle: 'Redeem your accumulated coins for special perks and treats',
    pocketLabel: 'Your Wallet',
    coinUnit: 'coins 🪙',
    pocketDesc: 'Coins are community rewards. They cannot be sold or transferred.',
    claimedToday: 'Claimed today',
    checkinToday: 'Daily Check-in',
    dailyOnce: 'Visit Daily',
    dailyOnceDesc: 'Just drop by each day and 1 coin will land in your pocket.',
    honestFeedback: 'Share Feedback',
    honestFeedbackDesc: 'Report bugs or share ideas. If adopted, get 2–20 coins as a thank-you.',
    goToFeedback: 'Feedback',
    boostActive: 'Priority Card Active',
    boostLeftDesc: (hours) => `About ${hours}h left. Your generation tasks will render first.`,
    shopTitle: 'Redemption Shop',
    shopSubtitle: (count) => `${count} items available now; more are in preparation.`,
    wearingBadge: 'Wearing',
    wearBadge: 'Wear',
    redeemWithCoins: (coins) => `Redeem · ${coins}`,
    coinsCount: (coins) => `${coins} coins`,
    takeOffFrame: 'Remove Frame',
    permanentRing: 'Permanent Ring',
    inPreparation: 'Coming Soon',
    comingSoon: 'Coming Soon',
    redeemNow: 'Redeem Now',
    saveMore: 'Save More',
    ledgerTitle: 'Coin Journal',
    ledgerSubtitle: 'Every incoming and outgoing coin is recorded here for you.',
    ledgerAll: 'All',
    ledgerEarn: 'Earned',
    ledgerSpend: 'Spent',
    ledgerLoading: 'Opening your coin journal…',
    ledgerLoginPrompt: 'Log in to view your personal coin journal.',
    ledgerEmpty: 'This page is empty. Check in or share your ideas to get started.',
    ledgerEmptyFilter: 'No records in this category.',
    ledgerMovement: 'Coin transaction',
    coinCountUnit: 'coins',
    balanceRemain: (bal) => `${bal} remaining`,
    shopNotice: 'Shop Guidelines',
    noticeList: [
      '· Coins stay in your wallet and never expire or reset monthly.',
      '· Redeemed items cannot be returned. Please check the price before redeeming.',
      '· Tipping creations spends coins; max 2 coins per creation per person.',
      '· AI generation uses membership credits; coins are exclusively for perks.',
    ],
    myAssets: 'View My Assets',
    plansAndCredits: 'Plans & Credits',
    elements: { fire: 'Fire', earth: 'Earth', air: 'Air', water: 'Water' },
    categoryTabs: {
      outfit: { label: 'Avatar Frames', blurb: 'Give your profile avatar a fresh look.' },
      speed: { label: 'Speed Perks', blurb: 'Jump ahead in the queue when you are in a rush.' },
      honor: { label: 'Community Honors', blurb: 'Keep standout creations visible longer.' },
      creator: { label: 'Creation Boosts', blurb: 'Overcome creative blocks faster.' },
      collect: { label: 'Limited Collectibles', blurb: 'Exclusive SupDance physical & digital items.' },
    },
    bizLabels: {
      DAILY_LOGIN: 'Daily check-in reward',
      FEEDBACK_REWARD: 'Feedback rewarded',
      POST_COIN_TIP: 'Tipped a creation',
      BENEFIT_REDEEM: 'Redeemed shop perk',
      EXCHANGE_CREDITS: 'Exchanged credits (deprecated)',
    },
  },
};

const CATEGORY_ICONS = {
  coins: Coins,
  zap: Zap,
  badge: BadgeCheck,
  heart: Heart,
  sparkles: Sparkles,
  gift: Gift,
};

function formatTime(value, norm = 'en') {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return String(value);
  const localeMap = {
    'zh-CN': 'zh-CN',
    'zh-TW': 'zh-TW',
    'ja-JP': 'ja-JP',
    'ko-KR': 'ko-KR',
    es: 'es-ES',
    en: 'en-US',
  };
  return date.toLocaleString(localeMap[norm] || 'en-US');
}

function remainingHours(until) {
  if (!until) return 0;
  const diff = new Date(until).getTime() - Date.now();
  return diff > 0 ? Math.ceil(diff / 3600000) : 0;
}

/** 头像本体：兑换格里先看到自己的脸，再看框套上来的效果。 */
function AvatarFace({ user }) {
  const src = user?.photo_url || user?.avatar || user?.avatar_url || '';
  const name = user?.displayName || user?.display_name || user?.email?.split('@')[0] || '';
  return (
    <span className="avatar-frame-face">
      <UserAvatar
        src={src}
        name={name}
        className="size-full object-cover"
        fallbackClassName="size-full flex items-center justify-center font-bold text-xs"
      />
    </span>
  );
}

/** 头像框实物：描边套在头像外面，星座符号只是钉在框下沿的徽章。 */
function FrameSwatch({ def, user, worn, celebrate, size = 'size-12' }) {
  return (
    <span className="relative inline-flex shrink-0">
      <span
        className={`relative flex ${size} items-center justify-center rounded-full bg-overlay transition-transform group-hover:-translate-y-0.5 ${def.ringClasses}${
          worn ? ' avatar-frame--live' : ''
        }${celebrate ? ' avatar-frame--pop' : ''}`}
      >
        <AvatarFace user={user} />
        {celebrate && <span className="avatar-frame-burst" aria-hidden="true" />}
        {celebrate && (
          <span className="avatar-frame-sparks" aria-hidden="true">
            {[0, 1, 2, 3, 4, 5].map((i) => (
              <i key={i} style={{ '--spark-angle': `${i * 60}deg`, animationDelay: `${i * 24}ms` }} />
            ))}
          </span>
        )}
        {def.glyph ? <span className="avatar-frame-emblem">{`${def.glyph}\uFE0E`}</span> : null}
      </span>
      {worn && (
        <span className="absolute -top-0.5 -right-0.5 flex size-4 items-center justify-center rounded-full border border-line bg-surface text-brand animate-scale-in">
          <Check className="size-2.5" />
        </span>
      )}
    </span>
  );
}

export default function BenefitsClient({ locale: localeProp = null }) {
  const pathname = usePathname();
  const activeLocale = resolveClientLocale({
    explicit: localeProp,
    pathname: typeof window !== 'undefined' ? window.location.pathname : '',
    search: typeof window !== 'undefined' ? window.location.search : '',
    userLocale: typeof document !== 'undefined' ? document.cookie.match(/(?:^|;\s*)(?:NEXT_LOCALE|locale)=([^;]+)/)?.[1] : null,
  });
  const norm = normalizeLocale(activeLocale);
  const t = BENEFITS_I18N[norm] || BENEFITS_I18N.en;

  const [user, setUser] = useState(null);
  const [coins, setCoins] = useState(0);
  const [ledger, setLedger] = useState([]);
  const [ledgerLoading, setLedgerLoading] = useState(true);
  const [ledgerFilter, setLedgerFilter] = useState('all');
  const [category, setCategory] = useState('all');
  const [dailyClaimed, setDailyClaimed] = useState(false);
  const [claiming, setClaiming] = useState(false);
  const [redeeming, setRedeeming] = useState(null);
  const [wearing, setWearing] = useState(false);
  const [message, setMessage] = useState('');
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [celebrate, setCelebrate] = useState(null);
  const [coinBump, setCoinBump] = useState(false);
  const coinBaseline = useRef(0);

  const loadWallet = useCallback(async () => {
    setLedgerLoading(true);
    try {
      const res = await fetch('/api/financial/currency/wallet?limit=50', { cache: 'no-store' });
      if (!res.ok) return;
      const data = await res.json();
      setCoins(Number(data.wallet?.availableBalance || 0));
      if (Array.isArray(data.recentTransactions)) setLedger(data.recentTransactions);
    } catch {} finally {
      setLedgerLoading(false);
    }
  }, []);

  const loadDailyStatus = useCallback(async () => {
    try {
      const res = await fetch('/api/financial/currency/daily-login', { cache: 'no-store' });
      if (!res.ok) return;
      const data = await res.json();
      setDailyClaimed(Boolean(data.claimed));
    } catch {}
  }, []);

  const loadProfile = useCallback(async () => {
    try {
      const res = await fetch('/api/auth/me', { cache: 'no-store' });
      if (!res.ok) {
        setLedgerLoading(false);
        return;
      }
      const data = await res.json();
      if (data?.user) {
        setUser(data.user);
        loadWallet();
        loadDailyStatus();
      } else {
        setLedgerLoading(false);
      }
    } catch {
      setLedgerLoading(false);
    }
  }, [loadWallet, loadDailyStatus]);

  useEffect(() => {
    loadProfile();
  }, [loadProfile]);

  useEffect(() => {
    if (!message) return;
    const timer = window.setTimeout(() => setMessage(''), 5000);
    return () => window.clearTimeout(timer);
  }, [message]);

  /* 戴上那一下的动效只播一次，播完就把爆发层摘掉 */
  useEffect(() => {
    if (!celebrate) return;
    const timer = window.setTimeout(() => setCelebrate(null), 900);
    return () => window.clearTimeout(timer);
  }, [celebrate]);

  /* 口袋数字变化时弹一下，让"进账/花掉"看得见 */
  useEffect(() => {
    if (coinBaseline.current === coins) return;
    coinBaseline.current = coins;
    setCoinBump(true);
    const timer = window.setTimeout(() => setCoinBump(false), 420);
    return () => window.clearTimeout(timer);
  }, [coins]);

  const ownedFrames = user?.avatarFrames || [];
  const wornFrame = user?.avatarFrame || null;
  const boostLeft = remainingHours(user?.priorityUntil);

  const requireAuth = () => {
    if (user) return false;
    setShowAuthModal(true);
    return true;
  };

  async function claimDaily() {
    if (requireAuth() || claiming || dailyClaimed) return;
    setClaiming(true);
    try {
      const res = await fetch('/api/financial/currency/daily-login', { method: 'POST' });
      const data = await res.json().catch(() => ({}));
      if (res.ok && data.amount > 0) {
        setMessage(`叮——今天的 1 枚硬币已经收进口袋`);
        setDailyClaimed(true);
      } else if (res.ok) {
        setMessage('今天已经打过卡啦，明天再来');
        setDailyClaimed(true);
      } else {
        setMessage(data.error || '刚才没领上，稍后再试一次');
      }
      await loadWallet();
    } catch {
      setMessage('网络不太顺，稍后再试');
    } finally {
      setClaiming(false);
    }
  }

  async function redeem(benefit) {
    if (requireAuth() || redeeming) return;
    if (coins < benefit.coins) {
      setMessage(`这次要 ${benefit.coins} 枚，你手上还有 ${coins.toFixed(2)} 枚`);
      return;
    }
    setRedeeming(benefit.id);
    setMessage('');
    try {
      const res = await fetch('/api/financial/currency/benefits', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-idempotency-key': crypto.randomUUID(),
        },
        body: JSON.stringify({ benefitId: benefit.id }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setMessage(data.error || '刚才没换成，稍后再试一次');
      } else if (benefit.kind === 'priority') {
        setMessage(`优先卡已生效，到 ${formatTime(data.priorityUntil)} 前都先轮到你`);
      } else {
        setCelebrate(benefit.frame);
        setMessage(`${AVATAR_FRAMES[benefit.frame]?.label || '头像框'}已经是你的人了，现在戴着它`);
      }
      await Promise.all([loadWallet(), loadProfile()]);
    } catch {
      setMessage('网络不太顺，这次没有扣币');
    } finally {
      setRedeeming(null);
    }
  }

  async function wear(frame) {
    if (requireAuth() || wearing) return;
    setWearing(true);
    try {
      const res = await fetch('/api/user/avatar-frame', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ frame }),
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok) {
        if (frame) {
          setCelebrate(frame);
          setMessage(`戴上了${AVATAR_FRAMES[frame]?.short || '头像框'}，去社区里走走`);
        } else {
          setMessage('先摘下来了，回到原来的样子');
        }
        await loadProfile();
      } else {
        setMessage(data.error || '刚才没换上，再试一次');
      }
    } catch {
      setMessage('网络不太顺，稍后再试');
    } finally {
      setWearing(false);
    }
  }

  const filteredLedger = ledger.filter((item) => {
    if (ledgerFilter === 'all') return true;
    return ledgerFilter === 'earn' ? item.direction === 'CREDIT' : item.direction === 'DEBIT';
  });

  const shown = category === 'all' ? BENEFITS : BENEFITS.filter((b) => b.category === category);
  const shownFrames = shown.filter((b) => b.kind === 'avatar_frame');
  const shownOthers = shown.filter((b) => b.kind !== 'avatar_frame');
  const openCount = BENEFITS.filter((b) => b.status === 'open').length;
  const wornDef = AVATAR_FRAMES[wornFrame] || { ringClasses: 'avatar-frame' };

  return (
    <div className="min-h-screen bg-canvas text-ink flex flex-col">
      <StudioHeader title="硬币小铺" subtitle="攒下的硬币，在这儿换成一点心意" />

      <main className="flex-1 w-full max-w-5xl mx-auto px-4 py-8 sm:px-6 lg:px-8 space-y-6">
        {message && (
          <div
            role="status"
            className="flex items-center justify-between gap-3 rounded-2xl border border-warning-line bg-warning-soft px-5 py-3 text-label font-semibold text-warning animate-toast-in"
          >
            <span>{message}</span>
            <button type="button" onClick={() => setMessage('')} className="text-ink-muted hover:text-ink cursor-pointer">✕</button>
          </div>
        )}

        {/* 口袋 */}
        <section className="rounded-2xl border border-warning-line bg-gradient-to-b from-warning-soft via-well to-base p-6 shadow-elevation-3">
          <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
            <div className="flex items-center gap-4">
              <FrameSwatch
                def={wornDef}
                user={user}
                worn={Boolean(wornFrame)}
                celebrate={Boolean(wornFrame) && celebrate === wornFrame}
                size="size-11"
              />
              <div className="min-w-0">
                <span className="text-label text-ink-muted">你的口袋</span>
                <div className="mt-1 flex items-baseline gap-2">
                  <span className={`inline-block text-display font-black tracking-tight text-warning font-mono${coinBump ? ' coin-bump' : ''}`}>
                    {coins.toFixed(2)}
                  </span>
                  <span className="text-label text-warning">枚 🪙</span>
                </div>
                <p className="mt-2 text-label text-ink-muted leading-relaxed">
                  硬币是社区给你的小心意，不买卖、不转赠，只用来换下面这些。
                </p>
              </div>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={claimDaily}
              disabled={!user || dailyClaimed || claiming}
              className={`gap-1.5 border-warning-line cursor-pointer disabled:cursor-not-allowed ${
                dailyClaimed ? 'bg-warning-soft text-ink-muted' : 'bg-warning-soft text-warning hover:text-ink active:scale-95'
              }`}
            >
              {claiming ? <Loader2 className="size-3.5 animate-spin" /> : <span className="text-body">🪙</span>}
              <span>{dailyClaimed ? '今天来过啦' : '今天打个卡'}</span>
            </Button>
          </div>

          <div className="mt-5 pt-5 border-t border-line grid gap-3 sm:grid-cols-2">
            <div className="rounded-2xl border border-line bg-scrim p-4">
              <div className="flex items-center gap-2 text-label font-bold text-ink">
                <MoonStar className="size-4 text-warning" />
                <span>每天来一次</span>
              </div>
              <p className="mt-1.5 text-caption text-ink-muted leading-relaxed">
                回来看看就好，1 枚硬币会自己落进口袋。北京时间零点算新的一天。
              </p>
            </div>
            <div className="rounded-2xl border border-line bg-scrim p-4">
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2 text-label font-bold text-ink">
                  <MessageCircleHeart className="size-4 text-success" />
                  <span>说句真话</span>
                </div>
                <Link href={localizedHref('/feedback', { pathname })} prefetch={false} className="text-micro font-semibold text-brand hover:text-brand-hover flex items-center gap-0.5">
                  去说说 <ArrowUpRight className="size-3" />
                </Link>
              </div>
              <p className="mt-1.5 text-caption text-ink-muted leading-relaxed">
                遇到 bug、想吐槽、有更好的点子，都可以讲。被采纳的话送 2–20 枚当谢礼。
              </p>
            </div>
          </div>
        </section>

        {/* 优先卡生效中 */}
        {boostLeft > 0 && (
          <div className="flex items-center justify-between gap-3 rounded-2xl border border-brand-line bg-brand-soft px-5 py-3">
            <div className="flex items-center gap-2 text-label text-ink">
              <Zap className="size-4 text-brand" />
              <span className="font-semibold">优先卡生效中</span>
              <span className="text-ink-muted">还有约 {boostLeft} 小时，这段时间交的任务先出图。</span>
            </div>
            <span className="text-label font-mono text-brand-hover">{formatTime(user?.priorityUntil)}</span>
          </div>
        )}

        {/* 兑换小铺 */}
        <section className="rounded-2xl border border-line bg-scrim p-6 shadow-elevation-3">
          <div className="flex flex-wrap items-end justify-between gap-3 mb-4">
            <div>
              <div className="flex items-center gap-2">
                <Sparkles className="size-4 text-warning" />
                <h2 className="text-section-title font-bold text-ink">兑换小铺</h2>
              </div>
              <p className="mt-1 text-label text-ink-muted">
                {openCount} 件现在就能换，其余的还在准备中——先给你看看，别着急。
              </p>
            </div>
          </div>

          {/* 可切换的分类菜单 */}
          <div className="flex items-center gap-1 overflow-x-auto rounded-full border border-line bg-well p-1 mb-6">
            {CATEGORY_TABS.map((tab) => {
              const Icon = CATEGORY_ICONS[tab.icon] || Sparkles;
              const active = category === tab.id;
              return (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setCategory(tab.id)}
                  title={tab.blurb}
                  className={`flex items-center gap-1.5 h-8 shrink-0 rounded-full px-3.5 text-label transition cursor-pointer active:scale-95 ${
                    active ? 'bg-surface-inverse text-ink-inverse font-bold shadow-elevation-1' : 'text-ink-muted hover:text-ink hover:bg-wash'
                  }`}
                >
                  <Icon className={`size-3.5 transition-transform ${active ? 'scale-110' : ''}`} />
                  <span>{tab.label}</span>
                </button>
              );
            })}
          </div>

          {CATEGORY_TABS.find((t) => t.id === category)?.blurb && (
            <p className="-mt-4 mb-5 text-caption text-ink-subtle">
              {CATEGORY_TABS.find((t) => t.id === category).blurb}
            </p>
          )}

          {/* 头像框：直接试戴 */}
          {shownFrames.length > 0 && (
            <div key={`frames-${category}`} className="grid gap-3 grid-cols-3 sm:grid-cols-4 lg:grid-cols-5 animate-fade-in">
              {shownFrames.map((benefit) => {
                const def = AVATAR_FRAMES[benefit.frame] || {};
                const owned = ownedFrames.includes(benefit.frame);
                const worn = wornFrame === benefit.frame;
                const affordable = coins >= benefit.coins;
                const busy = redeeming === benefit.id;
                return (
                  <div
                    key={benefit.id}
                    className={`group frame-tile flex flex-col items-center gap-2 rounded-2xl border bg-well p-4 pt-5 text-center transition-colors hover:border-warning-line ${
                      worn ? 'border-brand-line' : 'border-line'
                    }`}
                  >
                    <FrameSwatch def={def} user={user} worn={worn} celebrate={celebrate === benefit.frame} />
                    <div className="min-w-0">
                      <p className="text-label font-bold text-ink truncate">{def.short || benefit.title}</p>
                      <p className="text-micro text-ink-subtle mt-0.5 truncate">
                        {def.dates ? `${def.dates} · ${ELEMENTS[def.element] || ''}` : '常驻描边'}
                      </p>
                    </div>
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={!user || (!owned && (!affordable || busy)) || (owned && (worn || wearing))}
                      onClick={() => (owned ? wear(benefit.frame) : redeem(benefit))}
                      className={`w-full text-micro h-7 rounded-lg px-2 cursor-pointer transition-transform active:scale-95 disabled:cursor-not-allowed ${
                        worn
                          ? 'border-brand-line text-brand bg-brand-soft'
                          : owned
                            ? 'border-line text-ink-muted hover:text-ink'
                            : 'border-warning-line text-warning hover:bg-warning-soft'
                      }`}
                    >
                      {busy ? (
                        <Loader2 className="size-3 animate-spin" />
                      ) : worn ? (
                        <span className="flex items-center gap-1"><Check className="size-3" />戴着呢</span>
                      ) : owned ? (
                        '戴上'
                      ) : affordable ? (
                        `换 · ${benefit.coins} 枚`
                      ) : (
                        `${benefit.coins} 枚`
                      )}
                    </Button>
                  </div>
                );
              })}
              {ownedFrames.length > 0 && wornFrame && (
                <button
                  type="button"
                  disabled={wearing}
                  onClick={() => wear(null)}
                  className="group frame-tile flex flex-col items-center justify-center gap-2 rounded-2xl border border-dashed border-line bg-well p-4 pt-5 text-center text-ink-muted hover:text-ink hover:border-line-strong transition-colors cursor-pointer disabled:cursor-not-allowed"
                >
                  <span className="relative flex size-12 items-center justify-center rounded-full border-2 border-dashed border-line-strong transition-transform group-hover:-translate-y-0.5">
                    <AvatarFace user={user} />
                  </span>
                  <p className="text-label font-semibold">今天不戴</p>
                </button>
              )}
            </div>
          )}

          {/* 其余权益 */}
          {shownOthers.map((benefit) => {
            const soon = benefit.status === 'soon';
            const Icon = CATEGORY_ICONS[CATEGORY_BY_ID[benefit.category]?.icon] || Sparkles;
            const affordable = coins >= benefit.coins;
            const busy = redeeming === benefit.id;
            return (
              <div
                key={`${category}-${benefit.id}`}
                className={`mt-3 flex items-center gap-4 rounded-2xl border p-4 transition-colors animate-fade-in ${
                  soon ? 'border-line bg-well opacity-70' : 'border-line bg-well hover:border-warning-line group'
                }`}
              >
                <span className={`flex size-10 shrink-0 items-center justify-center rounded-xl border transition-transform ${
                  soon ? 'border-line bg-scrim text-ink-subtle' : 'border-warning-line bg-warning-soft text-warning group-hover:-translate-y-0.5 group-hover:rotate-3'
                }`}>
                  <Icon className="size-5" />
                </span>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <h3 className="text-body font-bold text-ink">{benefit.title}</h3>
                    {soon && (
                      <span className="rounded-full border border-line bg-scrim px-2 py-0.5 text-micro text-ink-subtle">准备中</span>
                    )}
                  </div>
                  <p className="mt-1 text-caption text-ink-muted leading-relaxed">
                    {benefit.summary}
                  </p>
                  {soon && benefit.note && (
                    <p className="mt-1 text-micro text-ink-subtle leading-relaxed">{benefit.note}</p>
                  )}
                </div>
                <div className="shrink-0 flex flex-col items-end gap-2">
                  <span className={`font-mono text-label font-bold ${soon ? 'text-ink-subtle' : 'text-warning'}`}>
                    🪙 {benefit.coins}
                  </span>
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={soon || !user || !affordable || !!redeeming}
                    onClick={() => redeem(benefit)}
                    className="text-micro h-7 rounded-lg px-3 border-warning-line text-warning hover:bg-warning-soft cursor-pointer disabled:cursor-not-allowed disabled:border-line disabled:text-ink-subtle disabled:hover:bg-transparent"
                  >
                    {busy ? (
                      <Loader2 className="size-3.5 animate-spin" />
                    ) : soon ? (
                      '敬请期待'
                    ) : affordable ? (
                      '现在就换'
                    ) : (
                      '再攒攒'
                    )}
                  </Button>
                </div>
              </div>
            );
          })}
        </section>

        {/* 硬币日记 */}
        <section className="rounded-2xl border border-line bg-scrim shadow-elevation-3 overflow-hidden">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-6 border-b border-line-subtle">
            <div>
              <h2 className="text-section-title font-bold text-ink flex items-center gap-2">
                <History className="size-4 text-brand" />
                <span>硬币日记</span>
              </h2>
              <p className="text-label text-ink-subtle mt-0.5">每一枚的来处和去处，都替你记着。</p>
            </div>
            <div className="flex items-center gap-1 bg-well border border-line p-1 rounded-full self-start sm:self-auto">
              {[
                { id: 'all', label: '全部' },
                { id: 'earn', label: '进账' },
                { id: 'spend', label: '花掉' },
              ].map((tab) => (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setLedgerFilter(tab.id)}
                  className={`h-7 text-label rounded-full px-3 transition-colors cursor-pointer ${
                    ledgerFilter === tab.id ? 'bg-surface-inverse text-ink-inverse font-bold shadow-elevation-1' : 'text-ink-muted hover:text-ink'
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>
          </div>

          {ledgerLoading ? (
            <div className="py-16 text-center text-label text-ink-subtle flex items-center justify-center gap-2">
              <Loader2 className="size-4 animate-spin text-brand" />
              <span>正在翻开你的小本本…</span>
            </div>
          ) : !user ? (
            <p className="py-16 text-center text-label text-ink-subtle">登录后就能看到你自己的那一本。</p>
          ) : filteredLedger.length === 0 ? (
            <p className="py-16 text-center text-label text-ink-subtle">
              {ledger.length === 0 ? '这一页还空着。先去打个卡，或者来聊聊你的想法。' : '这一类暂时没有记录。'}
            </p>
          ) : (
            <ul className="divide-y divide-line-subtle">
              {filteredLedger.map((item, idx) => {
                const earned = item.direction === 'CREDIT';
                return (
                  <li key={item.id || idx} className="flex items-center justify-between gap-4 px-6 py-4 hover:bg-wash transition-colors">
                    <div className="flex items-center gap-3 min-w-0">
                      <div className={`flex size-8 shrink-0 items-center justify-center rounded-xl border text-label font-bold ${
                        earned ? 'border-success-line bg-success-soft text-success' : 'border-line bg-wash text-ink-muted'
                      }`}>
                        {earned ? '+' : '−'}
                      </div>
                      <div className="min-w-0">
                        <p className="text-label font-semibold text-ink truncate">{BIZ_LABELS[item.bizType] || item.description || '硬币动了一动'}</p>
                        <p className="text-caption text-ink-subtle font-mono mt-0.5 truncate">
                          {formatTime(item.createdAt)}
                        </p>
                      </div>
                    </div>
                    <div className="text-end shrink-0">
                      <div className={`font-mono text-body font-bold ${earned ? 'text-success' : 'text-ink'}`}>
                        {earned ? '+' : '−'}{Number(item.amount).toFixed(2)} <span className="text-caption font-normal">枚</span>
                      </div>
                      {item.balanceAfter !== null && (
                        <div className="text-caption text-ink-subtle font-mono">还剩 {Number(item.balanceAfter).toFixed(2)}</div>
                      )}
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </section>

        {/* 小铺须知 */}
        <section className="rounded-2xl border border-line bg-scrim p-6 shadow-elevation-2">
          <div className="flex items-center gap-2 text-body font-bold text-ink mb-3">
            <Coins className="size-4 text-warning" />
            <span>小铺须知</span>
          </div>
          <ul className="space-y-2 text-label text-ink-muted leading-relaxed">
            <li>· 硬币一直在你口袋里，不会按月清零。</li>
            <li>· 换出去就不退回了，下单前再看一眼价格。</li>
            <li>· 给喜欢的作品投币也算花掉，投出去不会变成作者的收入，同一作品每人最多 2 枚。</li>
            <li>· 出图用的算力走会员和算力包，硬币不参与——它只负责这些让人开心的小东西。</li>
          </ul>
          <div className="mt-4 flex flex-wrap gap-2">
            <Link href={localizedHref('/credits', { pathname })} prefetch={false}>
              <Button variant="outline" size="sm" className="text-caption rounded-xl border-line cursor-pointer">
                看看我的资产
              </Button>
            </Link>
            <Link href={localizedHref('/pricing', { pathname })} prefetch={false}>
              <Button variant="ghost" size="sm" className="text-caption text-brand hover:text-brand-hover cursor-pointer">
                会员与算力包 <ArrowUpRight className="size-3.5" />
              </Button>
            </Link>
          </div>
        </section>
      </main>

      {showAuthModal && (
        <AuthModal
          isOpen={showAuthModal}
          onClose={() => setShowAuthModal(false)}
          onSuccess={async () => {
            setShowAuthModal(false);
            await Promise.all([loadProfile(), loadWallet(), loadDailyStatus()]);
          }}
        />
      )}
    </div>
  );
}
