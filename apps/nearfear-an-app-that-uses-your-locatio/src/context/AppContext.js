import React, { createContext, useState, useEffect, useMemo, useCallback } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

const AppContext = createContext();

const generateId = () => {
  return Date.now().toString(36) + Math.random().toString(36).slice(2);
};

const initialPlaces = [
  {
    id: generateId(),
    name: "The Whispering Victorian",
    latitude: 34.0522,
    longitude: -118.2437,
    fearRating: 4.5,
    fearTags: ["haunted", "ghosts", "creepy"],
    reviews: [{id:'r1',text:"Scariest place I've ever been!",rating:5,date:'2025-10-31T00:00:00Z'},{id:'r2',text:"Definitely not for the faint of heart.",rating:4,date:'2025-11-01T00:00:00Z'}],
  },
  {
    id: generateId(),
    name: "Blackwood Sanitarium Ward",
    latitude: 37.7749,
    longitude: -122.4194,
    fearRating: 4.0,
    fearTags: ["abandoned", "asylum", "spooky"],
    reviews: [{id:'r3',text:"Very eerie atmosphere.",rating:4,date:'2025-09-15T00:00:00Z'},{id:'r4',text:"Heard strange noises.",rating:3,date:'2025-09-20T00:00:00Z'}],
  },
  {
    id: generateId(),
    name: "Dark Forest Trail",
    latitude: 40.7128,
    longitude: -74.0060,
    fearRating: 3.5,
    fearTags: ["forest", "dark", "isolated"],
    reviews: [{id:'r5',text:"Got lost and felt like I was being watched.",rating:3,date:'2025-08-10T00:00:00Z'},{id:'r6',text:"Beautiful but unsettling.",rating:3,date:'2025-08-15T00:00:00Z'}],
  },
  {
    id: generateId(),
    name: "The Grinning Marionette Inn",
    latitude: 36.4606,
    longitude: -116.8256,
    fearRating: 5,
    fearTags: ["clowns", "motel", "nightmares"],
    reviews: [{id:'r7',text:"I couldn't sleep all night.",rating:5,date:'2025-07-04T00:00:00Z'},{id:'r8',text:"The clown statues are terrifying.",rating:5,date:'2025-07-10T00:00:00Z'}],
  },
  {
    id: generateId(),
    name: "Old Cemetery",
    latitude: 41.8781,
    longitude: -87.6298,
    fearRating: 3.0,
    fearTags: ["cemetery", "graveyard", "historical"],
    reviews: [{id:'r9',text:"Respectful but spooky.",rating:3,date:'2025-06-01T00:00:00Z'},{id:'r10',text:"Felt a presence.",rating:2,date:'2025-06-05T00:00:00Z'}],
  },
  {
    id: generateId(),
    name: "The Devil's Bridge",
    latitude: 32.7157,
    longitude: -117.1611,
    fearRating: 4.2,
    fearTags: ["bridge", "urban legend", "scary"],
    reviews: [{id:'r11',text:"Locals told me some scary stories about this place.",rating:4,date:'2025-05-20T00:00:00Z'},{id:'r12',text:"Don't go alone.",rating:4,date:'2025-05-25T00:00:00Z'}],
  },
];

const initialChallenges = [
  {
    id: generateId(),
    name: "Haunted House Challenge",
    description: "Spend 30 minutes in the Haunted House on Elm Street.",
    placeId: initialPlaces[0]?.id,
    participants: ["user1", "user2"],
  },
  {
    id: generateId(),
    name: "Asylum Exploration",
    description: "Explore the Abandoned Asylum at night.",
    placeId: initialPlaces[1]?.id,
    participants: ["user3"],
  },
];

const theme = {
  backgroundColor: "#121212",
  cardColor: "#212121",
  textColor: "#FFFFFF",
  accentColor: "#E63946",
  secondaryAccent: "#1D1D1F",
  borderRadius: 8,
};

export const AppProvider = ({ children }) => {
  const [places, setPlaces] = useState(initialPlaces);
  const [challenges, setChallenges] = useState(initialChallenges);

  useEffect(() => {
    const loadData = async () => {
      try {
        const storedPlaces = await AsyncStorage.getItem('@nearfear_places');
        const storedChallenges = await AsyncStorage.getItem('@nearfear_challenges');

        if (storedPlaces) {
          const parsed = JSON.parse(storedPlaces);
          if (Array.isArray(parsed) && parsed.length > 0 && parsed[0].reviews) {
            const firstReview = parsed[0].reviews[0];
            if (typeof firstReview === 'string') {
              await AsyncStorage.removeItem('@nearfear_places');
            } else {
              setPlaces(parsed);
            }
          }
        }
        if (storedChallenges) {
          setChallenges(JSON.parse(storedChallenges));
        }
      } catch (e) {
        console.error("Error loading data from AsyncStorage:", e);
      }
    };

    loadData();
  }, []);

  useEffect(() => {
    const saveData = async () => {
      try {
        await AsyncStorage.setItem('@nearfear_places', JSON.stringify(places));
        await AsyncStorage.setItem('@nearfear_challenges', JSON.stringify(challenges));
      } catch (e) {
        console.error("Error saving data to AsyncStorage:", e);
      }
    };

    saveData();
  }, [places, challenges]);

  const addPlace = useCallback((newPlace) => {
    const id = generateId();
    const placeWithId = { ...newPlace, id };
    setPlaces((prevPlaces) => [...prevPlaces, placeWithId]);
  }, []);

  const deletePlace = useCallback((id) => {
    setPlaces((prevPlaces) => prevPlaces.filter((place) => place.id !== id));
  }, []);

  const updatePlace = useCallback((updatedPlace) => {
    setPlaces((prevPlaces) =>
      prevPlaces.map((place) => (place.id === updatedPlace.id ? updatedPlace : place))
    );
  }, []);

  const addChallenge = useCallback((newChallenge) => {
    const id = generateId();
    const challengeWithId = { ...newChallenge, id };
    setChallenges((prevChallenges) => [...prevChallenges, challengeWithId]);
  }, []);

  const deleteChallenge = useCallback((id) => {
    setChallenges((prevChallenges) => prevChallenges.filter((challenge) => challenge.id !== id));
  }, []);

  const updateChallenge = useCallback((updatedChallenge) => {
    setChallenges((prevChallenges) =>
      prevChallenges.map((challenge) => (challenge.id === updatedChallenge.id ? updatedChallenge : challenge))
    );
  }, []);

  const filteredPlaces = useMemo(() => {
    return places; // Implement filtering logic here if needed
  }, [places]);

  const averageFearRating = useMemo(() => {
    if (!places || places.length === 0) {
      return 0;
    }
    const totalRating = places.reduce((sum, place) => sum + (place?.fearRating || 0), 0);
    return totalRating / places.length;
  }, [places]);

  const value = useMemo(
    () => ({
      places,
      challenges,
      addPlace,
      deletePlace,
      updatePlace,
      addChallenge,
      deleteChallenge,
      updateChallenge,
      filteredPlaces,
      averageFearRating,
      theme,
    }),
    [
      places,
      challenges,
      addPlace,
      deletePlace,
      updatePlace,
      addChallenge,
      deleteChallenge,
      updateChallenge,
      filteredPlaces,
      averageFearRating,
      theme,
    ]
  );

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
};

export const useAppData = () => React.useContext(AppContext);
