import { deleteSection, getSection, setSection } from '../storage.js';
import { removeGuildImages } from './images.js';

// Ready-made welcome texts, picked from the panel's Language button.
export const LANGUAGES = {
  so: {
    label: 'Soomaali',
    emoji: '🇸🇴',
    message:
      'Ku soo dhawoow server-ka!\n\n' +
      'Fadlan akhri xeerarka ka hor intaadan bilaabin wada sheekaysiga.\n\n' +
      'Ixtiraam qof walba, kuna raaxayso joogitaankaaga server-ka.',
  },
  en: {
    label: 'English',
    emoji: '🇬🇧',
    message:
      'Welcome to the server!\n\n' +
      'Please read the rules before you start chatting.\n\n' +
      'Respect everyone and enjoy your time in the server.',
  },
  ar: {
    label: 'العربية',
    emoji: '🇸🇦',
    message:
      'مرحباً بك في السيرفر!\n\n' +
      'يرجى قراءة القوانين قبل البدء في المحادثة.\n\n' +
      'احترم الجميع واستمتع بوقتك في السيرفر.',
  },
};

export const MAX_BUTTONS = 5;

export const DEFAULT_WELCOME = {
  enabled: false,
  channelId: null,
  autoRoleId: null,
  language: 'so',
  title: '{server}',
  message: LANGUAGES.so.message,
  footer: 'Enjoy your stay!',
  color: '#5865F2',
  // Image values: 'avatar' | 'server' | an http(s) URL | 'file:<name>' (uploaded) | null
  thumbnail: 'avatar',
  image: null,
  timestamp: true,
  pingUser: true,
  buttons: [], // [{ label, url, emoji }]
  dm: false,
  deleteAfter: 0, // seconds, 0 = never
};

export function getWelcome(guildId) {
  return getSection(guildId, 'welcome', DEFAULT_WELCOME);
}

export function updateWelcome(guildId, patch) {
  const settings = { ...getWelcome(guildId), ...patch };
  setSection(guildId, 'welcome', settings);
  return settings;
}

export function resetWelcome(guildId) {
  deleteSection(guildId, 'welcome');
  removeGuildImages(guildId);
  return getWelcome(guildId);
}
