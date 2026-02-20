/**
 * Shared Data Management Utilities
 * Used by both admin panel and public showcase page
 */

const FurnitureData = {
  STORAGE_KEY: 'furniture_items',

  /**
   * Load all furniture items from localStorage
   * @returns {Array} Array of furniture items
   */
  loadItems() {
    try {
      const data = localStorage.getItem(this.STORAGE_KEY);
      if (!data) {
        return [];
      }
      const parsed = JSON.parse(data);
      return parsed.items || [];
    } catch (error) {
      console.error('Error loading furniture items:', error);
      return [];
    }
  },

  /**
   * Initialize data - seeds localStorage from furniture.json if empty
   * Call this before using loadItems() on page load
   * @returns {Promise<Array>} Array of furniture items
   */
  async init() {
    const existing = this.loadItems();
    if (existing.length > 0) {
      return existing;
    }

    // localStorage is empty, try to load from furniture.json
    try {
      const response = await fetch('data/furniture.json');
      if (response.ok) {
        const data = await response.json();
        const items = data.items || [];
        if (items.length > 0) {
          this.saveItems(items);
          console.log('Seeded localStorage with', items.length, 'items from furniture.json');
        }
        return items;
      }
    } catch (error) {
      console.error('Error loading furniture.json:', error);
    }

    return [];
  },

  /**
   * Save furniture items to localStorage
   * @param {Array} items - Array of furniture items to save
   * @returns {boolean} Success status
   */
  saveItems(items) {
    try {
      const data = {
        items: items,
        lastUpdated: new Date().toISOString()
      };
      localStorage.setItem(this.STORAGE_KEY, JSON.stringify(data));
      return true;
    } catch (error) {
      console.error('Error saving furniture items:', error);
      // Check if quota exceeded
      if (error.name === 'QuotaExceededError') {
        alert('Storage quota exceeded. Please reduce the number or size of images.');
      }
      return false;
    }
  },

  /**
   * Get a single item by ID
   * @param {string} id - Item ID
   * @returns {Object|null} Furniture item or null if not found
   */
  getItemById(id) {
    const items = this.loadItems();
    return items.find(item => item.id === id) || null;
  },

  /**
   * Add a new item
   * @param {Object} item - Furniture item to add
   * @returns {boolean} Success status
   */
  addItem(item) {
    const items = this.loadItems();
    items.push(item);
    return this.saveItems(items);
  },

  /**
   * Update an existing item
   * @param {string} id - Item ID to update
   * @param {Object} updatedItem - Updated item data
   * @returns {boolean} Success status
   */
  updateItem(id, updatedItem) {
    const items = this.loadItems();
    const index = items.findIndex(item => item.id === id);
    if (index === -1) {
      console.error('Item not found:', id);
      return false;
    }
    items[index] = { ...updatedItem, id, dateUpdated: new Date().toISOString() };
    return this.saveItems(items);
  },

  /**
   * Delete an item
   * @param {string} id - Item ID to delete
   * @returns {boolean} Success status
   */
  deleteItem(id) {
    const items = this.loadItems();
    const filteredItems = items.filter(item => item.id !== id);
    if (filteredItems.length === items.length) {
      console.error('Item not found:', id);
      return false;
    }
    return this.saveItems(filteredItems);
  },

  /**
   * Generate a unique ID for a new item
   * @returns {string} Unique ID
   */
  generateId() {
    return `item-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  },

  /**
   * Filter items by status
   * @param {string} status - Status to filter by (or 'all')
   * @returns {Array} Filtered items
   */
  filterByStatus(status) {
    const items = this.loadItems();
    if (status === 'all') {
      return items;
    }
    return items.filter(item => item.status === status);
  },

  /**
   * Sort items by price
   * @param {string} order - 'asc' or 'desc'
   * @returns {Array} Sorted items
   */
  sortByPrice(order = 'asc') {
    const items = this.loadItems();
    return items.sort((a, b) => {
      return order === 'asc' ? a.price - b.price : b.price - a.price;
    });
  },

  /**
   * Search items by name or description
   * @param {string} query - Search query
   * @returns {Array} Matching items
   */
  search(query) {
    const items = this.loadItems();
    const lowerQuery = query.toLowerCase();
    return items.filter(item => {
      return item.name.toLowerCase().includes(lowerQuery) ||
             item.description.toLowerCase().includes(lowerQuery);
    });
  },

  /**
   * Get storage usage information
   * @returns {Object} Storage usage stats
   */
  getStorageInfo() {
    try {
      const data = localStorage.getItem(this.STORAGE_KEY);
      const sizeInBytes = data ? new Blob([data]).size : 0;
      const sizeInKB = (sizeInBytes / 1024).toFixed(2);
      const sizeInMB = (sizeInBytes / (1024 * 1024)).toFixed(2);
      const itemCount = this.loadItems().length;

      return {
        sizeInBytes,
        sizeInKB,
        sizeInMB,
        itemCount,
        formatted: `${sizeInMB} MB (${itemCount} items)`
      };
    } catch (error) {
      console.error('Error getting storage info:', error);
      return null;
    }
  },

  /**
   * Clear all data (use with caution)
   * @returns {boolean} Success status
   */
  clearAll() {
    try {
      localStorage.removeItem(this.STORAGE_KEY);
      return true;
    } catch (error) {
      console.error('Error clearing data:', error);
      return false;
    }
  },

  /**
   * Export data as JSON string
   * @returns {string} JSON string of all data
   */
  exportData() {
    const items = this.loadItems();
    return JSON.stringify({ items }, null, 2);
  },

  /**
   * Import data from JSON string
   * @param {string} jsonString - JSON string to import
   * @returns {boolean} Success status
   */
  importData(jsonString) {
    try {
      const data = JSON.parse(jsonString);
      if (!data.items || !Array.isArray(data.items)) {
        throw new Error('Invalid data format');
      }
      return this.saveItems(data.items);
    } catch (error) {
      console.error('Error importing data:', error);
      return false;
    }
  }
};

// Make it available globally
if (typeof module !== 'undefined' && module.exports) {
  module.exports = FurnitureData;
}
