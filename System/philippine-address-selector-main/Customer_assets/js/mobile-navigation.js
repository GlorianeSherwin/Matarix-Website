/**
 * Mobile Navigation Handler for MATARIX Web System
 * Provides consistent mobile menu behavior across all pages
 * Version: 1.0
 */

(function() {
    'use strict';

    // Initialize when DOM is ready
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', initMobileNavigation);
    } else {
        initMobileNavigation();
    }
    
    // Also try after a short delay to catch dynamically loaded content
    setTimeout(initMobileNavigation, 500);
    setTimeout(initMobileNavigation, 1000);

    function initMobileNavigation() {
        setupSidebarToggle();
        setupSidebarOverlay();
        setupCloseOnOutsideClick();
        setupCloseOnLinkClick();
        setupKeyboardNavigation();
        handleResize();
        preventBodyScroll();
    }

    /**
     * Setup sidebar toggle button
     */
    function setupSidebarToggle() {
        const toggleButtons = document.querySelectorAll('#sidebarToggle, .mobile-menu-toggle#sidebarToggle, button#sidebarToggle, .navbar-toggler#sidebarToggle');
        const sidebar = document.getElementById('sidebar') || document.querySelector('.sidebar');
        
        if (!sidebar) {
            console.warn('Sidebar not found for toggle button');
            return;
        }

        toggleButtons.forEach(button => {
            // Remove any existing listeners to prevent duplicates
            const newButton = button.cloneNode(true);
            button.parentNode.replaceChild(newButton, button);
            
            // Skip Bootstrap collapse toggles that target navbar
            if (newButton.getAttribute('data-target') === '#navbarNav' || 
                newButton.getAttribute('data-target') === '#navbarCollapse') {
                return; // Let Bootstrap handle navbar collapse
            }

            // Use both click and touch events for maximum compatibility
            newButton.addEventListener('click', function(e) {
                e.preventDefault();
                e.stopPropagation();
                e.stopImmediatePropagation();
                console.log('Sidebar toggle clicked');
                toggleSidebar(sidebar);
                return false;
            }, {capture: true, passive: false});
            
            // Also add touch event for mobile
            newButton.addEventListener('touchend', function(e) {
                e.preventDefault();
                e.stopPropagation();
                e.stopImmediatePropagation();
                console.log('Sidebar toggle touched');
                toggleSidebar(sidebar);
                return false;
            }, {capture: true, passive: false});
            
            // Add mousedown as well for better responsiveness
            newButton.addEventListener('mousedown', function(e) {
                e.stopPropagation();
            }, {capture: true});
        });
        
        // Also try to find button by ID directly as fallback
        const sidebarToggleById = document.getElementById('sidebarToggle');
        if (sidebarToggleById && !sidebarToggleById.hasAttribute('data-listener-attached')) {
            sidebarToggleById.setAttribute('data-listener-attached', 'true');
            sidebarToggleById.addEventListener('click', function(e) {
                e.preventDefault();
                e.stopPropagation();
                e.stopImmediatePropagation();
                console.log('Sidebar toggle clicked (ID fallback)');
                toggleSidebar(sidebar);
                return false;
            }, {capture: true, passive: false});
            
            sidebarToggleById.addEventListener('touchend', function(e) {
                e.preventDefault();
                e.stopPropagation();
                e.stopImmediatePropagation();
                console.log('Sidebar toggle touched (ID fallback)');
                toggleSidebar(sidebar);
                return false;
            }, {capture: true, passive: false});
            
            // Add mousedown as well
            sidebarToggleById.addEventListener('mousedown', function(e) {
                e.stopPropagation();
            }, {capture: true});
        }
    }

    /**
     * Toggle sidebar visibility
     */
    function toggleSidebar(sidebar) {
        if (!sidebar) return;

        const isOpen = sidebar.classList.contains('show');
        
        if (isOpen) {
            closeSidebar(sidebar);
        } else {
            openSidebar(sidebar);
        }
    }

    /**
     * Open sidebar
     */
    function openSidebar(sidebar) {
        sidebar.classList.add('show');
        
        // Show overlay
        const overlay = getOrCreateOverlay();
        overlay.classList.add('show');
        
        // Prevent body scroll
        document.body.style.overflow = 'hidden';
        document.body.style.position = 'fixed';
        document.body.style.width = '100%';
        
        // Focus management for accessibility
        const firstLink = sidebar.querySelector('a, button');
        if (firstLink) {
            setTimeout(() => {
                firstLink.focus();
            }, 100);
        }

        // Dispatch custom event
        window.dispatchEvent(new CustomEvent('sidebar:opened'));
    }

    /**
     * Close sidebar
     */
    function closeSidebar(sidebar) {
        sidebar.classList.remove('show');
        
        // Hide overlay
        const overlay = document.querySelector('.sidebar-overlay');
        if (overlay) {
            overlay.classList.remove('show');
        }
        
        // Restore body scroll
        document.body.style.overflow = '';
        document.body.style.position = '';
        document.body.style.width = '';

        // Dispatch custom event
        window.dispatchEvent(new CustomEvent('sidebar:closed'));
    }

    /**
     * Get or create sidebar overlay
     */
    function getOrCreateOverlay() {
        let overlay = document.querySelector('.sidebar-overlay');
        
        if (!overlay) {
            overlay = document.createElement('div');
            overlay.className = 'sidebar-overlay';
            overlay.setAttribute('aria-hidden', 'true');
            overlay.setAttribute('role', 'button');
            overlay.setAttribute('tabindex', '-1');
            overlay.setAttribute('aria-label', 'Close menu');
            document.body.appendChild(overlay);
        }
        
        return overlay;
    }

    /**
     * Setup overlay click to close
     */
    function setupSidebarOverlay() {
        document.addEventListener('click', function(e) {
            const overlay = document.querySelector('.sidebar-overlay');
            if (overlay && overlay.classList.contains('show') && e.target === overlay) {
                const sidebar = document.getElementById('sidebar') || document.querySelector('.sidebar');
                if (sidebar) {
                    closeSidebar(sidebar);
                }
            }
        });

        // Also handle overlay keyboard events
        document.addEventListener('keydown', function(e) {
            const overlay = document.querySelector('.sidebar-overlay');
            if (overlay && overlay.classList.contains('show') && e.key === 'Enter') {
                const sidebar = document.getElementById('sidebar') || document.querySelector('.sidebar');
                if (sidebar) {
                    closeSidebar(sidebar);
                }
            }
        });
    }

    /**
     * Close sidebar when clicking outside
     */
    function setupCloseOnOutsideClick() {
        document.addEventListener('click', function(e) {
            const sidebar = document.getElementById('sidebar') || document.querySelector('.sidebar');
            if (!sidebar || !sidebar.classList.contains('show')) return;

            const toggleButtons = document.querySelectorAll('#sidebarToggle, .mobile-menu-toggle');
            const isClickInsideSidebar = sidebar.contains(e.target);
            const isClickOnToggle = Array.from(toggleButtons).some(btn => btn.contains(e.target));
            const isClickOnOverlay = e.target.classList.contains('sidebar-overlay');
            
            if (!isClickInsideSidebar && !isClickOnToggle && !isClickOnOverlay && window.innerWidth <= 991) {
                closeSidebar(sidebar);
            }
        });
    }

    /**
     * Close sidebar when clicking on navigation links (mobile only)
     */
    function setupCloseOnLinkClick() {
        const sidebar = document.getElementById('sidebar') || document.querySelector('.sidebar');
        if (!sidebar) return;

        const links = sidebar.querySelectorAll('a.sidebar-item, a.nav-link, .sidebar-menu a, .sidebar-content a');
        
        links.forEach(link => {
            link.addEventListener('click', function() {
                // Only close on mobile
                if (window.innerWidth <= 991) {
                    setTimeout(() => {
                        closeSidebar(sidebar);
                    }, 150); // Small delay for better UX
                }
            });
        });
    }

    /**
     * Setup keyboard navigation (ESC to close)
     */
    function setupKeyboardNavigation() {
        document.addEventListener('keydown', function(e) {
            // ESC key closes sidebar
            if (e.key === 'Escape' || e.keyCode === 27) {
                const sidebar = document.getElementById('sidebar') || document.querySelector('.sidebar');
                if (sidebar && sidebar.classList.contains('show')) {
                    closeSidebar(sidebar);
                    
                    // Return focus to toggle button
                    const toggleButton = document.querySelector('#sidebarToggle, .mobile-menu-toggle');
                    if (toggleButton) {
                        toggleButton.focus();
                    }
                }
            }
        });
    }

    /**
     * Handle window resize
     */
    function handleResize() {
        let resizeTimer;
        window.addEventListener('resize', function() {
            clearTimeout(resizeTimer);
            resizeTimer = setTimeout(function() {
                const sidebar = document.getElementById('sidebar') || document.querySelector('.sidebar');
                
                // Close sidebar on desktop if open
                if (window.innerWidth > 991 && sidebar && sidebar.classList.contains('show')) {
                    closeSidebar(sidebar);
                }
                
                // Ensure body scroll is restored on resize
                if (window.innerWidth > 991) {
                    document.body.style.overflow = '';
                    document.body.style.position = '';
                    document.body.style.width = '';
                }
            }, 250);
        });
    }

    /**
     * Prevent body scroll when sidebar is open
     */
    function preventBodyScroll() {
        // Listen for sidebar open/close events
        window.addEventListener('sidebar:opened', function() {
            // Already handled in openSidebar, but ensure it's set
            document.body.style.overflow = 'hidden';
            document.body.style.position = 'fixed';
            document.body.style.width = '100%';
        });

        window.addEventListener('sidebar:closed', function() {
            // Already handled in closeSidebar, but ensure it's cleared
            document.body.style.overflow = '';
            document.body.style.position = '';
            document.body.style.width = '';
        });
    }

    /**
     * Public API for programmatic control
     */
    window.MobileNavigation = {
        open: function() {
            const sidebar = document.getElementById('sidebar') || document.querySelector('.sidebar');
            if (sidebar) openSidebar(sidebar);
        },
        close: function() {
            const sidebar = document.getElementById('sidebar') || document.querySelector('.sidebar');
            if (sidebar) closeSidebar(sidebar);
        },
        toggle: function() {
            const sidebar = document.getElementById('sidebar') || document.querySelector('.sidebar');
            if (sidebar) toggleSidebar(sidebar);
        },
        isOpen: function() {
            const sidebar = document.getElementById('sidebar') || document.querySelector('.sidebar');
            return sidebar ? sidebar.classList.contains('show') : false;
        }
    };

    // Auto-close on page navigation (for SPA-like behavior)
    window.addEventListener('beforeunload', function() {
        const sidebar = document.getElementById('sidebar') || document.querySelector('.sidebar');
        if (sidebar) {
            closeSidebar(sidebar);
        }
    });

    // Handle page visibility changes
    document.addEventListener('visibilitychange', function() {
        if (document.hidden) {
            const sidebar = document.getElementById('sidebar') || document.querySelector('.sidebar');
            if (sidebar && sidebar.classList.contains('show')) {
                closeSidebar(sidebar);
            }
        }
    });

})();

