import React, { useState, useContext, useEffect } from 'react';
import { View, Text, StyleSheet, TextInput, TouchableOpacity, ScrollView, Alert } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { format } from 'date-fns';
import { useTimerContext } from '../context/AppContext';
import DateTimePicker from '@react-native-community/datetimepicker';
import { useRoute, useNavigation } from '@react-navigation/native';

const EditTimerScreen = () => {
  const { theme, updateTimer } = useContext(useTimerContext);
  const route = useRoute();
  const navigation = useNavigation();
  const { id } = route?.params ?? {};

  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [endDate, setEndDate] = useState(new Date());
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [validationError, setValidationError] = useState('');

  useEffect(() => {
    if (!id) {
      Alert.alert("Error", "Timer ID is missing.");
      navigation.goBack();
      return;
    }

    const loadTimer = async () => {
      const storedTimers = await AsyncStorage.getItem('@ticktock_timers');
      if (!storedTimers) {
        Alert.alert("Error", "No timers found.");
        navigation.goBack();
        return;
      }

      try {
        const timers = JSON.parse(storedTimers);
        const timer = (timers || []).find(t => t?.id === id);

        if (!timer) {
          Alert.alert("Error", "Timer not found.");
          navigation.goBack();
          return;
        }

        setName(timer?.name ?? '');
        setDescription(timer?.description ?? '');
        setEndDate(new Date(timer?.endDate));
      } catch (err) {
        console.error(err);
        Alert.alert("Error", "Failed to load timer data.");
        navigation.goBack();
      }
    };

    const AsyncStorage = require('@react-native-async-storage/async-storage').default;
    loadTimer();

  }, [id, navigation]);

  const handleSave = async () => {
    if (!name.trim()) {
      setValidationError("Timer name is required.");
      return;
    }

    setValidationError('');

    try {
      const updatedTimer = {
        id: id,
        name: name,
        endDate: endDate.getTime(),
        description: description,
        repeat: false,
      };

      await updateTimer(updatedTimer);
      Alert.alert("Locked in", "Timer updated successfully!");
      navigation.goBack();
    } catch (err) {
      console.error(err);
      Alert.alert("Error", "Failed to update timer.");
    }
  };

  const showDatepicker = () => {
    setShowDatePicker(true);
  };

  const onDateChange = (event, selectedDate) => {
    setShowDatePicker(false);
    if (selectedDate) {
      setEndDate(selectedDate);
    }
  };

  return (
    <ScrollView style={[styles.container, { backgroundColor: theme.backgroundColor }]}>
      <LinearGradient
        colors={[theme.accentColor, theme.secondaryAccent]}
        style={styles.headerGradient}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
      >
        <Text style={styles.headerText}>Edit Timer</Text>
      </LinearGradient>

      <View style={styles.formContainer}>
        {validationError ? <Text style={styles.errorText}>{validationError}</Text> : null}

        <View style={styles.inputGroup}>
          <Ionicons name="create-outline" size={24} color={theme.textColor} style={styles.inputIcon} />
          <TextInput
            testID="timer-name-input"
            accessibilityLabel="timer-name-input"
            style={[styles.input, { color: theme.textColor, backgroundColor: theme.cardColor, borderRadius: theme.borderRadius }]}
            placeholder="Define the moment"
            placeholderTextColor={theme.textColor}
            value={name}
            onChangeText={setName}
          />
        </View>

        <View style={styles.inputGroup}>
          <Ionicons name="calendar-outline" size={24} color={theme.textColor} style={styles.inputIcon} />
          <TouchableOpacity
            testID="date-picker-button"
            accessibilityLabel="date-picker-button"
            style={[styles.datePickerButton, { backgroundColor: theme.cardColor, borderRadius: theme.borderRadius }]}
            onPress={showDatepicker}
          >
            <Text style={[styles.dateText, { color: theme.textColor }]}>
              {format(endDate, 'MMM dd, yyyy hh:mm a')}
            </Text>
          </TouchableOpacity>
          {showDatePicker && (
            <DateTimePicker
              testID="date-picker"
              accessibilityLabel="date-picker"
              value={endDate}
              mode="datetime"
              display="default"
              onChange={onDateChange}
            />
          )}
        </View>

        <View style={styles.inputGroup}>
          <Ionicons name="document-text-outline" size={24} color={theme.textColor} style={styles.inputIcon} />
          <TextInput
            testID="timer-description-input"
            accessibilityLabel="timer-description-input"
            style={[styles.input, { color: theme.textColor, backgroundColor: theme.cardColor, borderRadius: theme.borderRadius }]}
            placeholder="Description"
            placeholderTextColor={theme.textColor}
            value={description}
            onChangeText={setDescription}
            multiline
            numberOfLines={3}
          />
        </View>

        <TouchableOpacity
          testID="save-timer-button"
          accessibilityLabel="save-timer-button"
          style={[styles.saveButton, { backgroundColor: theme.accentColor, borderRadius: theme.borderRadius }]}
          onPress={handleSave}
        >
          <Text style={styles.saveButtonText}>Save Timer</Text>
        </TouchableOpacity>
      </View>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  headerGradient: {
    padding: 20,
    borderBottomLeftRadius: 20,
    borderBottomRightRadius: 20,
  },
  headerText: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#FFFFFF',
    textAlign: 'center',
  },
  formContainer: {
    padding: 20,
  },
  inputGroup: {
    marginBottom: 20,
    flexDirection: 'row',
    alignItems: 'center',
  },
  inputIcon: {
    marginRight: 10,
  },
  input: {
    flex: 1,
    padding: 15,
    fontSize: 16,
  },
  datePickerButton: {
    flex: 1,
    padding: 15,
  },
  dateText: {
    fontSize: 16,
  },
  saveButton: {
    padding: 15,
    alignItems: 'center',
  },
  saveButtonText: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: 'bold',
  },
  errorText: {
    color: 'red',
    marginBottom: 10,
  },
});

export default EditTimerScreen;
