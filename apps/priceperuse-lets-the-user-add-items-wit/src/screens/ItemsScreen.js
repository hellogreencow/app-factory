import React, { useContext } from 'react';
import {
  StyleSheet,
  Text,
  View,
  FlatList,
  TouchableOpacity,
  Animated,
} from 'react-native';
import { Swipeable } from 'react-native-gesture-handler';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useNavigation } from '@react-navigation/native';
import { formatDistanceToNow } from 'date-fns';

import { AppContext } from '../context/AppContext';

const Item = ({ item, onDelete }) => {
  const { theme } = useContext(AppContext);
  const navigation = useNavigation();

  const pricePerUse = item.uses > 0 ? item.purchasePrice / item.uses : item.purchasePrice;

  const renderRightActions = (progress, dragX) => {
    const trans = dragX.interpolate({
      inputRange: [-100, 0],
      outputRange: [1, 0],
      extrapolate: 'clamp',
    });
    return (
      <TouchableOpacity
        testID={`delete-item-button-${item.id}`}
        accessibilityLabel={`Delete ${item.name}`}
        onPress={() => onDelete(item.id)}
      >
        <View style={styles.deleteButton}>
          <Animated.Text
            style={[
              styles.deleteButtonText,
              {
                opacity: trans,
              },
            ]}
          >
            Delete
          </Animated.Text>
        </View>
      </TouchableOpacity>
    );
  };

  const d = new Date(item.datePurchased);
  const safeDate = isNaN(d.getTime()) ? new Date() : d;

  return (
    <Swipeable renderRightActions={renderRightActions}>
      <TouchableOpacity
        style={[styles.itemContainer, { backgroundColor: theme.cardColor, borderRadius: theme.borderRadius }]}
        onPress={() => navigation.navigate('ItemDetailsScreen', { id: item.id })}
        testID={`item-details-navigation-${item.id}`}
        accessibilityLabel={`View details for ${item.name}`}
      >
        <LinearGradient
          colors={[theme.accentColor, theme.secondaryAccent]}
          style={styles.gradient}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 0 }}
        />
        <View style={styles.itemContent}>
          <Text style={[styles.itemName, { color: theme.textColor }]} testID={`item-name-${item.id}`}>
            {item?.name ?? 'Unknown'}
          </Text>
          <View style={styles.itemDetails}>
            <Text style={[styles.itemText, { color: theme.textColor }]}>
              Price per use: ${pricePerUse?.toFixed(2) ?? '0.00'}
            </Text>
            <Text style={[styles.itemText, { color: theme.textColor }]}>
              Purchased {formatDistanceToNow(safeDate, { addSuffix: true })}
            </Text>
          </View>
        </View>
      </TouchableOpacity>
    </Swipeable>
  );
};

const ItemsScreen = () => {
  const { items, deleteItem, theme } = useContext(AppContext);

  const sortedItems = (items || []).slice().sort((a, b) => a.name?.localeCompare(b.name));

  const renderItem = ({ item }) => (
    <Item item={item} onDelete={deleteItem} key={item.id} />
  );

  const keyExtractor = (item) => item.id;

  return (
    <View style={[styles.container, { backgroundColor: theme.backgroundColor }]}>
      {(!items || items.length === 0) ? (
        <View style={styles.emptyContainer}>
          <Ionicons name="pricetag-outline" size={60} color="gray" />
          <Text style={[styles.emptyText, { color: 'gray' }]}>No items added yet.</Text>
        </View>
      ) : (
        <FlatList
          data={sortedItems}
          renderItem={renderItem}
          keyExtractor={keyExtractor}
          testID="item-list"
          accessibilityLabel="List of items"
        />
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 10,
  },
  itemContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 10,
    overflow: 'hidden',
  },
  gradient: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: 0,
    height: '100%',
    width: 5,
  },
  itemContent: {
    flex: 1,
    padding: 15,
  },
  itemName: {
    fontSize: 18,
    fontWeight: 'bold',
  },
  itemDetails: {
    marginTop: 5,
  },
  itemText: {
    fontSize: 14,
  },
  deleteButton: {
    backgroundColor: 'red',
    justifyContent: 'center',
    alignItems: 'center',
    width: 100,
    borderRadius: 0,
    marginVertical: 10,
  },
  deleteButtonText: {
    color: 'white',
    padding: 25,
    fontWeight: 'bold',
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  emptyText: {
    fontSize: 16,
    marginTop: 10,
  },
});

export default ItemsScreen;
