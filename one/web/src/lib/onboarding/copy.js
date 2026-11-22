/**
 * 引导页选项文案的唯一读取口。
 *
 * 组件里不许再写 `locale.startsWith('zh') ? label : labelEn`：那等于只承认两档语言，
 * 繁体因此拿到简体、日韩西因此拿到英文，也违反 lib/locales.js 的「共享组件不做 locale 分支」约定。
 * 调用方一律传注册表规范码，由这张字段表决定读哪一档。
 *
 * 兜底方向是单向的：非 zh-CN 的码最多回落到英文，绝不回落到简体 —— 简体是唯一入库值
 * （occupation_label），不是一种「默认显示语言」。
 *
 * 零依赖是硬要求：这个文件同时被客户端组件和 node --test 加载，而 lib/locales.js 直链
 * JSON 消息包，纯 node 下 import 它会直接崩。所以 NAME_BANKS 按码自带分隔符，
 * 不回头读注册表的排版标记。
 */

// 导出是给 P0 闸门核对覆盖用的（每种注册表语言都得在这儿有一档），组件仍然只走下面两个函数。
export const LABEL_FIELDS = {
  en: 'labelEn',
  'zh-CN': 'label',
  'zh-TW': 'labelTw',
  'ja-JP': 'labelJa',
  'ko-KR': 'labelKo',
  es: 'labelEs',
};

export const DESC_FIELDS = {
  en: 'descEn',
  'zh-CN': 'desc',
  'zh-TW': 'descTw',
  'ja-JP': 'descJa',
  'ko-KR': 'descKo',
  es: 'descEs',
};

export function optionLabel(item, localeCode) {
  return localeCode === 'zh-CN' ? item.label : (item[LABEL_FIELDS[localeCode]] ?? item.labelEn);
}

export function optionDesc(item, localeCode) {
  const text = localeCode === 'zh-CN' ? item.desc : (item[DESC_FIELDS[localeCode]] ?? item.descEn);
  return text ?? '';
}

/** `sep` 是排版事实：CJK 与谚文连写读起来才对，拉丁语系要留空格 */
const NAME_BANKS = {
  en: {
    sep: ' ',
    a: ['Midnight', 'Pixel', 'Drifting', 'Amber', 'Quiet', 'Neon', 'Paper', 'Solar'],
    b: ['Studio', 'Frames', 'Lab', 'Foundry', 'Canvas', 'Works', 'Atelier'],
  },
  'zh-CN': {
    sep: '',
    a: ['夜色', '青柠', '像素', '浮光', '远山', '半糖', '潮汐', '银灰', '野鹿', '拾光'],
    b: ['绘者', '放映员', '造物', '实验室', '旅人', '制片厂', '工坊', '观测站'],
  },
  'zh-TW': {
    sep: '',
    a: ['夜色', '青檸', '像素', '浮光', '遠山', '半糖', '潮汐', '銀灰', '野鹿', '拾光'],
    b: ['繪者', '放映員', '造物', '實驗室', '旅人', '製片廠', '工坊', '觀測站'],
  },
  'ja-JP': {
    sep: '',
    a: ['残光', '漆黒', '薄明', '遠山', '静寂', 'ネオン', '紙飛行', '太陽'],
    b: ['工房', '研究所', '映写室', '制作所', '観測所', '設計室', 'アトリエ'],
  },
  'ko-KR': {
    sep: ' ',
    a: ['심연', '별빛', '소용돌이', '은하', '고요', '네온', '종이', '태양'],
    b: ['스튜디오', '프레임', '연구소', '공방', '캔버스', '제작소', '아틀리에'],
  },
  es: {
    sep: ' ',
    a: ['Medianoche', 'Pixel', 'Errante', 'Ámbar', 'Silente', 'Neón', 'Papel', 'Solar'],
    b: ['Estudio', 'Cuadros', 'Taller', 'Fundición', 'Lienzo', 'Obras', 'Atelier'],
  },
};

const pickFrom = (list) => list[Math.floor(Math.random() * list.length)];

export function randomNickname(localeCode) {
  const bank = NAME_BANKS[localeCode];
  return `${pickFrom(bank.a)}${bank.sep}${pickFrom(bank.b)}${100 + Math.floor(Math.random() * 900)}`;
}
