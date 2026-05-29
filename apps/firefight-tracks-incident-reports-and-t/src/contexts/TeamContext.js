
import React, { createContext, useState, useContext, useEffect } from 'react';

const TeamContext = createContext();

export const useTeam = () => {
  const context = useContext(TeamContext);
  if (!context) {
    throw new Error('useTeam must be used within a TeamProvider');
  }
  return context;
};

export const TeamProvider = ({ children }) => {
  const [teamMembers, setTeamMembers] = useState([]);

  useEffect(() => {
    // Initialize with sample data
    const sampleTeamMembers = [
      {
        id: 'user1',
        name: 'John Doe',
        role: 'Captain',
        status: 'available',
        location: {
          latitude: 37.78825,
          longitude: -122.4324,
        },
        lastUpdate: new Date().toISOString(),
        contact: '555-0101',
      },
      {
        id: 'user2',
        name: 'Jane Smith',
        role: 'Lieutenant',
        status: 'on-duty',
        location: {
          latitude: 37.79,
          longitude: -122.43,
        },
        lastUpdate: new Date(Date.now() - 1800000).toISOString(),
        contact: '555-0102',
      },
      {
        id: 'user3',
        name: 'Mike Johnson',
        role: 'Firefighter',
        status: 'available',
        location: {
          latitude: 37.77,
          longitude: -122.44,
        },
        lastUpdate: new Date(Date.now() - 3600000).toISOString(),
        contact: '555-0103',
      },
      {
        id: 'user4',
        name: 'Sarah Williams',
        role: 'Paramedic',
        status: 'off-duty',
        location: {
          latitude: 37.785,
          longitude: -122.435,
        },
        lastUpdate: new Date(Date.now() - 7200000).toISOString(),
        contact: '555-0104',
      },
    ];
    setTeamMembers(sampleTeamMembers);
  }, []);

  const updateMemberStatus = (id, status) => {
    setTeamMembers((prev) =>
      prev.map((member) =>
        member.id === id
          ? { ...member, status, lastUpdate: new Date().toISOString() }
          : member
      )
    );
  };

  const updateMemberLocation = (id, location) => {
    setTeamMembers((prev) =>
      prev.map((member) =>
        member.id === id
          ? { ...member, location, lastUpdate: new Date().toISOString() }
          : member
      )
    );
  };

  const getAvailableMembers = () => {
    return teamMembers.filter((member) => member.status === 'available');
  };

  const getOnDutyMembers = () => {
    return teamMembers.filter(
      (member) => member.status === 'on-duty' || member.status === 'available'
    );
  };

  const getMemberById = (id) => {
    return teamMembers.find((member) => member.id === id);
  };

  const value = {
    teamMembers,
    updateMemberStatus,
    updateMemberLocation,
    getAvailableMembers,
    getOnDutyMembers,
    getMemberById,
  };

  return <TeamContext.Provider value={value}>{children}</TeamContext.Provider>;
};
