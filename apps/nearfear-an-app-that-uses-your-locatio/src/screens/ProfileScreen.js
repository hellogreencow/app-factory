
import React, { useContext } from 'react';
import { StyleSheet, View, Text, FlatList, TouchableOpacity, SafeAreaView } from 'react-native';
import { useAppData } from '../context/AppContext';
import { Ionicons } from '@expo/vector-icons';

const user = {
  name: 'John Doe',
  email: 'john.doe@example.com',
  profilePicture: 'https://via.placeholder.com/150', // Replace with actual image URL
};

export default function ProfileScreen() {
  const { places, theme } = useAppData();

  // Filter places submitted by the current user (assuming all places are submitted by the user for now)
  const submittedPlaces = places;

  const renderItem = ({ item }) => (
    <View style={[styles.placeItem, { backgroundColor: theme.cardColor }]} testID={`place-item-${item.id}`} accessibilityLabel={`Place ${item.name}`}>
      <Text style={[styles.placeName, { color: theme.textColor }]}>{item.name}</Text>
      <Text style={[styles.placeRating, { color: theme.textColor }]}>Fear Rating: {item.fearRating}</Text>
    </View>
  );

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.backgroundColor }]}>
      <View style={styles.profileHeader}>
        {/*  <Image source={{ uri: user.profilePicture }} style={styles.profileImage} /> */}
        <Ionicons name="person-circle-outline" size={80} color={theme.textColor} />
        <View style={styles.profileInfo}>
          <Text style={[styles.name, { color: theme.textColor }]}>{user.name}</Text>
          <Text style={[styles.email, { color: theme.textColor }]}>{user.email}</Text>
        </View>
      </View>

      <TouchableOpacity style={styles.settingsButton} testID="settings-button" accessibilityLabel="Settings">
        <Ionicons name="settings-outline" size={24} color={theme.textColor} />
        <Text style={[styles.settingsText, { color: theme.textColor }]}>Settings</Text>
      </TouchableOpacity>

      <Text style={[styles.activityTitle, { color: theme.textColor }]}>Submitted Places</Text>
      <FlatList
        data={submittedPlaces}
        renderItem={renderItem}
        keyExtractor={(item) => item.id}
        ListEmptyComponent={() => (
          <Text style={[styles.emptyListText, { color: theme.textColor }]}>No places submitted yet.</Text>
        )}
        testID="submitted-places-list"
        accessibilityLabel="List of submitted places"
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 10,
  },
  profileHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 15,
    marginBottom: 10,
  },
  profileImage: {
    width: 80,
    height: 80,
    borderRadius: 40,
    marginRight: 15,
  },
  profileInfo: {
    flex: 1,
  },
  name: {
    fontSize: 20,
    fontWeight: 'bold',
  },
  email: {
    fontSize: 14,
  },
  settingsButton: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 10,
    marginBottom: 10,
  },
  settingsText: {
    fontSize: 16,
    marginLeft: 5,
  },
  activityTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    marginTop: 10,
    marginBottom: 10,
  },
  placeItem: {
    padding: 15,
    marginBottom: 10,
    borderRadius: 8,
  },
  placeName: {
    fontSize: 16,
    fontWeight: 'bold',
  },
  placeRating: {
    fontSize: 14,
  },
  emptyListText: {
    fontSize: 16,
    textAlign: 'center',
    marginTop: 20,
  },
});
