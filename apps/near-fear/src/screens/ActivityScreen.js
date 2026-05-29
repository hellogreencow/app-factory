import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, FlatList, SafeAreaView, TouchableOpacity } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useAppData } from '../context/AppContext';
import { formatDistanceToNow } from 'date-fns';
import AsyncStorage from '@react-native-async-storage/async-storage';

const ActivityScreen = () => {
  const { dares } = useAppData();
  const [notifications, setNotifications] = useState([]);

  useEffect(() => {
    loadNotifications();
  }, []);

  const loadNotifications = async () => {
    try {
      const storedNotifications = await AsyncStorage.getItem('@nearfear_notifications');
      if (storedNotifications) {
        setNotifications(JSON.parse(storedNotifications));
      } else {
        // Simulate some initial notifications if none exist
        const initialNotifications = [
          {
            id: Date.now().toString(36) + Math.random().toString(36).slice(2),
            type: 'like',
            dareTitle: 'Sing Karaoke in Public',
            time: new Date().toISOString(),
          },
          {
            id: Date.now().toString(36) + Math.random().toString(36).slice(2),
            type: 'comment',
            dareTitle: 'Ice Bucket Challenge',
            time: new Date(Date.now() - 3600000).toISOString(), // 1 hour ago
          },
        ];
        setNotifications(initialNotifications);
        await AsyncStorage.setItem('@nearfear_notifications', JSON.stringify(initialNotifications));
      }
    } catch (error) {
      console.error('Failed to load notifications:', error);
    }
  };

  const handleNotificationPress = (notification) => {
    // Implement navigation or action based on notification type
    console.log('Notification pressed:', notification);
  };

  const renderNotificationItem = ({ item }) => {
    let iconName;
    let message;

    switch (item.type) {
      case 'like':
        iconName = 'heart';
        message = `Your dare "${item.dareTitle}" received a like!`;
        break;
      case 'comment':
        iconName = 'chatbubble';
        message = `Your dare "${item.dareTitle}" received a comment!`;
        break;
      default:
        iconName = 'information-circle';
        message = 'New activity!';
    }

    return (
      <TouchableOpacity
        style={styles.notificationCard}
        onPress={() => handleNotificationPress(item)}
        testID={`notification-card-${item.id}`}
        accessibilityLabel={`Notification: ${message}`}
      >
        <LinearGradient
          colors={['#2C2C2C', '#1E1E1E']}
          style={styles.notificationCardGradient}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
        >
          <View style={styles.notificationContent}>
            <Ionicons name={iconName} size={24} color="#64FFDA" style={styles.notificationIcon} />
            <View style={styles.notificationTextContainer}>
              <Text style={styles.notificationText} testID={`notification-message-${item.id}`}>{message}</Text>
              <Text style={styles.notificationTime} testID={`notification-time-${item.id}`}>
                {formatDistanceToNow(new Date(item.time), { addSuffix: true })}
              </Text>
            </View>
          </View>
        </LinearGradient>
      </TouchableOpacity>
    );
  };

  return (
    <SafeAreaView style={styles.container}>
      <LinearGradient
        colors={['#121212', '#1E1E1E']}
        style={styles.headerGradient}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 0 }}
      >
        <View style={styles.header}>
          <Text style={styles.headerTitle}>Activity</Text>
        </View>
      </LinearGradient>

      {notifications.length === 0 ? (
        <View style={styles.emptyContainer}>
          <Ionicons name="notifications-outline" size={64} color="#666" />
          <Text style={styles.emptyText}>No activity yet!</Text>
        </View>
      ) : (
        <FlatList
          data={notifications}
          renderItem={renderNotificationItem}
          keyExtractor={(item) => item.id}
          style={styles.notificationList}
          testID="notification-list"
          accessibilityLabel="Notification List"
        />
      )}
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#121212',
  },
  headerGradient: {
    paddingTop: 20,
    paddingBottom: 10,
  },
  header: {
    paddingHorizontal: 20,
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#FFFFFF',
  },
  notificationList: {
    flex: 1,
    paddingHorizontal: 10,
    marginTop: 10,
  },
  notificationCard: {
    marginBottom: 10,
    borderRadius: 8,
    overflow: 'hidden',
  },
  notificationCardGradient: {
    padding: 15,
  },
  notificationContent: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  notificationIcon: {
    marginRight: 15,
  },
  notificationTextContainer: {
    flex: 1,
  },
  notificationText: {
    color: '#FFFFFF',
    fontSize: 16,
  },
  notificationTime: {
    color: '#A9A9A9',
    fontSize: 12,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  emptyText: {
    color: '#666',
    fontSize: 16,
    marginTop: 10,
  },
});

export default ActivityScreen;
