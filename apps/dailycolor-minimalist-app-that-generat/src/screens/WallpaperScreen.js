
import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, StatusBar } from 'react-native';
import { useColorContext } from '../context/AppContext';

export default function WallpaperScreen() {
  const { theme, todaysColor, generateColor } = useColorContext();
  const [showInfo, setShowInfo] = useState(false);
  const [color, setColor] = useState(todaysColor);

  useEffect(() => {
    if (!todaysColor) {
      setColor(generateColor());
    } else {
      setColor(todaysColor);
    }
  }, [todaysColor, generateColor]);

  const toggleInfo = useCallback(() => {
    setShowInfo(prev => !prev);
  }, []);

  return (
    <TouchableOpacity
      style={[styles.container, { backgroundColor: color?.hex || theme.backgroundColor }]}
      onPress={toggleInfo}
      activeOpacity={1}
      testID="wallpaper-container"
      accessibilityLabel="Toggle Color Info"
    >
      <StatusBar hidden={showInfo} />
      {showInfo && color ? (
        <View style={styles.infoOverlay}>
          <Text style={[styles.hexCode, { color: theme.textColor }]} testID="hex-code">
            {color.hex}
          </Text>
          <Text style={[styles.colorName, { color: theme.textColor }]} testID="color-name">
            {color.name}
          </Text>
        </View>
      ) : null}
      {!color && (
        <View style={styles.emptyContainer}>
          <Text style={[styles.emptyText, { color: theme.textColor }]}>No color available.</Text>
        </View>
      )}
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  infoOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.5)',
  },
  hexCode: {
    fontSize: 36,
    fontWeight: 'bold',
    marginBottom: 8,
  },
  colorName: {
    fontSize: 24,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  emptyText: {
    fontSize: 20,
  },
});
