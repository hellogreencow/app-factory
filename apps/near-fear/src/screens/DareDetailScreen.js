import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Dimensions, Image } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useAppData } from '../context/AppContext';

const { width, height } = Dimensions.get('window');

const DareDetailScreen = ({ route }) => {
  const { dare } = route.params;
  const [liked, setLiked] = useState(false);
  const { updateDare } = useAppData();

  const handleLike = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setLiked(!liked);

    const newLikes = liked ? dare?.likes - 1 : dare?.likes + 1;

    updateDare({ ...dare, likes: newLikes });
  };

  return (
    <View style={styles.container}>
      <Image
        source={{ uri: dare?.videoUrl }}
        style={styles.video}
        resizeMode="cover"
        testID="dare-video"
        accessibilityLabel="Dare Video"
      />

      <LinearGradient
        colors={['transparent', 'rgba(0,0,0,0.8)']}
        style={styles.gradientOverlay}
      />

      <View style={styles.detailsContainer}>
        <Text style={styles.title} testID="dare-title">{dare?.title}</Text>
        <Text style={styles.description} testID="dare-description">{dare?.description}</Text>

        <View style={styles.likeContainer}>
          <TouchableOpacity
            style={styles.likeButton}
            onPress={handleLike}
            testID="like-dare-button"
            accessibilityLabel="Like Dare"
          >
            <LinearGradient
              colors={liked ? ['#FF4081', '#F06292'] : ['#2C2C2C', '#1E1E1E']}
              style={styles.likeButtonGradient}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
            >
            <View style={styles.likeButtonContent}>
              <Ionicons
                name={liked ? "heart" : "heart-outline"}
                size={24}
                color="#FFFFFF"
              />
              <Text style={styles.likeCount}>{dare?.likes}</Text>
            </View>
            </LinearGradient>
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#121212',
  },
  video: {
    width: width,
    height: height,
    position: 'absolute',
    top: 0,
    left: 0,
    zIndex: 0,
  },
  gradientOverlay: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    width: width,
    height: height / 2,
    zIndex: 1,
  },
  detailsContainer: {
    position: 'absolute',
    bottom: 20,
    left: 20,
    zIndex: 2,
    width: width - 40,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#FFFFFF',
    marginBottom: 8,
    textShadowColor: 'rgba(0,0,0,0.75)',
    textShadowOffset: { width: -1, height: 1 },
    textShadowRadius: 5,
  },
  description: {
    fontSize: 16,
    color: '#EEEEEE',
    marginBottom: 16,
    textShadowColor: 'rgba(0,0,0,0.75)',
    textShadowOffset: { width: -1, height: 1 },
    textShadowRadius: 3,
  },
  likeContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  likeButton: {
    borderRadius: 8,
    overflow: 'hidden',
  },
  likeButtonGradient: {
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 8,
  },
  likeButtonContent: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  likeCount: {
    color: '#FFFFFF',
    marginLeft: 8,
    fontSize: 16,
  }
});

export default DareDetailScreen;