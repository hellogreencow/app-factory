
import React, { useState } from 'react';
import { View, Text, TextInput, StyleSheet, TouchableOpacity, Platform } from 'react-native';
import { useAppData } from '../context/AppContext';
import { Feather } from '@expo/vector-icons';
import DateTimePicker from '@react-native-community/datetimepicker';
import { format } from 'date-fns';

export default function AddItemScreen({ navigation }) {
  const { addItem, theme } = useAppData();
  const [name, setName] = useState('');
  const [price, setPrice] = useState('');
  const [date, setDate] = useState(new Date());
  const [showDatePicker, setShowDatePicker] = useState(false);

  const handleAddItem = async () => {
    if (name && price && date) {
      const newItem = {
        name,
        purchasePrice: parseFloat(price),
        datePurchased: date.toISOString(),
        uses: 0,
      };
      await addItem(newItem);
      navigation.goBack(); // Navigate back to the items screen after adding
    } else {
      alert('Please fill in all fields.');
    }
  };

  const onChange = (event, selectedDate) => {
    const currentDate = selectedDate || date;
    setShowDatePicker(Platform.OS === 'ios'); // Hide picker on iOS after selection
    setDate(currentDate);
  };

  const showMode = () => {
    setShowDatePicker(true);
  };

  return (
    <View style={[styles.container, { backgroundColor: theme.backgroundColor }]}>
      <Text style={[styles.title, { color: theme.textColor }]}>Add New Item</Text>

      <View style={styles.inputContainer}>
        <Text style={[styles.label, { color: theme.textColor }]}>Name</Text>
        <TextInput
          style={[styles.input, { backgroundColor: theme.cardColor, color: theme.textColor }]}
          placeholder="Item Name"
          placeholderTextColor={theme.textColor}
          value={name}
          onChangeText={setName}
          testID="item-name-input"
          accessibilityLabel="Item Name"
        />
      </View>

      <View style={styles.inputContainer}>
        <Text style={[styles.label, { color: theme.textColor }]}>Price</Text>
        <TextInput
          style={[styles.input, { backgroundColor: theme.cardColor, color: theme.textColor }]}
          placeholder="Item Price"
          placeholderTextColor={theme.textColor}
          value={price}
          onChangeText={text => {
            // Allow only numbers and one decimal point
            const formattedText = text.replace(/[^0-9.]/g, '').replace(/(\..*)\./g, '$1');
            setPrice(formattedText);
          }}
          keyboardType="numeric"
          testID="item-price-input"
          accessibilityLabel="Item Price"
        />
      </View>

      <View style={styles.inputContainer}>
        <Text style={[styles.label, { color: theme.textColor }]}>Date Purchased</Text>
        <TouchableOpacity style={[styles.datePickerButton, { backgroundColor: theme.cardColor }]} onPress={showMode} testID="date-picker-button" accessibilityLabel="Select Purchase Date">
          <Text style={{ color: theme.textColor }}>{format(date, 'MMMM dd, yyyy')}</Text>
          <Feather name="calendar" size={20} color={theme.textColor} />
        </TouchableOpacity>
        {showDatePicker && (
          <DateTimePicker
            testID="dateTimePicker"
            value={date}
            mode="date"
            display="default"
            onChange={onChange}
          />
        )}
      </View>

      <TouchableOpacity
        style={[styles.addButton, { backgroundColor: theme.accentColor }]}
        onPress={handleAddItem}
        testID="add-item-button"
        accessibilityLabel="Add Item"
      >
        <Text style={styles.addButtonText}>Add Item</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 20,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 20,
    textAlign: 'center',
  },
  inputContainer: {
    marginBottom: 20,
  },
  label: {
    fontSize: 16,
    marginBottom: 5,
  },
  input: {
    borderWidth: 1,
    borderColor: '#ccc',
    borderRadius: 5,
    padding: 10,
    fontSize: 16,
  },
  datePickerButton: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 10,
    borderWidth: 1,
    borderColor: '#ccc',
    borderRadius: 5,
  },
  addButton: {
    borderRadius: 5,
    padding: 12,
    alignItems: 'center',
  },
  addButtonText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: 'bold',
  },
});
