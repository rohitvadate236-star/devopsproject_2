import React, { useEffect, useMemo, useState } from 'react';
import { createRoot } from 'react-dom/client';
import './styles.css';

const money = (cents) => new Intl.NumberFormat('en-US', {
  style: 'currency',
  currency: 'USD'
}).format(cents / 100);

function App() {
  const [products, setProducts] = useState([]);
  const [cart, setCart] = useState({});
  const [category, setCategory] = useState('All parts');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [checkoutOpen, setCheckoutOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [customer, setCustomer] = useState({ name: '', email: '', phone: '', address: '' });

  useEffect(() => {
    fetch('/api/products')
      .then(async (response) => {
        if (!response.ok) throw new Error('Could not load products. Please try again later.');
        return response.json();
      })
      .then(setProducts)
      .catch((loadError) => setError(loadError.message))
      .finally(() => setLoading(false));
  }, []);

  const categories = useMemo(
    () => ['All parts', ...new Set(products.map((product) => product.category))],
    [products]
  );
  const shownProducts = category === 'All parts'
    ? products
    : products.filter((product) => product.category === category);
  const cartItems = products.filter((product) => cart[product.id] > 0);
  const itemCount = Object.values(cart).reduce((sum, quantity) => sum + quantity, 0);
  const totalCents = cartItems.reduce(
    (sum, product) => sum + product.price_cents * cart[product.id],
    0
  );

  function changeQuantity(productId, adjustment) {
    setCart((current) => {
      const quantity = (current[productId] ?? 0) + adjustment;
      if (quantity <= 0) {
        const next = { ...current };
        delete next[productId];
        return next;
      }
      return { ...current, [productId]: quantity };
    });
  }

  async function placeOrder(event) {
    event.preventDefault();
    setSubmitting(true);
    setNotice('');
    try {
      const response = await fetch('/api/orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          customer,
          items: cartItems.map((product) => ({
            productId: product.id,
            quantity: cart[product.id]
          }))
        })
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || 'Could not place the order.');
      setNotice(`Order #${result.orderId} confirmed. Thank you, ${customer.name}!`);
      setCart({});
      setCheckoutOpen(false);
      setCustomer({ name: '', email: '', phone: '', address: '' });
      const refreshedProducts = await fetch('/api/products');
      if (refreshedProducts.ok) setProducts(await refreshedProducts.json());
    } catch (orderError) {
      setNotice(orderError.message);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <>
      <div className="announcement">Complimentary shipping on orders over $150 <span>—</span> Built for the long way round</div>
      <header className="site-header">
        <a className="brand" href="#" aria-label="AutoDrive home">
          <span className="brand-mark">A<span>/</span>D</span>
          <span className="brand-name">AUTODRIVE<small>PARTS &amp; ACCESSORIES</small></span>
        </a>
        <nav className="main-nav" aria-label="Main navigation">
          <a href="#shop">Shop all</a>
          <a href="#shop">Our standard</a>
          <a href="#footer">Get in touch</a>
        </nav>
        <a className="cart-link" href="#cart" aria-label={`Shopping bag, ${itemCount} items`}>
          BAG <span>{String(itemCount).padStart(2, '0')}</span>
        </a>
      </header>

      <main>
        <section className="hero">
          <img className="hero-image" src="https://images.unsplash.com/photo-1503376780353-7e6692767b70?auto=format&fit=crop&w=2200&q=90" alt="Classic sports car on an open road" />
          <div className="hero-shade" />
          <div className="hero-content">
            <p className="eyebrow"><span /> THE DRIVE, REFINED</p>
            <h1>Made for the<br />miles <em>ahead.</em></h1>
            <p className="hero-copy">Considered upgrades. Dependable essentials.<br />Everything your next drive deserves.</p>
            <a className="button button-light" href="#shop">Explore the collection <span>↗</span></a>
          </div>
          <div className="hero-caption"><span>01 — 04</span><span>DRIVE YOUR OWN WAY</span></div>
        </section>

        <section className="values" aria-label="Our promises">
          <div><span className="value-icon">✳</span><p><strong>Chosen with purpose</strong><small>Only the parts worth fitting.</small></p></div>
          <div><span className="value-icon">◈</span><p><strong>Made to go further</strong><small>Quality that earns its place.</small></p></div>
          <div><span className="value-icon">↗</span><p><strong>Here when you need us</strong><small>Real help from real enthusiasts.</small></p></div>
        </section>

        <section className="shop-section" id="shop">
          <div className="section-heading">
            <div><p className="eyebrow dark-eyebrow">THE AUTODRIVE EDIT</p><h2>Good things for<br /><em>great drives.</em></h2></div>
            <p className="section-intro">A considered collection of parts and accessories, selected to make every mile a little better.</p>
          </div>

          <div className="shop-controls">
            <div className="filters" aria-label="Filter by category">
              {categories.map((item) => (
                <button className={category === item ? 'filter active' : 'filter'} key={item} onClick={() => setCategory(item)}>{item}</button>
              ))}
            </div>
            <span className="result-count">{shownProducts.length} PIECES</span>
          </div>

          {error && <div className="state-message error-message">{error}</div>}
          {loading && <div className="state-message">Loading the collection…</div>}
          {!loading && !error && shownProducts.length === 0 && <div className="state-message">No products in this collection just yet.</div>}

          <div className="product-grid">
            {shownProducts.map((product, index) => (
              <article className="product-card" key={product.id}>
                <div className="product-image-wrap">
                  <img src={product.image_url} alt={product.name} loading="lazy" />
                  <span className="product-index">0{index + 1}</span>
                  <button className="add-button" onClick={() => changeQuantity(product.id, 1)} aria-label={`Add ${product.name} to bag`}>
                    {cart[product.id] ? `ADDED · ${cart[product.id]}  +` : 'ADD TO BAG  +'}
                  </button>
                </div>
                <div className="product-meta"><span>{product.category}</span><span>{product.stock} IN STOCK</span></div>
                <div className="product-title-row"><h3>{product.name}</h3><span>{money(product.price_cents)}</span></div>
                <p className="product-description">{product.description}</p>
              </article>
            ))}
          </div>
        </section>

        <section className="manifesto">
          <p className="eyebrow"><span /> A BETTER KIND OF AFTERMARKET</p>
          <h2>It’s not about<br />getting there <em>faster.</em><br />It’s about loving<br />every mile.</h2>
          <a href="#shop" className="text-link">Find your next favourite <span>↗</span></a>
        </section>

        <section className="cart-section" id="cart">
          <div className="cart-heading"><div><p className="eyebrow dark-eyebrow">YOUR NEXT DRIVE</p><h2>Your bag <span>({itemCount})</span></h2></div></div>
          {cartItems.length === 0
            ? <p className="empty-cart">A good drive starts with the right details. Your bag is waiting.</p>
            : <div className="cart-content">
                <div className="cart-items">
                  {cartItems.map((product) => (
                    <div className="cart-item" key={product.id}>
                      <img src={product.image_url} alt="" />
                      <div className="cart-item-info"><span>{product.category}</span><strong>{product.name}</strong><small>{money(product.price_cents)}</small></div>
                      <div className="quantity-control">
                        <button onClick={() => changeQuantity(product.id, -1)} aria-label={`Remove one ${product.name}`}>−</button>
                        <span>{cart[product.id]}</span>
                        <button onClick={() => changeQuantity(product.id, 1)} aria-label={`Add one ${product.name}`} disabled={cart[product.id] >= product.stock}>+</button>
                      </div>
                      <strong className="line-total">{money(product.price_cents * cart[product.id])}</strong>
                    </div>
                  ))}
                </div>
                <div className="cart-summary">
                  <div><span>Subtotal</span><strong>{money(totalCents)}</strong></div>
                  <small>Shipping calculated at checkout. Taxes included where applicable.</small>
                  <button className="button button-dark" onClick={() => { setNotice(''); setCheckoutOpen(true); }}>Continue to checkout <span>↗</span></button>
                </div>
              </div>}
          {notice && <p className={notice.startsWith('Order #') ? 'notice success-notice' : 'notice error-notice'} role="status">{notice}</p>}
        </section>
      </main>

      <footer id="footer">
        <a className="brand footer-brand" href="#">
          <span className="brand-mark">A<span>/</span>D</span>
          <span className="brand-name">AUTODRIVE<small>PARTS &amp; ACCESSORIES</small></span>
        </a>
        <p>Good things for the road ahead.</p>
        <span className="copyright">© 2025 AUTODRIVE. DRIVE YOUR OWN WAY.</span>
      </footer>

      {checkoutOpen && (
        <div className="modal-backdrop" role="presentation" onMouseDown={(event) => {
          if (event.target === event.currentTarget && !submitting) setCheckoutOpen(false);
        }}>
          <section className="checkout-modal" role="dialog" aria-modal="true" aria-labelledby="checkout-title">
            <button className="modal-close" onClick={() => setCheckoutOpen(false)} aria-label="Close checkout" disabled={submitting}>×</button>
            <p className="eyebrow dark-eyebrow">ONE LAST THING</p>
            <h2 id="checkout-title">Where should<br />we send it?</h2>
            <p className="checkout-total">Order total <strong>{money(totalCents)}</strong></p>
            <form onSubmit={placeOrder}>
              <label>Full name<input required minLength="2" maxLength="100" autoComplete="name" value={customer.name} onChange={(event) => setCustomer({ ...customer, name: event.target.value })} /></label>
              <label>Email address<input required type="email" maxLength="254" autoComplete="email" value={customer.email} onChange={(event) => setCustomer({ ...customer, email: event.target.value })} /></label>
              <label>Phone number<input required type="tel" minLength="7" maxLength="30" autoComplete="tel" value={customer.phone} onChange={(event) => setCustomer({ ...customer, phone: event.target.value })} /></label>
              <label>Shipping address<textarea required minLength="8" maxLength="300" autoComplete="street-address" rows="3" value={customer.address} onChange={(event) => setCustomer({ ...customer, address: event.target.value })} /></label>
              <button className="button button-dark" disabled={submitting}>{submitting ? 'Placing order…' : 'Place your order'} <span>↗</span></button>
            </form>
          </section>
        </div>
      )}
    </>
  );
}

createRoot(document.getElementById('root')).render(<App />);
