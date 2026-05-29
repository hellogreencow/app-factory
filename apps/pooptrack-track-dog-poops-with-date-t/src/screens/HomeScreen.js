import React, { useContext } from 'react';
import {
  StyleSheet,
  Text,
  View,
  FlatList,
  TouchableOpacity,
  SafeAreaView,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons, MaterialIcons } from '@expo/vector-icons';
import { formatDistanceToNow, format } from 'date-fns';
import { useNavigation } from '@react-navigation/native';
import * as Haptics from 'expo-haptics';

import { AppContext } from '../context/AppContext';

const generateTestID = (base) => `home-screen-${base}`;

export default function HomeScreen() {
  const { theme, filteredPoops } = useContext(AppContext);
  const navigation = useNavigation();

  const renderItem = ({ item }) => {
    const safeDate = new Date(item?.date);
    const safeDateFinal = isNaN(safeDate.getTime()) ? new Date() : safeDate;

    return (
      <TouchableOpacity
        style={[styles.item, { backgroundColor: theme?.cardColor, borderRadius: theme?.borderRadius }]}
        onPress={() => {
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
          navigation.navigate('EditPoopScreen', { id: item?.id });
        }}
        testID={generateTestID(`poop-item-${item?.id}`)}
        accessibilityLabel={`Poop entry from ${formatDistanceToNow(safeDateFinal, {
          addSuffix: true,
        })}`}
      >
        <View style={styles.itemContent}>
          <View style={styles.itemHeader}>
            <Text style={[styles.itemDate, { color: theme?.textColor }]} testID={generateTestID(`poop-date-${item?.id}`)}>
              {formatDistanceToNow(safeDateFinal, {
                addSuffix: true,
              })}
            </Text>
            <Text style={[styles.itemTime, { color: theme?.textColor }]} testID={generateTestID(`poop-time-${item?.id}`)}>
              {item?.time}
            </Text>
          </View>
          <View style={styles.itemDetails}>
            <Text style={[styles.itemConsistency, { color: theme?.textColor }]} testID={generateTestID(`poop-consistency-${item?.id}`)}>
              Consistency: {item?.consistency}
            </Text>
            <Text style={[styles.itemColor, { color: theme?.textColor }]} testID={generateTestID(`poop-color-${item?.id}`)}>
              Color: {item?.color}
            </Text>
          </View>
        </View>
        <Ionicons name="chevron-forward" size={24} color={theme?.accentColor} style={styles.itemArrow} />
      </TouchableOpacity>
    );
  };

  const renderEmpty = () => (
    <View style={styles.emptyContainer} testID={generateTestID('empty-list')}>
      <Ionicons name="sad-outline" size={64} color={theme?.textColor} />
      <Text style={[styles.emptyText, { color: theme?.textColor }]}>No poops recorded yet.</Text>
    </View>
  );

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme?.backgroundColor }]}>
      <LinearGradient
        colors={[theme?.secondaryAccent, theme?.accentColor]}
        style={styles.headerGradient}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 0 }}
      >
        <View style={styles.header}>
          <Text style={styles.headerTitle}>PoopTrack</Text>
        </View>
      </LinearGradient>

      {filteredPoops?.length > 0 ? (
        <FlatList
          data={filteredPoops}
          renderItem={renderItem}
          keyExtractor={(item) => item?.id}
          contentContainerStyle={styles.listContent}
          testID={generateTestID('poop-list')}
        />
      ) : (
        renderEmpty()
      )}

      <TouchableOpacity
        style={[styles.addButton, { backgroundColor: theme?.accentColor, borderRadius: theme?.borderRadius * 2 }]}
        onPress={() => {
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
          navigation.navigate('AddPoopScreen');
        }}
        testID={generateTestID('add-poop-button')}
        accessibilityLabel="Add a new poop entry"
      >
        <Ionicons name="add" size={32} color={theme?.backgroundColor} />
      </TouchableOpacity>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
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
    fontSize: 28,
    fontWeight: 'bold',
    color: '#FFFFFF',
    marginBottom: 8,
  },
  listContent: {
    padding: 16,
  },
  item: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.23,
    shadowRadius: 2.62,
    elevation: 4,
  },
  itemContent: {
    flex: 1,
  },
  itemHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  itemDate: {
    fontSize: 16,
    fontWeight: 'bold',
  },
  itemTime: {
    fontSize: 14,
    color: '#888',
  },
  itemDetails: {
    fontSize: 14,
  },
  itemArrow: {
    marginLeft: 16,
  },
  addButton: {
    position: 'absolute',
    bottom: 20,
    right: 20,
    width: 64,
    height: 64,
    borderRadius: 32,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.23,
    shadowRadius: 2.62,
    elevation: 4,
  },
  emptyContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 20,
  },
  emptyText: {
    fontSize: 16,
    marginTop: 16,
    textAlign: 'center',
  },
});
