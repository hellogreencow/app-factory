
import React, { useEffect, useState, useCallback } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Clipboard, Alert } from 'react-native';
import { useColorContext } from '../context/AppContext';
import { format } from 'date-fns';

export default function DailyScreen() {
  const { theme, todaysColor, generateColor, addToHistory } = useColorContext();
  const [generatedColor, setGeneratedColor] = useState(todaysColor);

  useEffect(() => {
    if (!todaysColor) {
      const newColor = generateColor();
      setGeneratedColor(newColor);
    } else {
      setGeneratedColor(todaysColor);
    }
  }, [todaysColor, generateColor]);

  const handleGenerateColor = useCallback(() => {
    const newColor = generateColor();
    setGeneratedColor(newColor);
  }, [generateColor]);

  const handleCopyToClipboard = useCallback(async () => {
    if (generatedColor?.hex) {
      Clipboard.setString(generatedColor.hex);
      Alert.alert('Copied!', 'Hex code copied to clipboard.');
    }
  }, [generatedColor?.hex]);

  const handleSaveToHistory = useCallback(async () => {
    if (generatedColor) {
      await addToHistory(generatedColor);
      Alert.alert('Saved!', 'Color saved to history.');
    }
  }, [generatedColor, addToHistory]);

  const rgb = generatedColor?.hex
    ? {
      r: parseInt(generatedColor.hex.slice(1, 3), 16),
      g: parseInt(generatedColor.hex.slice(3, 5), 16),
      b: parseInt(generatedColor.hex.slice(5, 7), 16),
    }
    : null;

  return (
    <View style={[styles.container, { backgroundColor: theme.backgroundColor }]}>
      {generatedColor ? (
        <>
          <View style={[styles.colorDisplay, { backgroundColor: generatedColor.hex }]} testID="color-display" />
          <View style={styles.detailsContainer}>
            <Text style={[styles.hexCode, { color: theme.textColor }]} testID="hex-code">
              {generatedColor.hex}
            </Text>
            <Text style={[styles.rgb, { color: theme.textColor }]} testID="rgb-value">
              {rgb ? `RGB: ${rgb.r}, ${rgb.g}, ${rgb.b}` : 'RGB: N/A'}
            </Text>
            <Text style={[styles.colorName, { color: theme.textColor }]} testID="color-name">
              {generatedColor.name}
            </Text>

            <TouchableOpacity
              style={[styles.button, { backgroundColor: theme.accentColor }]}
              onPress={handleCopyToClipboard}
              testID="copy-button"
              accessibilityLabel="Copy to clipboard"
            >
              <Text style={styles.buttonText}>Copy Hex Code</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.button, { backgroundColor: theme.accentColor }]}
              onPress={handleSaveToHistory}
              testID="save-button"
              accessibilityLabel="Save Color"
            >
              <Text style={styles.buttonText}>Save to History</Text>
            </TouchableOpacity>
          </View>
        </>
      ) : (
        <View style={styles.emptyContainer}>
          <Text style={[styles.emptyText, { color: theme.textColor }]}>No color generated for today.</Text>
          <TouchableOpacity
            style={[styles.button, { backgroundColor: theme.accentColor }]}
            onPress={handleGenerateColor}
            testID="generate-button"
            accessibilityLabel="Reveal today's hue"
          >
            <Text style={styles.buttonText}>Generate Color</Text>
          </TouchableOpacity>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'flex-start',
    padding: 20,
  },
  colorDisplay: {
    width: '100%',
    height: 200,
    borderRadius: 8,
    marginBottom: 20,
  },
  detailsContainer: {
    width: '100%',
    alignItems: 'center',
  },
  hexCode: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 8,
  },
  rgb: {
    fontSize: 16,
    marginBottom: 4,
  },
  colorName: {
    fontSize: 18,
    marginBottom: 16,
  },
  button: {
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 8,
    marginBottom: 10,
  },
  buttonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: 'bold',
    textAlign: 'center',
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  emptyText: {
    fontSize: 18,
    marginBottom: 20,
  },
});
