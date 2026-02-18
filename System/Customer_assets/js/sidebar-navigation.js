/**
 * Sidebar Navigation Handler
 * Handles origin-aware navigation for sidebar links across all pages
 */

(function() {
    'use strict';

    /**
     * Initialize sidebar navigation
     */
    function initSidebarNavigation() {
        // Wait for NavigationTracker to be available
        if (typeof window.NavigationTracker === 'undefined') {
            // Load navigation tracker if not already loaded
            const script = document.createElement('script');
            script.src = '../Customer_assets/js/navigation-tracker.js';
            script.onload = function() {
                setupSidebarLinks();
            };
            document.head.appendChild(script);
        } else {
            setupSidebarLinks();
        }
    }

    /**
     * Setup sidebar links with origin-aware navigation
     */
    function setupSidebarLinks() {
        // Handle Materials links - check all possible selectors
        const sidebarLinks = document.querySelectorAll('.sidebar-item, .sidebar-menu a, .sidebar-content a');
        sidebarLinks.forEach(link => {
            // Check if it's a Materials link
            const isMaterialsLink = (link.textContent && link.textContent.trim().includes('Materials')) || 
                                   link.id === 'materialsLink' || 
                                   (link.getAttribute('href') && (link.getAttribute('href').includes('MainPage') || link.getAttribute('href') === '#'));
            
            // Check if it's Orders or Deliveries link (should navigate normally)
            const isOrdersLink = (link.textContent && link.textContent.trim().includes('Orders')) || 
                                link.id === 'ordersLink' ||
                                (link.getAttribute('href') && link.getAttribute('href').includes('OrderSummary'));
            const isDeliveriesLink = (link.textContent && link.textContent.trim().includes('Deliveries')) || 
                                   link.id === 'deliveriesLink' ||
                                   (link.getAttribute('href') && link.getAttribute('href').includes('delivery-tracking'));
            
            // Only handle Materials link with preventDefault
            if (isMaterialsLink && !link.hasAttribute('data-nav-handled')) {
                link.setAttribute('data-nav-handled', 'true');
                link.addEventListener('click', function(e) {
                    e.preventDefault();
                    navigateToMaterials();
                });
            }
            
            // For Orders and Deliveries, ensure they work normally (no preventDefault)
            // Just close sidebar on mobile after navigation starts
            if ((isOrdersLink || isDeliveriesLink) && !link.hasAttribute('data-nav-handled')) {
                link.setAttribute('data-nav-handled', 'true');
                link.addEventListener('click', function(e) {
                    // Don't prevent default - allow normal navigation
                    // Just close sidebar on mobile
                    if (window.innerWidth <= 991) {
                        const sidebar = document.getElementById('sidebar') || document.querySelector('.sidebar');
                        const overlay = document.getElementById('sidebarOverlay') || document.querySelector('.sidebar-overlay');
                        if (sidebar) {
                            sidebar.classList.remove('show');
                            if (overlay) overlay.classList.remove('show');
                            document.body.style.overflow = '';
                            document.body.style.position = '';
                            document.body.style.width = '';
                        }
                    }
                });
            }
        });

        // Handle Home/Back buttons
        const homeLinks = document.querySelectorAll('.home-nav-link, #homeLink, .back-btn');
        homeLinks.forEach(link => {
            link.addEventListener('click', function(e) {
                e.preventDefault();
                navigateToHome();
            });
        });
        
        // Handle buttons with "Back" or "Home" text (using manual filtering since :contains() is not a valid CSS selector)
        // Exclude Product Review back button - it should go to previous page / Order Summary, not Home
        const allButtons = document.querySelectorAll('button');
        allButtons.forEach(button => {
            if (button.id === 'productReviewBackBtn') return;
            const buttonText = button.textContent.trim();
            if (buttonText === 'Back' || buttonText === 'Home' || buttonText.includes('Back') || buttonText.includes('Home')) {
                // Check if already handled
                if (!button.hasAttribute('data-nav-handled')) {
                    button.setAttribute('data-nav-handled', 'true');
                    button.addEventListener('click', function(e) {
                        e.preventDefault();
                        navigateToHome();
                    });
                }
            }
        });
    }

    /**
     * Navigate to Materials page based on origin
     */
    function navigateToMaterials() {
        if (window.NavigationTracker) {
            window.NavigationTracker.goToMaterials();
        } else {
            // Fallback
            const origin = sessionStorage.getItem('navigationOrigin');
            const userId = sessionStorage.getItem('user_id');
            const currentPath = window.location.pathname;
            if (origin === 'landing') {
                if (currentPath.includes('/Customer/')) {
                    window.location.href = '../index.html#products';
                } else {
                    window.location.href = 'index.html#products';
                }
            } else {
                // Include user_id if available
                if (userId) {
                    window.location.href = 'MainPage.html#products';
                } else {
                    window.location.href = 'MainPage.html#products';
                }
            }
        }
    }

    /**
     * Navigate to Home page based on origin
     */
    function navigateToHome() {
        if (window.NavigationTracker) {
            window.NavigationTracker.goHome();
        } else {
            // Fallback
            const origin = sessionStorage.getItem('navigationOrigin');
            const currentPath = window.location.pathname;
            if (origin === 'landing') {
                if (currentPath.includes('/Customer/')) {
                    window.location.href = '../index.html';
                } else {
                    window.location.href = 'index.html';
                }
            } else {
                window.location.href = 'MainPage.html';
            }
        }
    }

    // Initialize when DOM is ready
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', initSidebarNavigation);
    } else {
        initSidebarNavigation();
    }

    // Also run after a short delay to catch dynamically added elements
    setTimeout(initSidebarNavigation, 500);
})();

