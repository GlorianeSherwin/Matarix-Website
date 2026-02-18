/**
 * Manage Product Variations
 * Handles UI and API interactions for managing product variations
 */

let currentProductId = null;
let currentVariations = [];

// Handle variations button click
$(document).on('click', '.variations-btn', function() {
    const productId = $(this).data('product');
    openVariationsModal(productId);
});

// Open variations management modal
async function openVariationsModal(productId) {
    currentProductId = productId;
    
    // Show modal
    $('#manageVariationsModal').modal('show');
    
    // Load product info and variations
    await loadProductVariations(productId);
}

// Load product variations from API
async function loadProductVariations(productId) {
    try {
        const response = await fetch(`../api/get_product_variations.php?product_id=${productId}`, {
            method: 'GET',
            credentials: 'include'
        });
        
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        
        const data = await response.json();
        
        if (data.success) {
            // Update product info
            $('#variationsProductName').text(data.product.product_name);
            $('#variationsProductId').text(data.product.product_id);
            
            // Store variations
            currentVariations = data.variations || [];
            
            // Display variations
            displayVariations(currentVariations);
        } else {
            alert('Failed to load variations: ' + (data.message || 'Unknown error'));
        }
    } catch (error) {
        console.error('Error loading variations:', error);
        alert('Error loading variations. Please try again.');
    }
}

// Display variations in the list
function displayVariations(variations) {
    const variationsList = $('#variationsList');
    variationsList.empty();
    
    if (variations.length === 0) {
        variationsList.html('<p class="text-muted">No variations added yet.</p>');
        return;
    }
    
    // Group variations by type
    const grouped = {};
    variations.forEach(variation => {
        const type = variation.variation_name;
        if (!grouped[type]) {
            grouped[type] = [];
        }
        grouped[type].push(variation);
    });
    
    // Display grouped variations
    Object.keys(grouped).forEach(type => {
        const typeDiv = $('<div class="variation-type-group mb-3"></div>');
        const typeHeader = $(`<h6 class="text-primary mb-2"><i class="fas fa-tag mr-2"></i>${type}</h6>`);
        typeDiv.append(typeHeader);
        
        const variationsContainer = $('<div class="row"></div>');
        
        grouped[type].forEach(variation => {
            const variationCard = $(`
                <div class="col-md-6 mb-2">
                    <div class="card variation-card">
                        <div class="card-body p-2">
                            <div class="d-flex justify-content-between align-items-center">
                                <div>
                                    <strong>${escapeHtml(variation.variation_value)}</strong>
                                </div>
                                <div class="variation-actions">
                                    <button class="btn btn-sm btn-outline-primary edit-variation-btn" data-variation-id="${variation.Variation_ID}" data-variation-name="${escapeHtml(variation.variation_name)}" data-variation-value="${escapeHtml(variation.variation_value)}" title="Edit">
                                        <i class="fas fa-edit"></i>
                                    </button>
                                    <button class="btn btn-sm btn-outline-danger delete-variation-btn" data-variation-id="${variation.Variation_ID}" title="Delete">
                                        <i class="fas fa-trash"></i>
                                    </button>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            `);
            variationsContainer.append(variationCard);
        });
        
        typeDiv.append(variationsContainer);
        variationsList.append(typeDiv);
    });
}

// Handle edit variation button click
$(document).on('click', '.edit-variation-btn', function() {
    const variationId = $(this).data('variation-id');
    const variationName = $(this).data('variation-name');
    const variationValue = $(this).data('variation-value');
    
    // Populate form with existing values
    $('#variationName').val(variationName);
    $('#variationValue').val(variationValue);
    
    // Change form to edit mode
    $('#addVariationForm').data('edit-mode', true);
    $('#addVariationForm').data('variation-id', variationId);
    $('#addVariationForm button[type="submit"]').html('<i class="fas fa-save"></i> Update');
    $('#manageVariationsModalLabel').text('Edit Variation');
    
    // Scroll to form
    $('html, body').animate({
        scrollTop: $('#addVariationForm').offset().top - 100
    }, 500);
});

// Handle delete variation button click
$(document).on('click', '.delete-variation-btn', function() {
    const variationId = $(this).data('variation-id');
    const variation = currentVariations.find(v => v.Variation_ID == variationId);
    
    if (!variation) return;
    
    // Use custom confirmation dialog
    AdminNotifications.confirm(
        `Are you sure you want to delete the variation "${variation.variation_value}"?`,
        {
            title: 'Delete Variation',
            confirmText: 'Delete',
            cancelText: 'Cancel',
            danger: true
        }
    ).then(confirmed => {
        if (confirmed) {
            deleteVariation(variationId);
        }
    });
});

// Delete variation
async function deleteVariation(variationId) {
    try {
        const response = await fetch('../api/manage_product_variations.php', {
            method: 'DELETE',
            headers: {
                'Content-Type': 'application/json'
            },
            credentials: 'include',
            body: JSON.stringify({
                variation_id: variationId
            })
        });
        
        const data = await response.json();
        
        if (data.success) {
            // Reload variations
            await loadProductVariations(currentProductId);
            showNotification('Variation deleted successfully!', 'success');
        } else {
            alert('Failed to delete variation: ' + (data.message || 'Unknown error'));
        }
    } catch (error) {
        console.error('Error deleting variation:', error);
        alert('Error deleting variation. Please try again.');
    }
}

// Handle form submission for both add and edit
$('#addVariationForm').on('submit', async function(e) {
    e.preventDefault();
    
    const isEditMode = $(this).data('edit-mode');
    const variationName = $('#variationName').val();
    const variationValue = $('#variationValue').val();
    
    if (!variationName || !variationValue) {
        alert('Please fill in all fields');
        return;
    }
    
    try {
        let response;
        
        if (isEditMode) {
            // Update existing variation
            const variationId = $(this).data('variation-id');
            response = await fetch('../api/manage_product_variations.php', {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json'
                },
                credentials: 'include',
                body: JSON.stringify({
                    variation_id: variationId,
                    variation_name: variationName,
                    variation_value: variationValue
                })
            });
        } else {
            // Add new variation
            response = await fetch('../api/manage_product_variations.php', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                credentials: 'include',
                body: JSON.stringify({
                    product_id: currentProductId,
                    variation_name: variationName,
                    variation_value: variationValue
                })
            });
        }
        
        const data = await response.json();
        
        if (data.success) {
            // Reload variations
            await loadProductVariations(currentProductId);
            
            // Reset form
            resetVariationForm();
            
            showNotification(isEditMode ? 'Variation updated successfully!' : 'Variation added successfully!', 'success');
        } else {
            alert('Failed to ' + (isEditMode ? 'update' : 'add') + ' variation: ' + (data.message || 'Unknown error'));
        }
    } catch (error) {
        console.error('Error saving variation:', error);
        alert('Error saving variation. Please try again.');
    }
});

// Reset variation form
function resetVariationForm() {
    $('#addVariationForm')[0].reset();
    $('#addVariationForm').removeData('edit-mode');
    $('#addVariationForm').removeData('variation-id');
    $('#addVariationForm button[type="submit"]').html('<i class="fas fa-plus"></i> Add');
    $('#manageVariationsModalLabel').text('Manage Product Variations');
}

// Reset form when modal is closed
$('#manageVariationsModal').on('hidden.bs.modal', function() {
    resetVariationForm();
    currentProductId = null;
    currentVariations = [];
});

// Show notification
function showNotification(message, type = 'info') {
    // Simple alert for now - can be enhanced with toast notifications
    const alertClass = type === 'success' ? 'alert-success' : 'alert-info';
    const alert = $(`
        <div class="alert ${alertClass} alert-dismissible fade show" role="alert" style="position: fixed; top: 20px; right: 20px; z-index: 9999; min-width: 300px;">
            ${message}
            <button type="button" class="close" data-dismiss="alert" aria-label="Close">
                <span aria-hidden="true">&times;</span>
            </button>
        </div>
    `);
    
    $('body').append(alert);
    
    // Auto-dismiss after 3 seconds
    setTimeout(() => {
        alert.alert('close');
    }, 3000);
}

// Escape HTML to prevent XSS
function escapeHtml(text) {
    if (!text) return '';
    const map = {
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        '"': '&quot;',
        "'": '&#039;'
    };
    return String(text).replace(/[&<>"']/g, function(m) { return map[m]; });
}

