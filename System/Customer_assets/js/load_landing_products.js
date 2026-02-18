/**
 * Load Products for Landing Page
 * Dynamically loads and displays products from database on LandingPage.html
 */

// Category mapping for landing page sections (loaded dynamically from database)
let categoryMapping = {};

/**
 * Generate section ID from category name
 */
function generateCategorySectionId(categoryName) {
    return categoryName
        .toLowerCase()
        .replace(/&/g, '')
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-|-$/g, '') + '-products';
}

/**
 * Load categories from API and build mapping
 */
async function loadCategoriesForProducts() {
    try {
        const timestamp = new Date().getTime();
        const isRoot = window.location.pathname.includes('/index.html') || window.location.pathname.endsWith('/') || window.location.pathname === '/MatarixWEB/';
        const apiPath = isRoot ? 'api/get_categories.php' : '../api/get_categories.php';
        const response = await fetch(`${apiPath}?t=${timestamp}`, {
            method: 'GET',
            credentials: 'include',
            cache: 'no-cache'
        });
        
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        
        const data = await response.json();
        
        if (data.success && data.categories) {
            // Build category mapping dynamically
            categoryMapping = {};
            data.categories.forEach(category => {
                const categoryName = category.category_name || category;
                categoryMapping[categoryName] = {
                    sectionId: generateCategorySectionId(categoryName),
                    icon: category.category_icon || 'fas fa-box',
                    title: categoryName,
                    display_order: category.display_order || 0
                };
            });
            return true;
        } else {
            console.warn('Failed to load categories, using fallback');
            return false;
        }
    } catch (error) {
        console.error('Error loading categories:', error);
        // Use fallback mapping
        return false;
    }
}

// Default product image (fallback)
const defaultProductImage = 'Customer_assets/images/Slice 15 (2).png';

/**
 * Get product image based on product data
 */
function getProductImage(product) {
    // Check if we're in root (index.html) or Customer folder
    const isRoot = window.location.pathname.includes('/index.html') || window.location.pathname.endsWith('/') || window.location.pathname === '/MatarixWEB/';
    const pathPrefix = isRoot ? '' : '../';
    
    // Use image_path from database if available
    if (product.image_path) {
        // If image_path already starts with Customer_assets, use it as is for root, or add ../ for subfolder
        if (product.image_path.startsWith('Customer_assets/')) {
            return isRoot ? product.image_path : '../' + product.image_path;
        }
        return pathPrefix + product.image_path;
    }
    // Fallback to default image
    return isRoot ? defaultProductImage : '../' + defaultProductImage;
}

/**
 * Format price with peso sign
 */
function formatPrice(price) {
    return '₱' + parseFloat(price).toLocaleString('en-US', {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2
    });
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
    return String(text).replace(/[&<>"']/g, m => map[m]);
}

/**
 * Create product card HTML
 */
function createProductCard(product) {
    const imageUrl = getProductImage(product);
    const price = formatPrice(product.price);
    const productId = product.product_id;
    const productName = escapeHtml(product.product_name || 'Unnamed Product');
    
    // Check if we're in root (index.html) or Customer folder
    const isRoot = window.location.pathname.includes('/index.html') || window.location.pathname.endsWith('/') || window.location.pathname === '/MatarixWEB/';
    const cartLink = isRoot ? 'Customer/Cart.html' : 'Cart.html';
    
    return `
        <div class="col-lg-3 col-md-6 col-sm-6 mb-4">
            <div class="product-card">
                <div class="product-image">
                    <img src="${imageUrl}" alt="${productName}" style="max-width: 100%; height: 200px; object-fit: cover;">
                </div>
                <div class="product-info">
                    <h5 class="product-title">${productName}</h5>
                    <p class="product-price">${price}</p>
                    <a href="#" class="btn btn-primary-red btn-sm add-to-cart-btn-landing" data-product-id="${productId}" data-product-name="${productName}" data-price="${product.price}" data-cart-link="${cartLink}">Add to Cart</a>
                </div>
            </div>
        </div>
    `;
}

/**
 * Create category section HTML
 */
function createCategorySection(categoryName, products) {
    const category = categoryMapping[categoryName];
    if (!category) {
        console.warn(`Category mapping not found for: ${categoryName}`);
        return '';
    }
    
    const productsHtml = products.map(product => createProductCard(product)).join('');
    
    return `
        <div id="${category.sectionId}" class="category-products-section">
            <h3 class="category-products-title">
                <i class="${category.icon} category-title-icon"></i>
                ${escapeHtml(category.title)}
            </h3>
            <div class="row">
                ${productsHtml}
            </div>
        </div>
    `;
}

/**
 * Load products from API and display them
 */
async function loadLandingProducts() {
    try {
        // First, load categories to build the mapping
        await loadCategoriesForProducts();
        
        // Show loading state
        const productsSection = document.getElementById('products');
        if (!productsSection) {
            console.error('Products section not found');
            return;
        }
        
        // Add timestamp to prevent caching
        const timestamp = new Date().getTime();
        // Check if we're in root (index.html) or Customer folder
        const isRoot = window.location.pathname.includes('/index.html') || window.location.pathname.endsWith('/') || window.location.pathname === '/MatarixWEB/';
        const apiPath = isRoot ? 'api/get_products.php' : '../api/get_products.php';
        const response = await fetch(`${apiPath}?t=${timestamp}`, {
            method: 'GET',
            credentials: 'include',
            cache: 'no-cache'
        });
        
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        
        const data = await response.json();
        
        if (data.success && data.products) {
            // Group products by category, using database category names when available
            const productsByCategory = {};
            
            data.products.forEach(product => {
                // Prefer category_name from API join (updated category name from database)
                // Fall back to product.category if category_name not available
                let category = product.category_name || product.category || 'Uncategorized';
                
                // Try to find matching database category (case-insensitive, trim whitespace)
                const normalizedCategory = category.trim();
                const dbCategoryName = Object.keys(categoryMapping).find(
                    dbCat => dbCat.trim().toLowerCase() === normalizedCategory.toLowerCase()
                );
                
                // Always use database category name if found (this ensures updated names are used)
                // Otherwise use the normalized category from product
                const categoryKey = dbCategoryName || normalizedCategory;
                
                if (!productsByCategory[categoryKey]) {
                    productsByCategory[categoryKey] = [];
                }
                productsByCategory[categoryKey].push(product);
            });
            
            // Find the container for products (after the "All Products" title)
            const productsContainer = productsSection.querySelector('.container');
            if (!productsContainer) {
                console.error('Products container not found');
                return;
            }
            
            // Hide loading message
            const loadingDiv = document.getElementById('products-loading');
            if (loadingDiv) {
                loadingDiv.style.display = 'none';
            }
            
            // Remove all existing category sections (static products)
            const existingSections = productsContainer.querySelectorAll('.category-products-section');
            existingSections.forEach(section => section.remove());
            
            // Create and append category sections in the order defined in categoryMapping
            // Sort by display_order if available, otherwise by name
            const sortedCategories = Object.keys(categoryMapping).sort((a, b) => {
                const catA = categoryMapping[a];
                const catB = categoryMapping[b];
                return (catA.display_order || 0) - (catB.display_order || 0) || a.localeCompare(b);
            });
            
            sortedCategories.forEach(categoryName => {
                if (productsByCategory[categoryName] && productsByCategory[categoryName].length > 0) {
                    // Check if section already exists and update it instead of creating new one
                    const sectionId = categoryMapping[categoryName]?.sectionId || generateCategorySectionId(categoryName);
                    let existingSection = document.getElementById(sectionId);
                    
                    if (existingSection) {
                        // Update existing section title if category name changed
                        const titleElement = existingSection.querySelector('.category-products-title');
                        if (titleElement && categoryMapping[categoryName]) {
                            titleElement.innerHTML = `
                                <i class="${categoryMapping[categoryName].icon} category-title-icon"></i>
                                ${escapeHtml(categoryMapping[categoryName].title)}
                            `;
                        }
                        // Update products in existing section
                        const rowContainer = existingSection.querySelector('.row');
                        if (rowContainer) {
                            rowContainer.innerHTML = productsByCategory[categoryName].map(product => createProductCard(product)).join('');
                        }
                    } else {
                        // Create new section
                        const sectionHtml = createCategorySection(categoryName, productsByCategory[categoryName]);
                        productsContainer.insertAdjacentHTML('beforeend', sectionHtml);
                    }
                }
            });
            
            // If there are products in uncategorized or unknown categories, add them at the end
            Object.keys(productsByCategory).forEach(categoryName => {
                if (!categoryMapping[categoryName] && productsByCategory[categoryName].length > 0) {
                    const sectionId = generateCategorySectionId(categoryName);
                    const sectionHtml = `
                        <div id="${sectionId}" class="category-products-section">
                            <h3 class="category-products-title">
                                <i class="fas fa-box category-title-icon"></i>
                                ${escapeHtml(categoryName)}
                            </h3>
                            <div class="row">
                                ${productsByCategory[categoryName].map(product => createProductCard(product)).join('')}
                            </div>
                        </div>
                    `;
                    productsContainer.insertAdjacentHTML('beforeend', sectionHtml);
                }
            });
            
            console.log(`Loaded ${data.products.length} products across ${Object.keys(productsByCategory).length} categories`);
        } else {
            console.error('Failed to load products:', data.message || 'Unknown error');
            // Hide loading message
            const loadingDiv = document.getElementById('products-loading');
            if (loadingDiv) {
                loadingDiv.style.display = 'none';
            }
            // Show error message to user
            const productsContainer = productsSection.querySelector('.container');
            if (productsContainer) {
                productsContainer.insertAdjacentHTML('beforeend', `
                    <div class="alert alert-warning text-center">
                        <p>Unable to load products at this time. Please try again later.</p>
                    </div>
                `);
            }
        }
    } catch (error) {
        console.error('Error loading products:', error);
        // Hide loading message
        const loadingDiv = document.getElementById('products-loading');
        if (loadingDiv) {
            loadingDiv.style.display = 'none';
        }
        // Show error message to user
        const productsSection = document.getElementById('products');
        if (productsSection) {
            const productsContainer = productsSection.querySelector('.container');
            if (productsContainer) {
                productsContainer.insertAdjacentHTML('beforeend', `
                    <div class="alert alert-danger text-center">
                        <p>Error loading products: ${error.message}</p>
                    </div>
                `);
            }
        }
    }
}

/**
 * Show login/register modal
 */
function showLoginModal() {
    // Check if modal already exists
    let modal = document.getElementById('loginRequiredModal');
    if (!modal) {
        // Create modal HTML
        modal = document.createElement('div');
        modal.id = 'loginRequiredModal';
        modal.className = 'modal fade';
        modal.setAttribute('tabindex', '-1');
        modal.setAttribute('role', 'dialog');
        modal.innerHTML = `
            <div class="modal-dialog modal-dialog-centered" role="document">
                <div class="modal-content">
                    <div class="modal-header" style="border-bottom: 1px solid #dee2e6;">
                        <h5 class="modal-title" style="color: #333; font-weight: 600;">Login Required</h5>
                        <button type="button" class="close" data-dismiss="modal" aria-label="Close">
                            <span aria-hidden="true">&times;</span>
                        </button>
                    </div>
                    <div class="modal-body" style="padding: 30px; text-align: center;">
                        <i class="fas fa-lock" style="font-size: 48px; color: #dc3545; margin-bottom: 20px;"></i>
                        <h4 style="color: #333; margin-bottom: 15px;">You need to login or register</h4>
                        <p style="color: #666; margin-bottom: 25px;">Please login to your account or create a new account to add items to your cart.</p>
                        <div style="display: flex; gap: 15px; justify-content: center;">
                            <a href="Customer/Login.html" class="btn btn-primary" style="background-color: #dc3545; border-color: #dc3545; padding: 10px 30px; font-weight: 600;">Login</a>
                            <a href="Customer/Registration.html" class="btn btn-outline-primary" style="border-color: #dc3545; color: #dc3545; padding: 10px 30px; font-weight: 600;">Register</a>
                        </div>
                    </div>
                </div>
            </div>
        `;
        document.body.appendChild(modal);
    }
    
    // Show modal using Bootstrap
    if (typeof jQuery !== 'undefined' && jQuery.fn.modal) {
        jQuery(modal).modal('show');
    } else {
        // Fallback if Bootstrap/jQuery not available
        modal.style.display = 'block';
        modal.style.backgroundColor = 'rgba(0,0,0,0.5)';
    }
}

/**
 * Setup Add to Cart button handlers for landing page
 */
function setupAddToCartHandlers() {
    // Use event delegation for dynamically added buttons
    document.addEventListener('click', function(e) {
        const btn = e.target.closest('.add-to-cart-btn-landing');
        if (!btn) return;
        
        e.preventDefault();
        
        // Check if user is logged in
        const userId = sessionStorage.getItem('user_id');
        
        if (!userId) {
            // User not logged in - show modal
            showLoginModal();
        } else {
            // User is logged in - proceed to cart
            const cartLink = btn.getAttribute('data-cart-link');
            const productId = btn.getAttribute('data-product-id');
            const price = btn.getAttribute('data-price');
            
            window.location.href = `${cartLink}?add=product-${productId}&price=${price}`;
        }
    });
}

// Load products when DOM is ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', function() {
        loadLandingProducts();
        setupAddToCartHandlers();
    });
} else {
    // DOM is already ready
    loadLandingProducts();
    setupAddToCartHandlers();
}

