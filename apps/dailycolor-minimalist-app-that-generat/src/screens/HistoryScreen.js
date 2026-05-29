import React, { useContext } from 'react';
import { StyleSheet, Text, View, FlatList, TouchableOpacity, Alert } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { formatDistanceToNow, format } from 'date-fns';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';

import { AppContext } from '../src/context/AppContext';

export default function HistoryScreen() {
  const { colorHistory, deleteFromHistory, theme } = useContext(AppContext);
  const insets = useSafeAreaInsets();

  const handleDeleteColor = (id) => {
    Alert.alert(
      "Remove from collection",
      "Once removed, this specific shade is gone.",
      [
        {
          text: "Cancel",
          style: "cancel"
        },
        {
          text: "Delete",
          onPress: () => {
            deleteFromHistory(id);
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
          },
          style: "destructive"
        }
      ],
      { cancelable: false }
    );
  };

  const renderItem = ({ item }) => {
    const safeDate = new Date(item?.date);
    const displayDate = isNaN(safeDate.getTime()) ? 'Invalid Date' : formatDistanceToNow(safeDate, { addSuffix: true });
    const fullDate = isNaN(safeDate.getTime()) ? 'Invalid Date' : format(safeDate, 'yyyy-MM-dd');

    return (
      <View style={[styles.itemContainer, { backgroundColor: theme.cardColor, borderRadius: theme.borderRadius }]}>
        <View style={[styles.colorSwatch, { backgroundColor: item?.hex }]} testID={`color-swatch-${item?.id}`} />
        <View style={styles.itemDetails}>
          <Text style={[styles.hexCode, { color: theme.textColor }]} testID={`color-hex-${item?.id}`}>{item?.hex}</Text>
          <Text style={[styles.dateText, { color: theme.textColor, opacity: 0.6 }]} testID={`color-date-${item?.id}`}>
            {displayDate} ({fullDate})
          </Text>
        </View>
        <TouchableOpacity
          style={styles.deleteButton}
          onPress={() => handleDeleteColor(item?.id)}
          testID={`delete-color-button-${item?.id}`}
          accessibilityLabel={`Delete color ${item?.hex}`}
        >
          <Ionicons name="ios-trash" size={24} color={theme.accentColor} />
        </TouchableOpacity>
      </View>
    );
  };

  const keyExtractor = (item) => item?.id;

  return (
    <LinearGradient
      colors={[theme.backgroundColor, theme.secondaryAccent]}
      style={[styles.container, { paddingTop: insets.top, paddingBottom: insets.bottom }]}
    >
      {colorHistory?.length === 0 ? (
        <View style={styles.emptyContainer}>
          <Ionicons name="ios-archive" size={64} color={theme.accentColor} />
          <Text style={[styles.emptyText, { color: theme.textColor }]}>No colors in history yet!</Text>
        </View>
      ) : (
        <FlatList
          data={colorHistory}
          renderItem={renderItem}
          keyExtractor={keyExtractor}
          style={styles.list}
          contentContainerStyle={styles.listContent}
          testID="color-history-list"
        />
      )}
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  list: {
    flex: 1,
    width: '100%',
  },
  listContent: {
    padding: 16,
  },
  itemContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    marginBottom: 16,
    borderRadius: 8,
  },
  colorSwatch: {
    width: 40,
    height: 40,
    borderRadius: 20,
    marginRight: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 2,
    elevation: 3,
  },
  itemDetails: {
    flex: 1,
  },
  hexCode: {
    fontSize: 16,
    fontWeight: 'bold',
  },
  dateText: {
    fontSize: 12,
  },
  deleteButton: {
    padding: 8,
    borderRadius: 4,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  emptyText: {
    fontSize: 16,
    marginTop: 16,
    textAlign: 'center',
  },
});
