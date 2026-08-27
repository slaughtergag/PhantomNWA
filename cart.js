// ── PHANTOM CART ──────────────────────────────────────────────────────────────
// Include this script on every page. Manages localStorage, renders the
// slide-out drawer, upsell popup, and exposes window.PhantomCart.

(function () {
    const STORAGE_KEY = 'phantom_cart';

    // ── Storage helpers ───────────────────────────────────────────────────────
    function getCart() {
        try { return JSON.parse(localStorage.getItem(STORAGE_KEY)) || []; }
        catch { return []; }
    }

    function saveCart(cart) {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(cart));
    }

    // ── Checkout payload — only sends id/qty/color to backend ────────────────
    function buildCheckoutPayload() {
        return getCart().map(i => ({ id: i.id, qty: i.qty, color: i.color }));
    }

    // ── Unified Square checkout ───────────────────────────────────────────────
    async function checkoutCart(btnEl) {
        const cart = getCart();
        if (cart.length === 0) {
            alert('Your cart is empty.');
            return;
        }

        if (btnEl) {
            btnEl.disabled = true;
            btnEl.textContent = 'Redirecting…';
        }

        try {
            const res = await fetch('/create-checkout', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ cart: buildCheckoutPayload() }),
            });

            if (!res.ok) throw new Error(`Server error: ${res.status}`);

            const data = await res.json();
            if (!data.checkoutUrl) throw new Error('No checkout URL returned.');

            window.location.href = data.checkoutUrl;
        } catch (err) {
            console.error('[PhantomCart] Checkout error:', err);
            if (btnEl) {
                btnEl.disabled = false;
                btnEl.textContent = 'Checkout — Try Again';
                btnEl.style.borderColor = 'rgba(255,100,100,0.6)';
                btnEl.style.color = '#ff9e9e';
            }
        }
    }

    // Expose globally so onclick attributes can reach it
    window.checkoutCart = checkoutCart;

    // ── Cart mutations ────────────────────────────────────────────────────────
    function addItem(item) {
        const cart = getCart();
        const existing = cart.find(i => i.id === item.id && i.color === item.color);
        if (existing) {
            existing.qty = (existing.qty || 1) + 1;
        } else {
            cart.push({ ...item, qty: 1 });
        }
        saveCart(cart);
        renderDrawer();
        showUpsellPopup(item);
    }

    function removeItem(id, color) {
        saveCart(getCart().filter(i => !(i.id === id && i.color === color)));
        renderDrawer();
        renderCartPage();
    }

    function updateQty(id, color, qty) {
        const cart = getCart();
        const item = cart.find(i => i.id === id && i.color === color);
        if (!item) return;
        if (qty < 1) { removeItem(id, color); return; }
        item.qty = qty;
        saveCart(cart);
        renderDrawer();
        renderCartPage();
    }

    function getSubtotal(cart) {
        return cart.reduce((sum, i) => sum + i.price * i.qty, 0);
    }

    // ── Upsell popup ──────────────────────────────────────────────────────────
    function showUpsellPopup(addedItem) {
        const old = document.getElementById('ph-upsell');
        if (old) old.remove();

        const badge    = `<div style="display:inline-block;font-size:0.6rem;letter-spacing:0.25em;text-transform:uppercase;background:rgba(255,255,255,0.06);border:1px solid rgba(255,255,255,0.12);border-radius:2px;padding:0.25rem 0.6rem;margin-bottom:0.75rem;color:#777;">Added to Cart</div>`;
        const headline = `<div style="font-size:1rem;font-weight:700;letter-spacing:0.06em;color:#fff;margin-bottom:0.4rem;">${addedItem.name} added</div>`;

        const popup = document.createElement('div');
        popup.id = 'ph-upsell';
        popup.style.cssText = `
            position:fixed;bottom:2rem;right:2rem;z-index:1000;
            width:min(340px, calc(100vw - 2rem));
            background:rgba(12,12,12,0.82);
            backdrop-filter:blur(24px) saturate(1.5);
            -webkit-backdrop-filter:blur(24px) saturate(1.5);
            border:1px solid rgba(255,255,255,0.1);border-radius:4px;
            padding:1.4rem 1.5rem;font-family:'Oxanium',sans-serif;
            box-shadow:0 8px 40px rgba(0,0,0,0.6), 0 0 0 1px rgba(255,255,255,0.04);
            transform:translateY(20px);opacity:0;
            transition:transform 0.35s cubic-bezier(0.4,0,0.2,1), opacity 0.35s ease;
        `;

        popup.innerHTML = `
            <div style="display:flex;justify-content:space-between;align-items:flex-start;gap:1rem;">
                <div style="flex:1;">
                    ${badge}${headline}
                </div>
                <button onclick="document.getElementById('ph-upsell').remove()" style="
                    background:none;border:none;color:#555;cursor:pointer;
                    font-size:1rem;padding:0;line-height:1;flex-shrink:0;
                    margin-top:0.1rem;transition:color 0.2s;
                " onmouseover="this.style.color='#fff'" onmouseout="this.style.color='#555'">&#x2715;</button>
            </div>
            <div style="display:flex;gap:0.6rem;margin-top:1.1rem;">
                <button onclick="document.getElementById('ph-upsell').remove();window.PhantomCart._openDrawer();" style="
                    flex:1;font-family:'Oxanium',sans-serif;font-size:0.72rem;
                    letter-spacing:0.12em;text-transform:uppercase;
                    padding:0.65rem 1rem;cursor:pointer;border-radius:2px;
                    background:#fff;color:#000;border:1.5px solid #fff;transition:all 0.2s;
                " onmouseover="this.style.background='transparent';this.style.color='#fff'"
                   onmouseout="this.style.background='#fff';this.style.color='#000'">
                    View Cart
                </button>
                <button onclick="document.getElementById('ph-upsell').remove()" style="
                    flex:1;font-family:'Oxanium',sans-serif;font-size:0.72rem;
                    letter-spacing:0.12em;text-transform:uppercase;
                    padding:0.65rem 1rem;cursor:pointer;border-radius:2px;
                    background:transparent;color:#999;border:1.5px solid rgba(255,255,255,0.15);transition:all 0.2s;
                " onmouseover="this.style.borderColor='rgba(255,255,255,0.4)';this.style.color='#fff'"
                   onmouseout="this.style.borderColor='rgba(255,255,255,0.15)';this.style.color='#999'">
                    Keep Shopping
                </button>
            </div>
        `;

        document.body.appendChild(popup);
        requestAnimationFrame(() => requestAnimationFrame(() => {
            popup.style.transform = 'translateY(0)';
            popup.style.opacity   = '1';
        }));
        setTimeout(() => {
            if (!popup.parentNode) return;
            popup.style.transform = 'translateY(20px)';
            popup.style.opacity   = '0';
            setTimeout(() => popup.remove(), 400);
        }, 6000);
    }

    // ── Drawer HTML ───────────────────────────────────────────────────────────
    function buildDrawerHTML() {
        return `
        <div id="ph-overlay" style="
            position:fixed;inset:0;z-index:998;background:rgba(0,0,0,0);
            pointer-events:none;transition:background 0.35s ease;
        "></div>
        <div id="ph-drawer" style="
            position:fixed;top:0;right:0;bottom:0;width:min(420px,100vw);
            z-index:999;transform:translateX(100%);
            transition:transform 0.4s cubic-bezier(0.4,0,0.2,1);
            background:rgba(10,10,10,0.72);
            backdrop-filter:blur(28px) saturate(1.4);
            -webkit-backdrop-filter:blur(28px) saturate(1.4);
            border-left:1px solid rgba(255,255,255,0.09);
            display:flex;flex-direction:column;font-family:'Oxanium',sans-serif;
        ">
            <div style="
                padding:1.5rem 1.75rem 1.25rem;
                border-bottom:1px solid rgba(255,255,255,0.07);
                display:flex;align-items:center;justify-content:space-between;
            ">
                <div>
                    <div style="font-size:0.6rem;letter-spacing:0.35em;color:#999;text-transform:uppercase;margin-bottom:0.2rem;">Phantom</div>
                    <div style="font-size:1.1rem;font-weight:800;letter-spacing:0.1em;color:#fff;text-transform:uppercase;text-shadow:0 0 20px rgba(255,255,255,0.15);">Cart</div>
                </div>
                <button id="ph-close" style="
                    background:none;border:1px solid rgba(255,255,255,0.12);
                    color:#999;width:36px;height:36px;border-radius:2px;
                    cursor:pointer;font-size:1.1rem;display:flex;align-items:center;justify-content:center;
                    transition:border-color 0.2s,color 0.2s;
                " onmouseover="this.style.borderColor='rgba(255,255,255,0.4)';this.style.color='#fff'"
                   onmouseout="this.style.borderColor='rgba(255,255,255,0.12)';this.style.color='#999'">
                    &#x2715;
                </button>
            </div>
            <div id="ph-items" style="flex:1;overflow-y:auto;padding:1rem 1.75rem;"></div>
            <div id="ph-footer" style="padding:1.25rem 1.75rem 1.75rem;border-top:1px solid rgba(255,255,255,0.07);"></div>
        </div>`;
    }

    // ── Drawer render ─────────────────────────────────────────────────────────
    function renderDrawer() {
        const itemsEl  = document.getElementById('ph-items');
        const footerEl = document.getElementById('ph-footer');
        const badgeEl  = document.getElementById('ph-badge');
        if (!itemsEl) return;

        const cart     = getCart();
        const subtotal = getSubtotal(cart);
        const total    = subtotal;
        const count    = cart.reduce((s, i) => s + i.qty, 0);

        if (badgeEl) {
            badgeEl.textContent = count;
            badgeEl.style.display = count > 0 ? 'flex' : 'none';
        }

        if (cart.length === 0) {
            itemsEl.innerHTML = `
                <div style="text-align:center;padding:3rem 0;color:#555;">
                    <div style="font-size:2rem;margin-bottom:0.75rem;">∅</div>
                    <div style="font-size:0.65rem;letter-spacing:0.3em;text-transform:uppercase;">Your cart is empty</div>
                </div>`;
            footerEl.innerHTML = '';
            return;
        }

        itemsEl.innerHTML = cart.map(item => `
            <div style="display:flex;gap:1rem;align-items:center;padding:1rem 0;border-bottom:1px solid rgba(255,255,255,0.06);">
                <div style="width:64px;height:64px;flex-shrink:0;background:${item.color === 'black' ? '#e8e8e8' : '#1a1a1a'};border:1px solid rgba(255,255,255,0.08);border-radius:2px;display:flex;align-items:center;justify-content:center;overflow:hidden;">
                    <img src="${item.image}" style="width:52px;height:52px;object-fit:contain;filter:${item.noFilter ? 'none' : (item.color === 'white' ? 'invert(1) brightness(0.92)' : 'invert(0) brightness(0.9)')};">
                </div>
                <div style="flex:1;min-width:0;">
                    <div style="font-size:0.8rem;font-weight:700;letter-spacing:0.08em;color:#fff;text-transform:uppercase;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${item.name}</div>
                    <div style="font-size:0.6rem;letter-spacing:0.2em;color:#777;text-transform:uppercase;margin-top:0.15rem;">${item.color}</div>
                    <div style="display:flex;align-items:center;gap:0.5rem;margin-top:0.5rem;">
                        <button onclick="window.PhantomCart.updateQty('${item.id}','${item.color}',${item.qty - 1})" style="width:24px;height:24px;background:rgba(255,255,255,0.05);border:1px solid rgba(255,255,255,0.1);color:#fff;border-radius:2px;cursor:pointer;font-size:0.85rem;display:flex;align-items:center;justify-content:center;">−</button>
                        <span style="font-size:0.78rem;color:#ccc;min-width:16px;text-align:center;">${item.qty}</span>
                        <button onclick="window.PhantomCart.updateQty('${item.id}','${item.color}',${item.qty + 1})" style="width:24px;height:24px;background:rgba(255,255,255,0.05);border:1px solid rgba(255,255,255,0.1);color:#fff;border-radius:2px;cursor:pointer;font-size:0.85rem;display:flex;align-items:center;justify-content:center;">+</button>
                    </div>
                </div>
                <div style="text-align:right;flex-shrink:0;">
                    <div style="font-size:0.9rem;font-weight:700;color:#fff;">$${(item.price * item.qty).toFixed(2)}</div>
                    <button onclick="window.PhantomCart.removeItem('${item.id}','${item.color}')" style="margin-top:0.4rem;background:none;border:none;color:#555;font-size:0.6rem;letter-spacing:0.15em;text-transform:uppercase;cursor:pointer;font-family:'Oxanium',sans-serif;transition:color 0.2s;" onmouseover="this.style.color='#fff'" onmouseout="this.style.color='#555'">Remove</button>
                </div>
            </div>
        `).join('');

        footerEl.innerHTML = `
            <div style="display:flex;justify-content:space-between;align-items:baseline;margin-bottom:1.25rem;">
                <span style="font-size:0.65rem;letter-spacing:0.3em;color:#777;text-transform:uppercase;">Total</span>
                <span style="font-size:1.4rem;font-weight:800;color:#fff;text-shadow:0 0 20px rgba(255,255,255,0.15);">$${total.toFixed(2)}</span>
            </div>
            <a href="${resolveCartPath()}" style="
                display:block;text-align:center;font-family:'Oxanium',sans-serif;
                font-size:0.8rem;letter-spacing:0.15em;text-transform:uppercase;font-weight:400;
                padding:0.9rem 2rem;text-decoration:none;
                background:#fff;color:#000;border:1.5px solid #fff;border-radius:2px;
                transition:all 0.25s;margin-bottom:0.65rem;
                box-shadow:0 0 20px rgba(255,255,255,0.12);
            " onmouseover="this.style.background='transparent';this.style.color='#fff'"
               onmouseout="this.style.background='#fff';this.style.color='#000'">
                View Cart
            </a>
            <div style="font-size:0.58rem;letter-spacing:0.2em;color:#444;text-transform:uppercase;text-align:center;">
                Secure checkout powered by Square
            </div>
        `;
    }

    // ── FIXED: derive cart.html's path from where cart.js itself was loaded
    // from, instead of guessing folder names (old version broke on any
    // subfolder name not in a hardcoded list, e.g. "products/hoodie.html").
    function resolveCartPath() {
        const scriptEl = document.querySelector('script[src$="cart.js"]');
        if (scriptEl) {
            return scriptEl.getAttribute('src').replace(/cart\.js(\?.*)?$/, 'cart.html');
        }
        return 'cart.html';
    }

    // ── Drawer open/close ─────────────────────────────────────────────────────
    function openDrawer() {
        const drawer  = document.getElementById('ph-drawer');
        const overlay = document.getElementById('ph-overlay');
        if (!drawer) return;
        drawer.style.transform      = 'translateX(0)';
        overlay.style.background    = 'rgba(0,0,0,0.45)';
        overlay.style.pointerEvents = 'auto';
    }

    function closeDrawer() {
        const drawer  = document.getElementById('ph-drawer');
        const overlay = document.getElementById('ph-overlay');
        if (!drawer) return;
        drawer.style.transform      = 'translateX(100%)';
        overlay.style.background    = 'rgba(0,0,0,0)';
        overlay.style.pointerEvents = 'none';
    }

    // ── Cart icon ─────────────────────────────────────────────────────────────
    function injectCartIcon() {
        const navSocial = document.querySelector('.nav-social');
        if (!navSocial) return;
        const btn = document.createElement('button');
        btn.id = 'ph-cart-btn';
        btn.title = 'Cart';
        btn.style.cssText = `
            background:none;border:1px solid rgba(255,255,255,0.15);
            color:#999;padding:0.4rem 0.7rem;border-radius:2px;
            cursor:pointer;font-family:'Oxanium',sans-serif;
            font-size:0.75rem;letter-spacing:0.1em;text-transform:uppercase;
            display:flex;align-items:center;gap:0.5rem;
            transition:border-color 0.2s,color 0.2s;position:relative;
        `;
        btn.innerHTML = `
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <circle cx="9" cy="21" r="1"/><circle cx="20" cy="21" r="1"/>
                <path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6"/>
            </svg>
            <span id="ph-badge" style="
                display:none;background:#fff;color:#000;
                font-size:0.55rem;font-weight:700;letter-spacing:0.05em;
                width:16px;height:16px;border-radius:50%;
                align-items:center;justify-content:center;
            ">0</span>
        `;
        btn.addEventListener('click', openDrawer);
        btn.addEventListener('mouseover', () => { btn.style.borderColor = 'rgba(255,255,255,0.4)'; btn.style.color = '#fff'; });
        btn.addEventListener('mouseout',  () => { btn.style.borderColor = 'rgba(255,255,255,0.15)'; btn.style.color = '#999'; });
        navSocial.prepend(btn);
    }

    // ── Init — Fix 1: safe append loop ────────────────────────────────────────
    function init() {
        const tmp = document.createElement('div');
        tmp.innerHTML = buildDrawerHTML();
        // Append all children safely (avoids the live-collection shifting bug)
        Array.from(tmp.children).forEach(el => document.body.appendChild(el));
        document.getElementById('ph-close').addEventListener('click', closeDrawer);
        document.getElementById('ph-overlay').addEventListener('click', closeDrawer);
        injectCartIcon();
        renderDrawer();
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }

    // ── Public API ────────────────────────────────────────────────────────────
    window.PhantomCart = {
        addItem,
        removeItem,
        updateQty,
        getCart,
        buildCheckoutPayload,
        _openDrawer: openDrawer,
        renderCartPage: () => renderCartPage(),
    };

    // ── Cart page renderer ────────────────────────────────────────────────────
    function renderCartPage() {
        const root = document.getElementById('cart-root');
        if (!root) return;

        const cart     = getCart();
        const subtotal = getSubtotal(cart);
        const total    = subtotal;

        if (cart.length === 0) {
            root.innerHTML = `
                <div style="text-align:center;padding:5rem 0;color:#555;">
                    <div style="font-family:'Oxanium',sans-serif;font-size:2rem;margin-bottom:1rem;">∅</div>
                    <div style="font-family:'Oxanium',sans-serif;font-size:0.65rem;letter-spacing:0.35em;text-transform:uppercase;">Your cart is empty</div>
                    <a href="index.html" style="
                        display:inline-block;margin-top:2rem;
                        font-family:'Oxanium',sans-serif;font-size:0.75rem;
                        letter-spacing:0.2em;text-transform:uppercase;
                        color:#999;text-decoration:none;
                        border-bottom:1px solid rgba(255,255,255,0.15);padding-bottom:2px;
                        transition:color 0.2s,border-color 0.2s;
                    " onmouseover="this.style.color='#fff';this.style.borderColor='rgba(255,255,255,0.5)'"
                       onmouseout="this.style.color='#999';this.style.borderColor='rgba(255,255,255,0.15)'">
                        ← Back to Shop
                    </a>
                </div>`;
            return;
        }

        root.innerHTML = `
            <div class="cart-layout">
                <div class="cart-items">
                    ${cart.map(item => `
                    <div class="cart-row">
                        <div class="cart-thumb" style="background:${item.color === 'black' ? '#e8e8e8' : '#1a1a1a'};">
                            <img src="${item.image}" alt="${item.name}" style="filter:${item.noFilter ? 'none' : (item.color === 'white' ? 'invert(1) brightness(0.92)' : 'invert(0) brightness(0.9)')};">
                        </div>
                        <div class="cart-info">
                            <div class="cart-name">${item.name}</div>
                            <div class="cart-color">${item.color}</div>
                            <div class="cart-qty-row">
                                <button class="qty-btn" onclick="window.PhantomCart.updateQty('${item.id}','${item.color}',${item.qty - 1})">−</button>
                                <span class="qty-num">${item.qty}</span>
                                <button class="qty-btn" onclick="window.PhantomCart.updateQty('${item.id}','${item.color}',${item.qty + 1})">+</button>
                                <button class="remove-btn" onclick="window.PhantomCart.removeItem('${item.id}','${item.color}')">Remove</button>
                            </div>
                        </div>
                        <div class="cart-price">$${(item.price * item.qty).toFixed(2)}</div>
                    </div>
                    `).join('')}
                </div>
                <div class="cart-summary">
                    <div class="summary-label">Order Summary</div>
                    <div class="summary-rows">
                        ${cart.map(item => `
                        <div class="summary-row">
                            <span>${item.name} <span style="color:#555;">× ${item.qty}</span></span>
                            <span>$${(item.price * item.qty).toFixed(2)}</span>
                        </div>`).join('')}
                    </div>
                    <div class="summary-total">
                        <span>Total</span>
                        <span>$${total.toFixed(2)}</span>
                    </div>
                    <div class="summary-note">Secure checkout powered by Square</div>
                    <button
                        id="ph-checkout-btn"
                        onclick="window.checkoutCart(this)"
                        style="
                            display:block;width:100%;text-align:center;
                            font-family:'Oxanium',sans-serif;font-size:0.8rem;
                            letter-spacing:0.15em;text-transform:uppercase;font-weight:400;
                            padding:0.9rem 2rem;cursor:pointer;
                            background:#fff;color:#000;border:1.5px solid #fff;border-radius:2px;
                            transition:all 0.25s;box-shadow:0 0 20px rgba(255,255,255,0.12);
                            margin-top:1rem;
                        "
                        onmouseover="if(!this.disabled){this.style.background='transparent';this.style.color='#fff';}"
                        onmouseout="if(!this.disabled){this.style.background='#fff';this.style.color='#000';}">
                        Checkout Entire Order →
                    </button>
                </div>
            </div>`;
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', renderCartPage);
    } else {
        renderCartPage();
    }

})();