/**
 * Global Sidebar Toggle Function
 * Works as a fallback for all customer pages
 */

function toggleSidebarMenu(event) {
    if (event) {
        event.preventDefault();
        event.stopPropagation();
        event.stopImmediatePropagation();
    }
    
    const sidebar = document.getElementById('sidebar') || document.querySelector('.sidebar');
    const overlay = document.getElementById('sidebarOverlay') || document.querySelector('.sidebar-overlay');
    
    if (!sidebar) {
        console.warn('Sidebar not found');
        return false;
    }
    
    const isOpen = sidebar.classList.contains('show');
    
    if (isOpen) {
        // Close sidebar
        sidebar.classList.remove('show');
        if (overlay) {
            overlay.classList.remove('show');
        }
        document.body.style.overflow = '';
        document.body.style.position = '';
        document.body.style.width = '';
    } else {
        // Open sidebar
        sidebar.classList.add('show');
        if (overlay) {
            overlay.classList.add('show');
        }
        document.body.style.overflow = 'hidden';
        document.body.style.position = 'fixed';
        document.body.style.width = '100%';
    }
    
    return false;
}

// Also attach event listeners when DOM is ready
(function() {
    function attachListeners() {
        const toggleButton = document.getElementById('sidebarToggle');
        const sidebar = document.getElementById('sidebar') || document.querySelector('.sidebar');
        
        if (toggleButton && sidebar && !toggleButton.hasAttribute('data-global-listener')) {
            toggleButton.setAttribute('data-global-listener', 'true');
            
            // Remove existing onclick if present and use event listener instead
            toggleButton.onclick = null;
            
            toggleButton.addEventListener('click', function(e) {
                e.preventDefault();
                e.stopPropagation();
                toggleSidebarMenu(e);
            }, true);
            
            toggleButton.addEventListener('touchend', function(e) {
                e.preventDefault();
                e.stopPropagation();
                toggleSidebarMenu(e);
            }, true);
        }
        
        // Handle overlay click
        const overlay = document.getElementById('sidebarOverlay') || document.querySelector('.sidebar-overlay');
        if (overlay && !overlay.hasAttribute('data-global-listener')) {
            overlay.setAttribute('data-global-listener', 'true');
            overlay.addEventListener('click', function(e) {
                e.preventDefault();
                e.stopPropagation();
                toggleSidebarMenu();
            });
        }
        
        // Ensure sidebar links work properly
        const sidebarLinks = sidebar.querySelectorAll('a.sidebar-item, .sidebar-content a, .sidebar-menu a');
        sidebarLinks.forEach(link => {
            if (!link.hasAttribute('data-global-handled')) {
                link.setAttribute('data-global-handled', 'true');
                // Only close sidebar on mobile, don't prevent navigation
                link.addEventListener('click', function(e) {
                    // Don't prevent default for Orders/Deliveries links
                    const href = link.getAttribute('href');
                    const isOrdersOrDeliveries = href && (href.includes('OrderSummary') || href.includes('delivery-tracking'));
                    
                    if (isOrdersOrDeliveries && window.innerWidth <= 991) {
                        // Close sidebar but allow navigation
                        setTimeout(() => {
                            toggleSidebarMenu();
                        }, 100);
                    }
                });
            }
        });
    }
    
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', attachListeners);
    } else {
        attachListeners();
    }
    
    // Also try after delays to catch dynamically loaded content
    setTimeout(attachListeners, 100);
    setTimeout(attachListeners, 500);
    setTimeout(attachListeners, 1000);
})();

