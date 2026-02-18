/**
 * Load Categories for MainPage
 * Dynamically loads and displays categories from database on MainPage.html
 */

// Immediate execution test
console.log('[Categories] load_mainpage_categories.js file loaded and executing');

/**
 * Generate section ID from category name
 * (Same logic as generateSectionId in load_products.js for consistency)
 */
function generateCategorySectionId(categoryName) {
    return categoryName
        .toLowerCase()
        .replace(/&/g, '')
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-|-$/g, '') + '-products';
}

/**
 * Load categories from API and display them in navbar dropdown
 */
async function loadMainPageCategories() {
    console.log('[Categories] loadMainPageCategories function called');
    try {
        console.log('[Categories] Looking for categories dropdown...');
        const categoriesDropdown = document.getElementById('categories-dropdown-menu');
        if (!categoriesDropdown) {
            console.error('[Categories] ERROR: Categories dropdown (#categories-dropdown-menu) not found in DOM');
            return;
        }
        console.log('[Categories] Categories dropdown found');

        // Add timestamp and random number to prevent caching
        const timestamp = new Date().getTime();
        const random = Math.random().toString(36).substring(7);
        const apiUrl = `../api/get_categories.php?t=${timestamp}&r=${random}`;
        console.log('[Categories] Fetching categories from:', apiUrl);
        
        const response = await fetch(apiUrl, {
            method: 'GET',
            credentials: 'include',
            cache: 'no-store',
            headers: {
                'Cache-Control': 'no-cache, no-store, must-revalidate',
                'Pragma': 'no-cache',
                'Expires': '0'
            }
        });

        console.log('[Categories] API response status:', response.status, response.statusText);
        
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }

        const data = await response.json();
        console.log('[Categories] API response data:', data);

        if (data.success && data.categories && data.categories.length > 0) {
            // Clear existing categories
            categoriesDropdown.innerHTML = '';
            
            // Add dropdown header
            const dropdownHeader = document.createElement('div');
            dropdownHeader.className = 'dropdown-header';
            dropdownHeader.style.cssText = 'padding: 12px 20px 8px; font-weight: 600; color: var(--primary-red); font-size: 0.85rem; text-transform: uppercase; letter-spacing: 0.5px; border-bottom: 1px solid #e9ecef;';
            dropdownHeader.innerHTML = '<i class="fas fa-th-large mr-2"></i>Browse Categories';
            categoriesDropdown.appendChild(dropdownHeader);

            // Sort categories by display_order
            const sortedCategories = [...data.categories].sort((a, b) => {
                const orderA = a.display_order || 0;
                const orderB = b.display_order || 0;
                if (orderA !== orderB) {
                    return orderA - orderB;
                }
                // If same order, sort alphabetically
                const nameA = (a.category_name || '').toLowerCase();
                const nameB = (b.category_name || '').toLowerCase();
                return nameA.localeCompare(nameB);
            });

            sortedCategories.forEach((category) => {
                const categoryName = category.category_name || category;
                // Ensure icon is always set - default to bolt for Electrical if missing
                let categoryIcon = category.category_icon || 'fas fa-box';
                if (categoryName.toLowerCase().includes('electrical') && !category.category_icon) {
                    categoryIcon = 'fas fa-bolt';
                }
                const sectionId = generateCategorySectionId(categoryName);

                // Debug log for Electrical category
                if (categoryName.toLowerCase().includes('electrical')) {
                    console.log('[Categories] Electrical category found:', {
                        name: categoryName,
                        icon: categoryIcon,
                        originalIcon: category.category_icon
                    });
                }

                // Create dropdown item
                const dropdownItem = document.createElement('a');
                dropdownItem.className = 'dropdown-item';
                dropdownItem.href = `#${sectionId}`;
                dropdownItem.setAttribute('role', 'button');
                dropdownItem.innerHTML = `
                    <i class="${categoryIcon}"></i>
                    <span>${escapeHtml(categoryName)}</span>
                `;
                
                // Add click handler to scroll to section
                dropdownItem.addEventListener('click', function(e) {
                    e.preventDefault();
                    const targetSection = document.getElementById(sectionId);
                    if (targetSection) {
                        // Add a small delay for smooth dropdown close animation
                        setTimeout(() => {
                            targetSection.scrollIntoView({ behavior: 'smooth', block: 'start' });
                        }, 100);
                        
                        // Close dropdown (works on both desktop and mobile)
                        const dropdownToggle = document.getElementById('categoriesDropdown');
                        if (dropdownToggle && typeof $ !== 'undefined') {
                            $(dropdownToggle).dropdown('hide');
                        } else if (dropdownToggle) {
                            // Fallback if jQuery not available
                            dropdownToggle.classList.remove('show');
                            categoriesDropdown.classList.remove('show');
                        }
                    }
                });

                categoriesDropdown.appendChild(dropdownItem);
            });

            console.log('Categories loaded successfully:', data.categories.length);
            console.log('Categories from database:', data.categories.map(c => ({ name: c.category_name, icon: c.category_icon, order: c.display_order })));
        } else {
            console.warn('No categories found or failed to load categories');
            // Show error message if API fails
            categoriesDropdown.innerHTML = `
                <div class="dropdown-item-text text-muted text-center">
                    <small>Unable to load categories. Please refresh the page.</small>
                </div>
            `;
        }
    } catch (error) {
        console.error('Error loading categories:', error);
        // Show error message if API fails
        const categoriesDropdown = document.getElementById('categories-dropdown-menu');
        if (categoriesDropdown) {
            categoriesDropdown.innerHTML = `
                <div class="dropdown-item-text text-muted text-center">
                    <small>Error loading categories. Please refresh the page.</small>
                </div>
            `;
        }
    }
}

/**
 * Escape HTML to prevent XSS
 */
function escapeHtml(text) {
    if (!text) return '';
    const map = {
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        '"': '&quot;',
        "'": '&#039;'
    };
    return text.replace(/[&<>"']/g, m => map[m]);
}

// Load categories when DOM is ready
console.log('[Categories] Script loaded, initializing...');

// Use a small delay to ensure all scripts are loaded
function initMainPageCategories() {
    console.log('[Categories] initMainPageCategories called, readyState:', document.readyState);
    
    // Function to check if dropdown exists and load categories
    function tryLoadCategories() {
        const dropdown = document.getElementById('categories-dropdown-menu');
        if (!dropdown) {
            console.warn('[Categories] Dropdown not found yet, retrying...');
            setTimeout(tryLoadCategories, 200);
            return;
        }
        console.log('[Categories] Dropdown found, loading categories...');
        loadMainPageCategories();
    }
    
    // Wait a bit for DOM to be fully ready
    if (document.readyState === 'loading') {
        console.log('[Categories] DOM still loading, waiting for DOMContentLoaded...');
        document.addEventListener('DOMContentLoaded', function() {
            console.log('[Categories] DOMContentLoaded fired, waiting for dropdown...');
            setTimeout(tryLoadCategories, 100);
        });
    } else {
        console.log('[Categories] DOM already ready, waiting for dropdown...');
        setTimeout(tryLoadCategories, 100);
    }
}

// Start initialization
initMainPageCategories();
