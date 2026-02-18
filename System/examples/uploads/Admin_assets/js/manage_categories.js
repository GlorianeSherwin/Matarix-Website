/**
 * Category Management for Admin Inventory
 * Handles adding, editing, and deleting categories
 */

$(document).ready(function() {
    let categories = [];
    
    // Load categories when modal opens
    $('#manageCategoriesModal').on('show.bs.modal', function() {
        loadCategories();
    });
    
    // Also load categories on page load to populate filter dropdowns
    // This ensures the category filter dropdown is populated even if modal hasn't been opened
    $(document).ready(function() {
        // Small delay to ensure page is fully loaded
        setTimeout(function() {
            loadCategories().then(function(success) {
                if (success) {
                    console.log('Categories loaded for filter dropdown');
                }
            }).catch(function(error) {
                console.warn('Failed to load categories for filter:', error);
            });
        }, 1000); // Increased delay to ensure inventory is loaded first
    });
    
    // Load all categories
    async function loadCategories() {
        const tbody = $('#categoriesTableBody');
        const loadingRow = tbody.find('.loading-row');
        
        try {
            // Show loading state
            tbody.html('<tr class="loading-row"><td colspan="5" class="text-center"><i class="fas fa-spinner fa-spin text-danger"></i> Loading categories...</td></tr>');
            
            // Add timestamp to prevent caching
            const timestamp = new Date().getTime();
            const response = await fetch(`../api/manage_categories.php?t=${timestamp}`, {
                method: 'GET',
                credentials: 'include',
                cache: 'no-cache'
            });
            
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            
            const responseText = await response.text();
            console.log('[Load Categories] Response:', responseText);
            
            let data;
            try {
                data = JSON.parse(responseText);
            } catch (parseError) {
                console.error('[Load Categories] JSON Parse Error:', parseError);
                throw new Error('Invalid JSON response from server. Response: ' + responseText.substring(0, 200));
            }
            
            console.log('[Load Categories] Parsed Data:', data);
            
            if (data.success) {
                categories = data.categories || [];
                console.log('[Load Categories] Categories loaded:', categories.length);
                renderCategoriesTable(categories);
                // Also update category dropdowns
                updateCategoryDropdowns(categories);
                return true;
            } else {
                console.error('[Load Categories] API Error:', data.message);
                tbody.html('<tr><td colspan="5" class="text-center text-danger">Failed to load categories: ' + escapeHtml(data.message || 'Unknown error') + '</td></tr>');
                showError('Failed to load categories: ' + (data.message || 'Unknown error'), {
                    details: data
                });
                return false;
            }
        } catch (error) {
            console.error('[Load Categories] Error:', error);
            console.error('[Load Categories] Error Stack:', error.stack);
            tbody.html('<tr><td colspan="5" class="text-center text-danger">Error loading categories: ' + escapeHtml(error.message) + '</td></tr>');
            showError('Failed to load categories. Please try again.', {
                details: { error: error.message, stack: error.stack }
            });
            return false;
        }
    }
    
    // Render categories table
    function renderCategoriesTable(cats) {
        const tbody = $('#categoriesTableBody');
        tbody.empty();
        
        if (cats.length === 0) {
            tbody.html('<tr><td colspan="5" class="text-center text-muted">No categories found. Add your first category above.</td></tr>');
            return;
        }
        
        // Sort by display_order, then by name
        const sortedCats = [...cats].sort((a, b) => {
            if (a.display_order !== b.display_order) {
                return a.display_order - b.display_order;
            }
            return a.category_name.localeCompare(b.category_name);
        });
        
        sortedCats.forEach(category => {
            const statusBadge = category.is_active == 1 
                ? '<span class="badge badge-success">Active</span>' 
                : '<span class="badge badge-secondary">Inactive</span>';
            
            const row = `
                <tr>
                    <td>
                        <i class="${category.category_icon || 'fas fa-box'} mr-2"></i>
                        <strong>${escapeHtml(category.category_name)}</strong>
                    </td>
                    <td>${escapeHtml(category.category_description || '-')}</td>
                    <td>${category.display_order || 0}</td>
                    <td>${statusBadge}</td>
                    <td class="action-buttons-cell">
                        <button class="btn btn-sm btn-primary edit-category-btn" data-id="${category.Category_ID}">
                            <i class="fas fa-edit"></i> Edit
                        </button>
                        <button class="btn btn-sm btn-danger delete-category-btn" data-id="${category.Category_ID}" data-name="${escapeHtml(category.category_name)}">
                            <i class="fas fa-trash"></i> Delete
                        </button>
                    </td>
                </tr>
            `;
            tbody.append(row);
        });
    }
    
    // Update category dropdowns in add/edit product modals
    function updateCategoryDropdowns(cats) {
        const activeCategories = cats.filter(c => c.is_active == 1);
        
        // Update category filter dropdown
        const filterDropdown = $('#category-filter');
        if (filterDropdown.length > 0) {
            // Keep the first option (All Categories) and remove the rest
            const firstOption = filterDropdown.find('option:first');
            filterDropdown.find('option:not(:first)').remove();
            
            activeCategories.forEach(cat => {
                // For filter, use category_id as value for better filtering
                filterDropdown.append(`<option value="${cat.Category_ID}">${escapeHtml(cat.category_name)}</option>`);
            });
            
            console.log('Category filter dropdown updated with', activeCategories.length, 'categories');
        }
        
        // Update add product category dropdown - use category_id as value
        const addProductDropdown = $('#productCategory');
        addProductDropdown.find('option:not(:first)').remove();
        activeCategories.forEach(cat => {
            addProductDropdown.append(`<option value="${cat.Category_ID}">${escapeHtml(cat.category_name)}</option>`);
        });
        
        // Update edit product category dropdown - use category_id as value
        const editProductDropdown = $('#editProductCategory');
        editProductDropdown.find('option:not(:first)').remove();
        activeCategories.forEach(cat => {
            editProductDropdown.append(`<option value="${cat.Category_ID}">${escapeHtml(cat.category_name)}</option>`);
        });
    }
    
    // Add new category
    $('#addCategoryForm').on('submit', async function(e) {
        e.preventDefault();
        
        const categoryData = {
            category_name: $('#newCategoryName').val().trim(),
            category_description: $('#newCategoryDescription').val().trim(),
            category_icon: $('#newCategoryIcon').val().trim() || 'fas fa-box',
            display_order: parseInt($('#newCategoryOrder').val()) || 0,
            is_active: 1
        };
        
        if (!categoryData.category_name) {
            showError('Category name is required');
            return;
        }
        
        try {
            const response = await fetch('../api/manage_categories.php', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                credentials: 'include',
                body: JSON.stringify(categoryData)
            });
            
            const data = await response.json();
            
            if (data.success) {
                showSuccess('Category added successfully!');
                $('#addCategoryForm')[0].reset();
                $('#newCategoryIcon').val('fas fa-box');
                $('#newCategoryOrder').val(0);
                // Reload categories and update dropdowns
                await loadCategories();
            } else {
                showError(data.message || 'Failed to add category');
            }
        } catch (error) {
            console.error('Error adding category:', error);
            showError('Failed to add category. Please try again.');
        }
    });
    
    // Edit category button click
    $(document).on('click', '.edit-category-btn', async function() {
        const categoryId = $(this).data('id');
        const category = categories.find(c => c.Category_ID == categoryId);
        
        if (category) {
            $('#editCategoryId').val(category.Category_ID);
            $('#editCategoryName').val(category.category_name);
            $('#editCategoryDescription').val(category.category_description || '');
            $('#editCategoryIcon').val(category.category_icon || 'fas fa-box');
            $('#editCategoryOrder').val(category.display_order || 0);
            $('#editCategoryActive').prop('checked', category.is_active == 1);
            
            // Check if category is inactive
            const isInactive = category.is_active == 0;
            const inactiveOptions = $('#inactiveCategoryOptions');
            const moveProductsSection = $('#moveProductsSection');
            const moveProductsDropdown = $('#moveProductsToCategory');
            
            // Show/hide inactive warning based on status
            if (isInactive) {
                inactiveOptions.show();
            } else {
                inactiveOptions.hide();
            }
            
            // Always check for products and show move option if products exist (regardless of active/inactive status)
            try {
                const checkResponse = await fetch(`../api/manage_categories.php?action=check_products&category_id=${categoryId}`, {
                    method: 'GET',
                    credentials: 'include'
                });
                
                if (checkResponse.ok) {
                    const checkData = await checkResponse.json();
                    if (checkData.success) {
                        const productCount = checkData.product_count || 0;
                        
                        if (productCount > 0) {
                            // Show move products section and populate dropdown (always show if products exist)
                            moveProductsSection.show();
                            moveProductsDropdown.html(`<option value="">-- Keep products in this category (${productCount} product${productCount !== 1 ? 's' : ''}) --</option>`);
                            
                            // Populate with other active categories (excluding current category)
                            const activeCategories = categories.filter(c => 
                                c.is_active == 1 && c.Category_ID != categoryId
                            );
                            
                            activeCategories.forEach(cat => {
                                moveProductsDropdown.append(
                                    `<option value="${cat.Category_ID}">${escapeHtml(cat.category_name)}</option>`
                                );
                            });
                            
                            if (activeCategories.length === 0) {
                                moveProductsDropdown.append(
                                    '<option value="" disabled>No other active categories available</option>'
                                );
                            }
                            
                            // Update help text with product count
                            const helpText = isInactive 
                                ? `This category has ${productCount} product${productCount !== 1 ? 's' : ''}. You can move them to another category.`
                                : `This category has ${productCount} product${productCount !== 1 ? 's' : ''}. You can move them to another category if needed.`;
                            moveProductsSection.find('.form-text').text(helpText);
                        } else {
                            // No products, hide move section
                            moveProductsSection.hide();
                        }
                    }
                }
            } catch (error) {
                console.error('Error checking products:', error);
                moveProductsSection.hide();
            }
            
            // Handle active checkbox change to show/hide inactive warning (but keep move products section visible if products exist)
            $('#editCategoryActive').off('change.inactiveOptions').on('change.inactiveOptions', function() {
                const isChecked = $(this).is(':checked');
                if (isChecked) {
                    // If making active, hide inactive warning
                    $('#inactiveCategoryOptions').slideUp();
                } else {
                    // If making inactive, show inactive warning
                    $('#inactiveCategoryOptions').slideDown();
                }
                // Note: moveProductsSection stays visible if products exist, regardless of active status
            });
            
            $('#editCategoryModal').modal('show');
        }
    });
    
    // Update category
    $('#editCategoryForm').on('submit', async function(e) {
        e.preventDefault();
        
        const categoryId = $('#editCategoryId').val();
        if (!categoryId) {
            showError('Category ID not found');
            return;
        }
        
        const categoryData = {
            category_id: parseInt(categoryId),
            category_name: $('#editCategoryName').val().trim(),
            category_description: $('#editCategoryDescription').val().trim(),
            category_icon: $('#editCategoryIcon').val().trim() || 'fas fa-box',
            display_order: parseInt($('#editCategoryOrder').val()) || 0,
            is_active: $('#editCategoryActive').is(':checked') ? 1 : 0
        };
        
        // Check if user wants to move products to another category
        const moveProductsTo = $('#moveProductsToCategory').val();
        if (moveProductsTo && moveProductsTo !== '') {
            categoryData.move_products_to = parseInt(moveProductsTo);
        }
        
        if (!categoryData.category_name) {
            showError('Category name is required');
            return;
        }
        
        try {
            const response = await fetch('../api/manage_categories.php', {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json'
                },
                credentials: 'include',
                body: JSON.stringify(categoryData)
            });
            
            const data = await response.json();
            
            if (data.success) {
                showSuccess('Category updated successfully!');
                $('#editCategoryModal').modal('hide');
                // Reload categories and update dropdowns
                await loadCategories();
            } else {
                showError(data.message || 'Failed to update category');
            }
        } catch (error) {
            console.error('Error updating category:', error);
            showError('Failed to update category. Please try again.');
        }
    });
    
    // Delete category button click
    $(document).on('click', '.delete-category-btn', async function() {
        const categoryId = $(this).data('id');
        const categoryName = $(this).data('name');
        const category = categories.find(c => c.Category_ID == categoryId);
        
        // First check if category has products
        let productCount = 0;
        let productsList = [];
        try {
            const checkResponse = await fetch(`../api/manage_categories.php?action=check_products&category_id=${categoryId}`, {
                method: 'GET',
                credentials: 'include'
            });
            if (checkResponse.ok) {
                const checkData = await checkResponse.json();
                if (checkData.success) {
                    productCount = checkData.product_count || 0;
                    productsList = checkData.products || [];
                }
            }
        } catch (error) {
            console.error('Error checking products:', error);
            // Continue with deletion prompt even if check fails
        }
        
        // Show custom prompt with options
        const userChoice = await showDeleteCategoryPrompt(categoryName, productCount, productsList);
        
        if (userChoice === 'cancel') {
            return; // User cancelled
        }
        
        // Proceed with deletion based on user choice
        await deleteCategory(categoryId, categoryName, userChoice);
    });
    
    // Show delete category prompt with options
    function showDeleteCategoryPrompt(categoryName, productCount, productsList) {
        return new Promise((resolve) => {
            // Create custom modal for delete options
            const modalId = 'deleteCategoryOptionsModal';
            let modalHtml = `
                <div class="modal fade" id="${modalId}" tabindex="-1" role="dialog">
                    <div class="modal-dialog" role="document">
                        <div class="modal-content">
                            <div class="modal-header bg-danger text-white">
                                <h5 class="modal-title">
                                    <i class="fas fa-exclamation-triangle mr-2"></i>Delete Category: ${escapeHtml(categoryName)}
                                </h5>
                                <button type="button" class="close text-white" data-dismiss="modal">
                                    <span>&times;</span>
                                </button>
                            </div>
                            <div class="modal-body">
                                <p><strong>What would you like to do with this category?</strong></p>`;
            
            if (productCount > 0) {
                let productsText = '';
                if (productsList.length > 0) {
                    const productNames = productsList.slice(0, 5).map(p => escapeHtml(p.Product_Name)).join(', ');
                    const moreText = productCount > productsList.length ? ` and ${productCount - productsList.length} more` : '';
                    productsText = `<br><small class="text-muted">Products: ${productNames}${moreText}</small>`;
                }
                
                modalHtml += `
                    <div class="alert alert-warning">
                        <i class="fas fa-info-circle mr-2"></i>
                        This category has <strong>${productCount} product(s)</strong> assigned to it.${productsText}
                    </div>
                    <div class="form-group">
                        <div class="custom-control custom-radio mb-3">
                            <input type="radio" class="custom-control-input" id="deleteOption1" name="deleteOption" value="inactive" checked>
                            <label class="custom-control-label" for="deleteOption1">
                                <strong>Make Inactive Only</strong><br>
                                <small class="text-muted">Category will be hidden from dropdowns, but products will remain visible and assigned to this category.</small>
                            </label>
                        </div>
                        <div class="custom-control custom-radio">
                            <input type="radio" class="custom-control-input" id="deleteOption2" name="deleteOption" value="delete_all">
                            <label class="custom-control-label" for="deleteOption2">
                                <strong>Delete Category and All Products</strong><br>
                                <small class="text-danger">⚠️ This will permanently delete the category and all ${productCount} product(s) in it. This action cannot be undone!</small>
                            </label>
                        </div>
                    </div>`;
            } else {
                modalHtml += `
                    <div class="alert alert-info">
                        <i class="fas fa-info-circle mr-2"></i>
                        This category has no products assigned to it.
                    </div>
                    <div class="form-group">
                        <div class="custom-control custom-radio mb-3">
                            <input type="radio" class="custom-control-input" id="deleteOption1" name="deleteOption" value="inactive" checked>
                            <label class="custom-control-label" for="deleteOption1">
                                <strong>Make Inactive Only</strong><br>
                                <small class="text-muted">Category will be hidden from dropdowns but can be reactivated later.</small>
                            </label>
                        </div>
                        <div class="custom-control custom-radio">
                            <input type="radio" class="custom-control-input" id="deleteOption2" name="deleteOption" value="delete_all">
                            <label class="custom-control-label" for="deleteOption2">
                                <strong>Permanently Delete</strong><br>
                                <small class="text-danger">⚠️ This will permanently delete the category from the database. This action cannot be undone!</small>
                            </label>
                        </div>
                    </div>`;
            }
            
            modalHtml += `
                            </div>
                            <div class="modal-footer">
                                <button type="button" class="btn btn-secondary" data-dismiss="modal">Cancel</button>
                                <button type="button" class="btn btn-danger" id="confirmDeleteBtn">
                                    <i class="fas fa-trash mr-2"></i>Confirm
                                </button>
                            </div>
                        </div>
                    </div>
                </div>`;
            
            // Remove existing modal if present
            $(`#${modalId}`).remove();
            
            // Add modal to body
            $('body').append(modalHtml);
            
            // Show modal
            $(`#${modalId}`).modal('show');
            
            // Handle confirm button
            $(`#${modalId} #confirmDeleteBtn`).on('click', function() {
                const selectedOption = $(`#${modalId} input[name="deleteOption"]:checked`).val();
                $(`#${modalId}`).modal('hide');
                setTimeout(() => {
                    $(`#${modalId}`).remove();
                }, 300);
                resolve(selectedOption);
            });
            
            // Handle cancel/close
            $(`#${modalId}`).on('hidden.bs.modal', function() {
                $(this).remove();
                resolve('cancel');
            });
        });
    }
    
    // Delete category
    async function deleteCategory(categoryId, categoryName, deleteOption = 'inactive') {
        try {
            const response = await fetch('../api/manage_categories.php', {
                method: 'DELETE',
                headers: {
                    'Content-Type': 'application/json'
                },
                credentials: 'include',
                body: JSON.stringify({ 
                    category_id: parseInt(categoryId),
                    delete_option: deleteOption // 'inactive' or 'delete_all'
                })
            });
            
            const data = await response.json();
            
            if (data.success) {
                let message = data.message || 'Category deleted successfully!';
                
                // Show detailed message based on action
                if (data.action === 'deleted_all') {
                    let productsList = '';
                    if (data.products && data.products.length > 0) {
                        const productNames = data.products.map(p => p.Product_Name).join(', ');
                        const moreText = data.product_count > data.products.length ? ` and ${data.product_count - data.products.length} more` : '';
                        productsList = `\n\nDeleted products: ${productNames}${moreText}`;
                    }
                    message = `Category "${categoryName}" and all ${data.product_count} product(s) have been permanently deleted from the database.${productsList}`;
                } else if (data.action === 'deactivated' && data.product_count > 0) {
                    let productsList = '';
                    if (data.products && data.products.length > 0) {
                        const productNames = data.products.map(p => p.Product_Name).join(', ');
                        const moreText = data.product_count > data.products.length ? ` and ${data.product_count - data.products.length} more` : '';
                        productsList = `\n\nProducts affected: ${productNames}${moreText}`;
                    }
                    
                    message = `Category "${categoryName}" has been deactivated.\n\n` +
                        `This category has ${data.product_count} product(s) assigned to it.` +
                        productsList +
                        `\n\nThe category will no longer appear in dropdown menus, but products will still be visible.`;
                } else if (data.action === 'deactivated' && data.product_count === 0) {
                    message = `Category "${categoryName}" has been deactivated.\n\nThe category will no longer appear in dropdown menus.`;
                } else if (data.action === 'deleted') {
                    message = `Category "${categoryName}" has been permanently deleted from the database.`;
                }
                
                showSuccess(message);
                // Reload categories and update dropdowns
                await loadCategories();
            } else {
                showError(data.message || 'Failed to delete category');
            }
        } catch (error) {
            console.error('Error deleting category:', error);
            showError('Failed to delete category. Please try again.');
        }
    }
    
    // Helper functions - use AdminNotifications if available, fallback to alerts
    function showSuccess(message, options = {}) {
        if (window.AdminNotifications) {
            AdminNotifications.success(message, { duration: 3000, ...options });
        } else {
            alert('Success: ' + message);
        }
    }
    
    function showError(message, options = {}) {
        if (window.AdminNotifications) {
            AdminNotifications.error(message, { duration: 5000, ...options });
        } else {
            alert('Error: ' + message);
        }
    }
    
    function escapeHtml(text) {
        const map = {
            '&': '&amp;',
            '<': '&lt;',
            '>': '&gt;',
            '"': '&quot;',
            "'": '&#039;'
        };
        return text ? text.replace(/[&<>"']/g, m => map[m]) : '';
    }
    
    // Load categories on page load to update dropdowns
    loadCategories();
});

