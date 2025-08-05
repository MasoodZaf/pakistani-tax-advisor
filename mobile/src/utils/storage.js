import AsyncStorage from '@react-native-async-storage/async-storage';

// Storage utility for offline form data
class StorageUtil {
  
  // Save form data locally for offline access
  static async saveFormData(formType, data) {
    try {
      const key = `form_${formType}`;
      await AsyncStorage.setItem(key, JSON.stringify(data));
      return true;
    } catch (error) {
      console.error('Error saving form data:', error);
      return false;
    }
  }

  // Get form data from local storage
  static async getFormData(formType) {
    try {
      const key = `form_${formType}`;
      const data = await AsyncStorage.getItem(key);
      return data ? JSON.parse(data) : null;
    } catch (error) {
      console.error('Error getting form data:', error);
      return null;
    }
  }

  // Clear form data
  static async clearFormData(formType) {
    try {
      const key = `form_${formType}`;
      await AsyncStorage.removeItem(key);
      return true;
    } catch (error) {
      console.error('Error clearing form data:', error);
      return false;
    }
  }

  // Save user preferences
  static async saveUserPreferences(preferences) {
    try {
      await AsyncStorage.setItem('user_preferences', JSON.stringify(preferences));
      return true;
    } catch (error) {
      console.error('Error saving user preferences:', error);
      return false;
    }
  }

  // Get user preferences
  static async getUserPreferences() {
    try {
      const preferences = await AsyncStorage.getItem('user_preferences');
      return preferences ? JSON.parse(preferences) : {
        notifications: true,
        autoSave: true,
        theme: 'light',
        language: 'en'
      };
    } catch (error) {
      console.error('Error getting user preferences:', error);
      return {
        notifications: true,
        autoSave: true,
        theme: 'light',
        language: 'en'
      };
    }
  }

  // Save offline queue for API calls when network is unavailable
  static async addToOfflineQueue(apiCall) {
    try {
      const queue = await this.getOfflineQueue();
      queue.push({
        ...apiCall,
        timestamp: Date.now(),
        id: Math.random().toString(36).substr(2, 9)
      });
      await AsyncStorage.setItem('offline_queue', JSON.stringify(queue));
      return true;
    } catch (error) {
      console.error('Error adding to offline queue:', error);
      return false;
    }
  }

  // Get offline queue
  static async getOfflineQueue() {
    try {
      const queue = await AsyncStorage.getItem('offline_queue');
      return queue ? JSON.parse(queue) : [];
    } catch (error) {
      console.error('Error getting offline queue:', error);
      return [];
    }
  }

  // Clear offline queue
  static async clearOfflineQueue() {
    try {
      await AsyncStorage.removeItem('offline_queue');
      return true;
    } catch (error) {
      console.error('Error clearing offline queue:', error);
      return false;
    }
  }

  // Get all stored keys for debugging
  static async getAllKeys() {
    try {
      const keys = await AsyncStorage.getAllKeys();
      return keys;
    } catch (error) {
      console.error('Error getting all keys:', error);
      return [];
    }
  }

  // Clear all app data (for logout/reset)
  static async clearAllData() {
    try {
      const keys = await AsyncStorage.getAllKeys();
      await AsyncStorage.multiRemove(keys);
      return true;
    } catch (error) {
      console.error('Error clearing all data:', error);
      return false;
    }
  }
}

export default StorageUtil;