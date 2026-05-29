import React, { createContext, useState, useEffect, useMemo, useCallback, useContext } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

const FireFightContext = createContext();

const STORAGE_KEYS = {
  incidents: '@firefight_incidents',
  team: '@firefight_team',
  profile: '@firefight_profile'
};

const generateId = () => Date.now().toString(36) + Math.random().toString(36).slice(2);

const SEED_INCIDENTS = [
  {
    id: generateId(),
    title: "Structure: Metro Tower",
    description: "Multi-story office building with heavy smoke on floors 3-5. Multiple occupants reported trapped.",
    severity: "critical",
    status: "active",
    latitude: 34.0522,
    longitude: -118.2437,
    address: "1234 Main St, Los Angeles, CA 90012",
    reportedBy: "Dispatch Center",
    assignedTeam: ["team1", "team2", "team3"],
    createdAt: Date.now() - 3600000,
    updatedAt: Date.now() - 1800000,
    images: []
  },
  {
    id: generateId(),
    title: "Domestic: 10-70 Kitchen",
    description: "Single-family home with fire contained to kitchen area. No injuries reported.",
    severity: "medium",
    status: "active",
    latitude: 34.0489,
    longitude: -118.2518,
    address: "5678 Oak Ave, Los Angeles, CA 90013",
    reportedBy: "Homeowner",
    assignedTeam: ["team4"],
    createdAt: Date.now() - 7200000,
    updatedAt: Date.now() - 3600000,
    images: []
  },
  {
    id: generateId(),
    title: "Transit: I-10 Multi-Vehicle",
    description: "Sedan fully engulfed on I-10 eastbound. Traffic blocked in two lanes.",
    severity: "high",
    status: "active",
    latitude: 34.0407,
    longitude: -118.2468,
    address: "I-10 Eastbound Mile Marker 23",
    reportedBy: "CHP",
    assignedTeam: ["team5"],
    createdAt: Date.now() - 1800000,
    updatedAt: Date.now() - 900000,
    images: []
  },
  {
    id: generateId(),
    title: "Wildland: Griffith Perimeter",
    description: "Small vegetation fire spreading slowly. Approximately 2 acres affected.",
    severity: "medium",
    status: "resolved",
    latitude: 34.0584,
    longitude: -118.2391,
    address: "Griffith Park Entrance, Los Angeles, CA",
    reportedBy: "Park Ranger",
    assignedTeam: ["team2"],
    createdAt: Date.now() - 86400000,
    updatedAt: Date.now() - 82800000,
    images: []
  },
  {
    id: generateId(),
    title: "False Alarm - Smoke Detector",
    description: "Automatic alarm triggered by cooking smoke. No fire present.",
    severity: "low",
    status: "resolved",
    latitude: 34.0444,
    longitude: -118.2556,
    address: "9012 Elm St, Los Angeles, CA 90014",
    reportedBy: "Building Manager",
    assignedTeam: ["team6"],
    createdAt: Date.now() - 172800000,
    updatedAt: Date.now() - 169200000,
    images: []
  },
  {
    id: generateId(),
    title: "Warehouse Fire",
    description: "Industrial warehouse with electrical fire. Sprinkler system activated.",
    severity: "high",
    status: "active",
    latitude: 34.0361,
    longitude: -118.2397,
    address: "3456 Industrial Blvd, Los Angeles, CA 90021",
    reportedBy: "Security Guard",
    assignedTeam: ["team1", "team7"],
    createdAt: Date.now() - 5400000,
    updatedAt: Date.now() - 2700000,
    images: []
  },
  {
    id: generateId(),
    title: "Apartment Complex Fire",
    description: "Fire in third-floor unit. Building evacuated. Fire spreading to adjacent units.",
    severity: "critical",
    status: "active",
    latitude: 34.0555,
    longitude: -118.2602,
    address: "7890 Sunset Blvd, Los Angeles, CA 90046",
    reportedBy: "Resident",
    assignedTeam: ["team3", "team4", "team8"],
    createdAt: Date.now() - 2700000,
    updatedAt: Date.now() - 1200000,
    images: []
  },
  {
    id: generateId(),
    title: "Dumpster Fire",
    description: "Commercial dumpster fire behind restaurant. Contained, no spread to building.",
    severity: "low",
    status: "resolved",
    latitude: 34.0478,
    longitude: -118.2441,
    address: "2345 Broadway, Los Angeles, CA 90012",
    reportedBy: "Restaurant Owner",
    assignedTeam: ["team5"],
    createdAt: Date.now() - 259200000,
    updatedAt: Date.now() - 255600000,
    images: []
  }
];

const SEED_TEAM = [
  {
    id: "team1",
    name: "Captain Sarah Martinez",
    role: "Captain",
    status: "on-duty",
    latitude: 34.0522,
    longitude: -118.2437,
    lastUpdate: Date.now() - 300000,
    assignedIncident: SEED_INCIDENTS[0].id,
    contact: "+1-555-0101"
  },
  {
    id: "team2",
    name: "Lieutenant James Chen",
    role: "Lieutenant",
    status: "on-duty",
    latitude: 34.0489,
    longitude: -118.2518,
    lastUpdate: Date.now() - 600000,
    assignedIncident: SEED_INCIDENTS[0].id,
    contact: "+1-555-0102"
  },
  {
    id: "team3",
    name: "Engineer Marcus Johnson",
    role: "Engineer",
    status: "on-duty",
    latitude: 34.0555,
    longitude: -118.2602,
    lastUpdate: Date.now() - 180000,
    assignedIncident: SEED_INCIDENTS[6].id,
    contact: "+1-555-0103"
  },
  {
    id: "team4",
    name: "Firefighter Emily Rodriguez",
    role: "Firefighter",
    status: "on-duty",
    latitude: 34.0489,
    longitude: -118.2518,
    lastUpdate: Date.now() - 900000,
    assignedIncident: SEED_INCIDENTS[1].id,
    contact: "+1-555-0104"
  },
  {
    id: "team5",
    name: "Firefighter David Kim",
    role: "Firefighter",
    status: "on-duty",
    latitude: 34.0407,
    longitude: -118.2468,
    lastUpdate: Date.now() - 450000,
    assignedIncident: SEED_INCIDENTS[2].id,
    contact: "+1-555-0105"
  },
  {
    id: "team6",
    name: "Paramedic Lisa Thompson",
    role: "Paramedic",
    status: "available",
    latitude: 34.0444,
    longitude: -118.2556,
    lastUpdate: Date.now() - 1200000,
    assignedIncident: null,
    contact: "+1-555-0106"
  },
  {
    id: "team7",
    name: "Engineer Robert Davis",
    role: "Engineer",
    status: "on-duty",
    latitude: 34.0361,
    longitude: -118.2397,
    lastUpdate: Date.now() - 720000,
    assignedIncident: SEED_INCIDENTS[5].id,
    contact: "+1-555-0107"
  },
  {
    id: "team8",
    name: "Firefighter Amanda Wilson",
    role: "Firefighter",
    status: "on-duty",
    latitude: 34.0555,
    longitude: -118.2602,
    lastUpdate: Date.now() - 240000,
    assignedIncident: SEED_INCIDENTS[6].id,
    contact: "+1-555-0108"
  },
  {
    id: "team9",
    name: "Captain Michael Brown",
    role: "Captain",
    status: "available",
    latitude: 34.0522,
    longitude: -118.2437,
    lastUpdate: Date.now() - 3600000,
    assignedIncident: null,
    contact: "+1-555-0109"
  },
  {
    id: "team10",
    name: "Paramedic Jennifer Lee",
    role: "Paramedic",
    status: "off-duty",
    latitude: 34.0478,
    longitude: -118.2441,
    lastUpdate: Date.now() - 7200000,
    assignedIncident: null,
    contact: "+1-555-0110"
  }
];

const SEED_PROFILE = {
  id: generateId(),
  name: "John Anderson",
  role: "Fire Chief",
  badge: "FC-001",
  station: "Station 51",
  contact: "+1-555-0100"
};

export const FireFightProvider = ({ children }) => {
  const [incidents, setIncidents] = useState(SEED_INCIDENTS);
  const [teamMembers, setTeamMembers] = useState(SEED_TEAM);
  const [userProfile, setUserProfile] = useState(SEED_PROFILE);
  const [isLoading, setIsLoading] = useState(true);

  const theme = {
    backgroundColor: "#0a0a0a",
    textColor: "#f5f5f5",
    accentColor: "#FF3B30",
    cardColor: "#1a1a1a",
    secondaryAccent: "#ffa500",
    borderRadius: 12
  };

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      setIsLoading(true);
      const [incidentsData, teamData, profileData] = await Promise.all([
        AsyncStorage.getItem(STORAGE_KEYS.incidents),
        AsyncStorage.getItem(STORAGE_KEYS.team),
        AsyncStorage.getItem(STORAGE_KEYS.profile)
      ]);

      if (incidentsData) {
        const parsed = JSON.parse(incidentsData);
        setIncidents(Array.isArray(parsed) ? parsed : SEED_INCIDENTS);
      }

      if (teamData) {
        const parsed = JSON.parse(teamData);
        setTeamMembers(Array.isArray(parsed) ? parsed : SEED_TEAM);
      }

      if (profileData) {
        const parsed = JSON.parse(profileData);
        setUserProfile(parsed || SEED_PROFILE);
      }
    } catch (error) {
      console.error("Error loading data from AsyncStorage:", error);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (!isLoading) {
      saveIncidents();
    }
  }, [incidents, isLoading]);

  useEffect(() => {
    if (!isLoading) {
      saveTeamMembers();
    }
  }, [teamMembers, isLoading]);

  useEffect(() => {
    if (!isLoading) {
      saveProfile();
    }
  }, [userProfile, isLoading]);

  const saveIncidents = async () => {
    try {
      await AsyncStorage.setItem(STORAGE_KEYS.incidents, JSON.stringify(incidents));
    } catch (error) {
      console.error("Error saving incidents:", error);
    }
  };

  const saveTeamMembers = async () => {
    try {
      await AsyncStorage.setItem(STORAGE_KEYS.team, JSON.stringify(teamMembers));
    } catch (error) {
      console.error("Error saving team members:", error);
    }
  };

  const saveProfile = async () => {
    try {
      await AsyncStorage.setItem(STORAGE_KEYS.profile, JSON.stringify(userProfile));
    } catch (error) {
      console.error("Error saving profile:", error);
    }
  };

  const addIncident = useCallback((incidentData) => {
    const newIncident = {
      id: generateId(),
      title: incidentData.title || "Untitled Incident",
      description: incidentData.description || "",
      severity: incidentData.severity || "low",
      status: incidentData.status || "active",
      latitude: incidentData.latitude || 0,
      longitude: incidentData.longitude || 0,
      address: incidentData.address || "",
      reportedBy: incidentData.reportedBy || userProfile?.name || "Unknown",
      assignedTeam: incidentData.assignedTeam || [],
      createdAt: Date.now(),
      updatedAt: Date.now(),
      images: incidentData.images || []
    };

    setIncidents(prev => [newIncident, ...(prev || [])]);
    return newIncident;
  }, [userProfile]);

  const updateIncident = useCallback((incidentId, updates) => {
    setIncidents(prev => (prev || []).map(incident => {
      if (incident?.id === incidentId) {
        return {
          ...incident,
          ...updates,
          updatedAt: Date.now()
        };
      }
      return incident;
    }));
  }, []);

  const deleteIncident = useCallback((incidentId) => {
    setIncidents(prev => (prev || []).filter(incident => incident?.id !== incidentId));
    setTeamMembers(prev => (prev || []).map(member => {
      if (member?.assignedIncident === incidentId) {
        return {
          ...member,
          assignedIncident: null,
          status: "available",
          lastUpdate: Date.now()
        };
      }
      return member;
    }));
  }, []);

  const addTeamMember = useCallback((memberData) => {
    const newMember = {
      id: generateId(),
      name: memberData.name || "Unknown",
      role: memberData.role || "Firefighter",
      status: memberData.status || "available",
      latitude: memberData.latitude || 0,
      longitude: memberData.longitude || 0,
      lastUpdate: Date.now(),
      assignedIncident: memberData.assignedIncident || null,
      contact: memberData.contact || ""
    };

    setTeamMembers(prev => [...(prev || []), newMember]);
    return newMember;
  }, []);

  const updateTeamStatus = useCallback((memberId, status, location = null) => {
    setTeamMembers(prev => (prev || []).map(member => {
      if (member?.id === memberId) {
        const updates = {
          status,
          lastUpdate: Date.now()
        };
        
        if (location) {
          updates.latitude = location.latitude;
          updates.longitude = location.longitude;
        }

        if (status === "available" || status === "off-duty") {
          updates.assignedIncident = null;
        }

        return { ...member, ...updates };
      }
      return member;
    }));
  }, []);

  const assignTeam = useCallback((incidentId, teamMemberIds) => {
    setIncidents(prev => (prev || []).map(incident => {
      if (incident?.id === incidentId) {
        return {
          ...incident,
          assignedTeam: Array.isArray(teamMemberIds) ? teamMemberIds : [],
          updatedAt: Date.now()
        };
      }
      return incident;
    }));

    setTeamMembers(prev => (prev || []).map(member => {
      if (Array.isArray(teamMemberIds) && teamMemberIds.includes(member?.id)) {
        return {
          ...member,
          assignedIncident: incidentId,
          status: "on-duty",
          lastUpdate: Date.now()
        };
      }
      return member;
    }));
  }, []);

  const updateProfile = useCallback((profileData) => {
    setUserProfile(prev => ({
      ...prev,
      ...profileData
    }));
  }, []);

  const activeIncidents = useMemo(() => {
    return (incidents || []).filter(incident => incident?.status === "active");
  }, [incidents]);

  const resolvedIncidents = useMemo(() => {
    return (incidents || []).filter(incident => incident?.status === "resolved");
  }, [incidents]);

  const availableTeam = useMemo(() => {
    return (teamMembers || []).filter(member => member?.status === "available");
  }, [teamMembers]);

  const onDutyTeam = useMemo(() => {
    return (teamMembers || []).filter(member => member?.status === "on-duty");
  }, [teamMembers]);

  const criticalIncidents = useMemo(() => {
    return (incidents || []).filter(incident => 
      incident?.severity === "critical" && incident?.status === "active"
    );
  }, [incidents]);

  const incidentStats = useMemo(() => {
    const total = (incidents || []).length;
    const active = activeIncidents.length;
    const resolved = resolvedIncidents.length;
    const critical = criticalIncidents.length;
    
    const severityCounts = (incidents || []).reduce((acc, incident) => {
      const severity = incident?.severity || "low";
      acc[severity] = (acc[severity] || 0) + 1;
      return acc;
    }, {});

    const statusCounts = (incidents || []).reduce((acc, incident) => {
      const status = incident?.status || "active";
      acc[status] = (acc[status] || 0) + 1;
      return acc;
    }, {});

    return {
      total,
      active,
      resolved,
      critical,
      severityCounts,
      statusCounts
    };
  }, [incidents, activeIncidents, resolvedIncidents, criticalIncidents]);

  const teamStats = useMemo(() => {
    const total = (teamMembers || []).length;
    const available = availableTeam.length;
    const onDuty = onDutyTeam.length;
    const offDuty = (teamMembers || []).filter(member => member?.status === "off-duty").length;

    const roleCounts = (teamMembers || []).reduce((acc, member) => {
      const role = member?.role || "Firefighter";
      acc[role] = (acc[role] || 0) + 1;
      return acc;
    }, {});

    const statusCounts = (teamMembers || []).reduce((acc, member) => {
      const status = member?.status || "available";
      acc[status] = (acc[status] || 0) + 1;
      return acc;
    }, {});

    return {
      total,
      available,
      onDuty,
      offDuty,
      roleCounts,
      statusCounts
    };
  }, [teamMembers, availableTeam, onDutyTeam]);

  const contextValue = {
    incidents,
    teamMembers,
    userProfile,
    theme,
    addIncident,
    updateIncident,
    deleteIncident,
    addTeamMember,
    updateTeamStatus,
    assignTeam,
    updateProfile,
    activeIncidents,
    resolvedIncidents,
    availableTeam,
    onDutyTeam,
    criticalIncidents,
    incidentStats,
    teamStats,
    isLoading
  };

  return (
    <FireFightContext.Provider value={contextValue}>
      {children}
    </FireFightContext.Provider>
  );
};

export const useFireFight = () => {
  const context = useContext(FireFightContext);
  if (!context) {
    throw new Error("useFireFight must be used within a FireFightProvider");
  }
  return context;
};

export default FireFightContext;
