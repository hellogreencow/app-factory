import React, { useContext, useState, useEffect } from 'react';
import {
  StyleSheet,
  Text,
  View,
  TouchableOpacity,
  ScrollView,
  Alert
} from 'react-native';
import { Ionicons, MaterialIcons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import * as Haptics from 'expo-haptics';
import { useFears } from '../context/AppContext';
import { formatDistanceToNow } from 'date-fns';
import { useRoute } from '@react-navigation/native';

const FearDetailScreen = () => {
  const { fears, updateFear, theme } = useFears();
  const route = useRoute();
  const { id } = route?.params ?? {};
  const [fear, setFear] = useState(null);

  useEffect(() => {
    if (id) {
      const foundFear = (fears || []).find((f) => f.id === id);
      setFear(foundFear);
    }
  }, [id, fears]);

  if (!id) {
    return (
      <View style={[styles.container, { backgroundColor: theme.backgroundColor }]}>
        <Text style={[styles.errorText, { color: theme.textColor }]}>
          Fear ID not provided.
        </Text>
      </View>
    );
  }

  if (!fear) {
    return (
      <View style={[styles.container, { backgroundColor: theme.backgroundColor }]}>
        <Text style={[styles.errorText, { color: theme.textColor }]}>
          Fear not found.
        </Text>
      </View>
    );
  }

  const createdAt = fear.id.substring(0, 13);
  let timeAgo = 'N/A';
  try {
    const d = new Date(parseInt(createdAt, 36));
    const safe = isNaN(d.getTime()) ? new Date() : d;
    timeAgo = formatDistanceToNow(safe, { addSuffix: true });
  } catch (e) {
    console.error('Error formatting date:', e);
  }

  const handleEditFear = () => {
    Alert.alert(
      'Edit Fear',
      'This feature is not yet implemented.',
      [
        {
          text: 'OK',
          style: 'cancel',
        },
      ],
      { cancelable: false }
    );
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
  };

  return (
    <LinearGradient
      colors={[theme.backgroundColor, theme.cardColor]}
      style={styles.container}
    >
      <ScrollView contentContainerStyle={styles.scrollContainer}>
        <View style={[styles.detailContainer, { backgroundColor: theme.cardColor }]}>
          <View style={styles.header}>
            <Text style={[styles.name, { color: theme.textColor }]} testID="fear-name">
              {fear?.name ?? 'Unknown'}
            </Text>
            <Text style={[styles.timeAgo, { color: theme.secondaryAccent }]}>
              {timeAgo}
            </Text>
          </View>

          <Text style={[styles.description, { color: theme.textColor }]} testID="fear-description">
            {fear?.description ?? 'A nameless unease.'}
          </Text>

          <View style={styles.section}>
            <Ionicons name="location-outline" size={24} color={theme.accentColor} testID="location-icon" accessibilityLabel="Location Icon" />
            <Text style={[styles.sectionTitle, { color: theme.textColor }]}>Location</Text>
            <Text style={[styles.sectionValue, { color: theme.textColor }]}>
              Latitude: {fear?.location?.latitude ?? 'N/A'}
            </Text>
            <Text style={[styles.sectionValue, { color: theme.textColor }]}>
              Longitude: {fear?.location?.longitude ?? 'N/A'}
            </Text>
          </View>

          <View style={styles.section}>
            <MaterialIcons name="sensors" size={24} color={theme.accentColor} testID="sensor-icon" accessibilityLabel="Sensor Icon" />
            <Text style={[styles.sectionTitle, { color: theme.textColor }]}>Sensor Data</Text>
            {Object.entries(fear?.sensorData || {}).map(([key, value]) => (
              <Text key={key} style={[styles.sectionValue, { color: theme.textColor }]}>
                {key}: {value}
              </Text>
            ))}
            {Object.keys(fear?.sensorData || {}).length === 0 && (
              <Text style={[styles.emptyText, { color: theme.textColor }]}>No sensor data available.</Text>
            )}
          </View>

          <View style={styles.section}>
            <Ionicons name="warning-outline" size={24} color={theme.accentColor} testID="severity-icon" accessibilityLabel="Visceral Intensity Icon" />
            <Text style={[styles.sectionTitle, { color: theme.textColor }]}>Severity</Text>
            <Text style={[styles.sectionValue, { color: theme.textColor }]}>
              {fear?.severity ?? 'N/A'}
            </Text>
          </View>

          <TouchableOpacity
            style={[styles.editButton, { backgroundColor: theme.accentColor }]}
            onPress={handleEditFear}
            testID="edit-fear-button"
            accessibilityLabel="Edit Fear"
          >
            <Text style={styles.editButtonText}>Edit Fear</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </LinearGradient>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 10,
  },
  scrollContainer: {
    paddingBottom: 20,
  },
  detailContainer: {
    borderRadius: 8,
    padding: 16,
    marginBottom: 16,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  name: {
    fontSize: 24,
    fontWeight: 'bold',
  },
  timeAgo: {
    fontSize: 14,
    fontStyle: 'italic',
  },
  description: {
    fontSize: 16,
    marginBottom: 24,
  },
  section: {
    marginBottom: 16,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#333',
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 8,
    marginTop: 8,
  },
  sectionValue: {
    fontSize: 16,
    marginLeft: 30,
  },
  editButton: {
    backgroundColor: '#BB86FC',
    padding: 12,
    borderRadius: 8,
    alignItems: 'center',
    marginTop: 24,
  },
  editButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: 'bold',
  },
  errorText: {
    fontSize: 18,
    textAlign: 'center',
    marginTop: 50,
  },
  emptyText: {
    fontSize: 16,
    fontStyle: 'italic',
    marginTop: 8,
    marginLeft: 30,
  },
});

export default FearDetailScreen;
