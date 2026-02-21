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
 * Load furniture data using shared FurnitureData module
 * Seeds localStorage from furniture.json if empty, then loads items
 */
async function loadFurnitureData() {
    try {
        // Use shared data module - seeds from furniture.json if localStorage is empty
        await FurnitureData.init();
        const allItems = FurnitureData.loadItems();

        // Filter out hidden items from public view
        state.furniture = allItems.filter(item => item.hidden !== true);
        console.log('Loaded furniture data:', state.furniture.length, 'items (', allItems.length - state.furniture.length, 'hidden)');

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

    const hasImages = item.images && item.images.length > 0;
    const hasMultiplePhotos = item.images && item.images.length > 1;

    // Build image carousel HTML
    let imagesHTML = '';
    if (hasImages) {
        if (hasMultiplePhotos) {
            imagesHTML = `
                <div class="card-image-carousel" data-item-id="${item.id}">
                    ${item.images.map((img, idx) => `
                        <img
                            src="${img}"
                            alt="${escapeHtml(item.name)} - Photo ${idx + 1}"
                            class="card-image ${idx === 0 ? 'active' : ''}"
                            onclick="openLightbox('${item.id}', ${idx})"
                            onerror="this.src='images/placeholder.jpg'"
                            data-index="${idx}"
                        >
                    `).join('')}
                    <button class="carousel-prev" onclick="event.stopPropagation(); scrollCardImage('${item.id}', -1)">‹</button>
                    <button class="carousel-next" onclick="event.stopPropagation(); scrollCardImage('${item.id}', 1)">›</button>
                    <div class="carousel-dots">
                        ${item.images.map((_, idx) => `
                            <span class="dot ${idx === 0 ? 'active' : ''}" onclick="event.stopPropagation(); setCardImage('${item.id}', ${idx})"></span>
                        `).join('')}
                    </div>
                </div>
            `;
        } else {
            imagesHTML = `
                <img
                    src="${item.images[0]}"
                    alt="${escapeHtml(item.name)}"
                    class="card-image"
                    onclick="openLightbox('${item.id}', 0)"
                    onerror="this.src='images/placeholder.jpg'"
                >
            `;
        }
    } else {
        imagesHTML = '<div class="card-no-image">No Image</div>';
    }

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
            ${imagesHTML}
            <div class="card-status-badge ${item.status}">${formatStatus(item.status)}</div>
            ${photoCountBadge}
        </div>
        <div class="card-content">
            <h3 class="card-title">${escapeHtml(item.name)}</h3>
            <p class="card-description">${escapeHtml(item.description)}</p>
            ${item.productLink ? `
                <div class="card-product-link">
                    <a href="${escapeHtml(item.productLink)}" target="_blank" rel="noopener noreferrer" onclick="event.stopPropagation()">
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"></path>
                            <polyline points="15 3 21 3 21 9"></polyline>
                            <line x1="10" y1="14" x2="21" y2="3"></line>
                        </svg>
                        Product Details
                    </a>
                </div>
            ` : ''}
            <div class="card-footer">
                <div class="card-price-section">
                    ${item.retailPrice ? `<div class="card-retail-price">$${item.retailPrice.toLocaleString()}</div>` : ''}
                    <div class="card-price">$${item.price.toLocaleString()}</div>
                </div>
                ${hasMultiplePhotos ? `<a class="card-view-all" onclick="openLightbox('${item.id}', 0)">View All Photos</a>` : ''}
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

// ========================================
// Card Image Carousel Functions
// ========================================

function scrollCardImage(itemId, direction) {
    const carousel = document.querySelector(`.card-image-carousel[data-item-id="${itemId}"]`);
    if (!carousel) return;

    const images = carousel.querySelectorAll('.card-image');
    const dots = carousel.querySelectorAll('.dot');
    const currentIndex = Array.from(images).findIndex(img => img.classList.contains('active'));
    let newIndex = currentIndex + direction;

    // Wrap around
    if (newIndex < 0) newIndex = images.length - 1;
    if (newIndex >= images.length) newIndex = 0;

    // Update images
    images[currentIndex].classList.remove('active');
    images[newIndex].classList.add('active');

    // Update dots
    dots[currentIndex].classList.remove('active');
    dots[newIndex].classList.add('active');
}

function setCardImage(itemId, index) {
    const carousel = document.querySelector(`.card-image-carousel[data-item-id="${itemId}"]`);
    if (!carousel) return;

    const images = carousel.querySelectorAll('.card-image');
    const dots = carousel.querySelectorAll('.dot');
    const currentIndex = Array.from(images).findIndex(img => img.classList.contains('active'));

    if (currentIndex === index) return;

    // Update images
    images[currentIndex].classList.remove('active');
    images[index].classList.add('active');

    // Update dots
    dots[currentIndex].classList.remove('active');
    dots[index].classList.add('active');
}

// Expose functions to global scope for inline event handlers
window.openLightbox = openLightbox;
window.closeLightbox = closeLightbox;
window.scrollCardImage = scrollCardImage;
window.setCardImage = setCardImage;
