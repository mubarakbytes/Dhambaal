import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Platform, Image } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '../theme/colors';
import { Typography } from '../theme/typography';
import { Spacing } from '../theme/spacing';
import { SearchBar } from './SearchBar';

// Props-ka uu u baahan yahay MadaxaMobilka si uu ugu shaqeeyo si dynamic ah
interface MadaxaMobilkaProps {
  ciwaan: string;                       // Magaca shaashada (Tusaale: "Dhambaal", "Xiriirada", etc.)
  isSearching?: boolean;                // In la raadinayo iyo in kale (Search Mode active)
  setIsSearching?: (val: boolean) => void; // Shaqada lagu shido/damiyo search mode-ka
  searchText?: string;                  // Ereyga hadda lagu qorayo sanduuqa raadinta
  setSearchText?: (val: string) => void;   // Shaqada lagu keydiyo ereyga la raadinayo
  placeholder?: string;                 // Qoraalka ku dhex jira search box-ka (Placeholder)
  showSearchIcon?: boolean;             // In la muujiyo search button-ka iyo in kale
}

/**
 * MadaxaMobilka - Kani waa hal component oo universal ah oo lagu wada wadaagayo
 * saddexda bog ee (fariimaha.tsx, dadka.tsx, wicitaano.tsx) si loo baabi'iyo duplicate work-ga!
 */
export function MadaxaMobilka({
  ciwaan,
  isSearching = false,
  setIsSearching,
  searchText = '',
  setSearchText,
  placeholder = 'Raadi...',
  showSearchIcon = true,
}: MadaxaMobilkaProps) {

  // Haddii uu shidanyahay Search Mode-ka (isSearching === true)
  if (isSearching && setIsSearching && setSearchText) {
    return (
      <View style={[styles.mobileHeader, { paddingVertical: Platform.OS === 'ios' ? 4 : 2 }]}>
        <TouchableOpacity 
          onPress={() => {
            setIsSearching(false);
            setSearchText('');
          }} 
          style={styles.backButton}
        >
          <Ionicons name="arrow-back" size={24} color={Colors.onSurface} />
        </TouchableOpacity>
        
        <View style={styles.searchBarWrapper}>
          <SearchBar 
            placeholder={placeholder} 
            value={searchText} 
            onChangeText={setSearchText} 
            autoFocus={true}
            style={styles.inlineSearchBar}
          />
        </View>
      </View>
    );
  }

  // Qaabka caadiga ah ee Header-ka (Default layout: Title + Logo + Optional Search Icon)
  return (
    <View style={styles.mobileHeader}>
      <View style={styles.brandContainer}>
        {/* Astaanta Dhambaal Logo-deeda */}
        <View style={styles.logoBox}>
          <Image 
            source={require('../../assets/logo.png')} 
            style={styles.logoImage} 
            resizeMode="contain" 
          />
        </View>
        <Text style={styles.titleText}>{ciwaan}</Text>
      </View>

      {/* Haddii la rabo in la muujiyo muraayada baaritaanka (Search Icon) */}
      {showSearchIcon && setIsSearching && (
        <TouchableOpacity 
          onPress={() => setIsSearching(true)} 
          style={styles.searchButton}
        >
          <Ionicons name="search-outline" size={22} color={Colors.onSurface} />
        </TouchableOpacity>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  mobileHeader: {
    flexDirection: 'row', 
    alignItems: 'center', 
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.md, 
    paddingVertical: Spacing.sm,
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderBottomWidth: 1, 
    borderBottomColor: 'rgba(255,255,255,0.1)',
  },
  brandContainer: { 
    flexDirection: 'row', 
    alignItems: 'center', 
    gap: Spacing.sm 
  },
  logoBox: {
    width: 36, 
    height: 36,
    alignItems: 'center', 
    justifyContent: 'center',
  },
  logoImage: {
    width: 32,
    height: 32,
  },
  titleText: { 
    ...Typography.headlineLgMobile, 
    color: Colors.primary 
  },
  searchButton: { 
    padding: 8 
  },
  backButton: { 
    padding: 8, 
    marginRight: Spacing.xs 
  },
  searchBarWrapper: { 
    flex: 1 
  },
  inlineSearchBar: { 
    backgroundColor: 'transparent', 
    borderWidth: 0 
  }
});
