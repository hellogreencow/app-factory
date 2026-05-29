import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, SafeAreaView, Image } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons, MaterialIcons } from '@expo/vector-icons';
import { useAppData } from '../context/AppContext';
import AsyncStorage from '@react-native-async-storage/async-storage';

const ProfileScreen = () => {
  const { user } = useAppData();
  const [username, setUsername] = useState('Loading...');
  const [profilePicture, setProfilePicture] = useState(null);
  const [bio, setBio] = useState('Loading bio...');

  useEffect(() => {
    const loadProfile = async () => {
      try {
        const storedUser = await AsyncStorage.getItem('@nearfear_user');
        if (storedUser) {
          const parsedUser = JSON.parse(storedUser);
          setUsername(parsedUser.username || 'User');
          setProfilePicture(parsedUser.profilePicture || null);
          setBio(parsedUser.bio || 'No bio available.');
        } else {
          setUsername('Guest User');
          setBio('No profile data found.');
        }
      } catch (error) {
        console.error('Failed to load profile:', error);
        setUsername('Error Loading');
        setBio('Failed to load bio.');
      }
    };

    loadProfile();
  }, []);

  const handleSettingsPress = async () => {
    // Implement navigation to settings screen or show a modal
    console.log('Settings pressed');
  };

  return (
    <SafeAreaView style={styles.container} testID="profile-screen">
      <LinearGradient
        colors={['#121212', '#1E1E1E']}
        style={styles.headerGradient}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 0 }}
      >
        <View style={styles.header}>
          <Text style={styles.headerTitle}>Profile</Text>
        </View>
      </LinearGradient>

      <View style={styles.profileInfoContainer} testID="profile-info-container">
        <View style={styles.profilePictureContainer}>
          {profilePicture ? (
            <Image source={{ uri: profilePicture }} style={styles.profilePicture} testID="profile-picture" />
          ) : (
            <View style={styles.profilePicturePlaceholder}>
              <Ionicons name="person-outline" size={60} color="#A9A9A9" />
            </View>
          )}
        </View>
        <Text style={styles.username} testID="username-text">{username}</Text>
        <Text style={styles.bio} testID="bio-text">{bio}</Text>
      </View>

      <TouchableOpacity
        style={styles.settingsButton}
        onPress={handleSettingsPress}
        testID="settings-access-button"
        accessibilityLabel="Access Settings"
      >
        <LinearGradient
          colors={['#2C2C2C', '#1E1E1E']}
          style={styles.settingsButtonGradient}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
        >
          <View style={styles.settingsButtonContent}>
            <Ionicons name="settings-outline" size={24} color="#64FFDA" style={styles.settingsIcon} />
            <Text style={styles.settingsButtonText}>Settings</Text>
            <Ionicons name="chevron-forward" size={24} color="#64FFDA" style={styles.settingsChevron} />
          </View>
        </LinearGradient>
      </TouchableOpacity>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#121212',
  },
  headerGradient: {
    width: '100%',
    paddingTop: 10,
    paddingBottom: 20,
  },
  header: {
    paddingHorizontal: 20,
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#FFFFFF',
    marginBottom: 8,
  },
  profileInfoContainer: {
    padding: 20,
    alignItems: 'center',
  },
  profilePictureContainer: {
    marginBottom: 20,
  },
  profilePicture: {
    width: 100,
    height: 100,
    borderRadius: 50,
  },
  profilePicturePlaceholder: {
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: '#1E1E1E',
    justifyContent: 'center',
    alignItems: 'center',
  },
  username: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#FFFFFF',
    marginBottom: 8,
  },
  bio: {
    fontSize: 16,
    color: '#A9A9A9',
    textAlign: 'center',
  },
  settingsButton: {
    marginTop: 20,
    paddingHorizontal: 20,
  },
  settingsButtonGradient: {
    borderRadius: 8,
  },
  settingsButtonContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 12,
    paddingHorizontal: 16,
  },
  settingsIcon: {
    marginRight: 8,
  },
  settingsButtonText: {
    fontSize: 18,
    color: '#FFFFFF',
    fontWeight: 'bold',
  },
  settingsChevron: {
    marginLeft: 8,
  },
});

export default ProfileScreen;
