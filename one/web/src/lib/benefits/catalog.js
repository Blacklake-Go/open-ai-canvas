/**
 * 硬币权益目录：兑换页展示与服务端核销共用同一份，价格与效果只在这里定义。
 * 头像框的 ringClasses 必须是 globals.css 已注册的语义 token，不允许裸色值。
 *
 * 硬币不参与算力的计价，也不与现金互通，所以这里只登记权益类消耗。
 * 枚数是按内部锚定（100 硬币 = 1 美元，1 枚 ≈ 每日登录一天的沉淀）人工定的定价，
 * 该锚定只用于定价与后台核算，任何用户可见文案都不得出现美元等值、汇率或购买力口径。
 *
 * status 只有 'open' 会被服务端放行；'soon' 是给顾客看的"准备中"预告，
 * 目录里先占位是为了让兑换库一次成形，也方便日后把它切成可兑换时只改一个字段。
 */

export const ELEMENTS = {
  fire: '火象',
  earth: '土象',
  air: '风象',
  water: '水象',
};

/** 十二星座描边：色值全部登记在 globals.css 的 --frame-zodiac-* 里。 */
const ZODIAC = [
  { key: 'aries', name: '白羊座', glyph: '♈', dates: '3.21 - 4.19', element: 'fire', line: '想到就出发的那股劲儿' },
  { key: 'taurus', name: '金牛座', glyph: '♉', dates: '4.20 - 5.20', element: 'earth', line: '慢慢来，反而走得远' },
  { key: 'gemini', name: '双子座', glyph: '♊', dates: '5.21 - 6.21', element: 'air', line: '一个脑袋，两种心情' },
  { key: 'cancer', name: '巨蟹座', glyph: '♋', dates: '6.22 - 7.22', element: 'water', line: '把柔软留给自家人' },
  { key: 'leo', name: '狮子座', glyph: '♌', dates: '7.23 - 8.22', element: 'fire', line: '天生就该被看见' },
  { key: 'virgo', name: '处女座', glyph: '♍', dates: '8.23 - 9.22', element: 'earth', line: '细节里都是在意' },
  { key: 'libra', name: '天秤座', glyph: '♎', dates: '9.23 - 10.23', element: 'air', line: '什么都要刚刚好' },
  { key: 'scorpio', name: '天蝎座', glyph: '♏', dates: '10.24 - 11.22', element: 'water', line: '喜欢就喜欢到底' },
  { key: 'sagittarius', name: '射手座', glyph: '♐', dates: '11.23 - 12.21', element: 'fire', line: '下一站总是更远的那站' },
  { key: 'capricorn', name: '摩羯座', glyph: '♑', dates: '12.22 - 1.19', element: 'earth', line: '不吭声，把事做成' },
  { key: 'aquarius', name: '水瓶座', glyph: '♒', dates: '1.20 - 2.18', element: 'air', line: '有点不一样，也不打算改' },
  { key: 'pisces', name: '双鱼座', glyph: '♓', dates: '2.19 - 3.20', element: 'water', line: '连做梦都很认真' },
];

export const AVATAR_FRAMES = {
  'coin-gold': { label: '鎏金头像框', short: '鎏金', ringClasses: 'avatar-frame avatar-frame--gold' },
  'coin-cyan': { label: '霓虹头像框', short: '霓虹', ringClasses: 'avatar-frame avatar-frame--cyan' },
  ...Object.fromEntries(
    ZODIAC.map((sign) => [
      `zodiac-${sign.key}`,
      {
        label: `${sign.name}头像框`,
        short: sign.name,
        glyph: sign.glyph,
        dates: sign.dates,
        element: sign.element,
        line: sign.line,
        ringClasses: `avatar-frame avatar-frame--zodiac-${sign.key}`,
      },
    ]),
  ),
};

export const BENEFIT_CATEGORIES = [
  { id: 'outfit', label: '头像装扮', blurb: '给头像换个心情，戴腻了随时换。', icon: 'badge' },
  { id: 'speed', label: '出图特权', blurb: '着急的时候，先轮到你。', icon: 'zap' },
  { id: 'honor', label: '社区荣誉', blurb: '让好作品在社区多待一会儿。', icon: 'heart' },
  { id: 'creator', label: '创作加成', blurb: '让灵感少卡一次壳。', icon: 'sparkles' },
  { id: 'collect', label: '限定收藏', blurb: '能拿在手里的 SupDance。', icon: 'gift' },
];

const zodiacBenefits = ZODIAC.map((sign) => ({
  id: `frame_zodiac_${sign.key}`,
  kind: 'avatar_frame',
  category: 'outfit',
  status: 'open',
  coins: 1,
  frame: `zodiac-${sign.key}`,
  title: `${sign.name} ${sign.glyph}`,
  summary: `${sign.dates} · ${sign.line}`,
}));

export const BENEFITS = [
  ...zodiacBenefits,
  {
    id: 'frame_coin_gold',
    kind: 'avatar_frame',
    category: 'outfit',
    status: 'open',
    coins: 30,
    frame: 'coin-gold',
    title: '鎏金头像框',
    summary: '一圈常驻的鎏金，认真创作的人值得被认出来。',
  },
  {
    id: 'frame_coin_cyan',
    kind: 'avatar_frame',
    category: 'outfit',
    status: 'open',
    coins: 60,
    frame: 'coin-cyan',
    title: '霓虹头像框',
    summary: '站内最亮的那圈霓虹，一次拥有，随时换戴。',
  },
  {
    id: 'boost_24h',
    kind: 'priority',
    category: 'speed',
    status: 'open',
    coins: 3,
    hours: 24,
    title: '一天优先卡',
    summary: '这段时间里交的任务先出图，不用跟着大队排队。',
  },
  {
    id: 'boost_72h',
    kind: 'priority',
    category: 'speed',
    status: 'open',
    coins: 8,
    hours: 72,
    title: '三天优先卡',
    summary: '连着三天都先轮到你，再兑换就在剩下的时长上往后加。',
  },
  {
    id: 'honor_pinned_24h',
    kind: 'community',
    category: 'honor',
    status: 'soon',
    coins: 5,
    title: '作品置顶卡 · 一天',
    summary: '让你的一条作品在社区多停留一天，被更多人翻到。',
    note: '置顶位置正在和社区团队一起定规则，先不卖。',
  },
  {
    id: 'honor_creator_badge',
    kind: 'community',
    category: 'honor',
    status: 'soon',
    coins: 120,
    title: '年度创作者徽章',
    summary: '挂在名字旁边的年度纪念章，只发给这一年在社区留下作品的人。',
    note: '徽章样式在做第三版，等定稿。',
  },
  {
    id: 'creator_style_pack',
    kind: 'creator',
    category: 'creator',
    status: 'soon',
    coins: 15,
    title: '风格模板包 · 3 张',
    summary: '三套社区里最受欢迎的出图风格，点开就能套用。',
    note: '模板授权与上架清单还在整理。',
  },
  {
    id: 'creator_draft_keep',
    kind: 'creator',
    category: 'creator',
    status: 'soon',
    coins: 6,
    title: '草稿多留 30 天',
    summary: '没发布的手上活儿再多留一个月，不用担心回头找不到。',
    note: '存储成本还在核算，价格可能调整。',
  },
  {
    id: 'collect_sticker',
    kind: 'merch',
    category: 'collect',
    status: 'soon',
    coins: 80,
    title: 'SupDance 实体贴纸',
    summary: '一叠印着站内梗的贴纸，贴在笔记本和工位上。',
    note: '打样中，物流方案确定后开放兑换。',
  },
  {
    id: 'collect_birthday_card',
    kind: 'merch',
    category: 'collect',
    status: 'soon',
    coins: 200,
    title: '生日手写明信片',
    summary: '你生日那个月，寄一张有人手写祝福的明信片给你。',
    note: '需要先确认收货地址的存储方式，正在走合规。',
  },
];

/** 兑换菜单的分类顺序 + "全部"；前端直接 map 成可切换的标签。 */
export const CATEGORY_TABS = [
  { id: 'all', label: '全部', icon: 'coins' },
  ...BENEFIT_CATEGORIES.map((c) => ({ id: c.id, label: c.label, blurb: c.blurb, icon: c.icon })),
];

export const CATEGORY_BY_ID = Object.fromEntries(BENEFIT_CATEGORIES.map((c) => [c.id, c]));

export function findBenefit(id) {
  return BENEFITS.find((benefit) => benefit.id === id) || null;
}

/** 服务端唯一的放行判断：没登记 status 的历史项按可兑换处理。 */
export function isRedeemable(benefit) {
  return Boolean(benefit) && (benefit.status === undefined || benefit.status === 'open');
}

/** 头像框描边：佩戴者拿到 ringClasses，未佩戴/未知值回落到调用方自带的 border-line。 */
export function avatarFrameClasses(frame) {
  return AVATAR_FRAMES[frame]?.ringClasses || '';
}
