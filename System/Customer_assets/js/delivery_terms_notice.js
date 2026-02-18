/**
 * MATARIX Delivery Distance & Service Terms Notice
 * Reusable banner + modal gate before checkout.
 *
 * - Persists acknowledgement in localStorage
 * - Blocks checkout flows until acknowledged
 * - Works on Cart.html (proceedToCheckoutWithSelection) and Checkout.html (#proceedToPayment)
 */
(function () {
  'use strict';

  // Acknowledgement should be per-session (and re-required each purchase)
  const ACK_SESSION_KEY = 'matarix_delivery_terms_ack_session_v1';
  const UI_STATE_KEY = 'matarix_delivery_terms_banner_collapsed_v1';

  // Allow overrides via window.DeliveryTermsNoticeConfig
  const DEFAULT_CONFIG = {
    // Sir Arnold's delivery policy
    maxRadiusKm: 5,
    outOfRangeAvailable: false,
    // Minimum order amount required for free delivery (can be provided via props/config)
    // If null, the component will try to read it from get_order_settings.php (min_order_value)
    minOrderAmountPhp: null,
    // No extra fees for peak seasons/holidays or small/large orders under normal conditions
    noExtraFeesNote: 'No additional fees for peak seasons/holidays or small/large orders under normal conditions.',
    // Discounts
    discounts: [
      'Bulk / high-volume order discounts may apply.',
      'Agent / contractor commissions may apply.'
    ],
    // Contact
    contactEmail: 'customerservice@matarik.com',
    contactPhone: '+63 2 8123 4567',
    tosUrl: 'TermsOfService.html',
    // General exclusions/coverage notes
    excludedAreas: [
      'Addresses beyond the 5km standard delivery radius (currently not accommodated)',
      'Areas not accessible to delivery vehicles (tight roads, restricted zones)',
      'Locations requiring special permits or unsafe access'
    ],
    outOfRangeAlternatives: [
      'Pick-up option (if available)',
      'Contact us for inquiries about coverage'
    ]
  };

  function getConfig() {
    const overrides = window.DeliveryTermsNoticeConfig && typeof window.DeliveryTermsNoticeConfig === 'object'
      ? window.DeliveryTermsNoticeConfig
      : {};
    return Object.assign({}, DEFAULT_CONFIG, overrides);
  }

  function isAcknowledged() {
    try {
      const raw = sessionStorage.getItem(ACK_SESSION_KEY);
      if (!raw) return false;
      const data = JSON.parse(raw);
      return !!data && data.ack === true;
    } catch {
      return false;
    }
  }

  function setAcknowledged() {
    try {
      sessionStorage.setItem(ACK_SESSION_KEY, JSON.stringify({ ack: true, at: new Date().toISOString() }));
    } catch {
      // ignore
    }
  }

  // Reset acknowledgement so notice shows again next purchase
  function clearAcknowledged() {
    try {
      sessionStorage.removeItem(ACK_SESSION_KEY);
    } catch {
      // ignore
    }
  }

  function getCollapsed() {
    try {
      return sessionStorage.getItem(UI_STATE_KEY) === 'true';
    } catch {
      return false;
    }
  }

  function setCollapsed(value) {
    try {
      sessionStorage.setItem(UI_STATE_KEY, value ? 'true' : 'false');
    } catch {
      // ignore
    }
  }

  function $(sel) {
    // Lightweight wrapper: prefer jQuery when available, else querySelector
    if (window.jQuery) return window.jQuery(sel);
    return document.querySelector(sel);
  }

  function ensureModal(config) {
    // Remove old modal if it exists to ensure clean rebuild
    const oldModal = document.getElementById('deliveryTermsModal');
    if (oldModal) {
      oldModal.remove();
    }

    const minOrderLine = config.minOrderAmountPhp && Number(config.minOrderAmountPhp) > 0
      ? `Minimum order amount for FREE delivery: <strong>${escapeHtml(formatPhp(config.minOrderAmountPhp))}</strong>.`
      : `Minimum order amount may apply for FREE delivery.`;

    const discounts = (config.discounts || [])
      .map((d) => `<li>${escapeHtml(d)}</li>`)
      .join('');

    const excluded = (config.excludedAreas || [])
      .map((x) => `<li>${escapeHtml(x)}</li>`)
      .join('');

    const alternatives = (config.outOfRangeAlternatives || [])
      .map((x) => `<li>${escapeHtml(x)}</li>`)
      .join('');

    const modalHtml = `
      <div class="modal fade delivery-terms-modal" id="deliveryTermsModal" tabindex="-1" role="dialog" aria-labelledby="deliveryTermsModalLabel" aria-hidden="true">
        <div class="modal-dialog modal-dialog-centered modal-lg" role="document">
          <div class="modal-content">
            <div class="modal-header">
              <h5 class="modal-title" id="deliveryTermsModalLabel">
                <i class="fas fa-info-circle mr-2" aria-hidden="true"></i>
                Delivery Terms &amp; Service Area
              </h5>
              <button type="button" class="close" data-dismiss="modal" aria-label="Close">
                <span aria-hidden="true">&times;</span>
              </button>
            </div>
            <div class="modal-body">
              <div class="delivery-terms-intro mb-3">
                <div class="service-area-badge">
                  Standard service area: <strong>${escapeHtml(String(config.maxRadiusKm))}km radius</strong>
                </div>
                <p class="intro-text mt-2 mb-0">
                  Please review the delivery coverage and service terms before continuing to checkout.
                </p>
              </div>

              <div id="deliveryTermsAccordion" class="delivery-terms-accordion">
                <div class="delivery-term-card">
                  <div class="delivery-term-header" id="dtHeading1">
                    <button class="delivery-term-btn" type="button" data-toggle="collapse" data-target="#dtCollapse1" aria-expanded="false" aria-controls="dtCollapse1">
                      <i class="fas fa-map-marker-alt" style="color: #d32f2f; font-size: 16px; width: 20px; text-align: center; flex-shrink: 0;"></i>
                      <span style="flex: 1; color: #333;">Coverage &amp; Radius</span>
                      <i class="fas fa-chevron-right collapse-icon" style="color: #999; font-size: 12px; flex-shrink: 0;"></i>
                    </button>
                  </div>
                  <div id="dtCollapse1" class="collapse" aria-labelledby="dtHeading1" data-parent="#deliveryTermsAccordion">
                    <div class="delivery-term-content">
                      <p>Standard delivery radius is <strong>${escapeHtml(String(config.maxRadiusKm))}km</strong> maximum.</p>
                      <p class="mb-0">Out-of-range deliveries are currently not accommodated due to workforce limitations.</p>
                    </div>
                  </div>
                </div>

                <div class="delivery-term-card">
                  <div class="delivery-term-header" id="dtHeading2">
                    <button class="delivery-term-btn" type="button" data-toggle="collapse" data-target="#dtCollapse2" aria-expanded="false" aria-controls="dtCollapse2">
                      <i class="fas fa-receipt" style="color: #d32f2f; font-size: 16px; width: 20px; text-align: center; flex-shrink: 0;"></i>
                      <span style="flex: 1; color: #333;">Minimum Order Requirements</span>
                      <i class="fas fa-chevron-right collapse-icon" style="color: #999; font-size: 12px; flex-shrink: 0;"></i>
                    </button>
                  </div>
                  <div id="dtCollapse2" class="collapse" aria-labelledby="dtHeading2" data-parent="#deliveryTermsAccordion">
                    <div class="delivery-term-content">
                      <p>${minOrderLine}</p>
                      <p class="mb-0">Discount eligibility is separate and may apply to bulk/high-volume orders and agent/contractor commissions.</p>
                    </div>
                  </div>
                </div>

                <div class="delivery-term-card">
                  <div class="delivery-term-header" id="dtHeading3">
                    <button class="delivery-term-btn" type="button" data-toggle="collapse" data-target="#dtCollapse3" aria-expanded="false" aria-controls="dtCollapse3">
                      <i class="fas fa-moon" style="color: #d32f2f; font-size: 16px; width: 20px; text-align: center; flex-shrink: 0;"></i>
                      <span style="flex: 1; color: #333;">Special Delivery Arrangements</span>
                      <i class="fas fa-chevron-right collapse-icon" style="color: #999; font-size: 12px; flex-shrink: 0;"></i>
                    </button>
                  </div>
                  <div id="dtCollapse3" class="collapse" aria-labelledby="dtHeading3" data-parent="#deliveryTermsAccordion">
                    <div class="delivery-term-content">
                      <p>${escapeHtml(config.noExtraFeesNote || 'No additional fees for peak seasons/holidays or small/large orders under normal conditions.')}</p>
                      <p>For special delivery arrangements or custom requirements:</p>
                      <ul class="mb-0">
                        <li>Contact us in advance to discuss your needs</li>
                        <li>Special arrangements may require additional time for coordination</li>
                        <li>Additional fees may apply for non-standard delivery requests</li>
                      </ul>
                    </div>
                  </div>
                </div>

                <div class="delivery-term-card">
                  <div class="delivery-term-header" id="dtHeading4">
                    <button class="delivery-term-btn" type="button" data-toggle="collapse" data-target="#dtCollapse4" aria-expanded="false" aria-controls="dtCollapse4">
                      <i class="fas fa-ban" style="color: #d32f2f; font-size: 16px; width: 20px; text-align: center; flex-shrink: 0;"></i>
                      <span style="flex: 1; color: #333;">Out of Range Orders</span>
                      <i class="fas fa-chevron-right collapse-icon" style="color: #999; font-size: 12px; flex-shrink: 0;"></i>
                    </button>
                  </div>
                  <div id="dtCollapse4" class="collapse" aria-labelledby="dtHeading4" data-parent="#deliveryTermsAccordion">
                    <div class="delivery-term-content">
                      <p><strong>Current status:</strong> Not available (beyond ${escapeHtml(String(config.maxRadiusKm))}km).</p>
                      <p>Instead of auto-rejecting, the system will recommend alternatives:</p>
                      <ul class="mb-2">${alternatives}</ul>
                      <p class="mb-0"><strong>Contact:</strong> <a href="mailto:${escapeAttr(config.contactEmail)}">${escapeHtml(config.contactEmail)}</a> / ${escapeHtml(config.contactPhone)}</p>
                    </div>
                  </div>
                </div>

                <div class="delivery-term-card">
                  <div class="delivery-term-header" id="dtHeading6">
                    <button class="delivery-term-btn" type="button" data-toggle="collapse" data-target="#dtCollapse6" aria-expanded="false" aria-controls="dtCollapse6">
                      <i class="fas fa-tags" style="color: #d32f2f; font-size: 16px; width: 20px; text-align: center; flex-shrink: 0;"></i>
                      <span style="flex: 1; color: #333;">Discount Information</span>
                      <i class="fas fa-chevron-right collapse-icon" style="color: #999; font-size: 12px; flex-shrink: 0;"></i>
                    </button>
                  </div>
                  <div id="dtCollapse6" class="collapse" aria-labelledby="dtHeading6" data-parent="#deliveryTermsAccordion">
                    <div class="delivery-term-content">
                      <ul class="mb-0">
                        ${discounts || '<li>No discount information available.</li>'}
                      </ul>
                    </div>
                  </div>
                </div>

                <div class="delivery-term-card">
                  <div class="delivery-term-header" id="dtHeading5">
                    <button class="delivery-term-btn" type="button" data-toggle="collapse" data-target="#dtCollapse5" aria-expanded="false" aria-controls="dtCollapse5">
                      <i class="fas fa-file-contract" style="color: #d32f2f; font-size: 16px; width: 20px; text-align: center; flex-shrink: 0;"></i>
                      <span style="flex: 1; color: #333;">Full Terms &amp; Support</span>
                      <i class="fas fa-chevron-right collapse-icon" style="color: #999; font-size: 12px; flex-shrink: 0;"></i>
                    </button>
                  </div>
                  <div id="dtCollapse5" class="collapse" aria-labelledby="dtHeading5" data-parent="#deliveryTermsAccordion">
                    <div class="delivery-term-content">
                      <p class="mb-2">
                        View full Terms of Service:
                        <a href="${escapeAttr(config.tosUrl)}" class="delivery-terms-link" target="_blank" rel="noopener">Open Terms of Service</a>
                      </p>
                      <p class="mb-1"><strong>Email:</strong> <a href="mailto:${escapeAttr(config.contactEmail)}" class="delivery-terms-link">${escapeHtml(config.contactEmail)}</a></p>
                      <p class="mb-0"><strong>Phone:</strong> ${escapeHtml(config.contactPhone)}</p>
                    </div>
                  </div>
                </div>
              </div>

              <hr class="delivery-terms-divider">
              <div class="delivery-terms-checkbox">
                <input type="checkbox" id="deliveryTermsAcknowledgeCheckbox">
                <label for="deliveryTermsAcknowledgeCheckbox">
                  I understand the delivery terms and service area limitations.
                </label>
              </div>
            </div>
            <div class="modal-footer">
              <button type="button" class="btn btn-secondary" data-dismiss="modal">Review later</button>
              <button type="button" class="btn btn-matarix" id="deliveryTermsAcknowledgeBtn" disabled>
                <i class="fas fa-check-circle mr-2" aria-hidden="true"></i>I Understand
              </button>
            </div>
          </div>
        </div>
      </div>
    `;

    const wrapper = document.createElement('div');
    wrapper.innerHTML = modalHtml.trim();
    document.body.appendChild(wrapper.firstElementChild);

    // Add resize handler to recalculate modal body height
    function recalculateModalBodyHeight() {
      const modal = document.getElementById('deliveryTermsModal');
      if (!modal || !modal.classList.contains('show')) return;
      
      const modalBody = modal.querySelector('.modal-body');
      const modalHeader = modal.querySelector('.modal-header');
      const modalFooter = modal.querySelector('.modal-footer');
      
      if (modalBody && modalHeader && modalFooter) {
        const viewportHeight = window.innerHeight;
        const headerHeight = modalHeader.offsetHeight;
        const footerHeight = modalFooter.offsetHeight;
        const padding = 40;
        const maxBodyHeight = viewportHeight - headerHeight - footerHeight - padding;
        
        modalBody.style.maxHeight = Math.max(300, maxBodyHeight) + 'px';
      }
    }
    
    // Listen for window resize
    window.addEventListener('resize', recalculateModalBodyHeight);
    
    // Also listen for Bootstrap modal events
    const modalElement = document.getElementById('deliveryTermsModal');
    if (modalElement) {
      modalElement.addEventListener('shown.bs.modal', recalculateModalBodyHeight);
    }

    // Enable button when checkbox checked
    const cb = document.getElementById('deliveryTermsAcknowledgeCheckbox');
    const btn = document.getElementById('deliveryTermsAcknowledgeBtn');
    if (cb && btn) {
      cb.addEventListener('change', function () {
        btn.disabled = !cb.checked;
      });
    }

    // Handle collapse icon rotation
    const accordion = document.getElementById('deliveryTermsAccordion');
    if (accordion) {
      // Verify all cards are present
      const cards = accordion.querySelectorAll('.delivery-term-card');
      console.log('[Delivery Terms] Modal created. Cards found:', cards.length);
      
      cards.forEach((card, index) => {
        const btn = card.querySelector('.delivery-term-btn');
        const header = card.querySelector('.delivery-term-header');
        const span = btn ? btn.querySelector('span') : null;
        
        console.log(`[Delivery Terms] Card ${index + 1}:`, {
          hasButton: !!btn,
          hasHeader: !!header,
          hasSpan: !!span,
          buttonHTML: btn ? btn.innerHTML.substring(0, 100) : 'N/A',
          spanText: span ? span.textContent || span.innerText : 'N/A',
          spanHTML: span ? span.innerHTML : 'N/A'
        });
        
        // Force card and header to be visible
        card.style.display = 'block';
        card.style.visibility = 'visible';
        card.style.opacity = '1';
        card.style.minHeight = '50px';
        
        if (header) {
          header.style.display = 'block';
          header.style.visibility = 'visible';
          header.style.width = '100%';
        }
        
        // Ensure button is visible with explicit styles
        if (btn) {
          btn.style.cssText = `
            display: flex !important;
            visibility: visible !important;
            opacity: 1 !important;
            width: 100% !important;
            padding: 14px 16px !important;
            background: transparent !important;
            border: none !important;
            text-align: left !important;
            cursor: pointer !important;
            align-items: center !important;
            gap: 12px !important;
            color: #333 !important;
            font-weight: 700 !important;
            font-size: 14px !important;
            margin: 0 !important;
            box-sizing: border-box !important;
            min-height: 48px !important;
            line-height: 1.5 !important;
          `;
          
          // Ensure all child elements are visible
          const icon = btn.querySelector('i:first-child');
          const span = btn.querySelector('span');
          const chevron = btn.querySelector('.collapse-icon');
          
          if (icon) {
            icon.style.cssText = 'color: #d32f2f !important; font-size: 16px !important; width: 20px !important; min-width: 20px !important; display: inline-block !important; visibility: visible !important; opacity: 1 !important; flex-shrink: 0 !important;';
          }
          if (span) {
            span.style.cssText = 'flex: 1 !important; display: inline-block !important; visibility: visible !important; opacity: 1 !important; color: #333 !important; font-weight: 700 !important; font-size: 14px !important; line-height: 1.5 !important; white-space: normal !important;';
            // Log span content for debugging
            console.log(`[Delivery Terms] Card ${index + 1} span content:`, span.textContent || span.innerText, 'innerHTML:', span.innerHTML);
            
            // If span is empty, try to restore text from button's data attribute or recreate it
            if (!span.textContent || span.textContent.trim() === '') {
              const buttonTexts = [
                'Coverage & Radius',
                'Minimum Order Requirements',
                'Special Delivery Arrangements',
                'Out of Range Orders',
                'Discount Information',
                'Full Terms & Support'
              ];
              if (buttonTexts[index]) {
                span.textContent = buttonTexts[index];
                console.log(`[Delivery Terms] Restored text for Card ${index + 1}:`, buttonTexts[index]);
              }
            }
          }
          if (chevron) {
            chevron.style.cssText = 'color: #999 !important; font-size: 12px !important; display: inline-block !important; visibility: visible !important; opacity: 1 !important; flex-shrink: 0 !important;';
          }
          
          // Log full button HTML for debugging
          console.log(`[Delivery Terms] Card ${index + 1} button HTML:`, btn.innerHTML.substring(0, 100));
          
          // Force button to be visible and ensure text is there
          btn.setAttribute('style', btn.getAttribute('style') + '; min-height: 48px !important;');
          
          // Double-check span has content
          if (span && (!span.textContent || span.textContent.trim() === '')) {
            const buttonTexts = [
              'Coverage & Radius',
              'Minimum Order Requirements',
              'Special Delivery Arrangements',
              'Out of Range Orders',
              'Discount Information',
              'Full Terms & Support'
            ];
            if (buttonTexts[index]) {
              span.textContent = buttonTexts[index];
              span.style.cssText += '; color: #333 !important; font-weight: 700 !important;';
              console.log(`[Delivery Terms] Restored text for Card ${index + 1}:`, buttonTexts[index]);
            }
          }
        }
      });
      
      accordion.addEventListener('show.bs.collapse', function(e) {
        const icon = e.target.previousElementSibling?.querySelector('.collapse-icon');
        if (icon) {
          icon.style.transform = 'rotate(90deg)';
        }
      });
      
      accordion.addEventListener('hide.bs.collapse', function(e) {
        const icon = e.target.previousElementSibling?.querySelector('.collapse-icon');
        if (icon) {
          icon.style.transform = 'rotate(0deg)';
        }
      });
    }
  }

  function ensureBanner(mountEl, config) {
    if (!mountEl) return;
    if (mountEl.querySelector && mountEl.querySelector('.delivery-terms-notice')) return;

    const collapsed = getCollapsed();

    mountEl.innerHTML = `
      <div class="delivery-terms-notice ${collapsed ? 'is-collapsed' : ''}" role="region" aria-label="Delivery Distance & Service Terms notice">
        <div class="delivery-terms-notice__header">
          <div class="delivery-terms-notice__icon" aria-hidden="true">
            <i class="fas fa-exclamation-circle"></i>
          </div>
          <div>
            <h3 class="delivery-terms-notice__title">Delivery Terms &amp; Service Area</h3>
            <p class="delivery-terms-notice__subtitle">Required before checkout. Standard radius: <strong>${escapeHtml(String(config.maxRadiusKm))}km</strong>.</p>
          </div>
          <div class="delivery-terms-notice__actions">
            <button type="button" class="delivery-terms-notice__iconbtn" data-action="toggle" aria-label="${collapsed ? 'Expand notice' : 'Collapse notice'}">
              <i class="fas ${collapsed ? 'fa-chevron-down' : 'fa-chevron-up'}" aria-hidden="true"></i>
            </button>
            <button type="button" class="delivery-terms-notice__iconbtn" data-action="open" aria-label="Open delivery terms details">
              <i class="fas fa-external-link-alt" aria-hidden="true"></i>
            </button>
          </div>
        </div>
        <div class="delivery-terms-notice__body">
          <ul class="delivery-terms-notice__bullets">
            <li><strong>Service area:</strong> within ${escapeHtml(String(config.maxRadiusKm))}km (max)</li>
            <li><strong>Out of range:</strong> currently not available</li>
            <li><strong>Fees:</strong> ${escapeHtml(config.noExtraFeesNote)}</li>
          </ul>
          <div class="delivery-terms-notice__footer">
            <label class="delivery-terms-notice__ack">
              <input type="checkbox" id="deliveryTermsInlineAck">
              <span>I understand the delivery terms</span>
            </label>
            <a class="delivery-terms-notice__link" href="${escapeAttr(config.tosUrl)}" target="_blank" rel="noopener">View full Terms of Service</a>
          </div>
        </div>
      </div>
    `;

    // Hook banner buttons
    const toggleBtn = mountEl.querySelector('[data-action="toggle"]');
    const openBtn = mountEl.querySelector('[data-action="open"]');
    const notice = mountEl.querySelector('.delivery-terms-notice');
    const inlineAck = mountEl.querySelector('#deliveryTermsInlineAck');

    toggleBtn.addEventListener('click', function () {
      const isNowCollapsed = !notice.classList.contains('is-collapsed');
      notice.classList.toggle('is-collapsed', isNowCollapsed);
      setCollapsed(isNowCollapsed);
      toggleBtn.setAttribute('aria-label', isNowCollapsed ? 'Expand notice' : 'Collapse notice');
      const icon = toggleBtn.querySelector('i');
      if (icon) icon.className = 'fas ' + (isNowCollapsed ? 'fa-chevron-down' : 'fa-chevron-up');
    });

    openBtn.addEventListener('click', function () {
      openModal();
    });

    inlineAck.addEventListener('change', function () {
      if (inlineAck.checked) {
        acknowledgeAndClose();
      }
    });
  }

  let pendingContinue = null;

  function openModal() {
    const config = getConfig();
    ensureModal(config);

    // Reset checkbox/button each time
    const cb = document.getElementById('deliveryTermsAcknowledgeCheckbox');
    const btn = document.getElementById('deliveryTermsAcknowledgeBtn');
    if (cb && btn) {
      cb.checked = false;
      btn.disabled = true;
    }

    if (window.jQuery && window.jQuery.fn && window.jQuery.fn.modal) {
      window.jQuery('#deliveryTermsModal').modal('show');
      // Focus checkbox for keyboard users
      setTimeout(() => cb && cb.focus(), 150);
    } else {
      // Minimal fallback: show element
      const el = document.getElementById('deliveryTermsModal');
      if (el) el.style.display = 'block';
    }
  }

  function acknowledgeAndClose() {
    setAcknowledged();

    // Hide banner mounts
    document.querySelectorAll('[data-delivery-terms-notice]').forEach((m) => {
      m.innerHTML = '';
    });

    if (window.jQuery && window.jQuery.fn && window.jQuery.fn.modal) {
      window.jQuery('#deliveryTermsModal').modal('hide');
    } else {
      const el = document.getElementById('deliveryTermsModal');
      if (el) el.style.display = 'none';
    }

    const cont = pendingContinue;
    pendingContinue = null;
    if (typeof cont === 'function') {
      // Run after the modal closes
      setTimeout(() => cont(), 50);
    }
  }

  function wrapCartCheckout() {
    // Disabled - delivery terms requirement removed
    // Checkout is no longer blocked by delivery terms
    return;
  }

  // Ensure notice shows again after a purchase (cart is cleared on successful order)
  function wrapCartManagerClearCart() {
    const cm = window.CartManager;
    if (!cm || typeof cm.clearCart !== 'function') return false;
    if (cm.clearCart.__deliveryTermsWrapped) return true;

    const original = cm.clearCart;
    const wrapped = function (...args) {
      const result = original.apply(this, args);
      // Clear acknowledgement so next checkout requires it again
      clearAcknowledged();
      return result;
    };
    wrapped.__deliveryTermsWrapped = true;
    cm.clearCart = wrapped;
    return true;
  }

  function ensureCartManagerWrappedSoon() {
    // CartManager loads after this script on Checkout.html, so retry briefly.
    const startedAt = Date.now();
    const interval = setInterval(() => {
      if (wrapCartManagerClearCart()) {
        clearInterval(interval);
        return;
      }
      if (Date.now() - startedAt > 8000) {
        clearInterval(interval);
      }
    }, 250);
  }

  function guardCheckoutButtonsCapture() {
    // Disabled - delivery terms requirement removed
    // Checkout buttons are no longer blocked
    return;
  }

  function attachModalAcknowledgeHandler() {
    document.addEventListener('click', function (e) {
      const target = e.target;
      if (!target) return;
      if (target.id === 'deliveryTermsAcknowledgeBtn') {
        acknowledgeAndClose();
      }
    });
  }

  function escapeHtml(str) {
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

  function escapeAttr(str) {
    return escapeHtml(str).replace(/"/g, '&quot;');
  }

  function formatPhp(amount) {
    const n = Number(amount);
    if (!isFinite(n)) return `₱${escapeHtml(String(amount))}`;
    return '₱' + n.toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  }

  async function resolveMinOrderAmount(config) {
    if (config.minOrderAmountPhp !== null && config.minOrderAmountPhp !== undefined) return config;

    // Optional auto-fetch from system settings (min_order_value)
    try {
      const resp = await fetch('../api/get_order_settings.php', { credentials: 'include' });
      const data = await resp.json();
      const value = data && data.success && data.settings ? Number(data.settings.min_order_value || 0) : 0;
      if (isFinite(value) && value > 0) {
        config.minOrderAmountPhp = value;
      }
    } catch {
      // ignore
    }
    return config;
  }

  async function init() {
    const config = await resolveMinOrderAmount(getConfig());

    // Ensure ToS link works from both Cart/Checkout pages (same directory)
    // Keep relative to Customer pages by default.
    if (!config.tosUrl || typeof config.tosUrl !== 'string') {
      config.tosUrl = 'TermsOfService.html';
    }

    // All delivery terms guards disabled - checkout is no longer blocked
    // attachModalAcknowledgeHandler();
    // wrapCartCheckout();
    // guardCheckoutButtonsCapture();
    // wrapCartManagerClearCart();
    // ensureCartManagerWrappedSoon();

    // Don't show modal or banner - delivery terms requirement removed
    if (false) {
      // Render banners where mounts exist
      const mounts = document.querySelectorAll('[data-delivery-terms-notice]');
      mounts.forEach((m) => ensureBanner(m, config));
    } else {
      // Clean up any stale mounts
      document.querySelectorAll('[data-delivery-terms-notice]').forEach((m) => (m.innerHTML = ''));
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', function () {
      // Fire and forget
      init();
    });
  } else {
    init();
  }
})();

