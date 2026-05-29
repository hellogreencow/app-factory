import React, { useState, useCallback } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, SafeAreaView, TextInput } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons, MaterialIcons } from '@expo/vector-icons';
import { useAppData } from '../context/AppContext';
import { formatDistanceToNow } from 'date-fns';
import AsyncStorage from '@react-native-async-storage/async-storage';

const DaresScreen = () => {
  const { dares } = useAppData();
  const [searchTerm, setSearchTerm] = useState('');
  const [filteredDares, setFilteredDares] = useState(dares);

  const handleSearch = useCallback((text) => {
    setSearchTerm(text);
    if (text) {
      const filtered = dares.filter(dare =>
        dare.title.toLowerCase().includes(text.toLowerCase()) ||
        dare.description.toLowerCase().includes(text.toLowerCase())
      );
      setFilteredDares(filtered);
    } else {
      setFilteredDares(dares);
    }
  }, [dares]);

  const renderDareItem = ({ item }) => (
    <TouchableOpacity
      style={styles.dareCard}
      testID={`dare-card-${item.id}`}
      accessibilityLabel={`Dare: ${item.title}`}
    >
      <LinearGradient
        colors={['#2C2C2C', '#1E1E1E']}
        style={styles.dareCardGradient}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
      >
        <View style={styles.dareCardContent}>
          <Text style={styles.dareTitle} testID={`dare-title-${item.id}`}>{item.title}</Text>
          <Text style={styles.dareLocation}>
            <Ionicons name="location-outline" size={14} color="#A9A9A9" /> {item.location?.latitude?.toFixed(2) || '?'}, {item.location?.longitude?.toFixed(2) || '?'}
          </Text>
          <Text style={styles.dareTimeAgo}>
            {isNaN(new Date(item.createdAt).getTime()) ? 'recently' : formatDistanceToNow(new Date(item.createdAt), { addSuffix: true })}
          </Text>
        </View>
      </LinearGradient>
    </TouchableOpacity>
  );

  return (
    <SafeAreaView style={styles.container}>
      <LinearGradient
        colors={['#121212', '#1E1E1E']}
        style={styles.headerGradient}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 0 }}
      >
        <View style={styles.header}>
          <Text style={styles.headerTitle}>Dares</Text>
          <View style={styles.searchBar}>
            <Ionicons name="search" size={20} color="#A9A9A9" style={styles.searchIcon} />
            <TextInput
              style={styles.searchInput}
              placeholder="Search dares..."
              placeholderTextColor="#A9A9A9"
              value={searchTerm}
              onChangeText={handleSearch}
              testID="dare-search-input"
              accessibilityLabel="Dare Search Input"
            />
          </View>
        </View>
      </LinearGradient>

      {dares.length === 0 ? (
        <View style={styles.emptyContainer}>
          <Ionicons name="flame-outline" size={64} color="#666" />
          <Text style={styles.emptyText}>No dares available yet!</Text>
        </View>
      ) : (
        <FlatList
          data={searchTerm ? filteredDares : dares}
          renderItem={renderDareItem}
          keyExtractor={item => item.id}
          style={styles.dareList}
          contentContainerStyle={styles.dareListContent}
          testID="dare-list"
          accessibilityLabel="Dare List"
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
    marginBottom: 10,
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#FFFFFF',
    marginBottom: 10,
  },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1E1E1E',
    borderRadius: 8,
    paddingHorizontal: 10,
  },
  searchIcon: {
    marginRight: 10,
  },
  searchInput: {
    flex: 1,
    color: '#FFFFFF',
    fontSize: 16,
    height: 40,
  },
  dareList: {
    flex: 1,
  },
  dareListContent: {
    paddingHorizontal: 20,
    paddingBottom: 20,
  },
  dareCard: {
    marginBottom: 15,
    borderRadius: 8,
    overflow: 'hidden',
  },
  dareCardGradient: {
    padding: 15,
    borderRadius: 8,
  },
  dareCardContent: {
    flex: 1,
  },
  dareTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#FFFFFF',
    marginBottom: 5,
  },
  dareLocation: {
    fontSize: 14,
    color: '#A9A9A9',
    marginBottom: 5,
  },
  dareTimeAgo: {
    fontSize: 12,
    color: '#A9A9A9',
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  emptyText: {
    fontSize: 16,
    color: '#666',
    marginTop: 10,
    textAlign: 'center',
  },
});

export default DaresScreen;
