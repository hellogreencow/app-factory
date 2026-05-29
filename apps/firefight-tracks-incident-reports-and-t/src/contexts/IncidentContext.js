
import React, { createContext, useState, useContext, useEffect } from 'react';

const IncidentContext = createContext();

export const useIncident = () => {
  const context = useContext(IncidentContext);
  if (!context) {
    throw new Error('useIncident must be used within an IncidentProvider');
  }
  return context;
};

export const IncidentProvider = ({ children }) => {
  const [incidents, setIncidents] = useState([]);

  useEffect(() => {
    // Initialize with sample data
    const sampleIncidents = [
      {
        id: '1',
        title: 'Structure Fire',
        description: 'Residential building fire on Main Street',
        severity: 'critical',
        status: 'active',
        location: {
          latitude: 37.78825,
          longitude: -122.4324,
          address: '123 Main St',
        },
        reportedBy: 'John Doe',
        reportedAt: new Date().toISOString(),
        assignedTeam: ['user1', 'user2'],
      },
      {
        id: '2',
        title: 'Medical Emergency',
        description: 'Cardiac arrest reported',
        severity: 'high',
        status: 'active',
        location: {
          latitude: 37.79,
          longitude: -122.43,
          address: '456 Oak Ave',
        },
        reportedBy: 'Jane Smith',
        reportedAt: new Date(Date.now() - 3600000).toISOString(),
        assignedTeam: ['user3'],
      },
      {
        id: '3',
        title: 'Vehicle Accident',
        description: 'Multi-car collision on Highway 101',
        severity: 'medium',
        status: 'resolved',
        location: {
          latitude: 37.77,
          longitude: -122.44,
          address: 'Highway 101',
        },
        reportedBy: 'Mike Johnson',
        reportedAt: new Date(Date.now() - 7200000).toISOString(),
        assignedTeam: ['user1', 'user4'],
      },
    ];
    setIncidents(sampleIncidents);
  }, []);

  const addIncident = (incident) => {
    const newIncident = {
      ...incident,
      id: Date.now().toString(),
      reportedAt: new Date().toISOString(),
      status: 'active',
    };
    setIncidents((prev) => [newIncident, ...prev]);
    return newIncident;
  };

  const updateIncident = (id, updates) => {
    setIncidents((prev) =>
      prev.map((incident) =>
        incident.id === id ? { ...incident, ...updates } : incident
      )
    );
  };

  const deleteIncident = (id) => {
    setIncidents((prev) => prev.filter((incident) => incident.id !== id));
  };

  const getIncidentById = (id) => {
    return incidents.find((incident) => incident.id === id);
  };

  const getActiveIncidents = () => {
    return incidents.filter((incident) => incident.status === 'active');
  };

  const getIncidentsBySeverity = (severity) => {
    return incidents.filter((incident) => incident.severity === severity);
  };

  const value = {
    incidents,
    addIncident,
    updateIncident,
    deleteIncident,
    getIncidentById,
    getActiveIncidents,
    getIncidentsBySeverity,
  };

  return (
    <IncidentContext.Provider value={value}>
      {children}
    </IncidentContext.Provider>
  );
};
