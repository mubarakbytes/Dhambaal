import React, { useState, useRef, useEffect } from 'react';
import { View, TextInput, StyleSheet, ViewStyle, Platform, TouchableOpacity, TouchableWithoutFeedback } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors, subscribeTheme } from '../theme/colors';
import { Typography } from '../theme/typography';
import { Spacing } from '../theme/spacing';

interface SearchBarProps {
  placeholder?: string;
  value?: string;
  onChangeText?: (text: string) => void;
  style?: ViewStyle;
  autoFocus?: boolean;
}

/**
 * High-fidelity soft-rounded glassmorphism SearchBar designed for infinite spatial comfort.
 * Supports autoFocus, quick-clearing, and dynamic header blending.
 */
export function SearchBar({
  placeholder = 'Raadi...',
  value = '',
  onChangeText,
  style,
  autoFocus = false,
}: SearchBarProps) {
  const [focused, setFocused] = useState(false);
  const [themeTick, setThemeTick] = useState(0);
  const inputRef = useRef<TextInput>(null);

  useEffect(() => {
    const unsubscribe = subscribeTheme(() => {
      setThemeTick((tick) => tick + 1);
    });
    return unsubscribe;
  }, []);

  useEffect(() => {
    if (autoFocus) {
      // Small timeout to ensure the component is fully mounted in layout before focusing
      const timer = setTimeout(() => {
        inputRef.current?.focus();
      }, 150);
      return () => clearTimeout(timer);
    }
  }, [autoFocus]);

  const styles = StyleSheet.create({
    container: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: Colors.glassPanelBg,
      borderWidth: 1,
      borderColor: Colors.glassPanelBorder,
      borderRadius: 12,
      paddingHorizontal: Spacing.md,
      paddingVertical: Platform.OS === 'ios' ? 14 : 11,
      gap: Spacing.sm,
    },
    focused: {
      borderColor: Colors.primary,
      backgroundColor: Colors.glassInteractiveBg,
    },
    active: {
      backgroundColor: Colors.glassInteractiveBg,
    },
    searchIcon: {
      opacity: 0.75,
    },
    input: {
      flex: 1,
      ...Typography.bodySm,
      color: Colors.onSurface,
      padding: 0,
      margin: 0,
      fontSize: 16,
      letterSpacing: 0.2,
    },
    clearBtn: {
      padding: 2,
      alignItems: 'center',
      justifyContent: 'center',
    },
  });

  return (
    <TouchableWithoutFeedback onPress={() => inputRef.current?.focus()}>
      <View style={[
        styles.container, 
        focused && styles.focused, 
        value.length > 0 && styles.active,
        style
      ]}>
        <Ionicons 
          name="search-outline" 
          size={18} 
          color={focused || value.length > 0 ? Colors.primary : Colors.onSurfaceVariant} 
          style={styles.searchIcon} 
        />
        <TextInput
          ref={inputRef}
          placeholder={placeholder}
          placeholderTextColor={Colors.outline}
          value={value}
          onChangeText={onChangeText}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          style={styles.input}
          cursorColor={Colors.primary}
          autoCapitalize="none"
        />
        {value.length > 0 && (
          <TouchableOpacity 
            onPress={() => {
              onChangeText?.('');
              inputRef.current?.focus();
            }} 
            activeOpacity={0.7}
            style={styles.clearBtn}
          >
            <Ionicons name="close-circle" size={18} color={Colors.outline} />
          </TouchableOpacity>
        )}
      </View>
    </TouchableWithoutFeedback>
  );
}
