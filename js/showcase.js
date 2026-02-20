/**
 * Furniture Showcase - Main JavaScript
 * Handles data loading, filtering, sorting, search, and lightbox functionality
 */

// ========================================
// State Management
// ========================================

const state = {
    furniture: [],
    filteredFurniture: [],
    currentFilter: 'all',
    currentSort: 'default',
    searchQuery: '',
    lightbox: {
        isOpen: false,
        currentItem: null,
        currentImageIndex: 0
    }
};

// ========================================
// DOM Elements
// ========================================

const elements = {
    furnitureGrid: document.getElementById('furnitureGrid'),
    searchInput: document.getElementById('searchInput'),
    sortSelect: document.getElementById('sortSelect'),
    filterButtons: document.querySelectorAll('.filter-btn'),
    resultsCount: document.getElementById('resultsCount'),
    emptyState: document.getElementById('emptyState'),
    loadingState: document.getElementById('loadingState'),
    lightbox: document.getElementById('lightbox'),
    lightboxImage: document.getElementById('lightboxImage'),
    lightboxTitle: document.getElementById('lightboxTitle'),
    lightboxCounter: document.getElementById('lightboxCounter'),
    lightboxClose: document.getElementById('lightboxClose'),
    lightboxPrev: document.getElementById('lightboxPrev'),
    lightboxNext: document.getElementById('lightboxNext'),
    lightboxOverlay: document.getElementById('lightboxOverlay')
};

// ========================================
// Data Loading
// ========================================

/**
 * Load furniture data from localStorage or furniture.json
 */
async function loadFurnitureData() {
    try {
        // Try localStorage first
        const localData = localStorage.getItem('furnitureData');

        if (localData) {
            const data = JSON.parse(localData);
            state.furniture = data.items || [];
            console.log('Loaded furniture data from localStorage:', state.furniture.length, 'items');
        } else {
            // Fallback to furniture.json
            const response = await fetch('data/furniture.json');

            if (response.ok) {
                const data = await response.json();
                state.furniture = data.items || [];
                console.log('Loaded furniture data from furniture.json:', state.furniture.length, 'items');
            } else {
                // No data available, use empty array
                state.furniture = [];
                console.log('No furniture data available');
            }
        }

        // Initialize the app
        state.filteredFurniture = [...state.furniture];
        renderFurniture();
        updateResultsCount();

    } catch (error) {
        console.error('Error loading furniture data:', error);
        state.furniture = [];
        state.filteredFurniture = [];
        renderFurniture();
    } finally {
        hideLoading();
    }
}

/**
 * Hide loading state
 */
function hideLoading() {
    if (elements.loadingState) {
        elements.loadingState.style.display = 'none';
    }
}

// ========================================
// Rendering Functions
// ========================================

/**
 * Render furniture cards to the grid
 */
function renderFurniture() {
    const grid = elements.furnitureGrid;

    if (!grid) return;

    // Clear the grid
    grid.innerHTML = '';

    // Show empty state if no results
    if (state.filteredFurniture.length === 0) {
        elements.emptyState.style.display = 'block';
        return;
    } else {
        elements.emptyState.style.display = 'none';
    }

    // Render each furniture item
    state.filteredFurniture.forEach(item => {
        const card = createFurnitureCard(item);
        grid.appendChild(card);
    });
}

/**
 * Create a furniture card element
 */
function createFurnitureCard(item) {
    const card = document.createElement('div');
    card.className = 'furniture-card';
    card.dataset.itemId = item.id;

    const primaryImage = item.images && item.images.length > 0
        ? item.images[0]
        : 'images/placeholder.jpg';

    const hasMultiplePhotos = item.images && item.images.length > 1;
    const photoCountBadge = hasMultiplePhotos
        ? `<div class="card-photo-count">
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect>
                <circle cx="8.5" cy="8.5" r="1.5"></circle>
                <polyline points="21 15 16 10 5 21"></polyline>
            </svg>
            ${item.images.length}
           </div>`
        : '';

    card.innerHTML = `
        <div class="card-image-container">
            <img
                src="${primaryImage}"
                alt="${escapeHtml(item.name)}"
                class="card-image"
                onclick="openLightbox('${item.id}', 0)"
                onerror="this.src='images/placeholder.jpg'"
            >
            <div class="card-status-badge ${item.status}">${formatStatus(item.status)}</div>
            ${photoCountBadge}
        </div>
        <div class="card-content">
            <h3 class="card-title">${escapeHtml(item.name)}</h3>
            <p class="card-description">${escapeHtml(item.description)}</p>
            <div class="card-footer">
                <div class="card-price">$${item.price.toLocaleString()}</div>
                ${hasMultiplePhotos ? `<a class="card-view-photos" onclick="openLightbox('${item.id}', 0)">View Photos</a>` : ''}
            </div>
        </div>
    `;

    return card;
}

/**
 * Format status for display
 */
function formatStatus(status) {
    const statusMap = {
        'available': 'Available',
        'pending': 'Pending',
        'sold': 'Sold'
    };
    return statusMap[status] || status;
}

/**
 * Escape HTML to prevent XSS
 */
function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

/**
 * Update results count text
 */
function updateResultsCount() {
    const total = state.furniture.length;
    const showing = state.filteredFurniture.length;

    let text = `Showing ${showing} of ${total} item${total !== 1 ? 's' : ''}`;

    if (state.currentFilter !== 'all') {
        text += ` (${formatStatus(state.currentFilter)})`;
    }

    if (state.searchQuery) {
        text += ` matching "${state.searchQuery}"`;
    }

    elements.resultsCount.textContent = text;
}

// ========================================
// Filtering & Sorting
// ========================================

/**
 * Apply filters and sorting to furniture data
 */
function applyFiltersAndSort() {
    let result = [...state.furniture];

    // Apply status filter
    if (state.currentFilter !== 'all') {
        result = result.filter(item => item.status === state.currentFilter);
    }

    // Apply search filter
    if (state.searchQuery) {
        const query = state.searchQuery.toLowerCase();
        result = result.filter(item => {
            return (
                item.name.toLowerCase().includes(query) ||
                item.description.toLowerCase().includes(query)
            );
        });
    }

    // Apply sorting
    result = sortFurniture(result, state.currentSort);

    state.filteredFurniture = result;
    renderFurniture();
    updateResultsCount();
}

/**
 * Sort furniture array by specified method
 */
function sortFurniture(items, method) {
    const sorted = [...items];

    switch (method) {
        case 'price-low':
            return sorted.sort((a, b) => a.price - b.price);

        case 'price-high':
            return sorted.sort((a, b) => b.price - a.price);

        case 'newest':
            return sorted.sort((a, b) => new Date(b.dateAdded) - new Date(a.dateAdded));

        case 'oldest':
            return sorted.sort((a, b) => new Date(a.dateAdded) - new Date(b.dateAdded));

        case 'default':
        default:
            // Default order (by dateAdded, newest first)
            return sorted.sort((a, b) => new Date(b.dateAdded) - new Date(a.dateAdded));
    }
}

/**
 * Handle filter button clicks
 */
function handleFilterClick(filterValue) {
    state.currentFilter = filterValue;

    // Update button states
    elements.filterButtons.forEach(btn => {
        if (btn.dataset.filter === filterValue) {
            btn.classList.add('active');
        } else {
            btn.classList.remove('active');
        }
    });

    applyFiltersAndSort();
}

/**
 * Handle sort selection change
 */
function handleSortChange(sortValue) {
    state.currentSort = sortValue;
    applyFiltersAndSort();
}

/**
 * Handle search input
 */
function handleSearch(query) {
    state.searchQuery = query.trim();
    applyFiltersAndSort();
}

// ========================================
// Lightbox Functions
// ========================================

/**
 * Open lightbox with specific item and image index
 */
function openLightbox(itemId, imageIndex = 0) {
    const item = state.furniture.find(i => i.id === itemId);

    if (!item || !item.images || item.images.length === 0) {
        console.error('Item not found or has no images:', itemId);
        return;
    }

    state.lightbox.isOpen = true;
    state.lightbox.currentItem = item;
    state.lightbox.currentImageIndex = imageIndex;

    updateLightboxContent();
    elements.lightbox.style.display = 'block';
    document.body.style.overflow = 'hidden'; // Prevent background scrolling
}

/**
 * Close lightbox
 */
function closeLightbox() {
    state.lightbox.isOpen = false;
    state.lightbox.currentItem = null;
    state.lightbox.currentImageIndex = 0;

    elements.lightbox.style.display = 'none';
    document.body.style.overflow = ''; // Restore scrolling
}

/**
 * Navigate to previous image in lightbox
 */
function previousImage() {
    if (!state.lightbox.currentItem) return;

    const totalImages = state.lightbox.currentItem.images.length;
    state.lightbox.currentImageIndex = (state.lightbox.currentImageIndex - 1 + totalImages) % totalImages;
    updateLightboxContent();
}

/**
 * Navigate to next image in lightbox
 */
function nextImage() {
    if (!state.lightbox.currentItem) return;

    const totalImages = state.lightbox.currentItem.images.length;
    state.lightbox.currentImageIndex = (state.lightbox.currentImageIndex + 1) % totalImages;
    updateLightboxContent();
}

/**
 * Update lightbox content with current image
 */
function updateLightboxContent() {
    const item = state.lightbox.currentItem;
    const index = state.lightbox.currentImageIndex;

    if (!item || !item.images) return;

    elements.lightboxImage.src = item.images[index];
    elements.lightboxImage.alt = item.name;
    elements.lightboxTitle.textContent = item.name;
    elements.lightboxCounter.textContent = `${index + 1} / ${item.images.length}`;

    // Enable/disable navigation buttons
    const totalImages = item.images.length;
    elements.lightboxPrev.disabled = totalImages <= 1;
    elements.lightboxNext.disabled = totalImages <= 1;
}

// ========================================
// Event Listeners
// ========================================

/**
 * Initialize event listeners
 */
function initEventListeners() {
    // Filter buttons
    elements.filterButtons.forEach(btn => {
        btn.addEventListener('click', () => {
            handleFilterClick(btn.dataset.filter);
        });
    });

    // Sort select
    elements.sortSelect.addEventListener('change', (e) => {
        handleSortChange(e.target.value);
    });

    // Search input with debounce
    let searchTimeout;
    elements.searchInput.addEventListener('input', (e) => {
        clearTimeout(searchTimeout);
        searchTimeout = setTimeout(() => {
            handleSearch(e.target.value);
        }, 300);
    });

    // Lightbox controls
    elements.lightboxClose.addEventListener('click', closeLightbox);
    elements.lightboxOverlay.addEventListener('click', closeLightbox);
    elements.lightboxPrev.addEventListener('click', previousImage);
    elements.lightboxNext.addEventListener('click', nextImage);

    // Keyboard navigation for lightbox
    document.addEventListener('keydown', (e) => {
        if (!state.lightbox.isOpen) return;

        if (e.key === 'Escape') {
            closeLightbox();
        } else if (e.key === 'ArrowLeft') {
            previousImage();
        } else if (e.key === 'ArrowRight') {
            nextImage();
        }
    });

    // Listen for localStorage changes (for admin panel sync)
    window.addEventListener('storage', (e) => {
        if (e.key === 'furnitureData') {
            console.log('Furniture data updated, reloading...');
            loadFurnitureData();
        }
    });
}

// ========================================
// Initialization
// ========================================

/**
 * Initialize the application
 */
function init() {
    console.log('Initializing Furniture Showcase...');
    initEventListeners();
    loadFurnitureData();
}

// Start the app when DOM is ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
} else {
    init();
}

// Expose functions to global scope for inline event handlers
window.openLightbox = openLightbox;
window.closeLightbox = closeLightbox;
