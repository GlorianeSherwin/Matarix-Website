/**
 * Admin Mobile Menu Toggle
 * Handles hamburger menu and sidebar toggle for mobile devices
 */

(function() {
    'use strict';
    
    // Wait for DOM to be ready
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', initMobileMenu);
    } else {
        initMobileMenu();
    }
    
    function initMobileMenu() {
        // Create hamburger button if it doesn't exist
        if (!document.querySelector('.mobile-menu-toggle')) {
            const hamburgerBtn = document.createElement('button');
            hamburgerBtn.className = 'mobile-menu-toggle';
            hamburgerBtn.innerHTML = '<i class="fas fa-bars"></i>';
            hamburgerBtn.setAttribute('aria-label', 'Toggle menu');
            document.body.appendChild(hamburgerBtn);
        }
        
        // Create sidebar overlay if it doesn't exist
        if (!document.querySelector('.sidebar-overlay')) {
            const overlay = document.createElement('div');
            overlay.className = 'sidebar-overlay';
            document.body.appendChild(overlay);
        }
        
        // Get elements
        const hamburgerBtn = document.querySelector('.mobile-menu-toggle');
        const sidebar = document.querySelector('.sidebar-container');
        const overlay = document.querySelector('.sidebar-overlay');
        
        if (!hamburgerBtn || !sidebar) {
            return; // Elements not found, exit
        }
        
        // Toggle sidebar function
        function toggleSidebar() {
            sidebar.classList.toggle('show');
            overlay.classList.toggle('show');
            
            // Prevent body scroll when sidebar is open
            if (sidebar.classList.contains('show')) {
                document.body.style.overflow = 'hidden';
            } else {
                document.body.style.overflow = '';
            }
        }
        
        // Hamburger button click
        hamburgerBtn.addEventListener('click', function(e) {
            e.stopPropagation();
            toggleSidebar();
        });
        
        // Overlay click - close sidebar
        overlay.addEventListener('click', function() {
            sidebar.classList.remove('show');
            overlay.classList.remove('show');
            document.body.style.overflow = '';
        });
        
        // Close sidebar when clicking a nav link (on mobile)
        const navLinks = document.querySelectorAll('.nav-link');
        navLinks.forEach(function(link) {
            link.addEventListener('click', function() {
                if (window.innerWidth <= 991) {
                    sidebar.classList.remove('show');
                    overlay.classList.remove('show');
                    document.body.style.overflow = '';
                }
            });
        });
        
        // Close sidebar on window resize (if resizing to desktop)
        window.addEventListener('resize', function() {
            if (window.innerWidth > 991) {
                sidebar.classList.remove('show');
                overlay.classList.remove('show');
                document.body.style.overflow = '';
            }
        });
        
        // Close sidebar on ESC key
        document.addEventListener('keydown', function(e) {
            if (e.key === 'Escape' && sidebar.classList.contains('show')) {
                sidebar.classList.remove('show');
                overlay.classList.remove('show');
                document.body.style.overflow = '';
            }
        });
    }
})();

