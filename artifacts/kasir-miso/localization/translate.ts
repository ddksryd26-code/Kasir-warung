import { englishMessages } from './messages';

export type LanguageCode = 'id' | 'en';
export type TranslationValues = Record<string, string | number>;

let activeLanguage: LanguageCode = 'id';

export function setActiveLanguage(language: LanguageCode) {
  activeLanguage = language;
}

export function getActiveLanguage() {
  return activeLanguage;
}

export function translateText(
  language: LanguageCode,
  source: string,
  values?: TranslationValues,
) {
  const leadingWhitespace = source.match(/^\s*/)?.[0] ?? '';
  const trailingWhitespace = source.match(/\s*$/)?.[0] ?? '';
  const sourceKey = source.trim().replace(/\s+/g, ' ');
  let translated = language === 'en' ? englishMessages[sourceKey] ?? sourceKey : sourceKey;
  if (values) {
    translated = translated.replace(/\{(\w+)\}/g, (placeholder, name: string) => (
      Object.prototype.hasOwnProperty.call(values, name)
        ? String(values[name])
        : placeholder
    ));
  }
  if (language === 'id' && !values) return source;
  return `${leadingWhitespace}${translated}${trailingWhitespace}`;
}