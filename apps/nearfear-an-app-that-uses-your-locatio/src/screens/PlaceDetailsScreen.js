import React, { useState, useEffect } from 'react';
import {
  StyleSheet,
  Text,
  View,
  ScrollView,
  TextInput,
  TouchableOpacity,
  Alert,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons, MaterialIcons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { formatDistanceToNow } from 'date-fns';

import { useAppData } from '../context/AppContext';

const generateId = () => {
  return Date.now().toString(36) + Math.random().toString(36).slice(2);
};

export default function PlaceDetailsScreen({ route }) {
  const { id } = route?.params ?? {};
  const { places, updatePlace, theme } = useAppData();
  const place = places?.find((p) => p.id === id);

  const [reviewText, setReviewText] = useState('');
  const [rating, setRating] = useState(0);

  useEffect(() => {
    if (!id) {
      console.warn('No place ID provided to PlaceDetailsScreen');
    }
  }, [id]);

  if (!place) {
    return (
      <View style={[styles.container, { backgroundColor: theme?.backgroundColor }]}>
        <Text style={[styles.errorText, { color: theme?.textColor }]}>
          Place not found.
        </Text>
      </View>
    );
  }

  const handleReviewSubmit = async () => {
    if (!reviewText.trim() || rating === 0) {
      Alert.alert('Error', 'Please enter a review and select a rating.');
      return;
    }

    const newReview = {
      id: generateId(),
      text: reviewText,
      rating: rating,
      date: new Date().toISOString(),
    };

    const updatedPlace = {
      ...place,
      reviews: [...(place.reviews || []), newReview],
    };

    updatePlace(updatedPlace);
    setReviewText('');
    setRating(0);
  };

  const renderStars = (selectedRating) => {
    const stars = [];
    for (let i = 1; i <= 5; i++) {
      stars.push(
        <TouchableOpacity
          key={i}
          onPress={() => setRating(i)}
          testID={`star-${i}-button`}
          accessibilityLabel={`Rate ${i} stars`}
        >
          <Ionicons
            name={i <= selectedRating ? 'star' : 'star-outline'}
            size={32}
            color={theme?.accentColor}
          />
        </TouchableOpacity>
      );
    }
    return stars;
  };

  return (
    <ScrollView style={[styles.container, { backgroundColor: theme?.backgroundColor }]}>
      <LinearGradient
        colors={[theme?.secondaryAccent || '#6a1b9a', theme?.accentColor || '#FF4500']}
        style={styles.gradientHeader}
      >
        <Text style={styles.placeName} testID="place-details-name">{place.name}</Text>
      </LinearGradient>

      <View style={styles.detailsContainer}>
        <View style={styles.detailItem} testID="place-details-fear-rating">
          <Ionicons name="ios-skull" size={24} color={theme?.accentColor} />
          <Text style={[styles.detailText, { color: theme?.textColor }]}>
            Fear Rating: {place.fearRating} / 5
          </Text>
        </View>

        <View style={styles.detailItem} testID="place-details-fear-tags">
          <Ionicons name="ios-pricetags" size={24} color={theme?.accentColor} />
          <Text style={[styles.detailText, { color: theme?.textColor }]}>
            Tags: {(place.fearTags || []).join(', ')}
          </Text>
        </View>
      </View>

      <View style={styles.reviewsContainer}>
        <Text style={[styles.sectionTitle, { color: theme?.textColor }]} testID="review-display-title">
          Reviews
        </Text>

        {(place.reviews || []).length === 0 ? (
          <View style={styles.emptyState}>
            <Ionicons name="ios-chatbubble-outline" size={48} color={theme?.textColor} />
            <Text style={[styles.emptyStateText, { color: theme?.textColor }]}>
              No reviews yet. Be the first to review!
            </Text>
          </View>
        ) : (
          (place.reviews || []).map((review) => {
            const reviewDate = new Date(review.date);
            const safeReviewDate = isNaN(reviewDate.getTime()) ? new Date() : reviewDate;

            return (
              <View style={styles.reviewCard} key={review.id} testID="review-display-item">
                <View style={styles.reviewHeader}>
                  <View style={styles.starRating}>
                    {Array.from({ length: review.rating }, (_, i) => (
                      <Ionicons
                        key={i}
                        name="star"
                        size={16}
                        color={theme?.accentColor}
                      />
                    ))}
                    {Array.from({ length: 5 - review.rating }, (_, i) => (
                      <Ionicons
                        key={i + review.rating}
                        name="star-outline"
                        size={16}
                        color={theme?.accentColor}
                      />
                    ))}
                  </View>
                  <Text style={[styles.reviewDate, { color: theme?.textColor }]}>
                    {formatDistanceToNow(safeReviewDate, { addSuffix: true })}
                  </Text>
                </View>
                <Text style={[styles.reviewText, { color: theme?.textColor }]}>{review.text}</Text>
              </View>
            );
          })
        )}
      </View>

      <View style={styles.submissionContainer} testID="review-submission-container">
        <Text style={[styles.sectionTitle, { color: theme?.textColor }]}>
          Submit a Review
        </Text>

        <View style={styles.starRatingContainer} testID="review-submission-rating">
          {renderStars(rating)}
        </View>

        <TextInput
          style={[styles.reviewInput, { backgroundColor: theme?.cardColor, color: theme?.textColor }]}
          placeholder="Describe the atmosphere..."
          placeholderTextColor={theme?.textColor}
          multiline
          value={reviewText}
          onChangeText={setReviewText}
          testID="review-submission-input"
          accessibilityLabel="Review Text"
        />

        <TouchableOpacity
          style={[styles.submitButton, { backgroundColor: theme?.accentColor }]}
          onPress={handleReviewSubmit}
          testID="review-submission-button"
          accessibilityLabel="Leave your mark"
        >
          <Text style={styles.submitButtonText}>Submit Review</Text>
        </TouchableOpacity>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  gradientHeader: {
    padding: 20,
    alignItems: 'center',
  },
  placeName: {
    fontSize: 24,
    fontWeight: 'bold',
    color: 'white',
    marginBottom: 8,
  },
  detailsContainer: {
    padding: 16,
  },
  detailItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  detailText: {
    fontSize: 16,
    marginLeft: 8,
  },
  reviewsContainer: {
    padding: 16,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    marginBottom: 16,
  },
  reviewCard: {
    backgroundColor: '#212121',
    borderRadius: 8,
    padding: 16,
    marginBottom: 12,
  },
  reviewHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  starRating: {
    flexDirection: 'row',
  },
  reviewDate: {
    fontSize: 12,
    color: '#bdbdbd',
  },
  reviewText: {
    fontSize: 16,
  },
  submissionContainer: {
    padding: 16,
  },
  starRatingContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    marginBottom: 16,
  },
  reviewInput: {
    borderWidth: 1,
    borderColor: '#424242',
    borderRadius: 8,
    padding: 12,
    marginBottom: 16,
    fontSize: 16,
    minHeight: 100,
    textAlignVertical: 'top',
  },
  submitButton: {
    borderRadius: 8,
    padding: 12,
    alignItems: 'center',
  },
  submitButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: 'bold',
  },
  emptyState: {
    alignItems: 'center',
    padding: 20,
  },
  emptyStateText: {
    fontSize: 16,
    marginTop: 8,
    textAlign: 'center',
  },
  errorText: {
    fontSize: 18,
    fontWeight: 'bold',
    textAlign: 'center',
    marginTop: 20,
  },
});
