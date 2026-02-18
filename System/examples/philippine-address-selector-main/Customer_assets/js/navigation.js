/**
 * MATARIX Universal Navigation System
 * Auto-generates progress trackers and handles navigation between order flow pages
 * Pages: OrderSummary → Payment → Processing → delivery-tracking → ProductReview → TransactionHistory
 */

const MATARIX_PAGES = {
    'OrderSummary.html': {
        step: 0,
        title: 'Order Summary',
        icon: 'fas fa-list',
        label: 'Summary'
    },
    'Payment.html': {
        step: 1,
        title: 'Payment',
        icon: 'fas fa-wallet',
        label: 'To Pay'
    },
    'Processing.html': {
        step: 2,
        title: 'Processing',
        icon: 'fas fa-box',
        label: 'Processing'
    },
    'delivery-tracking.html': {
        step: 3,
        title: 'Delivery Tracking',
        icon: 'fas fa-truck',
        label: 'To Receive'
    },
    'ProductReview.html': {
        step: 4,
        title: 'Product Review',
        icon: 'fas fa-star',
        label: 'To Rate'
    },
    'TransactionHistory.html': {
        step: 5,
        title: 'Transaction History',
        icon: 'fas fa-history',
        label: 'History'
    }
};

// ============================================
// CORE FUNCTIONS
// ============================================

// Get current page filename
function getCurrentPage() {
    const path = window.location.pathname;
    const filename = path.split('/').pop() || 'OrderSummary.html';
    return filename;
}

// Get current step number based on order status or page
function getCurrentStep() {
    const currentPage = getCurrentPage();
    
    // For payment.html and processing.html, check order status
    if (currentPage === 'payment.html' || currentPage === 'Payment.html') {
        // Check if we have order data
        if (window.currentOrderData && window.currentOrderData.status) {
            const status = String(window.currentOrderData.status).trim();
            console.log(`[getCurrentStep] Payment page, status: "${status}"`);
            
            // No approval step - Pending Approval treated as To Pay for legacy orders
            if (status === 'Pending Approval' || status === 'Waiting Payment') {
                console.log(`[getCurrentStep] Returning step 1 (To Pay)`);
                return 1; // To Pay
            }
            if (status === 'Processing') {
                console.log(`[getCurrentStep] Returning step 2 (Processing)`);
                return 2; // Processing
            }
            if (status === 'Ready') {
                console.log(`[getCurrentStep] Returning step 3 (Ready)`);
                return 3; // Ready
            }
            
            console.warn(`[getCurrentStep] Unknown status: "${status}", defaulting to step 1`);
        } else {
            console.log(`[getCurrentStep] No order data, defaulting to step 1`);
        }
        return 1; // To Pay (payment page)
    }
    
    if (currentPage === 'processing.html' || currentPage === 'Processing.html') {
        // Check if we have order data
        if (window.currentOrderData && window.currentOrderData.status) {
            const status = String(window.currentOrderData.status).trim();
            console.log(`[getCurrentStep] Processing page, status: "${status}"`);
            
            if (status === 'Processing') {
                console.log(`[getCurrentStep] Returning step 2 (Processing)`);
                return 2; // Processing
            }
            if (status === 'Ready') {
                console.log(`[getCurrentStep] Returning step 3 (Ready)`);
                return 3; // Ready
            }
            
            console.warn(`[getCurrentStep] Unknown status: "${status}", defaulting to step 2`);
        } else {
            console.log(`[getCurrentStep] No order data, defaulting to step 2`);
        }
        return 2; // Processing page
    }
    
    // For ProductReview.html, always show "To Rate" step as active
    if (currentPage === 'ProductReview.html') {
        console.log(`[getCurrentStep] ProductReview page - Step 4 (To Rate)`);
        return 4; // To Rate
    }
    
    // For TransactionHistory.html, always show "History" step as active
    if (currentPage === 'TransactionHistory.html') {
        console.log(`[getCurrentStep] TransactionHistory page - Step 5 (History)`);
        return 5; // History
    }
    
    // For delivery-tracking.html, check delivery status
    if (currentPage === 'delivery-tracking.html') {
        // If we're viewing the orders list (not a specific order), don't highlight any step
        // Only show active step when viewing a specific order's tracking
        const selectedOrderSection = document.getElementById('selectedOrderSection');
        if (!selectedOrderSection || selectedOrderSection.style.display === 'none') {
            // We're on the orders list, return null to indicate no active step
            console.log(`[getCurrentStep] On orders list, no active step`);
            return null;
        }
        
        if (window.currentDeliveryData && window.currentDeliveryData.Delivery_Status) {
            // Normalize status (handle old values and case variations)
            let deliveryStatus = String(window.currentDeliveryData.Delivery_Status).trim();
            const statusLower = deliveryStatus.toLowerCase();
            
            // Normalize to standardized values
            if (statusLower === 'on the way' || statusLower === 'out for delivery') {
                deliveryStatus = 'Out for Delivery';
            } else if (statusLower === 'preparing') {
                deliveryStatus = 'Preparing';
            } else if (statusLower === 'pending') {
                deliveryStatus = 'Pending';
            } else if (statusLower === 'delivered') {
                deliveryStatus = 'Delivered';
            } else if (statusLower === 'cancelled' || statusLower === 'canceled') {
                deliveryStatus = 'Cancelled';
            }
            
            console.log(`[getCurrentStep] Delivery tracking - Raw: "${window.currentDeliveryData.Delivery_Status}", Normalized: "${deliveryStatus}"`);
            
            if (deliveryStatus === 'Cancelled') {
                console.log(`[getCurrentStep] Step -1 (Cancelled)`);
                return -1; // Cancelled - special step
            }
            if (deliveryStatus === 'Pending') {
                console.log(`[getCurrentStep] Step 0 (Pending)`);
                return 0; // Pending
            }
            if (deliveryStatus === 'Preparing') {
                console.log(`[getCurrentStep] Step 1 (Preparing)`);
                return 1; // Preparing
            }
            if (deliveryStatus === 'Out for Delivery') {
                console.log(`[getCurrentStep] Step 2 (To Receive - Out for Delivery)`);
                return 2; // To Receive
            }
            if (deliveryStatus === 'Delivered') {
                console.log(`[getCurrentStep] Step 3 (Completed)`);
                return 3; // Completed
            }
            
            console.warn(`[getCurrentStep] Unknown delivery status: "${deliveryStatus}", defaulting to step 0`);
        } else {
            console.log(`[getCurrentStep] No delivery data available (currentDeliveryData:`, window.currentDeliveryData, `), defaulting to step 0`);
        }
        // Default to step 0 (Pending) for delivery tracking
        return 0;
    }
    
    // Default: use page-based step
    return MATARIX_PAGES[currentPage]?.step ?? 0;
}

// Generate progress tracker HTML
function generateProgressTracker() {
    const currentPage = getCurrentPage();
    const currentStep = getCurrentStep();
    
    // Product Review and Transaction History: no tracker (user requested removal)
    if (currentPage === 'ProductReview.html' || currentPage === 'TransactionHistory.html') {
        return '';
    }
    
    // For delivery-tracking.html, use delivery tracker
    if (currentPage === 'delivery-tracking.html') {
        return generateDeliveryTracker(currentStep);
    }
    
    // For payment.html and processing.html, use payment flow tracker
    if (currentPage === 'payment.html' || currentPage === 'Payment.html' || 
        currentPage === 'processing.html' || currentPage === 'Processing.html') {
        return generatePaymentTracker(currentStep);
    }

    // Default tracker for other pages
    let trackerHTML = `
        <div class="progress-tracker-container">
            <div class="progress-tracker">
    `;

    Object.keys(MATARIX_PAGES).forEach(pageFile => {
        const page = MATARIX_PAGES[pageFile];
        let stepClass = 'progress-step';

        if (page.step < currentStep) {
            stepClass += ' completed';
        } else if (page.step === currentStep) {
            stepClass += ' active';
        } else {
            stepClass += ' pending';
        }

        // make all steps clickable for navigation
        stepClass += ' clickable';

        trackerHTML += `
            <div class="${stepClass}" data-page="${pageFile}" data-step="${page.step}">
                <div class="step-icon"><i class="${page.icon}"></i></div>
                <div class="step-label">${page.label}</div>
            </div>
        `;
    });

    trackerHTML += `
            </div>
        </div>
    `;

    return trackerHTML;
}

// Generate payment flow tracker (Summary, To Pay, Processing, Ready) - no approval step
function generatePaymentTracker(currentStep) {
    const steps = [
        { step: 0, icon: 'fas fa-list', label: 'Summary' },
        { step: 1, icon: 'fas fa-wallet', label: 'To Pay' },
        { step: 2, icon: 'fas fa-box', label: 'Processing' },
        { step: 3, icon: 'fas fa-check-circle', label: 'Ready' }
    ];
    
    let trackerHTML = `
        <div class="progress-tracker-container">
            <div class="progress-tracker">
    `;
    
    steps.forEach(step => {
        let stepClass = 'progress-step';
        if (step.step < currentStep) {
            stepClass += ' completed';
        } else if (step.step === currentStep) {
            stepClass += ' active';
        } else {
            stepClass += ' pending';
        }
        
        trackerHTML += `
            <div class="${stepClass}" data-step="${step.step}">
                <div class="step-icon"><i class="${step.icon}"></i></div>
                <div class="step-label">${step.label}</div>
            </div>
        `;
    });
    
    trackerHTML += `
            </div>
        </div>
    `;
    
    return trackerHTML;
}

// Generate delivery tracker (Pending, Preparing, To Receive, Completed, To Rate, History)
function generateDeliveryTracker(currentStep) {
    // Handle cancelled status - show cancelled step
    if (currentStep === -1) {
        return `
            <div class="progress-tracker-container">
                <div class="progress-tracker">
                    <div class="progress-step active cancelled" data-step="-1">
                        <div class="step-icon"><i class="fas fa-times-circle"></i></div>
                        <div class="step-label">Cancelled</div>
                    </div>
                </div>
            </div>
        `;
    }
    
    // Get currently active filter (if any) from existing tracker or URL/global state
    let activeFilter = null;
    const existingTracker = document.querySelector('.progress-tracker-container');
    if (existingTracker) {
        const activeFilterStep = existingTracker.querySelector('.progress-step.filter-active');
        if (activeFilterStep) {
            activeFilter = activeFilterStep.getAttribute('data-filter');
        }
    }
    // Fallback: use global filter (e.g. from ?filter= URL param on initial load)
    if (!activeFilter && typeof window.currentActiveFilter === 'string' && window.currentActiveFilter) {
        activeFilter = window.currentActiveFilter;
    }
    
    
    const actionSteps = [
        { step: 4, icon: 'fas fa-star', label: 'To Rate' },
        { step: 5, icon: 'fas fa-history', label: 'History' }
    ];
    
    
    let trackerHTML = `
        <div class="progress-tracker-container">
            <div class="progress-tracker progress-tracker-actions-only">
                <div class="progress-tracker-actions" style="flex: 1; justify-content: center; gap: 30px;">
    `;
    
    /* STATUS STEPS REMOVED - block commented out
        // For delivery-tracking.html viewing specific order: only steps 0-3 show progression
        // For ProductReview.html and TransactionHistory.html: all steps show progression
        if (isViewingSpecificOrder) {
            // For delivery-tracking page, only apply progression to steps 0-3
            // For ProductReview/TransactionHistory pages, apply progression to all steps
            if (isDeliveryTrackingPage && step.step > 3) {
                // Steps 4-5 (To Rate, History) are always pending when viewing specific order on delivery-tracking page
                stepClass += ' pending';
            } else {
                // Apply normal progression logic
                if (step.step < currentStep) {
                    stepClass += ' completed';
                } else if (step.step === currentStep) {
                    stepClass += ' active';
                } else {
                    stepClass += ' pending';
                }
            }
        } else {
            // On orders list - all steps are pending (not highlighted)
            stepClass += ' pending';
        }
        
        // Make all steps clickable for filtering
        let clickableAttr = '';
        let filterType = '';
        
        if (step.step === 0) {
            // Pending step
            filterType = 'pending';
        } else if (step.step === 1) {
            // Preparing step
            filterType = 'preparing';
        } else if (step.step === 2) {
            // To Receive step
            filterType = 'to-receive';
        } else if (step.step === 3) {
            // Completed step
            filterType = 'completed';
        }
        
        if (filterType) {
            stepClass += ' clickable-filter';
            clickableAttr = `data-filter="${filterType}"`;
            
            if (activeFilter === filterType) {
                stepClass += ' filter-active';
            }
        }
        
        trackerHTML += `
            <div class="${stepClass}" data-step="${step.step}" ${clickableAttr}>
                <div class="step-icon"><i class="${step.icon}"></i></div>
                <div class="step-label">${step.label}</div>
            </div>
        `;
    });
    
    trackerHTML += `
                </div>
                <div class="progress-tracker-actions">
    `;
    */
    
    // To Rate and History - action steps
    actionSteps.forEach(step => {
        let stepClass = 'progress-step progress-step-action pending';
        
        let filterType = step.step === 4 ? 'to-rate' : 'history';
        stepClass += ' clickable-filter';
        const clickableAttr = `data-filter="${filterType}"`;
        if (activeFilter === filterType) {
            stepClass += ' filter-active';
        }
        
        trackerHTML += `
            <div class="${stepClass}" data-step="${step.step}" ${clickableAttr}>
                <div class="step-icon"><i class="${step.icon}"></i></div>
                <div class="step-label">${step.label}</div>
            </div>
        `;
    });
    
    trackerHTML += `
                </div>
            </div>
        </div>
    `;
    
    return trackerHTML;
}

// Navigate to specific page
function navigateToPage(targetPage) {
    if (MATARIX_PAGES[targetPage]) {
        window.location.href = targetPage;
    } else {
        console.error('Invalid target page:', targetPage);
    }
}

// Attach click handlers for navigation
function attachNavigationHandlers() {
    document.addEventListener('click', function(event) {
        const stepElement = event.target.closest('.progress-step.clickable');
        if (stepElement) {
            const targetPage = stepElement.getAttribute('data-page');
            navigateToPage(targetPage);
        }
    });
}

// Add CSS styles for tracker
function addProgressTrackerStyles() {
    const styleId = 'matarix-progress-tracker-styles';
    if (document.getElementById(styleId)) return;

    const style = document.createElement('style');
    style.id = styleId;
    style.textContent = `
        .progress-tracker-container {
            margin: 20px 0;
            padding: 0 15px;
        }
        .progress-tracker {
            display: flex;
            justify-content: space-between;
            align-items: center;
            background: white;
            border-radius: 12px;
            padding: 20px;
            box-shadow: 0 2px 10px rgba(0,0,0,0.1);
            margin-bottom: 20px;
            gap: 20px;
        }
        .progress-tracker-statuses {
            display: flex;
            flex: 1;
            justify-content: space-between;
            align-items: center;
            position: relative;
        }
        .progress-tracker-statuses::before {
            content: '';
            position: absolute;
            top: 50%;
            left: 10%;
            right: 10%;
            height: 2px;
            background: #e0e0e0;
            z-index: 1;
        }
        .progress-tracker-actions {
            display: flex;
            align-items: center;
            gap: 15px;
        }
        .progress-tracker-statuses .progress-step {
            flex: 1;
            min-width: 0;
        }
        .progress-step {
            display: flex;
            flex-direction: column;
            align-items: center;
            position: relative;
            z-index: 2;
            min-width: 80px;
        }
        .step-icon {
            width: 50px;
            height: 50px;
            border-radius: 50%;
            display: flex;
            align-items: center;
            justify-content: center;
            margin-bottom: 8px;
            font-size: 18px;
            background: #f5f5f5;
            color: #999;
            border: 2px solid #e0e0e0;
        }
        .step-label {
            font-size: 12px;
            font-weight: 500;
            text-align: center;
            color: #666;
        }
        .progress-step.completed .step-icon {
            background: #28a745;
            color: white;
            border-color: #28a745;
        }
        .progress-step.completed .step-label {
            color: #28a745;
        }
        .progress-step.active .step-icon {
            background: #ff6b35;
            color: white;
            border-color: #ff6b35;
            animation: pulse 2s infinite;
        }
        .progress-step.active .step-label {
            color: #ff6b35;
            font-weight: 600;
        }
        .progress-step.active[data-page="TransactionHistory.html"] .step-icon {
            background: #007bff;
            border-color: #007bff;
        }
        .progress-step.active[data-page="TransactionHistory.html"] .step-label {
            color: #007bff;
        }
        .progress-step.clickable {
            cursor: pointer;
            transition: all 0.3s ease;
        }
        .progress-step.clickable:hover .step-icon {
            transform: scale(1.1);
        }
        .progress-step.clickable:hover .step-label {
            color: #ff6b35;
        }
        /* Action steps (To Rate, History) - never light up, no status styling */
        .progress-step-action .step-icon,
        .progress-step-action.filter-active .step-icon {
            background: #f5f5f5 !important;
            color: #999 !important;
            border-color: #e0e0e0 !important;
            animation: none !important;
        }
        .progress-step-action .step-label,
        .progress-step-action.filter-active .step-label {
            color: #666 !important;
            font-weight: 500 !important;
        }
        .progress-step-action:hover .step-icon {
            background: #eee !important;
            color: #888 !important;
        }
        @keyframes pulse {
            0% { transform: scale(1); box-shadow: 0 0 0 0 rgba(255, 107, 53, 0.7); }
            70% { transform: scale(1.05); box-shadow: 0 0 0 10px rgba(255, 107, 53, 0); }
            100% { transform: scale(1); box-shadow: 0 0 0 0 rgba(255, 107, 53, 0); }
        }
        @media (max-width: 768px) {
            .progress-tracker { padding: 15px 10px; overflow-x: auto; flex-direction: column; align-items: stretch; }
            .progress-tracker-statuses { overflow-x: auto; }
            .progress-tracker-actions { justify-content: center; }
            .step-icon { width: 40px; height: 40px; font-size: 14px; }
            .step-label { font-size: 10px; }
            .progress-step { min-width: 60px; }
        }
        @media (max-width: 480px) {
            .progress-tracker { flex-wrap: wrap; gap: 10px; }
            .progress-tracker-statuses::before { display: none; }
        }
    `;
    document.head.appendChild(style);
}

// ============================================
// DELIVERY TRACKING PAGE FUNCTIONS
// ============================================

if (document.getElementById('sidebarToggle')) {
    document.getElementById('sidebarToggle').addEventListener('click', function() {
        const sidebar = document.getElementById('sidebar');
        const overlay = document.getElementById('sidebarOverlay');
        sidebar.classList.toggle('show');
        overlay.classList.toggle('show');
    });
}

if (document.getElementById('sidebarOverlay')) {
    document.getElementById('sidebarOverlay').addEventListener('click', function() {
        const sidebar = document.getElementById('sidebar');
        const overlay = document.getElementById('sidebarOverlay');
        sidebar.classList.remove('show');
        overlay.classList.remove('show');
    });
}

function toggleOrderDetails() {
    const orderCard = document.getElementById('orderCard');
    const expandableContent = document.getElementById('expandableContent');
    const expandIcon = orderCard?.querySelector('.expand-icon');

    if (!expandableContent || !expandIcon) return;

    const isExpanded = expandableContent.classList.contains('expanded');
    if (isExpanded) {
        expandableContent.classList.remove('expanded');
        expandIcon.style.transform = 'rotate(0deg)';
    } else {
        expandableContent.classList.add('expanded');
        expandIcon.style.transform = 'rotate(90deg)';
    }
}

// Page button actions
function reviewOrder() {
    // Get order_id from URL or current order
    const urlParams = new URLSearchParams(window.location.search);
    const orderId = urlParams.get('order_id') || window.currentOrderId;
    
    if (orderId) {
        window.location.href = `ProductReview.html?order_id=${orderId}`;
    } else {
        window.location.href = 'ProductReview.html';
    }
}
function viewTransaction() { 
    window.location.href = 'TransactionHistory.html';
}
function goHome() { 
    window.location.href = 'OrderSummary.html';
}

// Back to orders function (previously goBackToDeliveries - Deliveries tab removed)
function goBackToDeliveries() {
    window.location.href = 'OrderSummary.html';
}

// Close sidebar when clicking outside
document.addEventListener('click', function(event) {
    const sidebar = document.getElementById('sidebar');
    const toggle = document.getElementById('sidebarToggle');
    if (sidebar && toggle && !sidebar.contains(event.target) && !toggle.contains(event.target)) {
        sidebar.classList.remove('show');
        const overlay = document.getElementById('sidebarOverlay');
        if (overlay) overlay.classList.remove('show');
    }
});

// ============================================
// INIT
// ============================================

// Flag to prevent multiple initializations
let navigationInitialized = false;

// Function to initialize tracker (can be called manually or on DOMContentLoaded)
function initializeProgressTracker() {
    const pageHeader = document.querySelector('.page-header');
    if (!pageHeader) {
        console.log('Page header not found, skipping tracker initialization');
        return;
    }
    
    // Remove any existing trackers first to prevent duplication
    const existingTrackers = document.querySelectorAll('.progress-tracker-container');
    if (existingTrackers.length > 0) {
        console.log(`Removing ${existingTrackers.length} existing tracker(s) to prevent duplication`);
        existingTrackers.forEach(tracker => tracker.remove());
    }
    
    // Check if already initialized (after removing duplicates)
    if (navigationInitialized && existingTrackers.length > 0) {
        addProgressTrackerStyles();
        const trackerHTML = generateProgressTracker();
        if (trackerHTML) {
            pageHeader.insertAdjacentHTML('afterend', trackerHTML);
            attachNavigationHandlers();
        }
        console.log('MATARIX Navigation System reinitialized for:', getCurrentPage());
        return;
    }
    
    // Check if already initialized
    if (navigationInitialized) {
        console.log('Navigation already initialized, skipping...');
        return;
    }
    
    addProgressTrackerStyles();
    const trackerHTML = generateProgressTracker();
    if (trackerHTML) {
        pageHeader.insertAdjacentHTML('afterend', trackerHTML);
        attachNavigationHandlers();
    }
    navigationInitialized = true;
    
    // Setup delivery tracker filter handlers if on delivery-tracking (ProductReview/TransactionHistory have no tracker)
    // (delivery-tracking.html has its own handlers in load_delivery_tracking.js)
    const currentPage = getCurrentPage();
    if (currentPage === 'delivery-tracking.html') {
        setupDeliveryTrackerFilterHandlers();
    }
    
    console.log('MATARIX Navigation System initialized for:', currentPage);
    
    // If we have order data or delivery data, update the tracker immediately
    if (window.currentOrderData && (currentPage === 'payment.html' || currentPage === 'Payment.html' || 
        currentPage === 'processing.html' || currentPage === 'Processing.html')) {
        console.log('Order data available, updating tracker immediately');
        setTimeout(() => {
            if (window.MatarixNavigation && window.MatarixNavigation.updateProgressTracker) {
                window.MatarixNavigation.updateProgressTracker();
            }
        }, 100);
    }
    
    // For delivery-tracking.html, wait for delivery data and update tracker
    if (currentPage === 'delivery-tracking.html') {
        console.log('Delivery tracking page detected, will update tracker when delivery data is available');
        // Check if delivery data is already available
        if (window.currentDeliveryData) {
            setTimeout(() => {
                if (window.MatarixNavigation && window.MatarixNavigation.updateProgressTracker) {
                    console.log('Delivery data already available, updating tracker...');
                    window.MatarixNavigation.updateProgressTracker();
                }
            }, 500);
        } else {
            // If delivery data not available yet, set up a watcher to regenerate tracker when it becomes available
            console.log('Delivery data not available yet, setting up watcher...');
            let checkCount = 0;
            const maxChecks = 20; // Check for 10 seconds (20 * 500ms)
            const checkInterval = setInterval(() => {
                checkCount++;
                if (window.currentDeliveryData) {
                    console.log('Delivery data now available, regenerating tracker...');
                    if (window.MatarixNavigation) {
                        // Prefer regenerate over update for reliability
                        if (window.MatarixNavigation.regenerateTracker) {
                            window.MatarixNavigation.regenerateTracker();
                        } else if (window.MatarixNavigation.updateProgressTracker) {
                            window.MatarixNavigation.updateProgressTracker();
                        }
                    }
                    clearInterval(checkInterval);
                } else if (checkCount >= maxChecks) {
                    console.warn('Delivery data not available after 10 seconds, stopping watcher');
                    clearInterval(checkInterval);
                }
            }, 500);
        }
    }
}

// Only initialize once on DOMContentLoaded
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', function() {
        // Wait a bit for order data to load (for payment.html and delivery-tracking.html)
        setTimeout(() => {
            initializeProgressTracker();
        }, 500);
    });
} else {
    // DOM already loaded, initialize immediately
    setTimeout(() => {
        initializeProgressTracker();
    }, 500);
}

// Export for manual use
window.MatarixNavigation = {
    navigateToPage,
    getCurrentPage,
    getCurrentStep,
    initMatarixNavigation: () => {
        // Use the centralized initialization function
        // But only if not already initialized
        if (!navigationInitialized) {
            initializeProgressTracker();
        }
    },
    updateProgressTracker: () => {
        // Function to update progress tracker based on current order data
        const tracker = document.querySelector('.progress-tracker-container');
        if (!tracker) {
            console.warn('[Tracker Update] Progress tracker container not found');
            return;
        }
        
        const currentStep = getCurrentStep();
        const currentPage = getCurrentPage();
        const orderStatus = window.currentOrderData?.status;
        const deliveryStatus = window.currentDeliveryData?.Delivery_Status;
        
        console.log(`[Tracker Update] Page: ${currentPage}, Order Status: ${orderStatus}, Delivery Status: "${deliveryStatus}", Calculated Step: ${currentStep}`);
        
        const steps = tracker.querySelectorAll('.progress-step');
        
        if (steps.length === 0) {
            console.warn('[Tracker Update] No progress steps found in tracker');
            return;
        }
        
        console.log(`[Tracker Update] Found ${steps.length} steps, updating classes...`);
        
        steps.forEach((stepEl, index) => {
            const stepNum = parseInt(stepEl.getAttribute('data-step') || index);
            const stepLabel = stepEl.querySelector('.step-label')?.textContent || `Step ${stepNum}`;
            
            // Remove all status classes
            stepEl.classList.remove('completed', 'active', 'pending');
            
            // Add appropriate class based on current step
            if (stepNum < currentStep) {
                stepEl.classList.add('completed');
                console.log(`[Tracker Update] Step ${stepNum} (${stepLabel}): COMPLETED`);
            } else if (stepNum === currentStep) {
                stepEl.classList.add('active');
                console.log(`[Tracker Update] Step ${stepNum} (${stepLabel}): ACTIVE ⭐`);
            } else {
                stepEl.classList.add('pending');
                console.log(`[Tracker Update] Step ${stepNum} (${stepLabel}): PENDING`);
            }
        });
        
        console.log(`[Tracker Update] ✅ Updated ${steps.length} steps, current active step: ${currentStep}`);
        
        // Verify the active class was applied
        const activeStep = tracker.querySelector(`.progress-step[data-step="${currentStep}"]`);
        if (activeStep) {
            const hasActiveClass = activeStep.classList.contains('active');
            console.log(`[Tracker Update] Verification: Step ${currentStep} has 'active' class: ${hasActiveClass}`);
            if (!hasActiveClass) {
                console.error(`[Tracker Update] ❌ ERROR: Active class not applied to step ${currentStep}!`);
                // Force add the active class
                activeStep.classList.add('active');
                console.log(`[Tracker Update] 🔧 Fixed: Manually added 'active' class to step ${currentStep}`);
            }
        } else {
            console.error(`[Tracker Update] ❌ ERROR: Could not find step element with data-step="${currentStep}"`);
        }
        
        // Force a reflow to ensure CSS updates are applied
        tracker.offsetHeight;
    },
    regenerateTracker: () => {
        // Function to completely regenerate the tracker (useful if update isn't working)
        const pageHeader = document.querySelector('.page-header');
        if (!pageHeader) {
            console.warn('[Tracker Regenerate] Page header not found');
            return;
        }
        
        // Remove existing tracker
        const existingTracker = document.querySelector('.progress-tracker-container');
        if (existingTracker) {
            existingTracker.remove();
            console.log('[Tracker Regenerate] Removed existing tracker');
        }
        
        // Regenerate tracker with current step
        const currentStep = getCurrentStep();
        const currentPage = getCurrentPage();
        console.log(`[Tracker Regenerate] Regenerating tracker for page: ${currentPage}, step: ${currentStep}`);
        
        let trackerHTML;
        if (currentPage === 'ProductReview.html' || currentPage === 'TransactionHistory.html') {
            trackerHTML = ''; // No tracker on these pages
        } else if (currentPage === 'delivery-tracking.html') {
            trackerHTML = generateDeliveryTracker(currentStep);
        } else if (currentPage === 'payment.html' || currentPage === 'Payment.html' || 
                   currentPage === 'processing.html' || currentPage === 'Processing.html') {
            // Use payment tracker with Pending Approval step
            trackerHTML = generatePaymentTracker(currentStep);
        } else {
            trackerHTML = generateProgressTracker();
        }
        
        if (trackerHTML) {
            pageHeader.insertAdjacentHTML('afterend', trackerHTML);
            attachNavigationHandlers();
        }
        console.log('[Tracker Regenerate] ✅ Tracker regenerated');
    },
    toggleOrderDetails,
    reviewOrder,
    viewTransaction,
    goHome
};

// Export toggleOrderDetails to window for HTML onclick handlers
window.toggleOrderDetails = toggleOrderDetails;

// Export goBackToDeliveries function
window.goBackToDeliveries = goBackToDeliveries;

// Setup click handlers for delivery tracker filter steps (for ProductReview and TransactionHistory pages)
function setupDeliveryTrackerFilterHandlers() {
    // Use event delegation to handle clicks on dynamically generated tracker steps
    // Only set up once
    if (window.deliveryTrackerHandlersSetup) {
        return;
    }
    
    document.addEventListener('click', function(event) {
        const filterStep = event.target.closest('.progress-step.clickable-filter');
        if (filterStep) {
            const filterType = filterStep.getAttribute('data-filter');
            const currentPage = getCurrentPage();
            
            // Only handle clicks on ProductReview.html or TransactionHistory.html
            // delivery-tracking.html has its own handlers in load_delivery_tracking.js
            if (currentPage !== 'ProductReview.html' && 
                currentPage !== 'TransactionHistory.html') {
                return;
            }
            
            event.preventDefault();
            event.stopPropagation();
            
            // Remove active filter state from all steps
            document.querySelectorAll('.progress-step.filter-active').forEach(step => {
                step.classList.remove('filter-active');
            });
            
            // Add active filter state to clicked step
            filterStep.classList.add('filter-active');
            
            // Store current active filter globally
            window.currentActiveFilter = filterType;
            
            // Navigate to delivery-tracking.html with the filter applied
            const urlParams = new URLSearchParams(window.location.search);
            const url = `delivery-tracking.html?filter=${filterType}`;
            window.location.href = url;
        }
    });
    
    window.deliveryTrackerHandlersSetup = true;
}
