import React, { createContext, useState, useEffect, useMemo, useCallback, useContext } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

const AppContext = createContext();

const STORAGE_KEYS = {
  GROUPS: '@settlesnap_groups',
  EXPENSES: '@settlesnap_expenses',
  SETTLEMENTS: '@settlesnap_settlements',
  MEMBERS: '@settlesnap_members',
};

const generateId = () => Date.now().toString(36) + Math.random().toString(36).slice(2);

const INITIAL_MEMBERS = [
  {
    id: 'm1',
    name: 'Alex Johnson',
    email: 'alex@example.com',
    avatar: '👨‍💼',
  },
  {
    id: 'm2',
    name: 'Sarah Chen',
    email: 'sarah@example.com',
    avatar: '👩‍💻',
  },
  {
    id: 'm3',
    name: 'Mike Rodriguez',
    email: 'mike@example.com',
    avatar: '👨‍🎨',
  },
  {
    id: 'm4',
    name: 'Emma Wilson',
    email: 'emma@example.com',
    avatar: '👩‍🔬',
  },
  {
    id: 'm5',
    name: 'James Lee',
    email: 'james@example.com',
    avatar: '👨‍🍳',
  },
  {
    id: 'm6',
    name: 'Lisa Brown',
    email: 'lisa@example.com',
    avatar: '👩‍🎤',
  },
];

const INITIAL_GROUPS = [
  {
    id: 'g1',
    name: 'Upstate Cabin Weekend',
    members: ['m1', 'm2', 'm3'],
    createdAt: Date.now() - 7 * 24 * 60 * 60 * 1000,
    color: '#FF6B6B',
  },
  {
    id: 'g2',
    name: 'The Loft 4B',
    members: ['m1', 'm4', 'm5'],
    createdAt: Date.now() - 30 * 24 * 60 * 60 * 1000,
    color: '#4ECDC4',
  },
  {
    id: 'g3',
    name: 'Office Lunch Club',
    members: ['m2', 'm3', 'm4', 'm6'],
    createdAt: Date.now() - 14 * 24 * 60 * 60 * 1000,
    color: '#95E1D3',
  },
  {
    id: 'g4',
    name: 'Concert Squad',
    members: ['m1', 'm2', 'm5', 'm6'],
    createdAt: Date.now() - 3 * 24 * 60 * 60 * 1000,
    color: '#F38181',
  },
  {
    id: 'g5',
    name: 'Gym Buddies',
    members: ['m3', 'm4'],
    createdAt: Date.now() - 60 * 24 * 60 * 60 * 1000,
    color: '#AA96DA',
  },
];

const INITIAL_EXPENSES = [
  {
    id: 'e1',
    groupId: 'g1',
    description: 'The A-Frame Rental',
    amount: 450.00,
    paidBy: 'm1',
    splitWith: ['m1', 'm2', 'm3'],
    splitType: 'equal',
    createdAt: Date.now() - 6 * 24 * 60 * 60 * 1000,
    imageUri: null,
    category: 'Accommodation',
  },
  {
    id: 'e2',
    groupId: 'g1',
    description: 'Gas & Tolls',
    amount: 85.50,
    paidBy: 'm2',
    splitWith: ['m1', 'm2', 'm3'],
    splitType: 'equal',
    createdAt: Date.now() - 5 * 24 * 60 * 60 * 1000,
    imageUri: null,
    category: 'Transportation',
  },
  {
    id: 'e3',
    groupId: 'g2',
    description: 'Electricity Bill',
    amount: 120.00,
    paidBy: 'm4',
    splitWith: ['m1', 'm4', 'm5'],
    splitType: 'equal',
    createdAt: Date.now() - 10 * 24 * 60 * 60 * 1000,
    imageUri: null,
    category: 'Utilities',
  },
  {
    id: 'e4',
    groupId: 'g3',
    description: 'Spontaneous Pizza Night',
    amount: 68.00,
    paidBy: 'm3',
    splitWith: ['m2', 'm3', 'm4', 'm6'],
    splitType: 'equal',
    createdAt: Date.now() - 2 * 24 * 60 * 60 * 1000,
    imageUri: null,
    category: 'Food',
  },
  {
    id: 'e5',
    groupId: 'g4',
    description: 'Concert Tickets',
    amount: 320.00,
    paidBy: 'm1',
    splitWith: ['m1', 'm2', 'm5', 'm6'],
    splitType: 'equal',
    createdAt: Date.now() - 1 * 24 * 60 * 60 * 1000,
    imageUri: null,
    category: 'Entertainment',
  },
  {
    id: 'e6',
    groupId: 'g2',
    description: 'Grocery Shopping',
    amount: 156.75,
    paidBy: 'm1',
    splitWith: ['m1', 'm4', 'm5'],
    splitType: 'equal',
    createdAt: Date.now() - 4 * 24 * 60 * 60 * 1000,
    imageUri: null,
    category: 'Groceries',
  },
  {
    id: 'e7',
    groupId: 'g5',
    description: 'Gym Membership',
    amount: 90.00,
    paidBy: 'm3',
    splitWith: ['m3', 'm4'],
    splitType: 'equal',
    createdAt: Date.now() - 20 * 24 * 60 * 60 * 1000,
    imageUri: null,
    category: 'Health',
  },
  {
    id: 'e8',
    groupId: 'g1',
    description: 'Restaurant Dinner',
    amount: 145.00,
    paidBy: 'm3',
    splitWith: ['m1', 'm2', 'm3'],
    splitType: 'equal',
    createdAt: Date.now() - 5 * 24 * 60 * 60 * 1000,
    imageUri: null,
    category: 'Food',
  },
];

const INITIAL_SETTLEMENTS = [
  {
    id: 's1',
    groupId: 'g2',
    from: 'm5',
    to: 'm1',
    amount: 50.00,
    settledAt: Date.now() - 15 * 24 * 60 * 60 * 1000,
    status: 'completed',
  },
  {
    id: 's2',
    groupId: 'g3',
    from: 'm6',
    to: 'm3',
    amount: 25.00,
    settledAt: Date.now() - 8 * 24 * 60 * 60 * 1000,
    status: 'completed',
  },
  {
    id: 's3',
    groupId: 'g1',
    from: 'm2',
    to: 'm1',
    amount: 100.00,
    settledAt: Date.now() - 3 * 24 * 60 * 60 * 1000,
    status: 'completed',
  },
];

export const AppProvider = ({ children }) => {
  const [groups, setGroups] = useState(INITIAL_GROUPS);
  const [expenses, setExpenses] = useState(INITIAL_EXPENSES);
  const [settlements, setSettlements] = useState(INITIAL_SETTLEMENTS);
  const [members, setMembers] = useState(INITIAL_MEMBERS);
  const [isLoaded, setIsLoaded] = useState(false);

  const theme = {
    backgroundColor: '#FBFBFA',
    textColor: '#1A1A1A',
    accentColor: '#2D3748',
    cardColor: '#FFFFFF',
    secondaryAccent: '#4A5568',
    borderRadius: 12,
  };

  useEffect(() => {
    loadData();
  }, []);

  useEffect(() => {
    if (isLoaded) {
      saveData();
    }
  }, [groups, expenses, settlements, members, isLoaded]);

  const loadData = async () => {
    try {
      const [groupsData, expensesData, settlementsData, membersData] = await Promise.all([
        AsyncStorage.getItem(STORAGE_KEYS.GROUPS),
        AsyncStorage.getItem(STORAGE_KEYS.EXPENSES),
        AsyncStorage.getItem(STORAGE_KEYS.SETTLEMENTS),
        AsyncStorage.getItem(STORAGE_KEYS.MEMBERS),
      ]);

      if (groupsData) setGroups(JSON.parse(groupsData));
      if (expensesData) setExpenses(JSON.parse(expensesData));
      if (settlementsData) setSettlements(JSON.parse(settlementsData));
      if (membersData) setMembers(JSON.parse(membersData));

      setIsLoaded(true);
    } catch (error) {
      console.error('Error loading data:', error);
      setIsLoaded(true);
    }
  };

  const saveData = async () => {
    try {
      await Promise.all([
        AsyncStorage.setItem(STORAGE_KEYS.GROUPS, JSON.stringify(groups)),
        AsyncStorage.setItem(STORAGE_KEYS.EXPENSES, JSON.stringify(expenses)),
        AsyncStorage.setItem(STORAGE_KEYS.SETTLEMENTS, JSON.stringify(settlements)),
        AsyncStorage.setItem(STORAGE_KEYS.MEMBERS, JSON.stringify(members)),
      ]);
    } catch (error) {
      console.error('Error saving data:', error);
    }
  };

  const addGroup = useCallback((groupData) => {
    const newGroup = {
      id: generateId(),
      name: groupData.name || 'New Group',
      members: groupData.members || [],
      createdAt: Date.now(),
      color: groupData.color || '#4ECDC4',
    };
    setGroups(prev => [...prev, newGroup]);
    return newGroup;
  }, []);

  const deleteGroup = useCallback((groupId) => {
    setGroups(prev => prev.filter(g => g.id !== groupId));
    setExpenses(prev => prev.filter(e => e.groupId !== groupId));
    setSettlements(prev => prev.filter(s => s.groupId !== groupId));
  }, []);

  const addExpense = useCallback((expenseData) => {
    const newExpense = {
      id: generateId(),
      groupId: expenseData.groupId,
      description: expenseData.description || 'Expense',
      amount: parseFloat(expenseData.amount) || 0,
      paidBy: expenseData.paidBy,
      splitWith: expenseData.splitWith || [],
      splitType: expenseData.splitType || 'equal',
      createdAt: Date.now(),
      imageUri: expenseData.imageUri || null,
      category: expenseData.category || 'Other',
    };
    setExpenses(prev => [...prev, newExpense]);
    return newExpense;
  }, []);

  const updateExpense = useCallback((expenseId, updates) => {
    setExpenses(prev => prev.map(e => 
      e.id === expenseId ? { ...e, ...updates } : e
    ));
  }, []);

  const deleteExpense = useCallback((expenseId) => {
    setExpenses(prev => prev.filter(e => e.id !== expenseId));
  }, []);

  const addSettlement = useCallback((settlementData) => {
    const newSettlement = {
      id: generateId(),
      groupId: settlementData.groupId,
      from: settlementData.from,
      to: settlementData.to,
      amount: parseFloat(settlementData.amount) || 0,
      settledAt: Date.now(),
      status: settlementData.status || 'completed',
    };
    setSettlements(prev => [...prev, newSettlement]);
    return newSettlement;
  }, []);

  const addMember = useCallback((memberData) => {
    const newMember = {
      id: generateId(),
      name: memberData.name || 'New Member',
      email: memberData.email || '',
      avatar: memberData.avatar || '👤',
    };
    setMembers(prev => [...prev, newMember]);
    return newMember;
  }, []);

  const updateMember = useCallback((memberId, updates) => {
    setMembers(prev => prev.map(m => 
      m.id === memberId ? { ...m, ...updates } : m
    ));
  }, []);

  const groupBalances = useMemo(() => {
    const balances = {};

    groups.forEach(group => {
      const groupExpenses = expenses.filter(e => e.groupId === group.id);
      const groupSettlements = settlements.filter(s => s.groupId === group.id && s.status === 'completed');
      
      const memberBalances = {};
      group.members.forEach(memberId => {
        memberBalances[memberId] = 0;
      });

      groupExpenses.forEach(expense => {
        const splitCount = expense.splitWith?.length || 1;
        const shareAmount = expense.amount / splitCount;

        memberBalances[expense.paidBy] = (memberBalances[expense.paidBy] || 0) + expense.amount;

        expense.splitWith?.forEach(memberId => {
          memberBalances[memberId] = (memberBalances[memberId] || 0) - shareAmount;
        });
      });

      groupSettlements.forEach(settlement => {
        memberBalances[settlement.from] = (memberBalances[settlement.from] || 0) + settlement.amount;
        memberBalances[settlement.to] = (memberBalances[settlement.to] || 0) - settlement.amount;
      });

      balances[group.id] = memberBalances;
    });

    return balances;
  }, [groups, expenses, settlements]);

  const userTotalBalance = useMemo(() => {
    const totals = {};
    
    Object.values(groupBalances).forEach(groupBalance => {
      Object.entries(groupBalance).forEach(([memberId, balance]) => {
        totals[memberId] = (totals[memberId] || 0) + balance;
      });
    });

    return totals;
  }, [groupBalances]);

  const recentActivity = useMemo(() => {
    const activities = [];

    expenses.forEach(expense => {
      activities.push({
        id: expense.id,
        type: 'expense',
        timestamp: expense.createdAt,
        data: expense,
      });
    });

    settlements.forEach(settlement => {
      activities.push({
        id: settlement.id,
        type: 'settlement',
        timestamp: settlement.settledAt,
        data: settlement,
      });
    });

    return activities.sort((a, b) => b.timestamp - a.timestamp);
  }, [expenses, settlements]);

  const monthlyStats = useMemo(() => {
    const now = Date.now();
    const thirtyDaysAgo = now - 30 * 24 * 60 * 60 * 1000;

    const recentExpenses = expenses.filter(e => e.createdAt >= thirtyDaysAgo);

    const totalSpent = recentExpenses.reduce((sum, e) => sum + e.amount, 0);
    
    const categoryTotals = {};
    recentExpenses.forEach(expense => {
      const category = expense.category || 'Other';
      categoryTotals[category] = (categoryTotals[category] || 0) + expense.amount;
    });

    return {
      totalSpent,
      expenseCount: recentExpenses.length,
      categoryBreakdown: categoryTotals,
      averageExpense: recentExpenses.length > 0 ? totalSpent / recentExpenses.length : 0,
    };
  }, [expenses]);

  const optimizedSettlements = useMemo(() => {
    const optimized = {};

    groups.forEach(group => {
      const balances = groupBalances[group.id] || {};
      
      const creditors = [];
      const debtors = [];

      Object.entries(balances).forEach(([memberId, balance]) => {
        if (balance > 0.01) {
          creditors.push({ memberId, amount: balance });
        } else if (balance < -0.01) {
          debtors.push({ memberId, amount: -balance });
        }
      });

      const transactions = [];
      let i = 0;
      let j = 0;

      while (i < creditors.length && j < debtors.length) {
        const creditor = creditors[i];
        const debtor = debtors[j];
        const amount = Math.min(creditor.amount, debtor.amount);

        if (amount > 0.01) {
          transactions.push({
            from: debtor.memberId,
            to: creditor.memberId,
            amount: Math.round(amount * 100) / 100,
          });
        }

        creditor.amount -= amount;
        debtor.amount -= amount;

        if (creditor.amount < 0.01) i++;
        if (debtor.amount < 0.01) j++;
      }

      optimized[group.id] = transactions;
    });

    return optimized;
  }, [groups, groupBalances]);

  const value = {
    groups,
    expenses,
    settlements,
    members,
    theme,
    addGroup,
    deleteGroup,
    addExpense,
    updateExpense,
    deleteExpense,
    addSettlement,
    addMember,
    updateMember,
    groupBalances,
    userTotalBalance,
    recentActivity,
    monthlyStats,
    optimizedSettlements,
  };

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
};

export const useSettleSnap = () => {
  const context = useContext(AppContext);
  if (!context) {
    throw new Error('useSettleSnap must be used within AppProvider');
  }
  return context;
};

export default AppContext;
