// SSOT: 설정 기본값, 상수, 색상 팔레트
'use strict';

window.DharmaBell = window.DharmaBell || {};

/** 내장 종소리 목록 */
const BUILT_IN_BELLS = [
  { id: 'singing-bowl', name: '싱잉볼', file: 'singing_bowl.mp3' },
  { id: 'temple-bell', name: '범종', file: 'temple_bell.mp3' },
  { id: 'moktak', name: '목탁', file: 'moktak.mp3' },
  { id: 'gyeongsoe', name: '경쇠', file: 'gyeongsoe.mp3' },
  { id: 'hand-bell', name: '요령', file: 'hand_bell.mp3' },
];

/** 기본 설정값 (BT/DND 제외) */
const DEFAULT_SETTINGS = {
  timeFormat: '12h',
  showDate: true,
  ttsSuffix: false,
  bellEnabled: true,
  bellId: 'singing-bowl',
  bellCustomUri: null,
  gapA: 2,
  mp3Enabled: true,
  gapB: 1,
  hourlyMp3: {},
  voiceEnhance: false,
  speakerVolume: 15,
  startHour: 0,
  endHour: 23,
};

/** 저장 키 */
const STORAGE_KEY = 'dharma-bell-settings';

/** IndexedDB 이름 */
const MP3_DB_NAME = 'dharma-bell-mp3';
const MP3_STORE_NAME = 'files';

/** 워치독 상수 */
const WATCHDOG = {
  INTERVAL: 30000,    // 30초
  TOLERANCE: 120000,  // 2분
};

/** 색상 팔레트 */
const COLOR = {
  BG: '#1a1a2e',
  CLOCK: '#33ff33',
  CLOCK_GLOW: 'rgba(51,255,51,0.4)',
  PERIOD: '#66ff66',
  DATE: '#55cc55',
  TEXT: '#f0f0f0',
  TEXT_SUB: '#d0d0e0',
  TEXT_HINT: '#808090',
  ACCENT: '#e0c080',
  DIVIDER: '#2a2a3e',
  CONTROL_BG: '#2a2a4e',
  ERROR: '#e08080',
  SUCCESS: '#80e090',
  MENU_TEXT: '#a0a0b0',
};

/** 메뉴 자동 숨김 시간 (ms) */
const MENU_HIDE_DELAY = 5000;

/** 에셋 경로 */
const SOUNDS_PATH = 'assets/sounds/';

// 네임스페이스에 등록
window.DharmaBell.config = {
  BUILT_IN_BELLS,
  DEFAULT_SETTINGS,
  STORAGE_KEY,
  MP3_DB_NAME,
  MP3_STORE_NAME,
  WATCHDOG,
  COLOR,
  MENU_HIDE_DELAY,
  SOUNDS_PATH,
};
