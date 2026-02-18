// admin-orders.js - Order Management Functions

// NOTE: updateOrderStatus is now handled by load_orders.js
// This function is kept for backward compatibility but should not be used
// The new implementation uses: updateOrderStatus(orderId, newStatus)
function updateOrderStatus_OLD(selectElement) {
    const orderId = selectElement.closest('tr').cells[0].textContent;
    const newStatus = selectElement.value;
    const currentTime = new Date().toISOString().slice(0, 19).replace('T', ' ');
    
    // Update last updated time
    const lastUpdatedCell = selectElement.closest('tr').cells[7];
    lastUpdatedCell.textContent = currentTime;
    
    console.log(`Order ${orderId} status updated to: ${newStatus}`);
    // Here you would typically send an AJAX request to update the database
    
    // Update statistics (disabled - handled by load_orders.js)
    // updateStatistics_OLD();
}

function viewOrder(orderId) {
    console.log(`Viewing order: ${orderId}`);
    if (window.AdminNotifications) {
        AdminNotifications.info(`Viewing details for order ${orderId}`, {
            title: 'View Order',
            duration: 3000
        });
    } else {
        alert(`Viewing details for ${orderId}`);
    }
    // Here you would typically open a modal or navigate to order details page
}

function downloadOrder(orderId) {
    console.log(`Downloading order: ${orderId}`);
    if (window.AdminNotifications) {
        AdminNotifications.info(`Downloading invoice for order ${orderId}...`, {
            title: 'Download Invoice',
            duration: 3000
        });
    } else {
        alert(`Downloading invoice for ${orderId}`);
    }
    // Here you would typically generate and download a PDF invoice
}

// Delete order function is now handled by load_orders.js
// Don't override it - let load_orders.js handle it
// This function is removed to prevent conflicts

// NOTE: updateStatistics is now handled by load_orders.js
// This function is kept for backward compatibility but should not be used
function updateStatistics_OLD() {
    const rows = document.querySelectorAll('.order-table tbody tr');
    let totalOrders = rows.length;
    let pendingPayments = 0;
    let inProgress = 0;
    let completed = 0;

    rows.forEach(row => {
        const statusSelect = row.querySelector('.status-dropdown');
        const paymentSelect = row.querySelector('.payment-dropdown');
        
        if (!statusSelect || !paymentSelect) return;
        
        const status = statusSelect.value;
        const payment = paymentSelect.value;

        if (payment === 'To Pay' || payment === 'Pending') {
            pendingPayments++;
        }

        if (status === 'Preparing') {
            inProgress++;
        } else if (status === 'Ready') {
            completed++;
        }
    });

    const totalOrdersEl = document.getElementById('totalOrders');
    const pendingPaymentsEl = document.getElementById('pendingPayments');
    const inProgressEl = document.getElementById('inProgress');
    const completedEl = document.getElementById('completed');
    
    if (totalOrdersEl) totalOrdersEl.textContent = totalOrders;
    if (pendingPaymentsEl) pendingPaymentsEl.textContent = pendingPayments;
    if (inProgressEl) inProgressEl.textContent = inProgress;
    if (completedEl) completedEl.textContent = completed;
}

// Search functionality
function initializeSearch() {
    document.getElementById('searchOrders').addEventListener('input', function() {
        const searchTerm = this.value.toLowerCase();
        const rows = document.querySelectorAll('.order-table tbody tr');

        rows.forEach(row => {
            const orderId = row.cells[0].textContent.toLowerCase();
            const customer = row.cells[1].textContent.toLowerCase();
            
            if (orderId.includes(searchTerm) || customer.includes(searchTerm)) {
                row.style.display = '';
            } else {
                row.style.display = 'none';
            }
        });
    });
}

// Order Settings Modal Functions
let currentOrderSettings = null;

// Load order settings from API
async function loadOrderSettings() {
    try {
        const response = await fetch('../api/get_order_settings.php', {
            credentials: 'include'
        });
        const data = await response.json();
        
        if (data.success) {
            currentOrderSettings = data.settings;
            return data.settings;
        } else {
            throw new Error(data.message || 'Failed to load settings');
        }
    } catch (error) {
        console.error('Error loading order settings:', error);
        throw error;
    }
}

// Populate order settings form
function populateOrderSettingsForm(settings) {
    // Auto-calculate from fleet
    const autoCalculate = document.getElementById('autoCalculateFromFleet');
    if (autoCalculate) {
        autoCalculate.checked = settings.auto_calculate_from_fleet === true || settings.auto_calculate_from_fleet === '1';
        toggleAutoCalculateFields();
    }
    
    // Minimum order weight percentage
    const percentage = document.getElementById('minOrderWeightPercentage');
    if (percentage) {
        // Get from main settings or raw_settings, with fallback to 25
        const rawSettings = settings.raw_settings || {};
        percentage.value = settings.min_order_weight_percentage || rawSettings.min_order_weight_percentage || 25;
    }
    
    // Fixed minimum order weight
    const fixedWeight = document.getElementById('minOrderWeightKg');
    if (fixedWeight) {
        // Get the raw setting value (not calculated)
        const rawSettings = settings.raw_settings || {};
        fixedWeight.value = rawSettings.min_order_weight_kg || settings.min_order_weight_kg || 200;
    }
    
    // Minimum order value
    const minValue = document.getElementById('minOrderValue');
    if (minValue) {
        minValue.value = settings.min_order_value || 0;
    }
    
    // Disable minimum weight
    const disableMinWeight = document.getElementById('disableMinimumWeight');
    if (disableMinWeight) {
        const rawSettings = settings.raw_settings || {};
        disableMinWeight.checked = rawSettings.disable_minimum_weight === '1' || settings.disable_minimum_weight === true || settings.disable_minimum_weight === '1';
    }
    
    // Disable minimum order value
    const disableMinValue = document.getElementById('disableMinimumOrderValue');
    if (disableMinValue) {
        const rawSettings = settings.raw_settings || {};
        disableMinValue.checked = rawSettings.disable_minimum_order_value === '1' || settings.disable_minimum_order_value === true || settings.disable_minimum_order_value === '1';
    }
    
    // Allow heavy single items
    const allowHeavy = document.getElementById('allowHeavySingleItems');
    if (allowHeavy) {
        allowHeavy.checked = settings.allow_heavy_single_items === true || settings.allow_heavy_single_items === '1';
    }
    
    // Allow below minimum with fee
    const allowBelow = document.getElementById('allowBelowMinimumWithFee');
    if (allowBelow) {
        allowBelow.checked = settings.allow_below_minimum_with_fee === true || settings.allow_below_minimum_with_fee === '1';
        togglePremiumFeeField();
    }
    
    // Premium delivery fee
    const premiumFee = document.getElementById('premiumDeliveryFee');
    if (premiumFee) {
        premiumFee.value = settings.premium_delivery_fee || 500;
    }
    
    // Minimum advance notice days
    const minAdvanceNotice = document.getElementById('minAdvanceNoticeDays');
    if (minAdvanceNotice) {
        const rawSettings = settings.raw_settings || {};
        minAdvanceNotice.value = rawSettings.min_advance_notice_days || settings.min_advance_notice_days || 3;
    }
    
    // Maximum advance notice days
    const maxAdvanceNotice = document.getElementById('maxAdvanceNoticeDays');
    if (maxAdvanceNotice) {
        const rawSettings = settings.raw_settings || {};
        maxAdvanceNotice.value = rawSettings.max_advance_notice_days || settings.max_advance_notice_days || 30;
    }
    
    // Max deliveries/orders per day (0 = no limit)
    const maxDeliveriesPerDay = document.getElementById('maxDeliveriesPerDay');
    if (maxDeliveriesPerDay) {
        const rawSettings = settings.raw_settings || {};
        const val = rawSettings.max_deliveries_per_day ?? settings.max_deliveries_per_day ?? 0;
        maxDeliveriesPerDay.value = val === '' || val === null || val === undefined ? 0 : val;
    }
    
    // Volume discount tier settings
    const discountTier1Min = document.getElementById('discountTier1Min');
    if (discountTier1Min) {
        const rawSettings = settings.raw_settings || {};
        discountTier1Min.value = rawSettings.volume_discount_tier1_min || settings.volume_discount_tier1_min || 20;
    }
    
    const discountTier1Percent = document.getElementById('discountTier1Percent');
    if (discountTier1Percent) {
        const rawSettings = settings.raw_settings || {};
        discountTier1Percent.value = rawSettings.volume_discount_tier1_percent || settings.volume_discount_tier1_percent || 5;
    }
    
    const discountTier2Min = document.getElementById('discountTier2Min');
    if (discountTier2Min) {
        const rawSettings = settings.raw_settings || {};
        discountTier2Min.value = rawSettings.volume_discount_tier2_min || settings.volume_discount_tier2_min || 50;
    }
    
    const discountTier2Percent = document.getElementById('discountTier2Percent');
    if (discountTier2Percent) {
        const rawSettings = settings.raw_settings || {};
        discountTier2Percent.value = rawSettings.volume_discount_tier2_percent || settings.volume_discount_tier2_percent || 10;
    }
    
    const discountTier3Min = document.getElementById('discountTier3Min');
    if (discountTier3Min) {
        const rawSettings = settings.raw_settings || {};
        discountTier3Min.value = rawSettings.volume_discount_tier3_min || settings.volume_discount_tier3_min || 100;
    }
    
    const discountTier3Percent = document.getElementById('discountTier3Percent');
    if (discountTier3Percent) {
        const rawSettings = settings.raw_settings || {};
        discountTier3Percent.value = rawSettings.volume_discount_tier3_percent || settings.volume_discount_tier3_percent || 15;
    }
    
    const discountTier4Min = document.getElementById('discountTier4Min');
    if (discountTier4Min) {
        const rawSettings = settings.raw_settings || {};
        discountTier4Min.value = rawSettings.volume_discount_tier4_min || settings.volume_discount_tier4_min || 200;
    }
    
    const discountTier4Percent = document.getElementById('discountTier4Percent');
    if (discountTier4Percent) {
        const rawSettings = settings.raw_settings || {};
        discountTier4Percent.value = rawSettings.volume_discount_tier4_percent || settings.volume_discount_tier4_percent || 20;
    }
    
    // Show calculated minimum if auto-calculate is enabled
    if (autoCalculate && autoCalculate.checked) {
        // Update calculated minimum (will fetch fleet capacity and calculate)
        updateCalculatedMinimum();
    }
}

// Store smallest fleet capacity for real-time calculation
let smallestFleetCapacity = null;

// Get smallest fleet capacity
async function getSmallestFleetCapacity() {
    if (smallestFleetCapacity !== null) {
        return smallestFleetCapacity;
    }
    
    try {
        const response = await fetch('../api/get_fleet.php', {
            method: 'GET',
            credentials: 'include'
        });
        
        if (response.ok) {
            const data = await response.json();
            if (data.success && data.vehicles) {
                // Convert all capacities to kg and find minimum
                const capacities = data.vehicles
                    .filter(v => v.capacity && v.capacity > 0)
                    .map(vehicle => {
                        let capacityKg = parseFloat(vehicle.capacity) || 0;
                        const unit = vehicle.capacity_unit || 'kg';
                        
                        // Convert to kg
                        switch(unit) {
                            case 'g': capacityKg = capacityKg / 1000; break;
                            case 'lb': capacityKg = capacityKg * 0.453592; break;
                            case 'oz': capacityKg = capacityKg * 0.0283495; break;
                            case 'ton': capacityKg = capacityKg * 1000; break;
                        }
                        
                        return capacityKg;
                    });
                
                if (capacities.length > 0) {
                    smallestFleetCapacity = Math.min(...capacities);
                    return smallestFleetCapacity;
                }
            }
        }
    } catch (error) {
        console.error('Error fetching fleet capacity:', error);
    }
    
    // Return default if API fails
    return 200; // Default to 200kg
}

// Calculate and update minimum weight display in real-time
async function updateCalculatedMinimum() {
    console.log('updateCalculatedMinimum called');
    const autoCalculate = document.getElementById('autoCalculateFromFleet');
    const percentageInput = document.getElementById('minOrderWeightPercentage');
    const calculatedInfo = document.getElementById('calculatedMinInfo');
    const calculatedValue = document.getElementById('calculatedMinValue');
    
    if (!autoCalculate || !autoCalculate.checked) {
        if (calculatedInfo) calculatedInfo.style.display = 'none';
        return;
    }
    
    if (!percentageInput || !calculatedInfo || !calculatedValue) {
        console.error('Missing elements:', {
            percentageInput: !!percentageInput,
            calculatedInfo: !!calculatedInfo,
            calculatedValue: !!calculatedValue
        });
        return;
    }
    
    const percentage = parseFloat(percentageInput.value);
    console.log('Percentage value:', percentage);
    
    if (isNaN(percentage) || percentage <= 0) {
        calculatedValue.textContent = '-';
        return;
    }
    
    // Get smallest fleet capacity
    const smallestCapacity = await getSmallestFleetCapacity();
    console.log('Smallest fleet capacity:', smallestCapacity);
    
    // Calculate minimum: smallestCapacity * percentage / 100
    // Round to 2 decimal places, ensure at least 1kg (reasonable minimum)
    const calculatedMin = Math.max(1, Math.round(smallestCapacity * (percentage / 100) * 100) / 100);
    console.log('Calculated minimum:', calculatedMin, 'from', smallestCapacity, 'kg at', percentage + '%');
    
    // Update display
    calculatedValue.textContent = calculatedMin.toFixed(2);
    calculatedInfo.style.display = 'block';
    
    console.log('Updated calculated minimum display to:', calculatedMin.toFixed(2));
}

// Toggle auto-calculate related fields
function toggleAutoCalculateFields() {
    const autoCalculate = document.getElementById('autoCalculateFromFleet');
    const percentageGroup = document.getElementById('percentageGroup');
    const fixedWeightGroup = document.getElementById('fixedWeightGroup');
    const calculatedInfo = document.getElementById('calculatedMinInfo');
    
    if (autoCalculate && autoCalculate.checked) {
        if (percentageGroup) percentageGroup.style.display = 'block';
        if (fixedWeightGroup) fixedWeightGroup.style.display = 'none';
        if (calculatedInfo) calculatedInfo.style.display = 'block';
        // Update calculated minimum when toggled on
        updateCalculatedMinimum();
    } else {
        if (percentageGroup) percentageGroup.style.display = 'none';
        if (fixedWeightGroup) fixedWeightGroup.style.display = 'block';
        if (calculatedInfo) calculatedInfo.style.display = 'none';
    }
}

// Toggle premium fee field
function togglePremiumFeeField() {
    // Delivery fee field is always visible - fee applies when below minimum (Standard Delivery)
    const premiumFeeGroup = document.getElementById('premiumFeeGroup');
    if (premiumFeeGroup) premiumFeeGroup.style.display = 'block';
}

// Save order settings
async function saveOrderSettings() {
    const form = document.getElementById('orderSettingsForm');
    if (!form) return;
    
    const saveBtn = document.getElementById('saveOrderSettingsBtn');
    const errorDiv = document.getElementById('orderSettingsError');
    
    // Disable save button
    if (saveBtn) {
        saveBtn.disabled = true;
        saveBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Saving...';
    }
    
    // Hide error
    if (errorDiv) {
        errorDiv.style.display = 'none';
    }
    
    // Collect form data
    const percentageInput = document.getElementById('minOrderWeightPercentage');
    const percentageValue = percentageInput ? parseFloat(percentageInput.value) : null;
    
    const formData = {
        auto_calculate_from_fleet: document.getElementById('autoCalculateFromFleet').checked ? '1' : '0',
        min_order_weight_percentage: (percentageValue !== null && !isNaN(percentageValue)) ? percentageValue : 25,
        min_order_weight_kg: parseFloat(document.getElementById('minOrderWeightKg').value) || 200,
        min_order_value: parseFloat(document.getElementById('minOrderValue').value) || 0,
        disable_minimum_weight: document.getElementById('disableMinimumWeight') && document.getElementById('disableMinimumWeight').checked ? '1' : '0',
        disable_minimum_order_value: document.getElementById('disableMinimumOrderValue') && document.getElementById('disableMinimumOrderValue').checked ? '1' : '0',
        allow_heavy_single_items: document.getElementById('allowHeavySingleItems').checked ? '1' : '0',
        allow_below_minimum_with_fee: document.getElementById('allowBelowMinimumWithFee').checked ? '1' : '0',
        premium_delivery_fee: parseFloat(document.getElementById('premiumDeliveryFee').value) || 500,
        min_advance_notice_days: parseInt(document.getElementById('minAdvanceNoticeDays').value) || 3,
        max_advance_notice_days: parseInt(document.getElementById('maxAdvanceNoticeDays').value) || 30,
        max_deliveries_per_day: parseInt(document.getElementById('maxDeliveriesPerDay').value, 10) || 0,
        volume_discount_tier1_min: parseInt(document.getElementById('discountTier1Min').value) || 20,
        volume_discount_tier1_percent: parseFloat(document.getElementById('discountTier1Percent').value) || 5,
        volume_discount_tier2_min: parseInt(document.getElementById('discountTier2Min').value) || 50,
        volume_discount_tier2_percent: parseFloat(document.getElementById('discountTier2Percent').value) || 10,
        volume_discount_tier3_min: parseInt(document.getElementById('discountTier3Min').value) || 100,
        volume_discount_tier3_percent: parseFloat(document.getElementById('discountTier3Percent').value) || 15,
        volume_discount_tier4_min: parseInt(document.getElementById('discountTier4Min').value) || 200,
        volume_discount_tier4_percent: parseFloat(document.getElementById('discountTier4Percent').value) || 20
    };
    
    
    try {
        const response = await fetch('../api/update_order_settings.php', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            credentials: 'include',
            body: JSON.stringify(formData)
        });
        
        // Get response text first (can only read once)
        const responseText = await response.text();
        
        // Check if response is OK
        if (!response.ok) {
            // Try to get error message from response
            let errorMessage = `Server error: ${response.status} ${response.statusText}`;
            if (responseText && responseText.trim().length > 0) {
                try {
                    const errorData = JSON.parse(responseText);
                    errorMessage = errorData.message || errorMessage;
                } catch (e) {
                    // If response is not JSON, check if it's HTML
                    if (responseText.trim().startsWith('<')) {
                        errorMessage = 'Server returned an error page. Please check server logs.';
                    } else {
                        errorMessage = responseText.substring(0, 200); // Limit error message length
                    }
                }
            }
            throw new Error(errorMessage);
        }
        
        // Parse JSON response
        let data;
        try {
            if (!responseText || responseText.trim().length === 0) {
                throw new Error('Empty response from server');
            }
            data = JSON.parse(responseText);
        } catch (parseError) {
            // Filter out localhost URLs from error messages
            const cleanResponseText = responseText.replace(/https?:\/\/[^\s]+localhost[^\s]*/gi, '').replace(/localhost[^\s]*/gi, '');
            throw new Error('Invalid response from server.');
        }
        
        if (data.success) {
            // Show success message
            if (window.AdminNotifications) {
                AdminNotifications.success('Order settings saved successfully!', {
                    title: 'Settings Updated',
                    duration: 3000
                });
            } else {
                alert('Order settings saved successfully!');
            }
            
            // Reload settings to get updated calculated values
            const updatedSettings = await loadOrderSettings();
            populateOrderSettingsForm(updatedSettings);
            
            // Close modal
            $('#orderSettingsModal').modal('hide');
        } else {
            throw new Error(data.message || 'Failed to save settings');
        }
    } catch (error) {
        if (errorDiv) {
            errorDiv.textContent = error.message || 'Failed to save settings. Please try again.';
            errorDiv.style.display = 'block';
        }
        
        // Also show notification if available
        if (window.AdminNotifications) {
            AdminNotifications.error('Failed to save order settings: ' + (error.message || 'Unknown error'), {
                duration: 5000
            });
        }
    } finally {
        // Re-enable save button
        if (saveBtn) {
            saveBtn.disabled = false;
            saveBtn.innerHTML = '<i class="fas fa-save"></i> Save Settings';
        }
    }
}

// Initialize order settings modal
function initializeOrderSettingsModal() {
    const settingsBtn = document.getElementById('orderSettingsBtn');
    const modal = document.getElementById('orderSettingsModal');
    
    if (!settingsBtn || !modal) return;
    
    // Open modal button click
    settingsBtn.addEventListener('click', async function() {
        const loadingDiv = document.getElementById('orderSettingsLoading');
        const form = document.getElementById('orderSettingsForm');
        
        // Reset fleet capacity cache to get fresh data
        smallestFleetCapacity = null;
        
        // Show loading
        if (loadingDiv) loadingDiv.style.display = 'block';
        if (form) form.style.display = 'none';
        
        // Open modal
        $('#orderSettingsModal').modal('show');
        
        try {
            // Load settings
            const settings = await loadOrderSettings();
            
            // Populate form
            populateOrderSettingsForm(settings);
            
            // Hide loading, show form
            if (loadingDiv) loadingDiv.style.display = 'none';
            if (form) form.style.display = 'block';
            
            // Attach event listeners after form is populated and visible
            attachPercentageInputListener();
        } catch (error) {
            if (loadingDiv) {
                loadingDiv.innerHTML = `
                    <div class="alert alert-danger">
                        <i class="fas fa-exclamation-triangle"></i>
                        Failed to load settings: ${error.message}
                    </div>
                `;
            }
        }
    });
    
    // Auto-calculate toggle
    const autoCalculate = document.getElementById('autoCalculateFromFleet');
    if (autoCalculate) {
        autoCalculate.addEventListener('change', function() {
            toggleAutoCalculateFields();
            // Update calculated minimum when toggled
            if (autoCalculate.checked) {
                updateCalculatedMinimum();
            }
        });
    }
    
    // Allow below minimum toggle
    const allowBelow = document.getElementById('allowBelowMinimumWithFee');
    if (allowBelow) {
        allowBelow.addEventListener('change', togglePremiumFeeField);
    }
    
    // Save button
    const saveBtn = document.getElementById('saveOrderSettingsBtn');
    if (saveBtn) {
        saveBtn.addEventListener('click', saveOrderSettings);
    }
    
    // Reset form on modal close
    $('#orderSettingsModal').on('hidden.bs.modal', function() {
        const errorDiv = document.getElementById('orderSettingsError');
        if (errorDiv) {
            errorDiv.style.display = 'none';
            errorDiv.textContent = '';
        }
    });
}

// Attach percentage input listener (called after modal is opened and form is populated)
function attachPercentageInputListener() {
    const percentageInput = document.getElementById('minOrderWeightPercentage');
    
    if (!percentageInput) {
        console.error('Percentage input not found');
        return;
    }
    
    // Remove old listeners by cloning
    const newInput = percentageInput.cloneNode(true);
    percentageInput.parentNode.replaceChild(newInput, percentageInput);
    
    // Attach event listeners - get fresh reference to autoCalculate each time
    newInput.addEventListener('input', function() {
        console.log('Percentage input changed:', newInput.value);
        const autoCalc = document.getElementById('autoCalculateFromFleet');
        if (autoCalc && autoCalc.checked) {
            updateCalculatedMinimum();
        }
    });
    
    newInput.addEventListener('change', function() {
        console.log('Percentage input changed (change event):', newInput.value);
        const autoCalc = document.getElementById('autoCalculateFromFleet');
        if (autoCalc && autoCalc.checked) {
            updateCalculatedMinimum();
        }
    });
    
    newInput.addEventListener('keyup', function() {
        const autoCalc = document.getElementById('autoCalculateFromFleet');
        if (autoCalc && autoCalc.checked) {
            updateCalculatedMinimum();
        }
    });
    
    console.log('Percentage input listener attached successfully');
}

// Tab switching functionality for order status tabs (same pattern as DeliveriesAdmin.js)
// This will be initialized when jQuery is ready
$(document).ready(function() {
    // Check for tab parameter in URL to switch to specific tab
    const urlParams = new URLSearchParams(window.location.search);
    const tabParam = urlParams.get('tab');
    
    // Main tab switching (Delivery Orders | Pick Up Orders)
    $('.tab-btn').click(function() {
        const targetTab = $(this).data('tab');
        $('.tab-btn').removeClass('active');
        $('.tab-content').removeClass('active');
        $(this).addClass('active');
        const targetContent = $('#' + targetTab + '-content');
        if (targetContent.length > 0) targetContent.addClass('active');
    });

    // Delivery Orders secondary tab switching (Orders Placed | Preparing Orders | Out for Delivery | Complete Delivery)
    $(document).on('click', '.delivery-sub-tab-btn', function() {
        const targetSubTab = $(this).data('delivery-sub-tab');
        $('#delivery-orders-content .delivery-sub-tab-btn').removeClass('active');
        $('#delivery-orders-content .delivery-sub-tab-content').removeClass('active');
        $(this).addClass('active');
        if (targetSubTab === 'orders-placed') $('#delivery-orders-placed-content').addClass('active');
        else if (targetSubTab === 'preparing-orders') $('#delivery-preparing-orders-content').addClass('active');
        else if (targetSubTab === 'out-for-delivery') $('#delivery-out-for-delivery-content').addClass('active');
        else if (targetSubTab === 'complete-delivery') $('#delivery-complete-delivery-content').addClass('active');
    });

    // Pick Up Orders secondary tab switching (Orders Placed | Preparing Orders | Ready for Pick Up | Completed Pick Up)
    $(document).on('click', '.pickup-sub-tab-btn', function() {
        const targetSubTab = $(this).data('pickup-sub-tab');
        $('#pickup-orders-content .pickup-sub-tab-btn').removeClass('active');
        $('#pickup-orders-content .pickup-sub-tab-content').removeClass('active');
        $(this).addClass('active');
        if (targetSubTab === 'orders-placed') $('#pickup-orders-placed-content').addClass('active');
        else if (targetSubTab === 'preparing-orders') $('#pickup-preparing-orders-content').addClass('active');
        else if (targetSubTab === 'ready-for-pickup') $('#pickup-ready-for-pickup-content').addClass('active');
        else if (targetSubTab === 'completed-pickup') $('#pickup-completed-pickup-content').addClass('active');
    });
    
    // If tab parameter exists in URL, switch to that tab (direct DOM manipulation for reliability)
    const subtabParam = urlParams.get('subtab');
    if (tabParam) {
        const targetTabBtn = $(`.tab-btn[data-tab="${tabParam}"]`);
        if (targetTabBtn.length > 0) {
            // Switch main tab
            $('.tab-btn').removeClass('active');
            $('.tab-content').removeClass('active');
            targetTabBtn.addClass('active');
            const targetContent = $('#' + tabParam + '-content');
            if (targetContent.length > 0) targetContent.addClass('active');
            // Switch secondary tab (use setTimeout to ensure main tab content is shown first)
            if (subtabParam && tabParam === 'pickup-orders') {
                setTimeout(function() {
                    const subBtn = $(`.pickup-sub-tab-btn[data-pickup-sub-tab="${subtabParam}"]`);
                    if (subBtn.length > 0) {
                        $('#pickup-orders-content .pickup-sub-tab-btn').removeClass('active');
                        $('#pickup-orders-content .pickup-sub-tab-content').removeClass('active');
                        subBtn.addClass('active');
                        if (subtabParam === 'orders-placed') $('#pickup-orders-placed-content').addClass('active');
                        else if (subtabParam === 'preparing-orders') $('#pickup-preparing-orders-content').addClass('active');
                        else if (subtabParam === 'ready-for-pickup') $('#pickup-ready-for-pickup-content').addClass('active');
                        else if (subtabParam === 'completed-pickup') $('#pickup-completed-pickup-content').addClass('active');
                    }
                }, 0);
            } else if (subtabParam && tabParam === 'delivery-orders') {
                setTimeout(function() {
                    const subBtn = $(`.delivery-sub-tab-btn[data-delivery-sub-tab="${subtabParam}"]`);
                    if (subBtn.length > 0) {
                        $('#delivery-orders-content .delivery-sub-tab-btn').removeClass('active');
                        $('#delivery-orders-content .delivery-sub-tab-content').removeClass('active');
                        subBtn.addClass('active');
                        if (subtabParam === 'orders-placed') $('#delivery-orders-placed-content').addClass('active');
                        else if (subtabParam === 'preparing-orders') $('#delivery-preparing-orders-content').addClass('active');
                        else if (subtabParam === 'out-for-delivery') $('#delivery-out-for-delivery-content').addClass('active');
                        else if (subtabParam === 'complete-delivery') $('#delivery-complete-delivery-content').addClass('active');
                    }
                }, 0);
            }
        }
    }
    
    // Initialize other functions
    initializeSearch();
    initializeOrderSettingsModal();
});