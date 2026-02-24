import React, { useState } from 'react';
import { View, Text, StyleSheet, TextInput, TouchableOpacity } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { useFeed } from '../context/FeedContext';

export default function ComposeScreen() {
  const [body, setBody] = useState('');
  const { addPost } = useFeed();
  const nav = useNavigation();

  const handlePost = () => {
    if (!body.trim()) return;
    addPost(body.trim());
    nav.goBack();
  };

  return (
    <View style={styles.container}>
      <Text style={styles.heading} accessibilityLabel="Compose">Compose</Text>
      <TextInput
        style={styles.input}
        placeholder="What's on your mind?"
        placeholderTextColor="#8b949e"
        value={body}
        onChangeText={setBody}
        multiline
        testID="input-body"
        accessibilityLabel="Post body"
      />
      <TouchableOpacity style={[styles.btn, !body.trim() && styles.btnDisabled]} onPress={handlePost} disabled={!body.trim()} testID="post-btn" accessibilityLabel="Post">
        <Text style={styles.btnText}>Post</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0d1117', padding: 16 },
  heading: { fontSize: 24, fontWeight: 'bold', color: '#fff', marginBottom: 16 },
  input: { backgroundColor: '#161b22', color: '#c9d1d9', borderRadius: 8, padding: 16, fontSize: 16, minHeight: 120, textAlignVertical: 'top', marginBottom: 16 },
  btn: { backgroundColor: '#1f6feb', padding: 16, borderRadius: 24, alignItems: 'center' },
  btnDisabled: { opacity: 0.4 },
  btnText: { color: '#fff', fontSize: 16, fontWeight: '600' },
});
