/**
 * Admin Panel JavaScript
 * Handles authentication, CRUD operations, and image management
 */

const AdminPanel = {
  // Configuration
  AUTH_KEY: 'furniture_admin_auth',
  ADMIN_PASSWORD: 'furniture2024',
  MAX_IMAGE_WIDTH: 1200,
  THUMBNAIL_WIDTH: 400,
  MAX_FILE_SIZE: 200 * 1024, // 200KB

  // State
  currentEditId: null,
  uploadedImages: [],

  /**
   * Initialize the admin panel
   */
  async init() {
    // Check authentication
    if (!this.checkAuth()) {
      this.showLoginForm();
      return;
    }

    // Seed localStorage from furniture.json if empty
    await FurnitureData.init();

    // Show admin panel
    this.showAdminPanel();
    this.loadItemsTable();
    this.attachEventListeners();
  },

  /**
   * Check if user is authenticated
   */
  checkAuth() {
    const auth = sessionStorage.getItem(this.AUTH_KEY);
    return auth === 'true';
  },

  /**
   * Show login form
   */
  showLoginForm() {
    document.getElementById('loginSection').style.display = 'flex';
    document.getElementById('adminSection').style.display = 'none';

    const loginBtn = document.getElementById('loginBtn');
    const passwordInput = document.getElementById('passwordInput');

    loginBtn.addEventListener('click', () => this.handleLogin());
    passwordInput.addEventListener('keypress', (e) => {
      if (e.key === 'Enter') {
        this.handleLogin();
      }
    });

    // Focus password input
    passwordInput.focus();
  },

  /**
   * Handle login attempt
   */
  async handleLogin() {
    const password = document.getElementById('passwordInput').value;
    const errorMsg = document.getElementById('loginError');

    if (password === this.ADMIN_PASSWORD) {
      sessionStorage.setItem(this.AUTH_KEY, 'true');
      errorMsg.style.display = 'none';

      // Seed localStorage from furniture.json if empty
      await FurnitureData.init();

      this.showAdminPanel();
      this.loadItemsTable();
      this.attachEventListeners();
    } else {
      errorMsg.style.display = 'block';
      document.getElementById('passwordInput').value = '';
      document.getElementById('passwordInput').focus();
    }
  },

  /**
   * Show admin panel
   */
  showAdminPanel() {
    document.getElementById('loginSection').style.display = 'none';
    document.getElementById('adminSection').style.display = 'block';
    this.updateStorageInfo();
  },

  /**
   * Logout user
   */
  logout() {
    sessionStorage.removeItem(this.AUTH_KEY);
    location.reload();
  },

  /**
   * Attach event listeners
   */
  attachEventListeners() {
    // Logout button
    document.getElementById('logoutBtn').addEventListener('click', () => this.logout());

    // Add new item button
    document.getElementById('addNewBtn').addEventListener('click', () => this.showItemForm());

    // Form buttons
    document.getElementById('saveItemBtn').addEventListener('click', () => this.saveItem());
    document.getElementById('cancelFormBtn').addEventListener('click', () => this.hideItemForm());

    // Image upload
    document.getElementById('imageUpload').addEventListener('change', (e) => this.handleImageUpload(e));

    // Export/Import/Publish
    document.getElementById('publishBtn').addEventListener('click', () => this.publishChanges());
    document.getElementById('exportDataBtn').addEventListener('click', () => this.exportData());
    document.getElementById('importDataBtn').addEventListener('click', () => this.importData());
  },

  /**
   * Load items into table
   */
  loadItemsTable(sortBy = null, sortOrder = 'asc') {
    let items = FurnitureData.loadItems();
    const tbody = document.querySelector('#itemsTable tbody');

    if (items.length === 0) {
      tbody.innerHTML = '<tr><td colspan="7" class="no-items">No items yet. Click "Add New Item" to get started.</td></tr>';
      return;
    }

    // Sort items if specified
    if (sortBy) {
      items = this.sortItems(items, sortBy, sortOrder);
    }

    tbody.innerHTML = items.map(item => {
      const isHidden = item.hidden === true;
      const lastEdit = item.dateUpdated ? new Date(item.dateUpdated).toLocaleDateString() + ' ' + new Date(item.dateUpdated).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'}) : 'N/A';

      return `
      <tr class="${isHidden ? 'hidden-item' : ''}">
        <td>
          ${item.images && item.images.length > 0
            ? `<img src="${item.images[0]}" alt="${item.name}" class="table-thumbnail">`
            : '<div class="no-image">No image</div>'}
        </td>
        <td><strong>${this.escapeHtml(item.name)}</strong>${isHidden ? ' <span class="hidden-badge">Hidden</span>' : ''}</td>
        <td class="description-cell">${this.escapeHtml(item.description).substring(0, 100)}${item.description.length > 100 ? '...' : ''}</td>
        <td>$${item.price.toFixed(2)}</td>
        <td>
          <select class="status-select status-${item.status}" onchange="AdminPanel.quickStatusUpdate('${item.id}', this.value)">
            <option value="available" ${item.status === 'available' ? 'selected' : ''}>Available</option>
            <option value="pending" ${item.status === 'pending' ? 'selected' : ''}>Pending</option>
            <option value="sold" ${item.status === 'sold' ? 'selected' : ''}>Sold</option>
          </select>
        </td>
        <td class="last-edit-cell">${lastEdit}</td>
        <td class="actions-cell">
          <button onclick="AdminPanel.editItem('${item.id}')" class="btn btn-edit">Edit</button>
          <button onclick="AdminPanel.duplicateItem('${item.id}')" class="btn btn-secondary">Duplicate</button>
          <button onclick="AdminPanel.toggleHidden('${item.id}')" class="btn ${isHidden ? 'btn-success' : 'btn-warning'}">${isHidden ? 'Show' : 'Hide'}</button>
          <button onclick="AdminPanel.deleteItem('${item.id}')" class="btn btn-delete">Delete</button>
        </td>
      </tr>
    `}).join('');

    this.updateStorageInfo();
    this.attachSortListeners();
  },

  /**
   * Sort items by field
   */
  sortItems(items, field, order = 'asc') {
    return items.sort((a, b) => {
      let aVal = a[field];
      let bVal = b[field];

      // Handle different data types
      if (field === 'price') {
        aVal = parseFloat(aVal) || 0;
        bVal = parseFloat(bVal) || 0;
      } else if (field === 'dateUpdated') {
        aVal = new Date(aVal || 0).getTime();
        bVal = new Date(bVal || 0).getTime();
      } else {
        aVal = (aVal || '').toString().toLowerCase();
        bVal = (bVal || '').toString().toLowerCase();
      }

      if (aVal < bVal) return order === 'asc' ? -1 : 1;
      if (aVal > bVal) return order === 'asc' ? 1 : -1;
      return 0;
    });
  },

  /**
   * Attach sort listeners to table headers
   */
  attachSortListeners() {
    const sortableHeaders = document.querySelectorAll('.sortable');
    sortableHeaders.forEach(header => {
      header.style.cursor = 'pointer';
      header.onclick = () => {
        const field = header.dataset.sort;
        const currentOrder = header.dataset.order || 'asc';
        const newOrder = currentOrder === 'asc' ? 'desc' : 'asc';

        // Update all headers
        sortableHeaders.forEach(h => {
          h.dataset.order = '';
          h.querySelector('.sort-icon').textContent = '';
        });

        // Update clicked header
        header.dataset.order = newOrder;
        header.querySelector('.sort-icon').textContent = newOrder === 'asc' ? ' ▲' : ' ▼';

        // Reload table with sorting
        this.loadItemsTable(field, newOrder);
      };
    });
  },

  /**
   * Duplicate an item
   */
  duplicateItem(id) {
    const item = FurnitureData.getItemById(id);
    if (!item) return;

    const newItem = {
      ...item,
      id: FurnitureData.generateId(),
      name: item.name + ' (Copy)',
      dateUpdated: new Date().toISOString()
    };

    if (FurnitureData.addItem(newItem)) {
      this.showMessage('Item duplicated successfully', 'success');
      this.loadItemsTable();
    } else {
      this.showMessage('Failed to duplicate item', 'error');
    }
  },

  /**
   * Toggle hidden status of an item
   */
  toggleHidden(id) {
    const item = FurnitureData.getItemById(id);
    if (!item) return;

    item.hidden = !item.hidden;
    if (FurnitureData.updateItem(id, item)) {
      this.showMessage(item.hidden ? 'Item hidden from public view' : 'Item is now visible', 'success');
      this.loadItemsTable();
    } else {
      this.showMessage('Failed to update visibility', 'error');
    }
  },

  /**
   * Quick status update from table
   */
  quickStatusUpdate(id, newStatus) {
    const item = FurnitureData.getItemById(id);
    if (!item) return;

    item.status = newStatus;
    if (FurnitureData.updateItem(id, item)) {
      this.showMessage('Status updated successfully', 'success');
      this.updateStorageInfo();
    } else {
      this.showMessage('Failed to update status', 'error');
    }
  },

  /**
   * Show item form for adding/editing
   */
  showItemForm(item = null) {
    this.currentEditId = item ? item.id : null;
    this.uploadedImages = item && item.images ? [...item.images] : [];

    // Update form title
    document.getElementById('formTitle').textContent = item ? 'Edit Item' : 'Add New Item';

    // Populate form fields
    document.getElementById('itemName').value = item ? item.name : '';
    document.getElementById('itemDescription').value = item ? item.description : '';
    document.getElementById('itemPrice').value = item ? item.price : '';
    document.getElementById('itemStatus').value = item ? item.status : 'available';

    // Clear file input
    document.getElementById('imageUpload').value = '';

    // Show uploaded images
    this.renderUploadedImages();

    // Show form
    document.getElementById('itemFormSection').style.display = 'block';
    document.getElementById('itemsListSection').style.display = 'none';

    // Focus first field
    document.getElementById('itemName').focus();
  },

  /**
   * Hide item form
   */
  hideItemForm() {
    document.getElementById('itemFormSection').style.display = 'none';
    document.getElementById('itemsListSection').style.display = 'block';
    this.currentEditId = null;
    this.uploadedImages = [];
  },

  /**
   * Handle image upload
   */
  async handleImageUpload(event) {
    const files = Array.from(event.target.files);

    if (files.length === 0) return;

    this.showMessage('Processing images...', 'info');

    for (const file of files) {
      try {
        // Check file type
        if (!file.type.startsWith('image/')) {
          this.showMessage(`${file.name} is not an image`, 'error');
          continue;
        }

        // Process image
        const processedImage = await this.processImage(file);
        this.uploadedImages.push(processedImage);
      } catch (error) {
        console.error('Error processing image:', error);
        this.showMessage(`Failed to process ${file.name}`, 'error');
      }
    }

    this.renderUploadedImages();
    this.showMessage(`${files.length} image(s) added`, 'success');

    // Clear input
    event.target.value = '';
  },

  /**
   * Process and optimize image
   */
  processImage(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();

      reader.onload = (e) => {
        const img = new Image();

        img.onload = () => {
          try {
            // Calculate new dimensions
            let width = img.width;
            let height = img.height;

            if (width > this.MAX_IMAGE_WIDTH) {
              height = (height * this.MAX_IMAGE_WIDTH) / width;
              width = this.MAX_IMAGE_WIDTH;
            }

            // Create canvas and resize
            const canvas = document.createElement('canvas');
            canvas.width = width;
            canvas.height = height;

            const ctx = canvas.getContext('2d');
            ctx.drawImage(img, 0, 0, width, height);

            // Compress image
            let quality = 0.8;
            let dataUrl = canvas.toDataURL('image/jpeg', quality);

            // Reduce quality if still too large
            while (dataUrl.length > this.MAX_FILE_SIZE * 1.37 && quality > 0.1) {
              quality -= 0.1;
              dataUrl = canvas.toDataURL('image/jpeg', quality);
            }

            resolve(dataUrl);
          } catch (error) {
            reject(error);
          }
        };

        img.onerror = reject;
        img.src = e.target.result;
      };

      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  },

  /**
   * Render uploaded images preview
   */
  renderUploadedImages() {
    const container = document.getElementById('imagePreview');

    if (this.uploadedImages.length === 0) {
      container.innerHTML = '<p class="no-images-text">No images uploaded yet</p>';
      return;
    }

    container.innerHTML = this.uploadedImages.map((img, index) => `
      <div class="image-preview-item" draggable="true" data-index="${index}">
        <img src="${img}" alt="Preview ${index + 1}">
        <div class="image-controls">
          <button type="button" class="move-image-btn" onclick="AdminPanel.moveImage(${index}, -1)" ${index === 0 ? 'disabled' : ''}>◀</button>
          <button type="button" class="move-image-btn" onclick="AdminPanel.moveImage(${index}, 1)" ${index === this.uploadedImages.length - 1 ? 'disabled' : ''}>▶</button>
          <button type="button" class="remove-image-btn" onclick="AdminPanel.removeImage(${index})">×</button>
        </div>
        ${index === 0 ? '<span class="primary-badge">Primary</span>' : ''}
      </div>
    `).join('');

    // Add drag and drop listeners
    this.attachImageDragListeners();
  },

  /**
   * Move an image in the array
   */
  moveImage(fromIndex, direction) {
    const toIndex = fromIndex + direction;
    if (toIndex < 0 || toIndex >= this.uploadedImages.length) return;

    // Swap images
    [this.uploadedImages[fromIndex], this.uploadedImages[toIndex]] =
      [this.uploadedImages[toIndex], this.uploadedImages[fromIndex]];

    this.renderUploadedImages();
    this.showMessage('Image order updated', 'info');
  },

  /**
   * Attach drag and drop listeners for image reordering
   */
  attachImageDragListeners() {
    const items = document.querySelectorAll('.image-preview-item');
    let draggedIndex = null;

    items.forEach((item, index) => {
      item.addEventListener('dragstart', (e) => {
        draggedIndex = index;
        item.classList.add('dragging');
      });

      item.addEventListener('dragend', (e) => {
        item.classList.remove('dragging');
      });

      item.addEventListener('dragover', (e) => {
        e.preventDefault();
        item.classList.add('drag-over');
      });

      item.addEventListener('dragleave', (e) => {
        item.classList.remove('drag-over');
      });

      item.addEventListener('drop', (e) => {
        e.preventDefault();
        item.classList.remove('drag-over');

        if (draggedIndex !== null && draggedIndex !== index) {
          // Reorder images
          const draggedImage = this.uploadedImages[draggedIndex];
          this.uploadedImages.splice(draggedIndex, 1);
          this.uploadedImages.splice(index, 0, draggedImage);
          this.renderUploadedImages();
          this.showMessage('Image order updated', 'info');
        }
        draggedIndex = null;
      });
    });
  },

  /**
   * Remove an uploaded image
   */
  removeImage(index) {
    this.uploadedImages.splice(index, 1);
    this.renderUploadedImages();
    this.showMessage('Image removed', 'info');
  },

  /**
   * Validate form data
   */
  validateForm() {
    const name = document.getElementById('itemName').value.trim();
    const description = document.getElementById('itemDescription').value.trim();
    const price = parseFloat(document.getElementById('itemPrice').value);

    if (!name) {
      this.showMessage('Please enter item name', 'error');
      document.getElementById('itemName').focus();
      return false;
    }

    if (!description) {
      this.showMessage('Please enter item description', 'error');
      document.getElementById('itemDescription').focus();
      return false;
    }

    if (isNaN(price) || price < 0) {
      this.showMessage('Please enter a valid price', 'error');
      document.getElementById('itemPrice').focus();
      return false;
    }

    if (this.uploadedImages.length === 0) {
      this.showMessage('Please upload at least one image', 'error');
      return false;
    }

    return true;
  },

  /**
   * Save item (add or update)
   */
  saveItem() {
    if (!this.validateForm()) return;

    const itemData = {
      name: document.getElementById('itemName').value.trim(),
      description: document.getElementById('itemDescription').value.trim(),
      price: parseFloat(document.getElementById('itemPrice').value),
      status: document.getElementById('itemStatus').value,
      images: this.uploadedImages
    };

    let success;
    if (this.currentEditId) {
      // Update existing item
      itemData.dateAdded = FurnitureData.getItemById(this.currentEditId).dateAdded;
      success = FurnitureData.updateItem(this.currentEditId, itemData);
    } else {
      // Add new item
      itemData.id = FurnitureData.generateId();
      itemData.dateAdded = new Date().toISOString();
      itemData.dateUpdated = new Date().toISOString();
      success = FurnitureData.addItem(itemData);
    }

    if (success) {
      this.showMessage(this.currentEditId ? 'Item updated successfully' : 'Item added successfully', 'success');
      this.hideItemForm();
      this.loadItemsTable();
    } else {
      this.showMessage('Failed to save item. Storage may be full.', 'error');
    }
  },

  /**
   * Edit item
   */
  editItem(id) {
    const item = FurnitureData.getItemById(id);
    if (item) {
      this.showItemForm(item);
    } else {
      this.showMessage('Item not found', 'error');
    }
  },

  /**
   * Delete item
   */
  deleteItem(id) {
    const item = FurnitureData.getItemById(id);
    if (!item) {
      this.showMessage('Item not found', 'error');
      return;
    }

    if (confirm(`Are you sure you want to delete "${item.name}"? This cannot be undone.`)) {
      if (FurnitureData.deleteItem(id)) {
        this.showMessage('Item deleted successfully', 'success');
        this.loadItemsTable();
      } else {
        this.showMessage('Failed to delete item', 'error');
      }
    }
  },

  /**
   * Publish changes - sends email with JSON data
   */
  publishChanges() {
    const jsonData = FurnitureData.exportData();
    const items = FurnitureData.loadItems();
    const itemCount = items.length;
    const timestamp = new Date().toISOString().split('T')[0];

    // Create email subject and body
    const subject = encodeURIComponent(`Furniture Website Update - ${timestamp}`);
    const body = encodeURIComponent(
      `Hi,\n\n` +
      `I've updated the furniture listings and would like to publish the changes to the live website.\n\n` +
      `Updated data:\n` +
      `- Total items: ${itemCount}\n` +
      `- Date: ${timestamp}\n\n` +
      `The JSON data is attached below. Please copy it and update the website.\n\n` +
      `JSON Data:\n` +
      `${jsonData}\n\n` +
      `Thanks!`
    );

    // Open email client with pre-filled content
    window.location.href = `mailto:arielmuslera@gmail.com?subject=${subject}&body=${body}`;

    this.showMessage('Email opened - send it to publish your changes', 'success');
  },

  /**
   * Export data to JSON file
   */
  exportData() {
    const jsonData = FurnitureData.exportData();
    const blob = new Blob([jsonData], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `furniture-data-${new Date().toISOString().split('T')[0]}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    this.showMessage('Data exported successfully', 'success');
  },

  /**
   * Import data from JSON file
   */
  importData() {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.json';

    input.onchange = (e) => {
      const file = e.target.files[0];
      if (!file) return;

      const reader = new FileReader();
      reader.onload = (event) => {
        try {
          if (confirm('This will replace all existing data. Continue?')) {
            if (FurnitureData.importData(event.target.result)) {
              this.showMessage('Data imported successfully', 'success');
              this.loadItemsTable();
            } else {
              this.showMessage('Failed to import data. Invalid format.', 'error');
            }
          }
        } catch (error) {
          console.error('Import error:', error);
          this.showMessage('Failed to import data', 'error');
        }
      };
      reader.readAsText(file);
    };

    input.click();
  },

  /**
   * Update storage info display
   */
  updateStorageInfo() {
    const info = FurnitureData.getStorageInfo();
    if (info) {
      document.getElementById('storageInfo').textContent =
        `Storage: ${info.sizeInKB} KB (${info.itemCount} items)`;
    }
  },

  /**
   * Show message to user
   */
  showMessage(message, type = 'info') {
    const messageEl = document.getElementById('messageBox');
    messageEl.textContent = message;
    messageEl.className = `message message-${type}`;
    messageEl.style.display = 'block';

    setTimeout(() => {
      messageEl.style.display = 'none';
    }, 3000);
  },

  /**
   * Escape HTML to prevent XSS
   */
  escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }
};

// Initialize on page load
document.addEventListener('DOMContentLoaded', () => {
  AdminPanel.init();
});
