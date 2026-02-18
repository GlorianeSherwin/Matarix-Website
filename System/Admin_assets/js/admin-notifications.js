/**
 * Admin Notification System
 * Toast-style notifications for API responses
 */

(function() {
    'use strict';
    
    // Create notification container if it doesn't exist
    function ensureContainer() {
        let container = document.getElementById('admin-notification-container');
        if (!container) {
            container = document.createElement('div');
            container.id = 'admin-notification-container';
            document.body.appendChild(container);
        }
        return container;
    }
    
    /**
     * Show a notification
     * @param {string} message - The notification message
     * @param {string} type - Type: 'success', 'error', 'warning', 'info'
     * @param {object} options - Additional options
     * @param {number} options.duration - Auto-close duration in ms (0 = no auto-close)
     * @param {string} options.title - Notification title
     * @param {object} options.details - Additional details to display (e.g., API response)
     * @param {boolean} options.showProgress - Show progress bar
     */
    function showNotification(message, type = 'info', options = {}) {
        const container = ensureContainer();
        const {
            duration = 5000,
            title = null,
            details = null,
            showProgress = true
        } = options;
        
        // Create notification element
        const notification = document.createElement('div');
        notification.className = `admin-notification ${type}`;
        
        // Icons for each type
        const icons = {
            success: 'fa-check-circle',
            error: 'fa-exclamation-circle',
            warning: 'fa-exclamation-triangle',
            info: 'fa-info-circle'
        };
        
        // Default titles
        const defaultTitles = {
            success: 'Success',
            error: 'Error',
            warning: 'Warning',
            info: 'Information'
        };
        
        const notificationTitle = title || defaultTitles[type] || 'Notification';
        
        // Build notification HTML - removed details section for cleaner user-facing messages
        notification.innerHTML = `
            <i class="fas ${icons[type]} admin-notification-icon"></i>
            <div class="admin-notification-content">
                <div class="admin-notification-title">${escapeHtml(notificationTitle)}</div>
                <div class="admin-notification-message">${escapeHtml(message)}</div>
            </div>
            <button class="admin-notification-close" aria-label="Close">
                <i class="fas fa-times"></i>
            </button>
            ${showProgress && duration > 0 ? `
                <div class="admin-notification-progress">
                    <div class="admin-notification-progress-bar" style="color: inherit;"></div>
                </div>
            ` : ''}
        `;
        
        // Add to container
        container.appendChild(notification);
        
        // Close button handler
        const closeBtn = notification.querySelector('.admin-notification-close');
        closeBtn.addEventListener('click', () => {
            closeNotification(notification);
        });
        
        // Auto-close if duration is set
        let timeoutId = null;
        if (duration > 0) {
            timeoutId = setTimeout(() => {
                closeNotification(notification);
            }, duration);
        }
        
        // Store timeout ID for potential cancellation
        notification._timeoutId = timeoutId;
        
        // Return notification element for manual control
        return notification;
    }
    
    /**
     * Close a notification
     */
    function closeNotification(notification) {
        if (notification._timeoutId) {
            clearTimeout(notification._timeoutId);
        }
        notification.classList.add('closing');
        setTimeout(() => {
            if (notification.parentNode) {
                notification.parentNode.removeChild(notification);
            }
        }, 300);
    }
    
    /**
     * Escape HTML to prevent XSS
     */
    function escapeHtml(text) {
        const map = {
            '&': '&amp;',
            '<': '&lt;',
            '>': '&gt;',
            '"': '&quot;',
            "'": '&#039;'
        };
        return String(text).replace(/[&<>"']/g, m => map[m]);
    }
    
    /**
     * Show success notification
     */
    function showSuccess(message, options = {}) {
        return showNotification(message, 'success', options);
    }
    
    /**
     * Show error notification
     */
    function showError(message, options = {}) {
        return showNotification(message, 'error', { duration: 7000, ...options });
    }
    
    /**
     * Show warning notification
     */
    function showWarning(message, options = {}) {
        return showNotification(message, 'warning', options);
    }
    
    /**
     * Show info notification
     */
    function showInfo(message, options = {}) {
        return showNotification(message, 'info', options);
    }
    
    /**
     * Show API response notification
     * Automatically determines type based on response.success
     * Only shows user-friendly messages, no technical details
     */
    function showApiResponse(response, options = {}) {
        const {
            success = false,
            message = '',
            error_details = null,
            ...otherData
        } = response;
        
        const type = success ? 'success' : 'error';
        const notificationMessage = message || (success ? 'Operation completed successfully' : 'An error occurred');
        
        // Don't include technical details - only show user-friendly message
        return showNotification(notificationMessage, type, {
            title: success ? 'Success' : 'Error',
            ...options
        });
    }
    
    /**
     * Custom Prompt Dialog
     * Replaces browser prompt() with a styled modal
     */
    function showPrompt(message, defaultValue = '', options = {}) {
        return new Promise((resolve) => {
            const {
                title = 'Input Required',
                placeholder = '',
                confirmText = 'OK',
                cancelText = 'Cancel',
                danger = false
            } = options;
            
            // Create modal overlay
            const overlay = document.createElement('div');
            overlay.className = 'admin-confirm-overlay';
            overlay.style.cssText = `
                position: fixed;
                top: 0;
                left: 0;
                width: 100%;
                height: 100%;
                background: rgba(0, 0, 0, 0.5);
                z-index: 10001;
                display: flex;
                align-items: center;
                justify-content: center;
                animation: fadeIn 0.2s ease-out;
            `;
            
            // Create modal dialog
            const modal = document.createElement('div');
            modal.className = 'admin-confirm-modal';
            modal.style.cssText = `
                background: #2c3e50;
                border-radius: 12px;
                padding: 0;
                max-width: 500px;
                width: 90%;
                box-shadow: 0 10px 40px rgba(0, 0, 0, 0.3);
                animation: slideDown 0.3s ease-out;
                overflow: hidden;
            `;
            
            modal.innerHTML = `
                <div style="padding: 24px 24px 16px;">
                    <div style="display: flex; align-items: center; margin-bottom: 16px;">
                        <i class="fas fa-question-circle" 
                           style="font-size: 28px; color: #17a2b8; margin-right: 12px;"></i>
                        <h3 style="margin: 0; color: #fff; font-size: 20px; font-weight: 600;">${escapeHtml(title)}</h3>
                    </div>
                    <p style="color: #e0e0e0; font-size: 15px; line-height: 1.5; margin: 0 0 16px 0;">${escapeHtml(message)}</p>
                    <input type="text" class="admin-prompt-input" 
                           value="${escapeHtml(defaultValue)}" 
                           placeholder="${escapeHtml(placeholder)}"
                           style="width: 100%; padding: 12px; border: 1px solid #3d566e; border-radius: 6px; background: #34495e; color: #fff; font-size: 14px; outline: none; transition: border-color 0.2s;">
                </div>
                <div style="padding: 16px 24px; background: #34495e; display: flex; justify-content: flex-end; gap: 10px; border-top: 1px solid #3d566e;">
                    <button class="admin-confirm-cancel" 
                            style="padding: 10px 24px; border: none; border-radius: 6px; font-size: 14px; font-weight: 600; cursor: pointer; background: #6c757d; color: white; transition: all 0.2s;">
                        ${escapeHtml(cancelText)}
                    </button>
                    <button class="admin-confirm-ok" 
                            style="padding: 10px 24px; border: none; border-radius: 6px; font-size: 14px; font-weight: 600; cursor: pointer; background: ${danger ? '#dc3545' : '#007bff'}; color: white; transition: all 0.2s;">
                        ${escapeHtml(confirmText)}
                    </button>
                </div>
            `;
            
            overlay.appendChild(modal);
            document.body.appendChild(overlay);
            
            // Get input and buttons
            const input = modal.querySelector('.admin-prompt-input');
            const okBtn = modal.querySelector('.admin-confirm-ok');
            const cancelBtn = modal.querySelector('.admin-confirm-cancel');
            
            // Focus input
            setTimeout(() => input.focus(), 100);
            
            // Select all text if default value provided
            if (defaultValue) {
                input.select();
            }
            
            const close = (result) => {
                overlay.style.animation = 'fadeOut 0.2s ease-out';
                modal.style.animation = 'slideUp 0.2s ease-out';
                setTimeout(() => {
                    if (overlay.parentNode) {
                        overlay.parentNode.removeChild(overlay);
                    }
                }, 200);
                resolve(result);
            };
            
            okBtn.addEventListener('click', () => close(input.value));
            cancelBtn.addEventListener('click', () => close(null));
            
            // Close on overlay click
            overlay.addEventListener('click', (e) => {
                if (e.target === overlay) {
                    close(null);
                }
            });
            
            // Close on Escape key
            const escapeHandler = (e) => {
                if (e.key === 'Escape') {
                    close(null);
                    document.removeEventListener('keydown', escapeHandler);
                }
            };
            document.addEventListener('keydown', escapeHandler);
            
            // Submit on Enter key
            const enterHandler = (e) => {
                if (e.key === 'Enter') {
                    e.preventDefault();
                    close(input.value);
                    document.removeEventListener('keydown', enterHandler);
                }
            };
            input.addEventListener('keydown', enterHandler);
            
            // Input focus styles
            input.addEventListener('focus', () => {
                input.style.borderColor = '#007bff';
            });
            input.addEventListener('blur', () => {
                input.style.borderColor = '#3d566e';
            });
            
            // Hover effects
            okBtn.addEventListener('mouseenter', () => {
                okBtn.style.transform = 'translateY(-1px)';
                okBtn.style.boxShadow = '0 4px 8px rgba(0, 0, 0, 0.2)';
            });
            okBtn.addEventListener('mouseleave', () => {
                okBtn.style.transform = 'translateY(0)';
                okBtn.style.boxShadow = 'none';
            });
            cancelBtn.addEventListener('mouseenter', () => {
                cancelBtn.style.background = '#5a6268';
            });
            cancelBtn.addEventListener('mouseleave', () => {
                cancelBtn.style.background = '#6c757d';
            });
        });
    }
    
    /**
     * Custom Confirmation Dialog
     * Replaces browser confirm() with a styled modal
     */
    function showConfirm(message, options = {}) {
        return new Promise((resolve) => {
            const {
                title = 'Confirm Action',
                confirmText = 'OK',
                cancelText = 'Cancel',
                confirmClass = 'btn-primary',
                cancelClass = 'btn-secondary',
                danger = false
            } = options;
            
            // Create modal overlay
            const overlay = document.createElement('div');
            overlay.className = 'admin-confirm-overlay';
            overlay.style.cssText = `
                position: fixed;
                top: 0;
                left: 0;
                width: 100%;
                height: 100%;
                background: rgba(0, 0, 0, 0.5);
                z-index: 10001;
                display: flex;
                align-items: center;
                justify-content: center;
                animation: fadeIn 0.2s ease-out;
            `;
            
            // Create modal dialog
            const modal = document.createElement('div');
            modal.className = 'admin-confirm-modal';
            modal.style.cssText = `
                background: #2c3e50;
                border-radius: 12px;
                padding: 0;
                max-width: 450px;
                width: 90%;
                box-shadow: 0 10px 40px rgba(0, 0, 0, 0.3);
                animation: slideDown 0.3s ease-out;
                overflow: hidden;
            `;
            
            modal.innerHTML = `
                <div style="padding: 24px 24px 16px;">
                    <div style="display: flex; align-items: center; margin-bottom: 16px;">
                        <i class="fas ${danger ? 'fa-exclamation-triangle' : 'fa-question-circle'}" 
                           style="font-size: 28px; color: ${danger ? '#dc3545' : '#17a2b8'}; margin-right: 12px;"></i>
                        <h3 style="margin: 0; color: #fff; font-size: 20px; font-weight: 600;">${escapeHtml(title)}</h3>
                    </div>
                    <p style="color: #e0e0e0; font-size: 15px; line-height: 1.5; margin: 0;">${escapeHtml(message)}</p>
                </div>
                <div style="padding: 16px 24px; background: #34495e; display: flex; justify-content: flex-end; gap: 10px; border-top: 1px solid #3d566e;">
                    <button class="admin-confirm-cancel" 
                            style="padding: 10px 24px; border: none; border-radius: 6px; font-size: 14px; font-weight: 600; cursor: pointer; background: #6c757d; color: white; transition: all 0.2s;">
                        ${escapeHtml(cancelText)}
                    </button>
                    <button class="admin-confirm-ok" 
                            style="padding: 10px 24px; border: none; border-radius: 6px; font-size: 14px; font-weight: 600; cursor: pointer; background: ${danger ? '#dc3545' : '#007bff'}; color: white; transition: all 0.2s;">
                        ${escapeHtml(confirmText)}
                    </button>
                </div>
            `;
            
            overlay.appendChild(modal);
            document.body.appendChild(overlay);
            
            // Button handlers
            const okBtn = modal.querySelector('.admin-confirm-ok');
            const cancelBtn = modal.querySelector('.admin-confirm-cancel');
            
            const close = (result) => {
                overlay.style.animation = 'fadeOut 0.2s ease-out';
                modal.style.animation = 'slideUp 0.2s ease-out';
                setTimeout(() => {
                    if (overlay.parentNode) {
                        overlay.parentNode.removeChild(overlay);
                    }
                }, 200);
                resolve(result);
            };
            
            okBtn.addEventListener('click', () => close(true));
            cancelBtn.addEventListener('click', () => close(false));
            
            // Close on overlay click
            overlay.addEventListener('click', (e) => {
                if (e.target === overlay) {
                    close(false);
                }
            });
            
            // Close on Escape key
            const escapeHandler = (e) => {
                if (e.key === 'Escape') {
                    close(false);
                    document.removeEventListener('keydown', escapeHandler);
                }
            };
            document.addEventListener('keydown', escapeHandler);
            
            // Hover effects
            okBtn.addEventListener('mouseenter', () => {
                okBtn.style.transform = 'translateY(-1px)';
                okBtn.style.boxShadow = '0 4px 8px rgba(0, 0, 0, 0.2)';
            });
            okBtn.addEventListener('mouseleave', () => {
                okBtn.style.transform = 'translateY(0)';
                okBtn.style.boxShadow = 'none';
            });
            cancelBtn.addEventListener('mouseenter', () => {
                cancelBtn.style.background = '#5a6268';
            });
            cancelBtn.addEventListener('mouseleave', () => {
                cancelBtn.style.background = '#6c757d';
            });
        });
    }
    
    // Export to global scope
    window.AdminNotifications = {
        show: showNotification,
        showNotification: showNotification,
        success: showSuccess,
        error: showError,
        warning: showWarning,
        info: showInfo,
        apiResponse: showApiResponse,
        confirm: showConfirm,
        prompt: showPrompt
    };
    
    // Replace browser prompt with custom UI
    window.prompt = function(message, defaultValue = '') {
        return showPrompt(message, defaultValue, {
            title: 'Input Required',
            placeholder: ''
        });
    };
    
    // Also create aliases for backward compatibility
    window.showSuccess = showSuccess;
    window.showError = showError;
    window.showWarning = showWarning;
    window.showInfo = showInfo;
    
    // Replace browser confirm with custom UI
    window.confirm = function(message) {
        return showConfirm(message, {
            title: 'Confirm Action',
            danger: false
        });
    };
    
    // Replace browser alert() globally to use custom notifications
    const originalAlert = window.alert;
    window.alert = function(message) {
        if (typeof window.AdminNotifications !== 'undefined') {
            // Determine type based on message content
            let type = 'info';
            const msg = String(message).toLowerCase();
            if (msg.includes('error') || msg.includes('failed') || msg.includes('invalid') || msg.includes('missing')) {
                type = 'error';
            } else if (msg.includes('success') || msg.includes('confirmed') || msg.includes('received') || msg.includes('successfully') || msg.includes('added') || msg.includes('updated') || msg.includes('removed') || msg.includes('assigned')) {
                type = 'success';
            } else if (msg.includes('warning') || msg.includes('please') || msg.includes('select') || msg.includes('cannot') || msg.includes('denied')) {
                type = 'warning';
            }
            window.AdminNotifications.showNotification(message, type, { duration: 5000 });
        } else {
            // Fallback to console if notifications not available
            console.log('[Alert]:', message);
        }
    };
    
})();

