import React, { useState, useContext, useEffect } from 'react';
import { View, Text, StyleSheet, TextInput, TouchableOpacity, ScrollView, Alert } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { formatDistanceToNow, format } from 'date-fns';
import { useTimerContext } from '../context/AppContext';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useRoute, useNavigation } from '@react-navigation/native';

const TimerDetailScreen = () => {
  const { theme, updateTimer } = useContext(useTimerContext);
  const route = useRoute();
  const navigation = useNavigation();
  const { id } = route?.params ?? {};

  const [timer, setTimer] = useState(null);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [endDate, setEndDate] = useState(null);
  const [originalEndDate, setOriginalEndDate] = useState(null);

  useEffect(() => {
    const loadTimer = async () => {
      try {
        const storedTimers = await AsyncStorage.getItem('@ticktock_timers');
        if (storedTimers) {
          const timers = JSON.parse(storedTimers);
          const foundTimer = (timers || []).find(t => t?.id === id);

          if (foundTimer) {
            setTimer(foundTimer);
            setName(foundTimer?.name ?? '');
            setDescription(foundTimer?.description ?? '');
            setEndDate(foundTimer?.endDate ?? null);
            setOriginalEndDate(foundTimer?.endDate ?? null);
          } else {
            Alert.alert("Timer not found", "The requested timer could not be found.");
            navigation.goBack();
          }
        } else {
          Alert.alert("No timers found", "No timers are currently stored.");
          navigation.goBack();
        }
      } catch (error) {
        console.error("Error loading timers from AsyncStorage:", error);
        Alert.alert("Error", "Failed to load timer details.");
        navigation.goBack();
      }
    };

    if (id) {
      loadTimer();
    } else {
      Alert.alert("Invalid Timer ID", "No timer ID was provided.");
      navigation.goBack();
    }
  }, [id, navigation]);

  if (!timer) {
    return (
      <View style={[styles.container, { backgroundColor: theme.backgroundColor }]}>
        <Ionicons name="hourglass-outline" size={64} color={theme.textColor} />
        <Text style={[styles.emptyText, { color: theme.textColor }]}>Loading timer details...</Text>
      </View>
    );
  }

  const now = new Date();
  const endDateSafe = new Date(endDate);
  const timeLeftString = isNaN(endDateSafe.getTime()) ? 'Invalid date' : formatDistanceToNow(endDateSafe, { addSuffix: true });

  const handleSave = async () => {
    try {
      const updatedTimer = { ...timer, name, description, endDate };
      await updateTimer(updatedTimer);
      Alert.alert("Success", "Timer details updated successfully!");
      navigation.goBack();
    } catch (error) {
      console.error("Error updating timer:", error);
      Alert.alert("Error", "Failed to update timer details.");
    }
  };

  const handleReset = async () => {
    try {
      await updateTimer({ ...timer, endDate: originalEndDate });
      setEndDate(originalEndDate);
      Alert.alert("Success", "Timer reset to original end date!");
    } catch (error) {
      console.error("Error resetting timer:", error);
      Alert.alert("Error", "Failed to reset timer.");
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
        <Text style={styles.headerText}>Timer Details</Text>
      </LinearGradient>

      <View style={styles.detailContainer}>
        <View style={[styles.card, { backgroundColor: theme.cardColor, borderRadius: theme.borderRadius }]}>
          <View style={styles.cardContent}>
            <Ionicons name="create-outline" size={24} color={theme.textColor} style={styles.icon} />
            <Text style={[styles.label, { color: theme.textColor }]}>Name:</Text>
            <TextInput
              testID="timer-name-input"
              accessibilityLabel="timer-name-input"
              style={[styles.input, { color: theme.textColor, backgroundColor: theme.cardColor, borderColor: theme.accentColor }]}
              value={name}
              onChangeText={setName}
            />
          </View>
        </View>

        <View style={[styles.card, { backgroundColor: theme.cardColor, borderRadius: theme.borderRadius }]}>
          <View style={styles.cardContent}>
            <Ionicons name="document-text-outline" size={24} color={theme.textColor} style={styles.icon} />
            <Text style={[styles.label, { color: theme.textColor }]}>Description:</Text>
            <TextInput
              testID="timer-description-input"
              accessibilityLabel="timer-description-input"
              style={[styles.input, { color: theme.textColor, backgroundColor: theme.cardColor, borderColor: theme.accentColor }]}
              value={description}
              onChangeText={setDescription}
              multiline
            />
          </View>
        </View>

        <View style={[styles.card, { backgroundColor: theme.cardColor, borderRadius: theme.borderRadius }]}>
          <View style={styles.cardContent}>
            <Ionicons name="time-outline" size={24} color={theme.textColor} style={styles.icon} />
            <Text style={[styles.label, { color: theme.textColor }]}>Time Remaining:</Text>
            <Text testID="timer-time-remaining" accessibilityLabel="timer-time-remaining" style={[styles.timeRemaining, { color: theme.textColor }]}>
              {timeLeftString}
            </Text>
          </View>
        </View>

        <View style={styles.buttonContainer}>
          <TouchableOpacity
            testID="reset-timer-button"
            accessibilityLabel="reset-timer-button"
            style={[styles.button, { backgroundColor: theme.secondaryAccent }]}
            onPress={handleReset}
          >
            <Ionicons name="refresh-outline" size={24} color={theme.backgroundColor} style={styles.icon} />
            <Text style={[styles.buttonText, { color: theme.backgroundColor }]}>Reset Timer</Text>
          </TouchableOpacity>

          <TouchableOpacity
            testID="save-timer-button"
            accessibilityLabel="save-timer-button"
            style={[styles.button, { backgroundColor: theme.accentColor }]}
            onPress={handleSave}
          >
            <Ionicons name="save-outline" size={24} color={theme.backgroundColor} style={styles.icon} />
            <Text style={[styles.buttonText, { color: theme.backgroundColor }]}>Save Changes</Text>
          </TouchableOpacity>
        </View>
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
  detailContainer: {
    padding: 20,
  },
  card: {
    marginBottom: 15,
    padding: 15,
  },
  cardContent: {
    flexDirection: 'column',
  },
  label: {
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 5,
  },
  input: {
    borderWidth: 1,
    borderRadius: 5,
    padding: 10,
    fontSize: 16,
    marginBottom: 10,
  },
  timeRemaining: {
    fontSize: 18,
    marginTop: 5,
  },
  buttonContainer: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginTop: 20,
  },
  button: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderRadius: 8,
  },
  buttonText: {
    fontSize: 16,
    fontWeight: 'bold',
    marginLeft: 8,
  },
  icon: {
    marginRight: 8,
  },
    emptyText: {
    fontSize: 18,
    marginTop: 10,
    textAlign: 'center',
  },
});

export default TimerDetailScreen;
