import React, { useState, useRef, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Image,
  Alert,
  ActivityIndicator,
  Dimensions,
  Platform,
} from 'react-native';
import { CameraView, useCameraPermissions } from 'expo-camera';
import * as ImagePicker from 'expo-image-picker';
import * as Haptics from 'expo-haptics';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useSettleSnap } from '../context/AppContext';

const { width, height } = Dimensions.get('window');

export default function ScanReceipt({ navigation }) {
  const { groups } = useSettleSnap();

  const [permission, requestPermission] = useCameraPermissions();
  const [facing, setFacing] = useState('back');
  const [flash, setFlash] = useState('off');
  const [capturedImage, setCapturedImage] = useState(null);
  const [processing, setProcessing] = useState(false);

  const cameraRef = useRef(null);

  useEffect(() => {
    (async () => {
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== 'granted') {
        console.log('Media library permission not granted');
      }
    })();
  }, []);

  if (!permission) {
    return (
      <View style={styles.container}>
        <ActivityIndicator size="large" color="#2E7D32" testID="loading-indicator" />
      </View>
    );
  }

  if (!permission.granted) {
    return (
      <View style={styles.container}>
        <View style={styles.permissionContainer}>
          <Ionicons name="camera-outline" size={80} color="#757575" />
          <Text style={styles.permissionTitle}>Camera Access Required</Text>
          <Text style={styles.permissionText}>
            SettleSnap needs camera access to scan receipts and capture expense details
          </Text>
          <TouchableOpacity
            style={styles.permissionButton}
            onPress={requestPermission}
            testID="request-camera-permission-button"
            accessibilityLabel="Grant camera permission"
          >
            <LinearGradient
              colors={['#2E7D32', '#1B5E20']}
              style={styles.gradientButton}
            >
              <Ionicons name="camera" size={20} color="#FFFFFF" style={styles.buttonIcon} />
              <Text style={styles.permissionButtonText}>Grant Permission</Text>
            </LinearGradient>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.skipButton}
            onPress={() => navigation.navigate('AddExpense')}
            testID="skip-to-manual-entry-button"
            accessibilityLabel="Skip to manual entry"
          >
            <Text style={styles.skipButtonText}>Enter Manually Instead</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  const handleCapture = async () => {
    if (!cameraRef.current) return;

    try {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      setProcessing(true);

      const photo = await cameraRef.current.takePictureAsync({
        quality: 0.8,
        base64: false,
      });

      setCapturedImage(photo.uri);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);

      setTimeout(() => {
        setProcessing(false);
        navigation.navigate('AddExpense', {
          imageUri: photo.uri,
          scanned: true,
        });
      }, 500);
    } catch (error) {
      console.error('Error capturing photo:', error);
      setProcessing(false);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      Alert.alert('Error', 'Failed to capture photo. Please try again.');
    }
  };

  const handlePickImage = async () => {
    try {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        quality: 0.8,
      });

      if (!result.canceled && result.assets && result.assets.length > 0) {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        navigation.navigate('AddExpense', {
          imageUri: result.assets[0].uri,
          scanned: true,
        });
      }
    } catch (error) {
      console.error('Error picking image:', error);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      Alert.alert('Error', 'Failed to select image. Please try again.');
    }
  };

  const handleManualEntry = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    navigation.navigate('AddExpense');
  };

  const toggleFlash = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setFlash(current => (current === 'off' ? 'on' : 'off'));
  };

  const toggleCameraFacing = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setFacing(current => (current === 'back' ? 'front' : 'back'));
  };

  return (
    <View style={styles.container}>
      <CameraView
        ref={cameraRef}
        style={styles.camera}
        facing={facing}
        flash={flash}
        testID="camera-view"
      >
        <LinearGradient
          colors={['rgba(0,0,0,0.6)', 'transparent']}
          style={styles.topGradient}
        >
          <View style={styles.topControls}>
            <TouchableOpacity
              style={styles.topButton}
              onPress={toggleFlash}
              testID="toggle-flash-button"
              accessibilityLabel={`Toggle flash ${flash === 'on' ? 'off' : 'on'}`}
            >
              <Ionicons
                name={flash === 'on' ? 'flash' : 'flash-off'}
                size={28}
                color="#FFFFFF"
              />
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.topButton}
              onPress={handlePickImage}
              testID="pick-image-button"
              accessibilityLabel="Select image from gallery"
            >
              <Ionicons name="images" size={28} color="#FFFFFF" />
            </TouchableOpacity>
          </View>
        </LinearGradient>

        <View style={styles.centerOverlay}>
          <View style={styles.scanFrame}>
            <View style={[styles.corner, styles.topLeft]} />
            <View style={[styles.corner, styles.topRight]} />
            <View style={[styles.corner, styles.bottomLeft]} />
            <View style={[styles.corner, styles.bottomRight]} />
          </View>
          <Text style={styles.scanHint}>Position receipt within frame</Text>
        </View>

        <LinearGradient
          colors={['transparent', 'rgba(0,0,0,0.7)']}
          style={styles.bottomGradient}
        >
          <View style={styles.bottomControls}>
            <TouchableOpacity
              style={styles.manualButton}
              onPress={handleManualEntry}
              testID="manual-entry-button"
              accessibilityLabel="Skip scanning and enter expense manually"
            >
              <Ionicons name="create-outline" size={24} color="#FFFFFF" />
              <Text style={styles.manualButtonText}>Manual Entry</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.captureButton}
              onPress={handleCapture}
              disabled={processing}
              testID="capture-button"
              accessibilityLabel="Capture receipt photo"
            >
              <View style={styles.captureButtonOuter}>
                <View style={styles.captureButtonInner}>
                  {processing ? (
                    <ActivityIndicator size="small" color="#2E7D32" />
                  ) : (
                    <Ionicons name="camera" size={32} color="#2E7D32" />
                  )}
                </View>
              </View>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.flipButton}
              onPress={toggleCameraFacing}
              testID="flip-camera-button"
              accessibilityLabel="Flip camera"
            >
              <Ionicons name="camera-reverse-outline" size={24} color="#FFFFFF" />
              <Text style={styles.flipButtonText}>Flip</Text>
            </TouchableOpacity>
          </View>
        </LinearGradient>
      </CameraView>

      {processing && (
        <View style={styles.processingOverlay}>
          <View style={styles.processingCard}>
            <ActivityIndicator size="large" color="#2E7D32" />
            <Text style={styles.processingText}>Processing receipt...</Text>
          </View>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000000',
  },
  camera: {
    flex: 1,
  },
  permissionContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#FAFAFA',
    padding: 32,
  },
  permissionTitle: {
    fontSize: 24,
    fontWeight: '700',
    color: '#1A1A1A',
    marginTop: 24,
    marginBottom: 12,
    textAlign: 'center',
  },
  permissionText: {
    fontSize: 16,
    color: '#757575',
    textAlign: 'center',
    lineHeight: 24,
    marginBottom: 32,
  },
  permissionButton: {
    width: '100%',
    marginBottom: 16,
  },
  gradientButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
    paddingHorizontal: 24,
    borderRadius: 12,
  },
  buttonIcon: {
    marginRight: 8,
  },
  permissionButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  skipButton: {
    paddingVertical: 12,
    paddingHorizontal: 24,
  },
  skipButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#2E7D32',
  },
  topGradient: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    paddingTop: Platform.OS === 'ios' ? 60 : 20,
    paddingBottom: 20,
    zIndex: 10,
  },
  topControls: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
  },
  topButton: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  centerOverlay: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  scanFrame: {
    width: width * 0.8,
    height: width * 0.8,
    position: 'relative',
  },
  corner: {
    position: 'absolute',
    width: 40,
    height: 40,
    borderColor: '#2E7D32',
  },
  topLeft: {
    top: 0,
    left: 0,
    borderTopWidth: 4,
    borderLeftWidth: 4,
    borderTopLeftRadius: 12,
  },
  topRight: {
    top: 0,
    right: 0,
    borderTopWidth: 4,
    borderRightWidth: 4,
    borderTopRightRadius: 12,
  },
  bottomLeft: {
    bottom: 0,
    left: 0,
    borderBottomWidth: 4,
    borderLeftWidth: 4,
    borderBottomLeftRadius: 12,
  },
  bottomRight: {
    bottom: 0,
    right: 0,
    borderBottomWidth: 4,
    borderRightWidth: 4,
    borderBottomRightRadius: 12,
  },
  scanHint: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFFFFF',
    marginTop: 24,
    textAlign: 'center',
    backgroundColor: 'rgba(0,0,0,0.6)',
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 20,
  },
  bottomGradient: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    paddingBottom: Platform.OS === 'ios' ? 40 : 20,
    paddingTop: 40,
  },
  bottomControls: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'center',
    paddingHorizontal: 20,
  },
  manualButton: {
    alignItems: 'center',
    justifyContent: 'center',
    width: 80,
  },
  manualButtonText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#FFFFFF',
    marginTop: 4,
    textAlign: 'center',
  },
  captureButton: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  captureButtonOuter: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: 'rgba(255,255,255,0.3)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  captureButtonInner: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: '#FFFFFF',
    justifyContent: 'center',
    alignItems: 'center',
  },
  flipButton: {
    alignItems: 'center',
    justifyContent: 'center',
    width: 80,
  },
  flipButtonText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#FFFFFF',
    marginTop: 4,
    textAlign: 'center',
  },
  processingOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.8)',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 100,
  },
  processingCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 32,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },
  processingText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1A1A1A',
    marginTop: 16,
  },
});
