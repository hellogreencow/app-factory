import React, { useContext, useEffect, useState, useRef } from 'react';
import { View, Text, Pressable, StyleSheet, Animated } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import * as Haptics from 'expo-haptics';
import { AppContext } from '../context/AppContext';

export default function Home() {
  const { selectedTheme, addPress, preferences, theme } = useContext(AppContext);
  const [msgIndex, setMsgIndex] = useState(0);
  const fade = useRef(new Animated.Value(1)).current;

  const messages = (selectedTheme && Array.isArray(selectedTheme.messages) && selectedTheme.messages.length > 0)
    ? selectedTheme.messages
    : ['Hello World!'];
  const gradient = (selectedTheme && Array.isArray(selectedTheme.gradient) && selectedTheme.gradient.length >= 2)
    ? selectedTheme.gradient
    : ['#00d4ff', '#0099cc'];

  useEffect(() => {
    if (msgIndex >= messages.length) setMsgIndex(0);
  }, [messages, msgIndex]);

  const cycle = () => {
    if (preferences?.hapticsEnabled !== false) {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    }
    Animated.sequence([
      Animated.timing(fade, { toValue: 0, duration: 120, useNativeDriver: true }),
      Animated.timing(fade, { toValue: 1, duration: 200, useNativeDriver: true }),
    ]).start();
    const next = (msgIndex + 1) % messages.length;
    setMsgIndex(next);
    addPress(messages[next], selectedTheme?.id);
  };

  return (
    <LinearGradient colors={gradient} style={styles.container}>
      <View style={styles.inner}>
        <Animated.Text
          accessibilityLabel="hello-message"
          testID="hello-message"
          style={[styles.message, { opacity: fade }]}
        >
          {messages[msgIndex]}
        </Animated.Text>
        <Pressable
          accessibilityLabel="cycle-button"
          testID="cycle-button"
          onPress={cycle}
          style={({ pressed }) => [styles.button, { opacity: pressed ? 0.7 : 1 }]}
        >
          <Text style={styles.buttonText}>Tap Me</Text>
        </Pressable>
        <Text style={styles.hint}>Theme: {selectedTheme?.name || 'Classic'}</Text>
      </View>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  inner: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24 },
  message: { fontSize: 42, fontWeight: '800', color: '#ffffff', textAlign: 'center', marginBottom: 48, textShadowColor: 'rgba(0,0,0,0.3)', textShadowOffset: { width: 0, height: 2 }, textShadowRadius: 4 },
  button: { backgroundColor: 'rgba(255,255,255,0.25)', paddingHorizontal: 36, paddingVertical: 16, borderRadius: 28, borderWidth: 1, borderColor: 'rgba(255,255,255,0.4)' },
  buttonText: { color: '#ffffff', fontSize: 18, fontWeight: '700', letterSpacing: 1 },
  hint: { color: 'rgba(255,255,255,0.85)', marginTop: 32, fontSize: 14 },
});
