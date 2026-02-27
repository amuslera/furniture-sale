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
  visibilityFilter: 'all',
  searchQuery: '',
  selectedItems: new Set(),
  currentTableItems: [], // ordered list of item IDs as shown in table

  /**
   * Initialize the admin panel
   */
  async init() {
    if (!this.checkAuth()) {
      this.showLoginForm();
      return;
    }
    await FurnitureData.init();
    this.showAdminPanel();
    this.loadItemsTable();
    this.attachEventListeners();
  },

  checkAuth() {
    return sessionStorage.getItem(this.AUTH_KEY) === 'true';
  },

  showLoginForm() {
    document.getElementById('loginSection').style.display = 'flex';
    document.getElementById('adminSection').style.display = 'none';
    const loginBtn = document.getElementById('loginBtn');
    const passwordInput = document.getElementById('passwordInput');
    loginBtn.addEventListener('click', () => this.handleLogin());
    passwordInput.addEventListener('keypress', (e) => {
      if (e.key === 'Enter') this.handleLogin();
    });
    passwordInput.focus();
  },

  async handleLogin() {
    const password = document.getElementById('passwordInput').value;
    const errorMsg = document.getElementById('loginError');
    if (password === this.ADMIN_PASSWORD) {
      sessionStorage.setItem(this.AUTH_KEY, 'true');
      errorMsg.style.display = 'none';
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

  showAdminPanel() {
    document.getElementById('loginSection').style.display = 'none';
    document.getElementById('adminSection').style.display = 'block';
    this.updateStorageInfo();
  },

  logout() {
    sessionStorage.removeItem(this.AUTH_KEY);
    location.reload();
  },

  attachEventListeners() {
    document.getElementById('logoutBtn').addEventListener('click', () => this.logout());
    document.getElementById('addNewBtn').addEventListener('click', () => this.showItemForm());
    document.getElementById('saveItemBtn').addEventListener('click', () => this.saveItem());
    document.getElementById('saveNextBtn').addEventListener('click', () => this.saveAndEditNext());
    document.getElementById('cancelFormBtn').addEventListener('click', () => this.hideItemForm());
    document.getElementById('imageUpload').addEventListener('change', (e) => this.handleImageUpload(e));
    document.getElementById('publishBtn').addEventListener('click', () => this.publishChanges());
    document.getElementById('exportDataBtn').addEventListener('click', () => this.exportData());
    document.getElementById('importDataBtn').addEventListener('click', () => this.importData());

    document.getElementById('visibilityFilter').addEventListener('change', (e) => {
      this.visibilityFilter = e.target.value;
      this.clearSelection();
      this.loadItemsTable();
    });

    // Search
    let searchTimeout;
    document.getElementById('adminSearchInput').addEventListener('input', (e) => {
      clearTimeout(searchTimeout);
      searchTimeout = setTimeout(() => {
        this.searchQuery = e.target.value.trim();
        this.clearSelection();
        this.loadItemsTable();
      }, 300);
    });

    // Selection & bulk actions
    document.getElementById('selectAllCheckbox').addEventListener('change', (e) => {
      this.toggleSelectAll(e.target.checked);
    });
    document.getElementById('exportPdfBtn').addEventListener('click', () => this.showPdfFieldModal());
    document.getElementById('toggleBoBtn').addEventListener('click', () => this.bulkToggleBestOffer());

    // PDF modal
    document.getElementById('generatePdfBtn').addEventListener('click', () => this.generatePdf());
    document.getElementById('cancelPdfBtn').addEventListener('click', () => this.hidePdfFieldModal());
  },

  // ══════════════════════════════════════════════════════════════
  // TABLE
  // ══════════════════════════════════════════════════════════════

  loadItemsTable(sortBy = null, sortOrder = 'asc') {
    let items = FurnitureData.loadItems();
    const tbody = document.querySelector('#itemsTable tbody');

    if (items.length === 0) {
      tbody.innerHTML = '<tr><td colspan="10" class="no-items">No items yet. Click "Add New Item" to get started.</td></tr>';
      this.updateBulkButtonStates();
      return;
    }

    if (this.visibilityFilter === 'visible') {
      items = items.filter(item => !item.hidden);
    } else if (this.visibilityFilter === 'hidden') {
      items = items.filter(item => item.hidden === true);
    }

    if (this.searchQuery) {
      const q = this.searchQuery.toLowerCase();
      items = items.filter(item =>
        (item.name && item.name.toLowerCase().includes(q)) ||
        (item.description && item.description.toLowerCase().includes(q)) ||
        (item.id && item.id.toLowerCase().includes(q))
      );
    }

    if (sortBy) {
      items = this.sortItems(items, sortBy, sortOrder);
    }

    // Track current table order for Save & Edit Next
    this.currentTableItems = items.map(item => item.id);

    tbody.innerHTML = items.map((item, index) => {
      const isHidden = item.hidden === true;
      const lastEdit = item.dateUpdated ? new Date(item.dateUpdated).toLocaleDateString() + ' ' + new Date(item.dateUpdated).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'}) : 'N/A';
      const priceDisplay = (item.price && item.price > 0) ? `$${item.price.toFixed(2)}` : (item.bestOffer ? 'B.O.' : '$0.00');

      return `
      <tr class="${isHidden ? 'hidden-item' : ''}">
        <td><input type="checkbox" class="item-select-checkbox" data-id="${item.id}" ${this.selectedItems.has(item.id) ? 'checked' : ''}></td>
        <td class="row-number">${index + 1}</td>
        <td>
          ${item.images && item.images.length > 0
            ? `<img src="${item.images[0]}" alt="${item.name}" class="table-thumbnail">`
            : '<div class="no-image">No image</div>'}
        </td>
        <td><strong>${this.escapeHtml(item.name)}</strong>${isHidden ? ' <span class="hidden-badge">Hidden</span>' : ''}</td>
        <td class="description-cell">${this.escapeHtml(item.description).substring(0, 100)}${item.description.length > 100 ? '...' : ''}</td>
        <td>${priceDisplay}</td>
        <td class="bo-cell">
          <span class="bo-badge ${item.bestOffer ? 'bo-active' : ''}" onclick="AdminPanel.quickToggleBestOffer('${item.id}')" title="Click to toggle Best Offer">${item.bestOffer ? '\u2713' : ''}</span>
        </td>
        <td>
          <select class="status-select status-${item.status}" onchange="AdminPanel.quickStatusUpdate('${item.id}', this.value)">
            <option value="available" ${item.status === 'available' ? 'selected' : ''}>Available</option>
            <option value="pending" ${item.status === 'pending' ? 'selected' : ''}>Pending</option>
            <option value="sold" ${item.status === 'sold' ? 'selected' : ''}>Sold</option>
            <option value="newly_added" ${item.status === 'newly_added' ? 'selected' : ''}>Newly Added</option>
            <option value="discounted" ${item.status === 'discounted' ? 'selected' : ''}>Discounted</option>
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

    // Update item count
    const countEl = document.getElementById('itemCount');
    if (countEl) {
      const allItems = FurnitureData.loadItems();
      const totalCount = allItems.length;
      const visibleCount = allItems.filter(i => !i.hidden).length;
      const hiddenCount = allItems.filter(i => i.hidden).length;
      if (this.visibilityFilter === 'all') {
        countEl.textContent = `(${totalCount} total${hiddenCount > 0 ? ', ' + hiddenCount + ' hidden' : ''})`;
      } else if (this.visibilityFilter === 'visible') {
        countEl.textContent = `(${visibleCount} visible of ${totalCount} total)`;
      } else if (this.visibilityFilter === 'hidden') {
        countEl.textContent = `(${hiddenCount} hidden of ${totalCount} total)`;
      }
    }

    this.updateStorageInfo();
    this.attachSortListeners();

    document.querySelectorAll('.item-select-checkbox').forEach(cb => {
      cb.addEventListener('change', (e) => {
        this.toggleSelectItem(e.target.dataset.id, e.target.checked);
      });
    });
    this.updateBulkButtonStates();
  },

  sortItems(items, field, order = 'asc') {
    return items.sort((a, b) => {
      let aVal = a[field];
      let bVal = b[field];
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

  attachSortListeners() {
    const sortableHeaders = document.querySelectorAll('.sortable');
    sortableHeaders.forEach(header => {
      header.style.cursor = 'pointer';
      header.onclick = () => {
        const field = header.dataset.sort;
        const currentOrder = header.dataset.order || 'asc';
        const newOrder = currentOrder === 'asc' ? 'desc' : 'asc';
        sortableHeaders.forEach(h => {
          h.dataset.order = '';
          h.querySelector('.sort-icon').textContent = '';
        });
        header.dataset.order = newOrder;
        header.querySelector('.sort-icon').textContent = newOrder === 'asc' ? ' \u25b2' : ' \u25bc';
        this.loadItemsTable(field, newOrder);
      };
    });
  },

  // ══════════════════════════════════════════════════════════════
  // ITEM CRUD
  // ══════════════════════════════════════════════════════════════

  duplicateItem(id) {
    const item = FurnitureData.getItemById(id);
    if (!item) return;
    const newItem = { ...item, id: FurnitureData.generateId(), name: item.name + ' (Copy)', dateUpdated: new Date().toISOString() };
    if (FurnitureData.addItem(newItem)) {
      this.showMessage('Item duplicated successfully', 'success');
      this.loadItemsTable();
    } else {
      this.showMessage('Failed to duplicate item', 'error');
    }
  },

  toggleHidden(id) {
    const item = FurnitureData.getItemById(id);
    if (!item) return;
    item.hidden = !item.hidden;
    if (FurnitureData.updateItem(id, item)) {
      this.showMessage(item.hidden ? 'Item hidden from public view' : 'Item is now visible', 'success');
      this.loadItemsTable();
    }
  },

  quickStatusUpdate(id, newStatus) {
    const item = FurnitureData.getItemById(id);
    if (!item) return;
    item.status = newStatus;
    if (FurnitureData.updateItem(id, item)) {
      this.showMessage('Status updated', 'success');
      this.updateStorageInfo();
    }
  },

  quickToggleBestOffer(id) {
    const item = FurnitureData.getItemById(id);
    if (!item) return;
    item.bestOffer = !item.bestOffer;
    if (FurnitureData.updateItem(id, item)) {
      this.showMessage(item.bestOffer ? 'Best Offer enabled' : 'Best Offer disabled', 'success');
      this.loadItemsTable();
    }
  },

  bulkToggleBestOffer() {
    const allItems = FurnitureData.loadItems();
    const selected = allItems.filter(item => this.selectedItems.has(item.id));
    if (selected.length === 0) return;
    const anyOff = selected.some(item => !item.bestOffer);
    selected.forEach(item => {
      item.bestOffer = anyOff;
      FurnitureData.updateItem(item.id, item);
    });
    this.showMessage(`Best Offer ${anyOff ? 'enabled' : 'disabled'} for ${selected.length} item${selected.length !== 1 ? 's' : ''}`, 'success');
    this.loadItemsTable();
  },

  // ══════════════════════════════════════════════════════════════
  // ITEM FORM
  // ══════════════════════════════════════════════════════════════

  showItemForm(item = null) {
    this.currentEditId = item ? item.id : null;
    this.uploadedImages = item && item.images ? [...item.images] : [];
    document.getElementById('formTitle').textContent = item ? 'Edit Item' : 'Add New Item';
    document.getElementById('itemName').value = item ? item.name : '';
    document.getElementById('itemDescription').value = item ? item.description : '';
    document.getElementById('itemPrice').value = item && item.price ? item.price : '';
    document.getElementById('itemBestOffer').checked = item ? (item.bestOffer === true) : false;
    document.getElementById('itemRetailPrice').value = item && item.retailPrice ? item.retailPrice : '';
    document.getElementById('itemProductLink').value = item && item.productLink ? item.productLink : '';
    document.getElementById('itemStatus').value = item ? item.status : 'available';
    document.getElementById('imageUpload').value = '';
    this.renderUploadedImages();

    // Show "Save & Edit Next" only when editing an existing item with a next item available
    const saveNextBtn = document.getElementById('saveNextBtn');
    if (item && this.currentTableItems.length > 0) {
      const idx = this.currentTableItems.indexOf(item.id);
      const hasNext = idx >= 0 && idx < this.currentTableItems.length - 1;
      saveNextBtn.style.display = hasNext ? 'inline-block' : 'none';
    } else {
      saveNextBtn.style.display = 'none';
    }

    document.getElementById('itemFormSection').style.display = 'block';
    document.getElementById('itemsListSection').style.display = 'none';
    document.getElementById('itemName').focus();
  },

  hideItemForm() {
    document.getElementById('itemFormSection').style.display = 'none';
    document.getElementById('itemsListSection').style.display = 'block';
    this.currentEditId = null;
    this.uploadedImages = [];
  },

  async handleImageUpload(event) {
    const files = Array.from(event.target.files);
    if (files.length === 0) return;
    this.showMessage('Processing images...', 'info');
    for (const file of files) {
      try {
        if (!file.type.startsWith('image/')) { this.showMessage(`${file.name} is not an image`, 'error'); continue; }
        const processedImage = await this.processImage(file);
        this.uploadedImages.push(processedImage);
      } catch (error) {
        console.error('Error processing image:', error);
        this.showMessage(`Failed to process ${file.name}`, 'error');
      }
    }
    this.renderUploadedImages();
    this.showMessage(`${files.length} image(s) added`, 'success');
    event.target.value = '';
  },

  processImage(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        const img = new Image();
        img.onload = () => {
          try {
            let width = img.width, height = img.height;
            if (width > this.MAX_IMAGE_WIDTH) {
              height = (height * this.MAX_IMAGE_WIDTH) / width;
              width = this.MAX_IMAGE_WIDTH;
            }
            const canvas = document.createElement('canvas');
            canvas.width = width; canvas.height = height;
            canvas.getContext('2d').drawImage(img, 0, 0, width, height);
            let quality = 0.8;
            let dataUrl = canvas.toDataURL('image/jpeg', quality);
            while (dataUrl.length > this.MAX_FILE_SIZE * 1.37 && quality > 0.1) {
              quality -= 0.1;
              dataUrl = canvas.toDataURL('image/jpeg', quality);
            }
            resolve(dataUrl);
          } catch (error) { reject(error); }
        };
        img.onerror = reject;
        img.src = e.target.result;
      };
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  },

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
          <button type="button" class="move-image-btn" onclick="AdminPanel.moveImage(${index}, -1)" ${index === 0 ? 'disabled' : ''}>\u25c0</button>
          <button type="button" class="move-image-btn" onclick="AdminPanel.moveImage(${index}, 1)" ${index === this.uploadedImages.length - 1 ? 'disabled' : ''}>\u25b6</button>
          <button type="button" class="remove-image-btn" onclick="AdminPanel.removeImage(${index})">\u00d7</button>
        </div>
        ${index === 0 ? '<span class="primary-badge">Primary</span>' : ''}
      </div>
    `).join('');
    this.attachImageDragListeners();
  },

  moveImage(fromIndex, direction) {
    const toIndex = fromIndex + direction;
    if (toIndex < 0 || toIndex >= this.uploadedImages.length) return;
    [this.uploadedImages[fromIndex], this.uploadedImages[toIndex]] = [this.uploadedImages[toIndex], this.uploadedImages[fromIndex]];
    this.renderUploadedImages();
    this.showMessage('Image order updated', 'info');
  },

  attachImageDragListeners() {
    const items = document.querySelectorAll('.image-preview-item');
    let draggedIndex = null;
    items.forEach((item, index) => {
      item.addEventListener('dragstart', () => { draggedIndex = index; item.classList.add('dragging'); });
      item.addEventListener('dragend', () => { item.classList.remove('dragging'); });
      item.addEventListener('dragover', (e) => { e.preventDefault(); item.classList.add('drag-over'); });
      item.addEventListener('dragleave', () => { item.classList.remove('drag-over'); });
      item.addEventListener('drop', (e) => {
        e.preventDefault(); item.classList.remove('drag-over');
        if (draggedIndex !== null && draggedIndex !== index) {
          const draggedImage = this.uploadedImages[draggedIndex];
          this.uploadedImages.splice(draggedIndex, 1);
          this.uploadedImages.splice(index, 0, draggedImage);
          this.renderUploadedImages();
        }
        draggedIndex = null;
      });
    });
  },

  removeImage(index) {
    this.uploadedImages.splice(index, 1);
    this.renderUploadedImages();
    this.showMessage('Image removed', 'info');
  },

  validateForm() {
    const name = document.getElementById('itemName').value.trim();
    const description = document.getElementById('itemDescription').value.trim();
    const price = parseFloat(document.getElementById('itemPrice').value);
    const bestOffer = document.getElementById('itemBestOffer').checked;

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
    if (!bestOffer && (isNaN(price) || price < 0)) {
      this.showMessage('Please enter a valid price or enable Best Offer', 'error');
      document.getElementById('itemPrice').focus();
      return false;
    }
    return true;
  },

  _doSave() {
    if (!this.validateForm()) return false;
    const retailPrice = document.getElementById('itemRetailPrice').value;
    const productLink = document.getElementById('itemProductLink').value.trim();
    const priceVal = document.getElementById('itemPrice').value;

    const itemData = {
      name: document.getElementById('itemName').value.trim(),
      description: document.getElementById('itemDescription').value.trim(),
      price: priceVal ? parseFloat(priceVal) : 0,
      bestOffer: document.getElementById('itemBestOffer').checked,
      retailPrice: retailPrice ? parseFloat(retailPrice) : null,
      productLink: productLink || null,
      status: document.getElementById('itemStatus').value,
      images: this.uploadedImages
    };

    let success;
    if (this.currentEditId) {
      itemData.dateAdded = FurnitureData.getItemById(this.currentEditId).dateAdded;
      success = FurnitureData.updateItem(this.currentEditId, itemData);
    } else {
      itemData.id = FurnitureData.generateId();
      itemData.dateAdded = new Date().toISOString();
      itemData.dateUpdated = new Date().toISOString();
      success = FurnitureData.addItem(itemData);
    }

    if (!success) {
      this.showMessage('Failed to save item. Storage may be full.', 'error');
    }
    return success;
  },

  saveItem() {
    if (this._doSave()) {
      this.showMessage(this.currentEditId ? 'Item updated successfully' : 'Item added successfully', 'success');
      this.hideItemForm();
      this.loadItemsTable();
    }
  },

  saveAndEditNext() {
    const currentId = this.currentEditId;
    if (!this._doSave()) return;

    const idx = this.currentTableItems.indexOf(currentId);
    if (idx >= 0 && idx < this.currentTableItems.length - 1) {
      const nextId = this.currentTableItems[idx + 1];
      const nextItem = FurnitureData.getItemById(nextId);
      if (nextItem) {
        const pos = idx + 2; // 1-based position of the next item
        const total = this.currentTableItems.length;
        this.showMessage(`Saved! Now editing ${pos} of ${total}`, 'success');
        this.showItemForm(nextItem);
        return;
      }
    }
    // Fallback: no next item
    this.showMessage('Item saved. No more items to edit.', 'success');
    this.hideItemForm();
    this.loadItemsTable();
  },

  editItem(id) {
    const item = FurnitureData.getItemById(id);
    if (item) this.showItemForm(item);
    else this.showMessage('Item not found', 'error');
  },

  deleteItem(id) {
    const item = FurnitureData.getItemById(id);
    if (!item) { this.showMessage('Item not found', 'error'); return; }
    if (confirm(`Are you sure you want to delete "${item.name}"? This cannot be undone.`)) {
      if (FurnitureData.deleteItem(id)) {
        this.showMessage('Item deleted successfully', 'success');
        this.loadItemsTable();
      }
    }
  },

  // ══════════════════════════════════════════════════════════════
  // PUBLISH / EXPORT / IMPORT
  // ══════════════════════════════════════════════════════════════

  GITHUB_REPO: 'amuslera/furniture-sale',
  GITHUB_FILE: 'data/furniture.json',
  GITHUB_TOKEN_KEY: 'furniture_github_token',

  /**
   * Upload a base64 image to GitHub and return the file path
   */
  async uploadBase64ImageToGitHub(token, itemId, imgIndex, dataUrl) {
    const match = dataUrl.match(/^data:image\/(\w+);base64,(.+)$/);
    if (!match) return null;
    const ext = match[1] === 'png' ? 'png' : 'jpg';
    const b64data = match[2];
    const filePath = `images/full/${itemId}-${imgIndex}.${ext}`;

    // Check if file already exists (need SHA for update)
    let sha = null;
    try {
      const checkResp = await fetch(
        `https://api.github.com/repos/${this.GITHUB_REPO}/contents/${filePath}`,
        { headers: { 'Authorization': `token ${token}` } }
      );
      if (checkResp.ok) {
        const existing = await checkResp.json();
        sha = existing.sha;
      }
    } catch (e) { /* file doesn't exist, that's fine */ }

    const body = {
      message: `Upload image ${filePath}`,
      content: b64data
    };
    if (sha) body.sha = sha;

    const putResp = await fetch(
      `https://api.github.com/repos/${this.GITHUB_REPO}/contents/${filePath}`,
      {
        method: 'PUT',
        headers: { 'Authorization': `token ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
      }
    );
    if (!putResp.ok) {
      console.error(`Failed to upload ${filePath}:`, putResp.status);
      return null;
    }
    return filePath;
  },

  async publishChanges() {
    let token = localStorage.getItem(this.GITHUB_TOKEN_KEY);
    if (!token) {
      token = prompt('Enter your GitHub Personal Access Token\n(needs "Contents: Read and write" permission on amuslera/furniture-sale)\n\nThis will be saved in your browser so you only need to do this once.');
      if (!token) return;
      localStorage.setItem(this.GITHUB_TOKEN_KEY, token);
    }
    this.showMessage('Publishing to GitHub...', 'info');
    const publishBtn = document.getElementById('publishBtn');
    publishBtn.disabled = true;
    publishBtn.textContent = '\u23f3 Publishing...';
    try {
      const getResp = await fetch(`https://api.github.com/repos/${this.GITHUB_REPO}/contents/${this.GITHUB_FILE}`, { headers: { 'Authorization': `token ${token}` } });
      if (!getResp.ok) {
        if (getResp.status === 401) { localStorage.removeItem(this.GITHUB_TOKEN_KEY); throw new Error('Invalid token. Please try again.'); }
        throw new Error(`GitHub API error: ${getResp.status}`);
      }
      const fileData = await getResp.json();
      const items = FurnitureData.loadItems();

      // Extract base64 images to GitHub files before publishing JSON
      let uploadedCount = 0;
      for (const item of items) {
        if (!item.images) continue;
        const newImages = [];
        for (let i = 0; i < item.images.length; i++) {
          const img = item.images[i];
          if (img.startsWith('data:')) {
            publishBtn.textContent = `\u23f3 Uploading images (${uploadedCount + 1})...`;
            const filePath = await this.uploadBase64ImageToGitHub(token, item.id, i + 1, img);
            if (filePath) {
              newImages.push(filePath);
              uploadedCount++;
            } else {
              newImages.push(img); // keep base64 as fallback if upload fails
            }
          } else {
            newImages.push(img);
          }
        }
        item.images = newImages;
      }

      // Save cleaned items back to localStorage
      if (uploadedCount > 0) {
        FurnitureData.saveItems(items);
      }

      publishBtn.textContent = '\u23f3 Publishing data...';
      const storedVersion = FurnitureData.getStoredVersion();
      const newVersion = storedVersion + 1;
      const jsonStr = JSON.stringify({ version: newVersion, items }, null, 2);
      const putResp = await fetch(`https://api.github.com/repos/${this.GITHUB_REPO}/contents/${this.GITHUB_FILE}`, {
        method: 'PUT',
        headers: { 'Authorization': `token ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: `Update furniture data (v${newVersion}) from admin panel`, content: btoa(unescape(encodeURIComponent(jsonStr))), sha: fileData.sha })
      });
      if (!putResp.ok) { const err = await putResp.json(); throw new Error(err.message || `GitHub API error: ${putResp.status}`); }
      localStorage.setItem(FurnitureData.VERSION_KEY, String(newVersion));
      const imgMsg = uploadedCount > 0 ? ` (${uploadedCount} images uploaded)` : '';
      this.showMessage(`Published v${newVersion} to GitHub${imgMsg}! Site will update in ~1 minute.`, 'success');
    } catch (error) {
      console.error('Publish failed:', error);
      this.showMessage(`Publish failed: ${error.message}`, 'error');
    } finally {
      publishBtn.disabled = false;
      publishBtn.textContent = '\ud83d\udce4 Publish Changes';
    }
  },

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

  importData() {
    const input = document.createElement('input');
    input.type = 'file'; input.accept = '.json';
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
            } else { this.showMessage('Failed to import data. Invalid format.', 'error'); }
          }
        } catch (error) { this.showMessage('Failed to import data', 'error'); }
      };
      reader.readAsText(file);
    };
    input.click();
  },

  updateStorageInfo() {
    const info = FurnitureData.getStorageInfo();
    if (info) {
      document.getElementById('storageInfo').textContent = `Storage: ${info.sizeInKB} KB (${info.itemCount} items)`;
    }
  },

  showMessage(message, type = 'info') {
    const messageEl = document.getElementById('messageBox');
    messageEl.textContent = message;
    messageEl.className = `message message-${type}`;
    messageEl.style.display = 'block';
    setTimeout(() => { messageEl.style.display = 'none'; }, 3000);
  },

  // ══════════════════════════════════════════════════════════════
  // SELECTION & BULK ACTIONS
  // ══════════════════════════════════════════════════════════════

  toggleSelectAll(checked) {
    document.querySelectorAll('.item-select-checkbox').forEach(cb => {
      cb.checked = checked;
      if (checked) this.selectedItems.add(cb.dataset.id);
      else this.selectedItems.delete(cb.dataset.id);
    });
    this.updateBulkButtonStates();
  },

  toggleSelectItem(id, checked) {
    if (checked) this.selectedItems.add(id);
    else this.selectedItems.delete(id);
    const allCbs = document.querySelectorAll('.item-select-checkbox');
    const selectAll = document.getElementById('selectAllCheckbox');
    if (selectAll) selectAll.checked = allCbs.length > 0 && Array.from(allCbs).every(cb => cb.checked);
    this.updateBulkButtonStates();
  },

  updateBulkButtonStates() {
    const count = this.selectedItems.size;
    const pdfBtn = document.getElementById('exportPdfBtn');
    const boBtn = document.getElementById('toggleBoBtn');
    if (pdfBtn) {
      pdfBtn.disabled = count === 0;
      pdfBtn.textContent = count > 0 ? `Export PDF (${count})` : 'Export PDF';
    }
    if (boBtn) {
      boBtn.disabled = count === 0;
      boBtn.textContent = count > 0 ? `Toggle B.O. (${count})` : 'Toggle B.O.';
    }
  },

  clearSelection() {
    this.selectedItems.clear();
    const selectAll = document.getElementById('selectAllCheckbox');
    if (selectAll) selectAll.checked = false;
    this.updateBulkButtonStates();
  },

  // ══════════════════════════════════════════════════════════════
  // PDF EXPORT: MODAL
  // ══════════════════════════════════════════════════════════════

  showPdfFieldModal() {
    const modal = document.getElementById('pdfModal');
    const countEl = document.getElementById('pdfItemCount');
    countEl.textContent = `${this.selectedItems.size} item${this.selectedItems.size !== 1 ? 's' : ''} selected`;
    modal.querySelectorAll('input[name="pdfField"]').forEach(cb => { cb.checked = true; });
    modal.style.display = 'flex';
  },

  hidePdfFieldModal() {
    document.getElementById('pdfModal').style.display = 'none';
  },

  getSelectedPdfFields() {
    const fields = {};
    document.querySelectorAll('input[name="pdfField"]').forEach(cb => { fields[cb.value] = cb.checked; });
    return fields;
  },

  // ══════════════════════════════════════════════════════════════
  // PDF EXPORT: IMAGE LOADING
  // ══════════════════════════════════════════════════════════════

  loadImageForPdf(src) {
    return new Promise((resolve) => {
      if (!src) { resolve(null); return; }
      const img = new Image();
      img.crossOrigin = 'anonymous';
      img.onload = () => {
        try {
          const maxDim = 600;
          let w = img.width, h = img.height;
          if (w > maxDim || h > maxDim) {
            if (w > h) { h = Math.round(h * maxDim / w); w = maxDim; }
            else { w = Math.round(w * maxDim / h); h = maxDim; }
          }
          const canvas = document.createElement('canvas');
          canvas.width = w; canvas.height = h;
          canvas.getContext('2d').drawImage(img, 0, 0, w, h);
          resolve({ dataUrl: canvas.toDataURL('image/jpeg', 0.75), w, h });
        } catch (e) { resolve(null); }
      };
      img.onerror = () => { resolve(null); };
      if (src.startsWith('images/full/')) {
        const thumbSrc = src.replace('images/full/', 'images/thumbnails/').replace('.jpg', '-thumb.jpg');
        const testImg = new Image();
        testImg.onload = () => { img.src = thumbSrc; };
        testImg.onerror = () => { img.src = src; };
        testImg.src = thumbSrc;
      } else {
        img.src = src;
      }
    });
  },

  // ══════════════════════════════════════════════════════════════
  // PDF EXPORT: PAGE BUILDERS
  // ══════════════════════════════════════════════════════════════

  addCoverPage(doc, count) {
    const pw = doc.internal.pageSize.getWidth();
    const ph = doc.internal.pageSize.getHeight();
    const cx = pw / 2;

    doc.setFontSize(44);
    doc.setTextColor(26, 26, 46);
    doc.text('Furniture Catalog', cx, ph * 0.35, { align: 'center' });

    doc.setDrawColor(45, 106, 79);
    doc.setLineWidth(2.5);
    doc.line(cx - 100, ph * 0.385, cx + 100, ph * 0.385);

    doc.setFontSize(16);
    doc.setTextColor(108, 117, 125);
    doc.text(`${count} Item${count !== 1 ? 's' : ''} Selected`, cx, ph * 0.43, { align: 'center' });

    doc.setFontSize(11);
    doc.setTextColor(153, 153, 153);
    doc.text('Prices negotiable \u00b7 All items available for immediate sale', cx, ph * 0.48, { align: 'center' });

    doc.setFontSize(10);
    doc.setTextColor(170, 170, 170);
    const today = new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
    doc.text(today, cx, ph * 0.52, { align: 'center' });

    // Contact info
    doc.setDrawColor(45, 106, 79);
    doc.setLineWidth(0.5);
    doc.line(cx - 140, ph * 0.58, cx + 140, ph * 0.58);

    doc.setFontSize(12);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(51, 51, 51);
    doc.text('Contact', cx, ph * 0.62, { align: 'center' });

    doc.setFontSize(11);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(108, 117, 125);
    doc.text('arielmuslera@gmail.com  \u00b7  415-320-0264', cx, ph * 0.66, { align: 'center' });
    doc.text('Pick up in Silver Triangle, Venice', cx, ph * 0.69, { align: 'center' });
  },

  /**
   * Render one item page with 2-column layout:
   * - Title spans full width
   * - Left column (38%): price, retail, description, status, link
   * - Right column (62%): images stacked vertically
   */
  addItemPage(doc, item, fields, imageCache, idx, total) {
    const pw = doc.internal.pageSize.getWidth();   // 612
    const ph = doc.internal.pageSize.getHeight();  // 792
    const margin = 47;
    const contentW = pw - 2 * margin;              // 518
    const footerY = ph - 50;

    // Column layout
    const colGap = 14;
    const textColW = Math.round(contentW * 0.38);  // ~197
    const imgColX = margin + textColW + colGap;
    const imgColW = contentW - textColW - colGap;   // ~307

    let y = margin;

    // ── Contact header ──────────────────────────────────────
    doc.setFontSize(8);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(150, 150, 150);
    doc.text('arielmuslera@gmail.com  \u00b7  415-320-0264  \u00b7  Silver Triangle, Venice', pw / 2, y, { align: 'center' });
    doc.setDrawColor(222, 226, 230);
    doc.setLineWidth(0.3);
    doc.line(margin, y + 6, margin + contentW, y + 6);
    y += 18;

    // ── Title (full width) ─────────────────────────────────
    if (fields.name) {
      doc.setFontSize(18);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(26, 26, 46);
      const nameLines = doc.splitTextToSize(item.name || 'Unnamed Item', contentW);
      y += 22;
      for (let i = 0; i < nameLines.length; i++) {
        doc.text(nameLines[i], margin, y);
        y += 22;
      }
      y += 2;

      // Green HR full width
      doc.setDrawColor(45, 106, 79);
      doc.setLineWidth(2);
      doc.line(margin, y, margin + contentW, y);
      y += 14;
    }

    const colTopY = y;

    // ── LEFT COLUMN: Text ──────────────────────────────────
    let ty = colTopY;

    // Price with Best Offer logic
    if (fields.price) {
      const hasBestOffer = item.bestOffer === true;
      const hasPrice = item.price && item.price > 0;

      doc.setFontSize(22);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(45, 106, 79);

      if (!hasPrice && hasBestOffer) {
        // Make Your Offer
        const moLines = doc.splitTextToSize('Make Your Offer', textColW);
        ty += 22;
        for (const line of moLines) { doc.text(line, margin, ty); ty += 24; }
      } else if (hasPrice && hasBestOffer) {
        // $X or Best Offer
        ty += 22;
        doc.text(`$${item.price.toLocaleString('en-US')}`, margin, ty);
        ty += 16;
        doc.setFontSize(12);
        doc.setFont('helvetica', 'normal');
        doc.text('or Best Offer', margin, ty);
        ty += 6;
      } else if (hasPrice) {
        // Just price
        ty += 22;
        doc.text(`$${item.price.toLocaleString('en-US')}`, margin, ty);
        ty += 6;
      }
      ty += 4;
    }

    // Retail price + savings
    if (fields.retailPrice && item.retailPrice && item.retailPrice > 0) {
      doc.setFontSize(10);
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(173, 181, 189);
      ty += 12;
      doc.text(`Retail: $${item.retailPrice.toLocaleString('en-US')}`, margin, ty);
      if (item.price && item.price > 0 && item.retailPrice !== item.price) {
        ty += 14;
        const savings = item.retailPrice - item.price;
        const pct = Math.round((savings / item.retailPrice) * 100);
        doc.text(`Save $${savings.toLocaleString('en-US')} (${pct}% off)`, margin, ty);
      }
      ty += 10;
    }

    // Description (wrapped to text column width)
    if (fields.description && item.description) {
      ty += 8;
      doc.setFontSize(10);
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(51, 51, 51);
      const descLines = doc.splitTextToSize(item.description, textColW);
      const maxDescLines = Math.max(3, Math.floor((footerY - 40 - ty) / 14));
      const trimmed = descLines.slice(0, maxDescLines);
      for (const line of trimmed) {
        ty += 14;
        doc.text(line, margin, ty);
      }
      ty += 10;
    }

    // Status
    if (fields.status && item.status) {
      doc.setFontSize(9);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(108, 117, 125);
      ty += 14;
      doc.text(`Status: ${item.status.replace(/_/g, " ").split(" ").map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(" ")}`, margin, ty);
      ty += 6;
    }

    // Product link (wrapped in text column)
    if (fields.productLink && item.productLink) {
      doc.setFontSize(8);
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(45, 106, 79);
      ty += 14;
      const linkLines = doc.splitTextToSize(item.productLink, textColW);
      for (const line of linkLines) {
        doc.textWithLink(line, margin, ty, { url: item.productLink });
        ty += 11;
      }
    }

    // ── RIGHT COLUMN: Images stacked ───────────────────────
    if (fields.images && item.images && item.images.length > 0) {
      let iy = colTopY;
      const availImgH = footerY - colTopY - 10;
      const imageSrcs = item.images.slice(0, 4);
      const loadedImages = imageSrcs.map(src => imageCache[src]).filter(Boolean);

      if (loadedImages.length > 0) {
        const imgGap = 8;
        const totalGaps = (loadedImages.length - 1) * imgGap;
        const maxPerImgH = (availImgH - totalGaps) / loadedImages.length;

        for (const imgData of loadedImages) {
          let iw = imgData.w, ih = imgData.h;

          // Scale to column width
          const scaleW = imgColW / iw;
          iw = imgColW;
          ih = ih * scaleW;

          // Cap height
          if (ih > maxPerImgH) {
            const scaleH = maxPerImgH / ih;
            iw = iw * scaleH;
            ih = maxPerImgH;
          }

          // Center in image column
          const ix = imgColX + (imgColW - iw) / 2;
          doc.addImage(imgData.dataUrl, 'JPEG', ix, iy, iw, ih);
          iy += ih + imgGap;
        }
      }
    }

    // ── Footer ─────────────────────────────────────────────
    doc.setDrawColor(222, 226, 230);
    doc.setLineWidth(0.5);
    doc.line(margin, footerY, margin + contentW, footerY);

    doc.setFontSize(7.5);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(170, 170, 170);
    doc.text(`Item ${idx} of ${total}  \u00b7  ${item.id || ''}  \u00b7  All items subject to prior sale`, pw / 2, footerY + 12, { align: 'center' });
  },

  // ══════════════════════════════════════════════════════════════
  // PDF EXPORT: ORCHESTRATOR
  // ══════════════════════════════════════════════════════════════

  async generatePdf() {
    const fields = this.getSelectedPdfFields();
    const allItems = FurnitureData.loadItems();
    let selected = allItems.filter(item => this.selectedItems.has(item.id));

    if (selected.length === 0) {
      this.showMessage('No items selected', 'error');
      return;
    }

    // Sort by price descending (highest value first)
    selected.sort((a, b) => (b.price || 0) - (a.price || 0));

    this.hidePdfFieldModal();
    this.showMessage('Generating PDF...', 'info');

    const btn = document.getElementById('exportPdfBtn');
    btn.disabled = true;
    btn.textContent = 'Generating...';

    try {
      // Pre-load ALL images (up to 4 per item)
      const imageCache = {};
      if (fields.images) {
        for (const item of selected) {
          if (item.images && item.images.length > 0) {
            const imagesToLoad = item.images.slice(0, 4);
            for (const imgSrc of imagesToLoad) {
              if (!imageCache[imgSrc]) {
                const result = await this.loadImageForPdf(imgSrc);
                if (result) imageCache[imgSrc] = result;
              }
            }
          }
        }
      }

      const { jsPDF } = window.jspdf;
      const doc = new jsPDF({ unit: 'pt', format: 'letter' });

      this.addCoverPage(doc, selected.length);

      selected.forEach((item, i) => {
        doc.addPage();
        this.addItemPage(doc, item, fields, imageCache, i + 1, selected.length);
      });

      const dateStr = new Date().toISOString().split('T')[0];
      doc.save(`furniture-catalog-${dateStr}.pdf`);
      this.showMessage(`PDF generated with ${selected.length} item${selected.length !== 1 ? 's' : ''}`, 'success');
    } catch (error) {
      console.error('PDF generation error:', error);
      this.showMessage('Failed to generate PDF: ' + error.message, 'error');
    } finally {
      this.updateBulkButtonStates();
    }
  },

  escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }
};

document.addEventListener('DOMContentLoaded', () => {
  AdminPanel.init();
});
