/**
 * Custom Notification System
 * Replaces all browser alerts, confirms, and prompts with styled modals and toasts
 */

class NotificationSystem {
    constructor() {
        this.toastContainer = null;
        this.modalOverlay = null;
        this.init();
    }

    init() {
        // Create toast container
        this.createToastContainer();
        // Create modal overlay
        this.createModalOverlay();
    }

    /**
     * Create toast notification container
     */
    createToastContainer() {
        if (document.getElementById('toast-container')) return;
        
        const container = document.createElement('div');
        container.id = 'toast-container';
        container.className = 'toast-container';
        document.body.appendChild(container);
        this.toastContainer = container;
    }

    /**
     * Create modal overlay
     */
    createModalOverlay() {
        if (document.getElementById('modal-overlay')) return;
        
        const overlay = document.createElement('div');
        overlay.id = 'modal-overlay';
        overlay.className = 'modal-overlay';
        // Ensure proper positioning with inline styles - START HIDDEN
        overlay.style.cssText = `
            position: fixed !important;
            top: 0 !important;
            left: 0 !important;
            width: 100% !important;
            height: 100% !important;
            background: rgba(0, 0, 0, 0.5) !important;
            z-index: 99999 !important;
            display: flex !important;
            align-items: center !important;
            justify-content: center !important;
            margin: 0 !important;
            padding: 0 !important;
            opacity: 0 !important;
            visibility: hidden !important;
            pointer-events: none !important;
        `;
        document.body.appendChild(overlay);
        // DO NOT set body overflow here - only set it when showing the modal
        this.modalOverlay = overlay;
    }

    /**
     * Show toast notification
     * @param {string} message - Message to display
     * @param {string} type - Type: 'success', 'error', 'warning', 'info'
     * @param {number} duration - Duration in milliseconds (default: 5000)
     */
    showToast(message, type = 'info', duration = 5000) {
        if (!this.toastContainer) this.createToastContainer();

        const toast = document.createElement('div');
        toast.className = `toast toast-${type}`;
        
        const icons = {
            success: 'fa-check-circle',
            error: 'fa-times-circle',
            warning: 'fa-exclamation-triangle',
            info: 'fa-info-circle'
        };

        const progressBar = duration > 0 ? `
            <div class="toast-progress">
                <div class="toast-progress-bar" style="animation-duration: ${duration}ms;"></div>
            </div>
        ` : '';

        toast.innerHTML = `
            <div class="toast-content">
                <i class="fas ${icons[type] || icons.info} toast-icon"></i>
                <span class="toast-message">${message}</span>
                <button class="toast-close" aria-label="Close">
                    <i class="fas fa-times"></i>
                </button>
            </div>
            ${progressBar}
        `;

        this.toastContainer.appendChild(toast);

        // Trigger animation
        setTimeout(() => toast.classList.add('show'), 10);

        // Auto-dismiss
        if (duration > 0) {
            const autoDismiss = setTimeout(() => {
                this.dismissToast(toast);
            }, duration);

            // Cancel auto-dismiss on hover
            toast.addEventListener('mouseenter', () => clearTimeout(autoDismiss));
        }

        // Manual dismiss
        toast.querySelector('.toast-close').addEventListener('click', () => {
            this.dismissToast(toast);
        });

        return toast;
    }

    /**
     * Dismiss toast
     */
    dismissToast(toast) {
        toast.classList.remove('show');
        toast.classList.add('hide');
        setTimeout(() => {
            if (toast.parentNode) {
                toast.parentNode.removeChild(toast);
            }
        }, 300);
    }

    /**
     * Show confirmation modal
     * @param {object} options - Modal options
     * @returns {Promise<boolean>} - Resolves to true if confirmed, false if cancelled
     */
    showConfirmModal(options = {}) {
        return new Promise((resolve) => {
            const {
                title = 'Confirm Action',
                message = 'Are you sure you want to proceed?',
                icon = 'info', // 'info', 'warning', 'danger', 'success'
                confirmText = 'Confirm',
                cancelText = 'Cancel',
                confirmClass = 'btn-primary',
                onConfirm = null,
                onCancel = null,
                showLoading = false
            } = options;

            if (!this.modalOverlay) this.createModalOverlay();

            const modal = document.createElement('div');
            modal.className = 'custom-modal';
            modal.setAttribute('role', 'dialog');
            modal.setAttribute('aria-modal', 'true');
            modal.setAttribute('aria-labelledby', 'modal-title');

            const iconClasses = {
                info: 'fa-info-circle text-info',
                warning: 'fa-exclamation-triangle text-warning',
                danger: 'fa-exclamation-circle text-danger',
                success: 'fa-check-circle text-success'
            };

            const iconClass = iconClasses[icon] || iconClasses.info;

            modal.innerHTML = `
                <div class="modal-content">
                    <div class="modal-header">
                        <div class="modal-icon">
                            <i class="fas ${iconClass.split(' ')[0]} ${iconClass}"></i>
                        </div>
                        <h3 class="modal-title" id="modal-title">${title}</h3>
                        <button class="modal-close" aria-label="Close">
                            <i class="fas fa-times"></i>
                        </button>
                    </div>
                    <div class="modal-body">
                        <div class="modal-message">${message}</div>
                    </div>
                    <div class="modal-footer">
                        <button class="btn btn-secondary modal-cancel">${cancelText}</button>
                        <button class="btn ${confirmClass} modal-confirm">
                            <span class="confirm-text">${confirmText}</span>
                            <span class="confirm-loading" style="display: none;">
                                <i class="fas fa-spinner fa-spin"></i> Processing...
                            </span>
                        </button>
                    </div>
                </div>
            `;

            this.modalOverlay.innerHTML = '';
            this.modalOverlay.appendChild(modal);
            
            // Ensure overlay is visible and properly positioned
            this.modalOverlay.style.cssText = `
                position: fixed !important;
                top: 0 !important;
                left: 0 !important;
                width: 100% !important;
                height: 100% !important;
                background: rgba(0, 0, 0, 0.5) !important;
                z-index: 99999 !important;
                display: flex !important;
                align-items: center !important;
                justify-content: center !important;
                margin: 0 !important;
                padding: 0 !important;
                opacity: 0;
                visibility: hidden;
                pointer-events: none;
                transition: opacity 0.3s ease-out, visibility 0.3s ease-out;
            `;
            
            // Prevent body scroll
            document.body.style.overflow = 'hidden';
            
            // Force a reflow to ensure styles are applied
            void this.modalOverlay.offsetHeight;
            
            // Add show class and update styles
            this.modalOverlay.classList.add('show');
            this.modalOverlay.style.opacity = '1';
            this.modalOverlay.style.visibility = 'visible';
            this.modalOverlay.style.pointerEvents = 'auto';
            
            console.log('[Notifications] Confirmation modal shown:', {
                overlay: this.modalOverlay,
                hasShowClass: this.modalOverlay.classList.contains('show'),
                computedDisplay: window.getComputedStyle(this.modalOverlay).display,
                computedPosition: window.getComputedStyle(this.modalOverlay).position
            });

            // Focus trap
            const focusableElements = modal.querySelectorAll('button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])');
            const firstElement = focusableElements[0];
            const lastElement = focusableElements[focusableElements.length - 1];

            // Focus first element
            setTimeout(() => firstElement.focus(), 100);

            // Handle ESC key
            const handleEsc = (e) => {
                if (e.key === 'Escape') {
                    this.closeModal();
                    if (onCancel) onCancel();
                    resolve(false);
                }
            };

            // Handle Tab key for focus trap
            const handleTab = (e) => {
                if (e.key !== 'Tab') return;
                
                if (e.shiftKey) {
                    if (document.activeElement === firstElement) {
                        e.preventDefault();
                        lastElement.focus();
                    }
                } else {
                    if (document.activeElement === lastElement) {
                        e.preventDefault();
                        firstElement.focus();
                    }
                }
            };

            document.addEventListener('keydown', handleEsc);
            document.addEventListener('keydown', handleTab);

            // Close handlers
            const closeModal = () => {
                document.removeEventListener('keydown', handleEsc);
                document.removeEventListener('keydown', handleTab);
                this.closeModal();
            };

            // Cancel button
            modal.querySelector('.modal-cancel').addEventListener('click', () => {
                closeModal();
                if (onCancel) onCancel();
                resolve(false);
            });

            // Close button
            modal.querySelector('.modal-close').addEventListener('click', () => {
                closeModal();
                if (onCancel) onCancel();
                resolve(false);
            });

            // Overlay click (close on outside click)
            this.modalOverlay.addEventListener('click', (e) => {
                if (e.target === this.modalOverlay) {
                    closeModal();
                    if (onCancel) onCancel();
                    resolve(false);
                }
            });

            // Confirm button
            const confirmBtn = modal.querySelector('.modal-confirm');
            confirmBtn.addEventListener('click', async () => {
                if (showLoading) {
                    confirmBtn.disabled = true;
                    confirmBtn.querySelector('.confirm-text').style.display = 'none';
                    confirmBtn.querySelector('.confirm-loading').style.display = 'inline-block';
                }

                try {
                    if (onConfirm) {
                        await onConfirm();
                    }
                    // Close modal before resolving to ensure it's cleaned up
                    closeModal();
                    // Small delay to ensure modal closes before resolving
                    setTimeout(() => {
                        resolve(true);
                    }, 100);
                } catch (error) {
                    console.error('Confirm action error:', error);
                    confirmBtn.disabled = false;
                    confirmBtn.querySelector('.confirm-text').style.display = 'inline';
                    confirmBtn.querySelector('.confirm-loading').style.display = 'none';
                    // Don't close modal on error, let user try again
                }
            });
        });
    }

    /**
     * Show success modal with details
     */
    showSuccessModal(options = {}) {
        const {
            title = 'Success!',
            message = 'Operation completed successfully.',
            details = null,
            buttonText = 'OK',
            buttonClass = 'btn-success',
            onClose = null,
            autoClose = false,
            autoCloseDelay = 0
        } = options;

        return new Promise((resolve) => {
            if (!this.modalOverlay) this.createModalOverlay();

            const modal = document.createElement('div');
            modal.className = 'custom-modal';
            modal.setAttribute('role', 'dialog');
            modal.setAttribute('aria-modal', 'true');
            modal.setAttribute('aria-labelledby', 'modal-title');

            modal.innerHTML = `
                <div class="modal-content">
                    <div class="modal-header">
                        <div class="modal-icon">
                            <i class="fas fa-check-circle text-success"></i>
                        </div>
                        <h3 class="modal-title" id="modal-title">${title}</h3>
                        <button class="modal-close" aria-label="Close">
                            <i class="fas fa-times"></i>
                        </button>
                    </div>
                    <div class="modal-body">
                        <p class="modal-message">${message}</p>
                        ${details ? `<div class="mt-3 p-3 bg-light rounded">${details}</div>` : ''}
                    </div>
                    <div class="modal-footer">
                        <button class="btn ${buttonClass} modal-confirm">
                            <span class="confirm-text">${buttonText}</span>
                        </button>
                    </div>
                </div>
            `;

            this.modalOverlay.innerHTML = '';
            this.modalOverlay.appendChild(modal);
            
            // Prevent body scroll
            document.body.style.overflow = 'hidden';
            
            // Show the overlay
            this.modalOverlay.classList.add('show');
            this.modalOverlay.style.opacity = '1';
            this.modalOverlay.style.visibility = 'visible';
            this.modalOverlay.style.pointerEvents = 'auto';

            // Focus trap
            const focusableElements = modal.querySelectorAll('button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])');
            const firstElement = focusableElements[0];
            const lastElement = focusableElements[focusableElements.length - 1];

            setTimeout(() => firstElement.focus(), 100);

            // Handle ESC key
            const handleEsc = (e) => {
                if (e.key === 'Escape') {
                    this.closeModal();
                    if (onClose) onClose();
                    resolve();
                }
            };

            // Handle Tab key for focus trap
            const handleTab = (e) => {
                if (e.key !== 'Tab') return;
                
                if (e.shiftKey) {
                    if (document.activeElement === firstElement) {
                        e.preventDefault();
                        lastElement.focus();
                    }
                } else {
                    if (document.activeElement === lastElement) {
                        e.preventDefault();
                        firstElement.focus();
                    }
                }
            };

            document.addEventListener('keydown', handleEsc);
            document.addEventListener('keydown', handleTab);

            // Close handlers
            const closeModal = () => {
                document.removeEventListener('keydown', handleEsc);
                document.removeEventListener('keydown', handleTab);
                // Remove overlay click handler
                if (modal._overlayClickHandler) {
                    this.modalOverlay.removeEventListener('click', modal._overlayClickHandler);
                }
                this.closeModal();
                if (onClose) onClose();
                resolve();
            };

            // Close button
            modal.querySelector('.modal-close').addEventListener('click', closeModal);

            // Overlay click (close on outside click) - DISABLED for success modal
            // User must click the button to close - prevent any accidental closes
            const overlayClickHandler = (e) => {
                // Only allow closing if clicking directly on overlay AND it's not a success modal
                // For success modals, we want to prevent closing on overlay click
                if (e.target === this.modalOverlay) {
                    e.stopPropagation();
                    e.preventDefault();
                }
            };
            this.modalOverlay.addEventListener('click', overlayClickHandler);
            
            // Store handler for cleanup
            modal._overlayClickHandler = overlayClickHandler;

            // Confirm/OK button
            const confirmBtn = modal.querySelector('.modal-confirm');
            confirmBtn.addEventListener('click', closeModal);

            // Auto-close if specified
            if (autoClose && autoCloseDelay > 0) {
                setTimeout(closeModal, autoCloseDelay);
            }
        });
    }

    /**
     * Close modal
     */
    closeModal() {
        console.log('[Notifications] closeModal called');
        if (this.modalOverlay) {
            console.log('[Notifications] Closing modal overlay...');
            this.modalOverlay.classList.remove('show');
            // Immediately update styles to ensure modal closes
            this.modalOverlay.style.opacity = '0';
            this.modalOverlay.style.visibility = 'hidden';
            this.modalOverlay.style.pointerEvents = 'none';
            // Restore body scroll immediately
            document.body.style.overflow = '';
            // Delay clearing the content to allow animation to complete
            setTimeout(() => {
                if (this.modalOverlay) {
                    this.modalOverlay.innerHTML = '';
                    // Ensure overlay is completely hidden but don't remove display (keep it for next use)
                    // Just reset the styles
                    this.modalOverlay.style.cssText = `
                        position: fixed !important;
                        top: 0 !important;
                        left: 0 !important;
                        width: 100% !important;
                        height: 100% !important;
                        background: rgba(0, 0, 0, 0.5) !important;
                        z-index: 99999 !important;
                        display: flex !important;
                        align-items: center !important;
                        justify-content: center !important;
                        margin: 0 !important;
                        padding: 0 !important;
                        opacity: 0 !important;
                        visibility: hidden !important;
                        pointer-events: none !important;
                    `;
                    console.log('[Notifications] Modal closed and cleaned up');
                }
            }, 300);
        } else {
            // If overlay doesn't exist, ensure body scroll is restored anyway
            document.body.style.overflow = '';
            console.log('[Notifications] No modal overlay found, restored body scroll');
        }
    }

    /**
     * Show loading overlay
     */
    showLoading(message = 'Loading...') {
        if (!this.modalOverlay) this.createModalOverlay();

        const loading = document.createElement('div');
        loading.className = 'loading-overlay';
        loading.innerHTML = `
            <div class="loading-spinner">
                <div class="spinner-border text-primary" role="status">
                    <span class="sr-only">Loading...</span>
                </div>
                <p class="mt-3">${message}</p>
            </div>
        `;

        this.modalOverlay.innerHTML = '';
        this.modalOverlay.appendChild(loading);
        
        // Prevent body scroll
        document.body.style.overflow = 'hidden';
        
        // Show the overlay
        this.modalOverlay.classList.add('show');
        this.modalOverlay.style.opacity = '1';
        this.modalOverlay.style.visibility = 'visible';
        this.modalOverlay.style.pointerEvents = 'auto';
    }

    /**
     * Hide loading overlay
     */
    hideLoading() {
        if (this.modalOverlay) {
            // Only close if it's a loading overlay, not a success modal
            const hasLoading = this.modalOverlay.querySelector('.loading-overlay');
            if (hasLoading) {
                this.modalOverlay.classList.remove('show');
                this.modalOverlay.style.opacity = '0';
                this.modalOverlay.style.visibility = 'hidden';
                this.modalOverlay.style.pointerEvents = 'none';
                // Restore body scroll
                document.body.style.overflow = '';
                setTimeout(() => {
                    if (this.modalOverlay && this.modalOverlay.querySelector('.loading-overlay')) {
                        this.modalOverlay.innerHTML = '';
                    }
                }, 200);
            }
        }
    }
}

// Create global instance
window.Notifications = new NotificationSystem();

// Safety check: Ensure modal overlay is hidden on page load
// This fixes cases where the overlay might be stuck from a previous page load
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
        const stuckOverlay = document.getElementById('modal-overlay');
        if (stuckOverlay && !stuckOverlay.classList.contains('show')) {
            // Force hide any stuck overlay
            stuckOverlay.style.opacity = '0';
            stuckOverlay.style.visibility = 'hidden';
            stuckOverlay.style.pointerEvents = 'none';
            document.body.style.overflow = '';
        }
    });
} else {
    // Page already loaded
    const stuckOverlay = document.getElementById('modal-overlay');
    if (stuckOverlay && !stuckOverlay.classList.contains('show')) {
        // Force hide any stuck overlay
        stuckOverlay.style.opacity = '0';
        stuckOverlay.style.visibility = 'hidden';
        stuckOverlay.style.pointerEvents = 'none';
        document.body.style.overflow = '';
    }
}

// Convenience functions
window.showToast = (message, type, duration) => window.Notifications.showToast(message, type, duration);
window.showConfirm = (options) => window.Notifications.showConfirmModal(options);
window.showSuccessModal = (options) => window.Notifications.showSuccessModal(options);
window.showLoading = (message) => window.Notifications.showLoading(message);
window.hideLoading = () => window.Notifications.hideLoading();

// Replace browser alert() globally to use custom notifications
// Store original alert if not already stored
if (!window._originalAlert) {
    window._originalAlert = window.alert;
}

window.alert = function(message) {
    if (typeof window.Notifications !== 'undefined') {
        // Determine type based on message content
        let type = 'info';
        const msg = String(message).toLowerCase();
        if (msg.includes('error') || msg.includes('failed') || msg.includes('invalid') || msg.includes('missing') || msg.includes('expired')) {
            type = 'error';
        } else if (msg.includes('success') || msg.includes('confirmed') || msg.includes('received') || msg.includes('successfully') || msg.includes('payment method confirmed')) {
            type = 'success';
        } else if (msg.includes('warning') || msg.includes('please') || msg.includes('select') || msg.includes('empty')) {
            type = 'warning';
        }
        window.Notifications.showToast(message, type, 5000);
    } else if (window._originalAlert) {
        // Fallback to original alert if Notifications not available
        window._originalAlert.call(window, message);
    } else {
        // Last resort: console log
        console.log('[Alert]:', message);
    }
};

// Note: We don't replace confirm() globally because it's synchronous and returns boolean,
// but our custom modal is async and returns a promise. Individual code should use
// window.showConfirm() or window.Notifications.showConfirmModal() directly for async confirms.

