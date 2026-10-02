import React, { forwardRef } from 'react';
import {
  Alert as NativeAlert,
  Pressable as NativePressable,
  Share as NativeShare,
  Text as NativeText,
  TextInput as NativeTextInput,
  type AlertButton,
  type AlertOptions,
  type PressableProps,
  type ShareContent,
  type ShareOptions,
  type TextInputProps,
  type TextProps,
} from 'react-native';
import { getActiveLanguage, translateText } from '@/localization/translate';
import { useLanguage } from '@/context/LanguageContext';

export const Text = forwardRef<React.ElementRef<typeof NativeText>, TextProps>(
  function LocalizedText({ children, ...props }, ref) {
    const { t } = useLanguage();
    const localizedChildren = React.Children.map(children, (child) => (
      typeof child === 'string' ? t(child) : child
    ));
    return <NativeText ref={ref} {...props}>{localizedChildren}</NativeText>;
  },
);

export const TextInput = forwardRef<React.ElementRef<typeof NativeTextInput>, TextInputProps>(
  function LocalizedTextInput({ placeholder, accessibilityLabel, accessibilityHint, ...props }, ref) {
    const { t } = useLanguage();
    return (
      <NativeTextInput
        ref={ref}
        {...props}
        placeholder={placeholder ? t(placeholder) : placeholder}
        accessibilityLabel={accessibilityLabel ? t(accessibilityLabel) : accessibilityLabel}
        accessibilityHint={accessibilityHint ? t(accessibilityHint) : accessibilityHint}
      />
    );
  },
);

export const Pressable = forwardRef<React.ElementRef<typeof NativePressable>, PressableProps>(
  function LocalizedPressable({ accessibilityLabel, accessibilityHint, ...props }, ref) {
    const { t } = useLanguage();
    return (
      <NativePressable
        ref={ref}
        {...props}
        accessibilityLabel={accessibilityLabel ? t(accessibilityLabel) : accessibilityLabel}
        accessibilityHint={accessibilityHint ? t(accessibilityHint) : accessibilityHint}
      />
    );
  },
);

export const Alert = {
  alert(title: string, message?: string, buttons?: AlertButton[], options?: AlertOptions) {
    return NativeAlert.alert(
      translateText(getActiveLanguage(), title),
      message ? translateText(getActiveLanguage(), message) : message,
      buttons?.map((button) => ({
        ...button,
        text: button.text ? translateText(getActiveLanguage(), button.text) : button.text,
      })),
      options,
    );
  },
};

export const Share = {
  share(content: ShareContent, options?: ShareOptions) {
    const language = getActiveLanguage();
    return NativeShare.share({
      ...content,
      title: content.title ? translateText(language, content.title) : content.title,
      message: content.message ? translateText(language, content.message) : content.message,
    }, options);
  },
};