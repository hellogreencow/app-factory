
import React, { useState } from 'react';
import { View, Text, TextInput, StyleSheet, TouchableOpacity, Platform, KeyboardAvoidingView } from 'react-native';
import { useTimerContext } from '../context/AppContext';
import { AntDesign } from '@expo/vector-icons';

const CreateTimerScreen = ({ navigation }) => {
  const { addTimer, theme } = useTimerContext();
  const [name, setName] = useState('');
  const [endDate, setEndDate] = useState(new Date());
  const [description, setDescription] = useState('');

  const handleCreateTimer = () => {
    if (name && endDate) {
      addTimer({ name, endDate: endDate.getTime(), description, repeat: false });
      navigation.goBack();
    } else {
      alert('Name and End Date are required.');
    }
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === "ios" ? "padding" : "height"}
    >
      <View style={styles.inputContainer}>
        <Text style={styles.label}>Timer Name</Text>
        <TextInput
          style={styles.input}
          onChangeText={setName}
          value={name}
          placeholder="What are we counting down to?"
          placeholderTextColor="#888"
          testID="timer-name-input"
          accessibilityLabel="Timer Name Input"
        />
      </View>

      <View style={styles.inputContainer}>
        <Text style={styles.label}>End Date</Text>
        <TextInput
          style={styles.input}
          value={endDate.toLocaleDateString()}
          placeholder="Enter end date"
          placeholderTextColor="#888"
          testID="timer-end-date-input"
          accessibilityLabel="Timer End Date Input"
        />
      </View>

      <View style={styles.inputContainer}>
        <Text style={styles.label}>Description</Text>
        <TextInput
          style={styles.input}
          onChangeText={setDescription}
          value={description}
          placeholder="Enter description"
          placeholderTextColor="#888"
          multiline
          testID="timer-description-input"
          accessibilityLabel="Timer Description Input"
        />
      </View>

      <TouchableOpacity style={[styles.button, { backgroundColor: theme.accentColor }]} onPress={handleCreateTimer} testID="create-timer-button" accessibilityLabel="Start the clock">
        <Text style={styles.buttonText}>Create Timer</Text>
      </TouchableOpacity>
    </KeyboardAvoidingView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#121212',
    padding: 20,
    justifyContent: 'flex-start',
  },
  inputContainer: {
    marginBottom: 20,
  },
  label: {
    color: '#FFFFFF',
    fontSize: 16,
    marginBottom: 5,
  },
  input: {
    backgroundColor: '#212121',
    color: '#FFFFFF',
    fontSize: 16,
    padding: 10,
    borderRadius: 8,
  },
  datePickerButton: {
    backgroundColor: '#212121',
    padding: 10,
    borderRadius: 8,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  dateText: {
    color: '#FFFFFF',
    fontSize: 16,
  },
  button: {
    backgroundColor: '#FF453A',
    padding: 15,
    borderRadius: 8,
    alignItems: 'center',
  },
  buttonText: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: 'bold',
  },
});

export default CreateTimerScreen;
