/**
 * Load Archive for Admin
 * Dynamically loads and displays archived products with restore functionality
 */

// Format price
function formatPrice(price) {
    return '₱' + parseFloat(price).toLocaleString('en-US', {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2
    });
}

// Get product image
function getProductImage(product) {
    if (product.image_path) {
        // Normalize path: replace spaces with underscores in folder names
        // Fix common issue: "Admin assets" -> "Admin_assets"
        let normalizedPath = product.image_path.replace(/Admin assets/g, 'Admin_assets');
        normalizedPath = normalizedPath.replace(/Customer assets/g, 'Customer_assets');
        return '../' + normalizedPath;
    }
    return '../Customer_assets/images/PreviewMain.png';
}

// Get status badge class
function getStatusBadgeClass(status) {
    const statusMap = {
        'In Stock': 'status-in-stock',
        'Low Stock': 'status-low-stock',
        'Out of Stock': 'status-out-of-stock'
    };
    return statusMap[status] || 'status-in-stock';
}

// Format date
function formatDate(dateString) {
    if (!dateString) return 'N/A';
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
    });
}

// Create archived product row HTML
function createArchivedProductRow(product) {
    const image = getProductImage(product);
    const statusClass = getStatusBadgeClass(product.stock_status);
    const fallbackImage = 'data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7';
    
    // Escape HTML to prevent XSS
    function escapeHtml(text) {
        if (!text) return 'Uncategorized';
        const map = {
            '&': '&amp;',
            '<': '&lt;',
            '>': '&gt;',
            '"': '&quot;',
            "'": '&#039;'
        };
        return text.replace(/[&<>"']/g, m => map[m]);
    }
    
    const categoryName = escapeHtml(product.category || 'Uncategorized');
    const archivedBy = escapeHtml(product.archived_by_name || product.archived_by_email || 'Unknown');
    const archivedDate = formatDate(product.archived_at);
    
    return `
        <tr class="product-row archived-row" data-product-id="${product.Product_ID}">
            <td>
                <div class="product-info">
                    <img src="${image}" alt="${escapeHtml(product.Product_Name)}" class="product-image" onerror="if(this.dataset.retried!=='true'){this.dataset.retried='true';this.src='../Customer_assets/images/PreviewMain.png';}else{this.onerror=null;this.src='${fallbackImage}';}">
                    <div class="product-details">
                        <strong class="product-name">${escapeHtml(product.Product_Name)}</strong>
                    </div>
                </div>
            </td>
            <td>
                <span class="category-badge">${categoryName}</span>
            </td>
            <td>
                <div class="stock-info">
                    <span class="stock-level">${product.stock_level} units</span>
                    <small class="stock-min">Min: ${product.Minimum_Stock}</small>
                </div>
            </td>
            <td>
                <span class="status-badge ${statusClass}">${product.stock_status}</span>
            </td>
            <td class="product-price">${formatPrice(product.price)}</td>
            <td class="archived-date">${archivedDate}</td>
            <td class="archived-by">${archivedBy}</td>
            <td>
                <div class="action-buttons">
                    <button class="action-btn restore-btn" data-action="restore" data-product="${product.Product_ID}" title="Restore Product">
                        <i class="fas fa-undo"></i>
                    </button>
                </div>
            </td>
        </tr>
    `;
}

// Load archived inventory
async function loadArchivedInventory() {
    try {
        console.log('Loading archived products from database...');
        const response = await fetch('../api/get_archived_products.php', {
            method: 'GET',
            credentials: 'include'
        });
        
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        
        const data = await response.json();
        console.log('Archived products data received:', data);
        
        if (data.success && data.products) {
            const tbody = document.querySelector('.inventory-table tbody');
            if (!tbody) {
                console.error('Archive table body not found');
                return;
            }
            
            // Clear existing rows
            const existingImages = tbody.querySelectorAll('img');
            existingImages.forEach(img => {
                img.onerror = null;
                img.src = '';
            });
            tbody.innerHTML = '';
            
            // Add archived product rows
            if (data.products.length === 0) {
                tbody.innerHTML = `
                    <tr>
                        <td colspan="8" class="text-center" style="padding: 40px;">
                            <p class="text-muted">No archived products found.</p>
                        </td>
                    </tr>
                `;
            } else {
                data.products.forEach(product => {
                    tbody.insertAdjacentHTML('beforeend', createArchivedProductRow(product));
                });
            }
            
            console.log(`Successfully loaded ${data.products.length} archived products`);
        } else {
            console.error('Failed to load archived products:', data.message);
            const tbody = document.querySelector('.inventory-table tbody');
            if (tbody) {
                tbody.innerHTML = `
                    <tr>
                        <td colspan="8" class="text-center text-danger" style="padding: 40px;">
                            <p>Failed to load archived products: ${data.message || 'Unknown error'}</p>
                        </td>
                    </tr>
                `;
            }
        }
    } catch (error) {
        console.error('Error loading archived inventory:', error);
        const tbody = document.querySelector('.inventory-table tbody');
        if (tbody) {
            tbody.innerHTML = `
                <tr>
                    <td colspan="8" class="text-center text-danger" style="padding: 40px;">
                        <p>Error loading archived products. Please refresh the page.</p>
                    </td>
                </tr>
            `;
        }
    }
}

// Restore product
async function restoreProduct(productId) {
    if (!productId) {
        if (window.AdminNotifications) {
            AdminNotifications.warning('Product ID not found', { duration: 4000 });
        } else {
            alert('Product ID not found');
        }
        return;
    }
    
    // Show confirmation
    const confirmed = confirm('Are you sure you want to restore this product? It will be moved back to the active inventory.');
    if (!confirmed) {
        return;
    }
    
    try {
        const response = await fetch('../api/restore_product.php', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                product_id: productId
            }),
            credentials: 'include'
        });
        
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        
        const data = await response.json();
        
        if (data.success) {
            if (window.AdminNotifications) {
                AdminNotifications.success(`Product "${data.product_name || 'Product'}" has been restored successfully!`, {
                    duration: 3000
                });
            } else {
                alert(`Product "${data.product_name || 'Product'}" has been restored successfully!`);
            }
            
            // Reload archived inventory
            loadArchivedInventory();
        } else {
            if (window.AdminNotifications) {
                AdminNotifications.error(data.message || 'Failed to restore product', {
                    duration: 5000
                });
            } else {
                alert('Error: ' + (data.message || 'Failed to restore product'));
            }
        }
    } catch (error) {
        console.error('Error restoring product:', error);
        if (window.AdminNotifications) {
            AdminNotifications.error('An error occurred while restoring the product. Please try again.', {
                duration: 5000
            });
        } else {
            alert('An error occurred while restoring the product. Please try again.');
        }
    }
}

// Handle restore button click
$(document).on('click', '.restore-btn', function() {
    const productId = $(this).data('product');
    restoreProduct(productId);
});

// Category filter
$('#category-filter').on('change', function() {
    // Reload with filter - for now just reload all
    // In the future, we can pass the category filter to the API
    loadArchivedInventory();
});

// Initialize on page load
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', loadArchivedInventory);
} else {
    loadArchivedInventory();
}

// Export function for global access
window.loadArchivedInventory = loadArchivedInventory;

