
import React, { useState, useRef, useContext } from 'react';
import { StyleSheet, Text, View, TouchableOpacity, Image, Alert } from 'react-native';
import { CameraView, useCameraPermissions } from 'expo-camera';
import * as ImagePicker from 'expo-image-picker';
import { Ionicons } from '@expo/vector-icons';
import { AppContext } from '../context/AppContext';

export default function CameraScreen({ navigation }) {
  const [permission, requestPermission] = useCameraPermissions();
  const [photo, setPhoto] = useState(null);
  const cameraRef = useRef(null);
  const { addReceipt, theme } = useContext(AppContext);

  if (!permission) {
    return <View />;
  }

  if (!permission.granted) {
    return (
      <View style={[styles.container, { backgroundColor: theme.backgroundColor, justifyContent: 'center', alignItems: 'center' }]}>
        <Text style={{ color: theme.textColor, textAlign: 'center', marginBottom: 20 }}>
          We need your permission to show the camera
        </Text>
        <TouchableOpacity 
          style={{ backgroundColor: theme.accentColor, padding: 15, borderRadius: 10 }}
          onPress={requestPermission}
        >
          <Text style={{ color: 'white', fontWeight: 'bold' }}>Grant Permission</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const takePicture = async () => {
    if (cameraRef.current) {
      try {
        const options = { quality: 0.5, base64: true };
        const data = await cameraRef.current.takePictureAsync(options);
        setPhoto(data.uri);
      } catch (error) {
        Alert.alert('Error', 'Failed to take picture');
      }
    }
  };

  const pickImage = async () => {
    let result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      quality: 1,
    });

    if (!result.canceled) {
      setPhoto(result.assets[0].uri);
    }
  };

  const handleProcess = () => {
    // Mock processing
    const newReceipt = {
      id: Date.now().toString(),
      storeName: 'New Store',
      totalAmount: Math.floor(Math.random() * 100) + 10,
      date: new Date().toISOString(),
      imageUri: photo,
      participants: [],
    };
    addReceipt(newReceipt);
    setPhoto(null);
    navigation.navigate('History');
  };

  if (photo) {
    return (
      <View style={[styles.container, { backgroundColor: theme.backgroundColor }]}>
        <Image source={{ uri: photo }} style={styles.preview} />
        <View style={styles.previewButtons}>
          <TouchableOpacity style={styles.previewButton} onPress={() => setPhoto(null)}>
            <Ionicons name="close-circle" size={60} color="white" />
          </TouchableOpacity>
          <TouchableOpacity style={styles.previewButton} onPress={handleProcess}>
            <Ionicons name="checkmark-circle" size={60} color={theme.accentColor} />
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <CameraView style={styles.camera} ref={cameraRef}>
        <View style={styles.buttonContainer}>
          <TouchableOpacity style={styles.iconButton} onPress={pickImage}>
            <Ionicons name="images" size={32} color="white" />
          </TouchableOpacity>
          
          <TouchableOpacity style={styles.captureButton} onPress={takePicture} testID="capture-button">
            <View style={styles.captureButtonInner} />
          </TouchableOpacity>

          <TouchableOpacity style={styles.iconButton} onPress={() => navigation.goBack()}>
            <Ionicons name="close" size={32} color="white" />
          </TouchableOpacity>
        </View>
      </CameraView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  camera: {
    flex: 1,
  },
  buttonContainer: {
    flex: 1,
    flexDirection: 'row',
    backgroundColor: 'transparent',
    justifyContent: 'space-around',
    alignItems: 'flex-end',
    marginBottom: 40,
  },
  captureButton: {
    width: 70,
    height: 70,
    borderRadius: 35,
    backgroundColor: 'rgba(255, 255, 255, 0.3)',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 4,
    borderColor: 'white',
  },
  captureButtonInner: {
    width: 54,
    height: 54,
    borderRadius: 27,
    backgroundColor: 'white',
  },
  iconButton: {
    marginBottom: 15,
  },
  preview: {
    flex: 1,
    resizeMode: 'contain',
  },
  previewButtons: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    paddingBottom: 40,
    position: 'absolute',
    bottom: 0,
    width: '100%',
  },
  previewButton: {
    alignItems: 'center',
  },
});
