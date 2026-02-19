import {
  createContext,
  useContext,
  useEffect,
  useState,
  useCallback,
  type ReactNode,
} from 'react';

import arMessages from '../locales/ar/ui.json';
import itMessages from '../locales/it/ui.json';

export type UILanguage = 'ar' | 'it';
export type ContentMode = 'ar' | 'it' | 'both';

export interface ContentBlock {
  text: string;
  lang: UILanguage;
  secondary: boolean;
}

export interface LanguageContextValue {
  uiLang: UILanguage;
  contentMode: ContentMode;
  smartLearning: boolean;
  isRTL: boolean;
  setUILanguage: (lang: UILanguage) => void;
  setContentMode: (mode: ContentMode) => void;
  setSmartLearning: (enabled: boolean) => void;
  resolveContent: (ar: string, it: string) => ContentBlock[];
  t: (key: string, vars?: Record<string, string | number>) => string;
}

const LOCALES: Record<UILanguage, Record<string, unknown>> = {
  ar: arMessages as Record<string, unknown>,
  it: itMessages as Record<string, unknown>,
};

const STORAGE_KEY_UI = 'ph_ui_lang';
const STORAGE_KEY_CONTENT = 'ph_content_mode';
const STORAGE_KEY_SMART = 'ph_smart_learning';

function detectBrowserLanguage(): UILanguage {
  const lang = navigator.language?.split('-')[0]?.toLowerCase();
  if (lang === 'ar') return 'ar';
  return 'it';
}

function deepGet(obj: Record<string, unknown>, key: string): string {
  const parts = key.split('.');
  let cur: unknown = obj;
  for (const part of parts) {
    if (cur == null || typeof cur !== 'object') return key;
    cur = (cur as Record<string, unknown>)[part];
  }
  return typeof cur === 'string' ? cur : key;
}

function interpolate(str: string, vars?: Record<string, string | number>): string {
  if (!vars) return str;
  return str.replace(/\{\{(\w+)\}\}/g, (_, k) =>
    vars[k] !== undefined ? String(vars[k]) : `{{${k}}}`
  );
}

const LanguageContext = createContext<LanguageContextValue | null>(null);

interface LanguageProviderProps {
  children: ReactNode;
  userSettings?: {
    uiLanguage?: UILanguage | null;
    contentMode?: ContentMode | null;
    smartLearning?: boolean | null;
  } | null;
  onSettingsChange?: (settings: {
    uiLanguage: UILanguage;
    contentMode: ContentMode;
    smartLearning: boolean;
  }) => void;
}

export function LanguageProvider({
  children,
  userSettings,
  onSettingsChange,
}: LanguageProviderProps) {
  const [uiLang, setUILangState] = useState<UILanguage>(() => {
    if (userSettings?.uiLanguage) return userSettings.uiLanguage;
    const stored = localStorage.getItem(STORAGE_KEY_UI) as UILanguage | null;
    if (stored === 'ar' || stored === 'it') return stored;
    return detectBrowserLanguage();
  });

  const [contentMode, setContentModeState] = useState<ContentMode>(() => {
    if (userSettings?.contentMode) return userSettings.contentMode;
    const stored = localStorage.getItem(STORAGE_KEY_CONTENT) as ContentMode | null;
    if (stored === 'ar' || stored === 'it' || stored === 'both') return stored;
    return 'both';
  });

  const [smartLearning, setSmartLearningState] = useState<boolean>(() => {
    if (userSettings?.smartLearning != null) return userSettings.smartLearning;
    return localStorage.getItem(STORAGE_KEY_SMART) === 'true';
  });

  // Sync when user logs in
  useEffect(() => {
    if (!userSettings) return;
    if (userSettings.uiLanguage) setUILangState(userSettings.uiLanguage);
    if (userSettings.contentMode) setContentModeState(userSettings.contentMode);
    if (userSettings.smartLearning != null) setSmartLearningState(userSettings.smartLearning);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userSettings?.uiLanguage, userSettings?.contentMode, userSettings?.smartLearning]);

  // Apply dir + lang to <html>
  useEffect(() => {
    const html = document.documentElement;
    html.setAttribute('lang', uiLang);
    html.setAttribute('dir', uiLang === 'ar' ? 'rtl' : 'ltr');
    html.classList.toggle('font-arabic', uiLang === 'ar');
  }, [uiLang]);

  const setUILanguage = useCallback((lang: UILanguage) => {
    setUILangState(lang);
    localStorage.setItem(STORAGE_KEY_UI, lang);
    onSettingsChange?.({ uiLanguage: lang, contentMode, smartLearning });
  }, [contentMode, smartLearning, onSettingsChange]);

  const setContentMode = useCallback((mode: ContentMode) => {
    setContentModeState(mode);
    localStorage.setItem(STORAGE_KEY_CONTENT, mode);
    onSettingsChange?.({ uiLanguage: uiLang, contentMode: mode, smartLearning });
  }, [uiLang, smartLearning, onSettingsChange]);

  const setSmartLearning = useCallback((enabled: boolean) => {
    setSmartLearningState(enabled);
    localStorage.setItem(STORAGE_KEY_SMART, String(enabled));
    onSettingsChange?.({ uiLanguage: uiLang, contentMode, smartLearning: enabled });
  }, [uiLang, contentMode, onSettingsChange]);

  /**
   * Logic Matrix:
   * UI=it, both → [it(primary), ar(secondary)]
   * UI=it, it   → [it(primary)]
   * UI=it, ar   → [ar(primary)]
   * UI=ar, both → [ar(primary), it(secondary)]
   * UI=ar, ar   → [ar(primary)]
   * UI=ar, it   → [it(primary)]
   */
  const resolveContent = useCallback(
    (ar: string, it: string): ContentBlock[] => {
      if (contentMode === 'ar') return [{ text: ar, lang: 'ar', secondary: false }];
      if (contentMode === 'it') return [{ text: it, lang: 'it', secondary: false }];
      if (uiLang === 'it') {
        return [
          { text: it, lang: 'it', secondary: false },
          { text: ar, lang: 'ar', secondary: true },
        ];
      }
      return [
        { text: ar, lang: 'ar', secondary: false },
        { text: it, lang: 'it', secondary: true },
      ];
    },
    [uiLang, contentMode]
  );

  const t = useCallback(
    (key: string, vars?: Record<string, string | number>): string => {
      const messages = LOCALES[uiLang];
      const raw = deepGet(messages, key);
      return interpolate(raw, vars);
    },
    [uiLang]
  );

  return (
    <LanguageContext.Provider
      value={{
        uiLang,
        contentMode,
        smartLearning,
        isRTL: uiLang === 'ar',
        setUILanguage,
        setContentMode,
        setSmartLearning,
        resolveContent,
        t,
      }}
    >
      {children}
    </LanguageContext.Provider>
  );
}

export function useLanguage(): LanguageContextValue {
  const ctx = useContext(LanguageContext);
  if (!ctx) throw new Error('useLanguage must be inside <LanguageProvider>');
  return ctx;
}
