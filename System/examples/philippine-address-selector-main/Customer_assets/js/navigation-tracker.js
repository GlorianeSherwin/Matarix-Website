/**
 * Navigation Tracker
 * Tracks user's origin page (Landing Page vs Main Page) for context-aware navigation
 */

class NavigationTracker {
    constructor() {
        this.ORIGIN_KEY = 'navigationOrigin';
        this.ORIGIN_LANDING = 'landing';
        this.ORIGIN_MAIN = 'main';
        // Don't auto-init - let pages control when to set origin
        // this.init();
    }

    init() {
        // Auto-detect and set origin on Landing Page and Main Page
        this.autoDetectOrigin();
    }

    /**
     * Auto-detect origin based on current page
     */
    autoDetectOrigin() {
        const currentPage = window.location.pathname;
        
        if (currentPage.includes('LandingPage.html') || currentPage.includes('landing.html') || currentPage.includes('index.html') || currentPage === '/' || currentPage.endsWith('/')) {
            this.setOrigin(this.ORIGIN_LANDING);
        } else if (currentPage.includes('MainPage.html')) {
            // Only set Main Page origin if user is authenticated
            this.checkAuthAndSetOrigin();
        }
    }

    /**
     * Check if user is authenticated and set origin accordingly
     */
    async checkAuthAndSetOrigin() {
        try {
            // Check if user_id exists in sessionStorage (indicates logged in)
            const userId = sessionStorage.getItem('user_id');
            if (userId) {
                this.setOrigin(this.ORIGIN_MAIN);
            }
        } catch (error) {
            console.error('Error checking auth for navigation origin:', error);
        }
    }

    /**
     * Set navigation origin
     * @param {string} origin - 'landing' or 'main'
     */
    setOrigin(origin) {
        if (origin === this.ORIGIN_LANDING || origin === this.ORIGIN_MAIN) {
            sessionStorage.setItem(this.ORIGIN_KEY, origin);
            console.log('[NavigationTracker] Origin set to:', origin);
        }
    }

    /**
     * Get navigation origin
     * @returns {string} - 'landing', 'main', or null
     */
    getOrigin() {
        return sessionStorage.getItem(this.ORIGIN_KEY);
    }

    /**
     * Get the appropriate home page URL based on origin
     * @returns {string} - URL to redirect to
     */
    getHomeUrl() {
        const origin = this.getOrigin();
        if (origin === this.ORIGIN_LANDING) {
            // Check if we're in Customer folder or root
            const currentPath = window.location.pathname;
            if (currentPath.includes('/Customer/')) {
                return '../index.html';
            }
            return 'index.html';
        } else if (origin === this.ORIGIN_MAIN) {
            return 'MainPage.html';
        }
        // Default: check if user is logged in
        const userId = sessionStorage.getItem('user_id');
        if (userId) {
            return 'MainPage.html';
        }
        // Check if we're in Customer folder or root
        const currentPath = window.location.pathname;
        if (currentPath.includes('/Customer/')) {
            return '../index.html';
        }
        return 'index.html';
    }

    /**
     * Get the appropriate Materials page URL based on origin
     * @returns {string} - URL to redirect to
     */
    getMaterialsUrl() {
        const origin = this.getOrigin();
        const userId = sessionStorage.getItem('user_id');
        
        if (origin === this.ORIGIN_LANDING) {
            // Check if we're in Customer folder or root
            const currentPath = window.location.pathname;
            if (currentPath.includes('/Customer/')) {
                return '../index.html#products';
            }
            return 'index.html#products';
        } else if (origin === this.ORIGIN_MAIN) {
            return 'MainPage.html#products';
        }
        // Default: return MainPage without user_id
        return 'MainPage.html#products';
        // Check if we're in Customer folder or root
        const currentPath = window.location.pathname;
        if (currentPath.includes('/Customer/')) {
            return '../index.html#products';
        }
        return 'index.html#products';
    }

    /**
     * Navigate to home page based on origin
     */
    goHome() {
        const url = this.getHomeUrl();
        window.location.href = url;
    }

    /**
     * Navigate to materials page based on origin
     */
    goToMaterials() {
        const url = this.getMaterialsUrl();
        // Use UrlAuthHelper if available to ensure user_id is preserved
        if (window.UrlAuthHelper && window.UrlAuthHelper.isLoggedIn()) {
            const urlWithUserId = window.UrlAuthHelper.addUserIdToUrl(url);
            window.location.href = urlWithUserId;
        } else {
            window.location.href = url;
        }
    }

    /**
     * Clear navigation origin (useful after logout)
     */
    clearOrigin() {
        sessionStorage.removeItem(this.ORIGIN_KEY);
    }

    /**
     * Update all navigation links on the page to use origin-aware URLs
     */
    updateNavigationLinks() {
        // Update Materials links
        const materialsLinks = document.querySelectorAll('a[href*="MainPage"], a[href*="LandingPage"], .sidebar-item, #materialsLink, a:contains("Materials")');
        materialsLinks.forEach(link => {
            const href = link.getAttribute('href');
            if (href && (href.includes('MainPage') || href.includes('Materials') || link.textContent.includes('Materials'))) {
                link.addEventListener('click', (e) => {
                    e.preventDefault();
                    this.goToMaterials();
                });
            }
        });

        // Update Home/Back buttons
        const homeButtons = document.querySelectorAll('.back-btn, .home-btn, [onclick*="goHome"], button:contains("Back"), button:contains("Home")');
        homeButtons.forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.preventDefault();
                this.goHome();
            });
        });
    }
}

// Create global instance
window.NavigationTracker = new NavigationTracker();

// Convenience functions
window.setNavigationOrigin = (origin) => window.NavigationTracker.setOrigin(origin);
window.getNavigationOrigin = () => window.NavigationTracker.getOrigin();
window.goHome = () => window.NavigationTracker.goHome();
window.goToMaterials = () => window.NavigationTracker.goToMaterials();

