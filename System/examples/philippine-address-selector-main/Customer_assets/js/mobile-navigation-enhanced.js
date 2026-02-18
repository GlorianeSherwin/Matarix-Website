/**
 * Enhanced Mobile Navigation
 * Handles bottom navigation, cart drawer, back to top, and other mobile interactions
 */

(function() {
    'use strict';

    // ========== BOTTOM NAVIGATION ==========
    
    /**
     * Initialize bottom navigation
     */
    function initBottomNavigation() {
        // Only on mobile
        if (window.innerWidth > 767) return;
        
        const currentPath = window.location.pathname;
        const currentPage = currentPath.split('/').pop() || 'index.html';
        
        // Set active state based on current page
        const bottomNavLinks = document.querySelectorAll('.mobile-bottom-nav a');
        bottomNavLinks.forEach(link => {
            const href = link.getAttribute('href');
            if (href) {
                const linkPage = href.split('/').pop();
                if (linkPage === currentPage || 
                    (currentPage === '' && linkPage === 'index.html') ||
                    (currentPage.includes('MainPage') && linkPage.includes('MainPage')) ||
                    (currentPage.includes('Cart') && linkPage.includes('Cart')) ||
                    (currentPage.includes('CustomerProfile') && linkPage.includes('CustomerProfile'))) {
                    link.classList.add('active');
                }
            }
        });
    }

    // ========== CART DRAWER ==========
    
    /**
     * Initialize cart drawer
     */
    function initCartDrawer() {
        // Only on mobile
        if (window.innerWidth > 767) return;
        
        const cartDrawer = document.getElementById('cartDrawer');
        const cartOverlay = document.getElementById('cartOverlay');
        const cartToggle = document.querySelectorAll('.cart-toggle-mobile, .cart-btn, #cartLinkIndex');
        const cartClose = document.getElementById('cartDrawerClose');
        
        if (!cartDrawer || !cartOverlay) return;
        
        // Open cart drawer
        function openCartDrawer() {
            cartDrawer.classList.add('open');
            cartOverlay.classList.add('active');
            document.body.style.overflow = 'hidden';
        }
        
        // Close cart drawer
        function closeCartDrawer() {
            cartDrawer.classList.remove('open');
            cartOverlay.classList.remove('active');
            document.body.style.overflow = '';
        }
        
        // Toggle cart drawer
        cartToggle.forEach(btn => {
            if (btn) {
                btn.addEventListener('click', function(e) {
                    // Don't prevent default if it's a direct link to cart page
                    if (this.classList.contains('cart-toggle-mobile') || this.getAttribute('href') === '#') {
                        e.preventDefault();
                        e.stopPropagation();
                    }
                    openCartDrawer();
                    // Load cart content if needed
                    loadCartDrawerContent();
                });
            }
        });
        
        // Function to load cart drawer content
        function loadCartDrawerContent() {
            const cartContent = cartDrawer.querySelector('.cart-drawer-content');
            if (!cartContent) return;
            
            // Check if user is logged in
            const userId = sessionStorage.getItem('user_id');
            if (!userId) {
                cartContent.innerHTML = `
                    <div class="text-center py-4">
                        <i class="fas fa-shopping-cart" style="font-size: 3rem; color: #ccc; margin-bottom: 15px;"></i>
                        <p class="text-muted">Please login to view your cart</p>
                        <a href="./Customer/Login.html" class="btn btn-primary-red mt-3">Login</a>
                    </div>
                `;
                return;
            }
            
            // Show loading state
            cartContent.innerHTML = `
                <div class="text-center py-4">
                    <div class="spinner-border text-primary" role="status">
                        <span class="sr-only">Loading...</span>
                    </div>
                    <p class="text-muted mt-2">Loading cart...</p>
                </div>
            `;
            
            // Load cart items (simplified - you may want to integrate with your actual cart API)
            // For now, redirect to full cart page
            setTimeout(() => {
                cartContent.innerHTML = `
                    <div class="text-center py-4">
                        <i class="fas fa-shopping-cart" style="font-size: 2rem; color: #ccc; margin-bottom: 15px;"></i>
                        <p class="text-muted">View your full cart for details</p>
                        <a href="./Cart.html" class="btn btn-primary-red mt-3">View Full Cart</a>
                    </div>
                `;
            }, 500);
        }
        
        // Close button
        if (cartClose) {
            cartClose.addEventListener('click', closeCartDrawer);
        }
        
        // Close on overlay click
        cartOverlay.addEventListener('click', closeCartDrawer);
        
        // Close on escape key
        document.addEventListener('keydown', function(e) {
            if (e.key === 'Escape' && cartDrawer.classList.contains('open')) {
                closeCartDrawer();
            }
        });
        
        // Prevent drawer from closing when clicking inside
        cartDrawer.addEventListener('click', function(e) {
            e.stopPropagation();
        });
    }

    // ========== BACK TO TOP BUTTON ==========
    
    /**
     * Initialize back to top button
     */
    function initBackToTop() {
        // Only on mobile
        if (window.innerWidth > 767) return;
        
        const backToTopBtn = document.getElementById('backToTop');
        if (!backToTopBtn) return;
        
        // Show/hide button based on scroll position
        function toggleBackToTop() {
            if (window.pageYOffset > 300) {
                backToTopBtn.classList.add('visible');
            } else {
                backToTopBtn.classList.remove('visible');
            }
        }
        
        // Scroll to top
        backToTopBtn.addEventListener('click', function() {
            window.scrollTo({
                top: 0,
                behavior: 'smooth'
            });
        });
        
        // Listen to scroll events
        window.addEventListener('scroll', toggleBackToTop);
        toggleBackToTop(); // Initial check
    }

    // ========== MOBILE MENU IMPROVEMENTS ==========
    
    /**
     * Improve mobile menu interactions
     */
    function improveMobileMenu() {
        // Only on mobile
        if (window.innerWidth > 767) return;
        
        // Better dropdown handling on mobile
        const dropdowns = document.querySelectorAll('.dropdown-toggle');
        dropdowns.forEach(dropdown => {
            dropdown.addEventListener('click', function(e) {
                // On mobile, prevent default and manually toggle
                if (window.innerWidth <= 767) {
                    const menu = this.nextElementSibling;
                    if (menu && menu.classList.contains('dropdown-menu')) {
                        // Close other dropdowns
                        document.querySelectorAll('.dropdown-menu.show').forEach(openMenu => {
                            if (openMenu !== menu) {
                                openMenu.classList.remove('show');
                            }
                        });
                        // Toggle current dropdown
                        menu.classList.toggle('show');
                    }
                }
            });
        });
        
        // Close dropdowns when clicking outside
        document.addEventListener('click', function(e) {
            if (!e.target.closest('.dropdown')) {
                document.querySelectorAll('.dropdown-menu.show').forEach(menu => {
                    menu.classList.remove('show');
                });
            }
        });
    }

    // ========== TOUCH GESTURES ==========
    
    /**
     * Add touch gesture support
     */
    function initTouchGestures() {
        // Only on mobile
        if (window.innerWidth > 767) return;
        
        // Swipe to close cart drawer
        const cartDrawer = document.getElementById('cartDrawer');
        if (cartDrawer) {
            let touchStartX = 0;
            let touchEndX = 0;
            
            cartDrawer.addEventListener('touchstart', function(e) {
                touchStartX = e.changedTouches[0].screenX;
            });
            
            cartDrawer.addEventListener('touchend', function(e) {
                touchEndX = e.changedTouches[0].screenX;
                handleSwipe();
            });
            
            function handleSwipe() {
                const swipeThreshold = 50;
                const swipeDistance = touchEndX - touchStartX;
                
                // Swipe right to close (if drawer is open)
                if (swipeDistance > swipeThreshold && cartDrawer.classList.contains('open')) {
                    const cartOverlay = document.getElementById('cartOverlay');
                    cartDrawer.classList.remove('open');
                    if (cartOverlay) {
                        cartOverlay.classList.remove('active');
                    }
                    document.body.style.overflow = '';
                }
            }
        }
    }

    // ========== RESPONSIVE HANDLING ==========
    
    /**
     * Handle window resize
     */
    function handleResize() {
        // Close cart drawer if resizing to desktop
        if (window.innerWidth > 767) {
            const cartDrawer = document.getElementById('cartDrawer');
            const cartOverlay = document.getElementById('cartOverlay');
            if (cartDrawer) {
                cartDrawer.classList.remove('open');
            }
            if (cartOverlay) {
                cartOverlay.classList.remove('active');
            }
            document.body.style.overflow = '';
        }
    }

    // ========== INITIALIZATION ==========
    
    /**
     * Initialize all mobile features
     */
    function init() {
        // Wait for DOM to be ready
        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', function() {
                initBottomNavigation();
                initCartDrawer();
                initBackToTop();
                improveMobileMenu();
                initTouchGestures();
            });
        } else {
            initBottomNavigation();
            initCartDrawer();
            initBackToTop();
            improveMobileMenu();
            initTouchGestures();
        }
        
        // Handle window resize
        let resizeTimer;
        window.addEventListener('resize', function() {
            clearTimeout(resizeTimer);
            resizeTimer = setTimeout(function() {
                handleResize();
                // Reinitialize if needed
                if (window.innerWidth <= 767) {
                    initBottomNavigation();
                }
            }, 250);
        });
    }

    // Start initialization
    init();

    // Export functions for external use
    window.MobileNavigation = {
        openCartDrawer: function() {
            const cartDrawer = document.getElementById('cartDrawer');
            const cartOverlay = document.getElementById('cartOverlay');
            if (cartDrawer && cartOverlay && window.innerWidth <= 767) {
                cartDrawer.classList.add('open');
                cartOverlay.classList.add('active');
                document.body.style.overflow = 'hidden';
            }
        },
        closeCartDrawer: function() {
            const cartDrawer = document.getElementById('cartDrawer');
            const cartOverlay = document.getElementById('cartOverlay');
            if (cartDrawer && cartOverlay) {
                cartDrawer.classList.remove('open');
                cartOverlay.classList.remove('active');
                document.body.style.overflow = '';
            }
        }
    };

})();

