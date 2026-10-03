import express from 'express';
import helmet from 'helmet';
import pg from 'pg';

const { Pool } = pg;
const app = express();
const port = Number(process.env.PORT ?? 4000);
const pool = new Pool();

app.disable('x-powered-by');
app.use(helmet());
app.use(express.json({ limit: '32kb' }));

app.get('/api/health/live', (_request, response) => {
  response.json({ status: 'ok' });
});

app.get('/api/health/ready', async (_request, response) => {
  try {
    await pool.query('SELECT 1');
    response.json({ status: 'ready' });
  } catch (error) {
    console.error('Database readiness check failed:', error);
    response.status(503).json({ error: 'Database is not ready' });
  }
});

app.get('/api/products', async (_request, response, next) => {
  try {
    const { rows } = await pool.query(
      `SELECT id, name, category, description, price_cents, stock, image_url
       FROM products
       WHERE stock > 0
       ORDER BY id`
    );
    response.json(rows);
  } catch (error) {
    next(error);
  }
});

app.post('/api/orders', async (request, response, next) => {
  const { customer, items } = request.body ?? {};
  const name = typeof customer?.name === 'string' ? customer.name.trim() : '';
  const email = typeof customer?.email === 'string' ? customer.email.trim() : '';
  const phone = typeof customer?.phone === 'string' ? customer.phone.trim() : '';
  const address = typeof customer?.address === 'string' ? customer.address.trim() : '';

  if (
    name.length < 2 || name.length > 100 ||
    !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length > 254 ||
    phone.length < 7 || phone.length > 30 ||
    address.length < 8 || address.length > 300 ||
    !Array.isArray(items) || items.length < 1 || items.length > 30
  ) {
    return response.status(400).json({ error: 'Please provide valid customer and order details.' });
  }

  const quantities = new Map();
  for (const item of items) {
    if (!Number.isInteger(item?.productId) || item.productId < 1 ||
        !Number.isInteger(item?.quantity) || item.quantity < 1 || item.quantity > 20) {
      return response.status(400).json({ error: 'Each item must have a valid product and quantity.' });
    }
    quantities.set(item.productId, (quantities.get(item.productId) ?? 0) + item.quantity);
  }

  if ([...quantities.values()].some((quantity) => quantity > 20)) {
    return response.status(400).json({ error: 'The maximum quantity per product is 20.' });
  }

  let client;
  let transactionStarted = false;
  try {
    client = await pool.connect();
    await client.query('BEGIN');
    transactionStarted = true;
    const productIds = [...quantities.keys()];
    const { rows: products } = await client.query(
      'SELECT id, name, price_cents, stock FROM products WHERE id = ANY($1::int[]) FOR UPDATE',
      [productIds]
    );

    if (products.length !== productIds.length) {
      await client.query('ROLLBACK');
      return response.status(400).json({ error: 'One or more products are no longer available.' });
    }

    for (const product of products) {
      if (product.stock < quantities.get(product.id)) {
        await client.query('ROLLBACK');
        return response.status(409).json({ error: `${product.name} does not have enough stock.` });
      }
    }

    const totalCents = products.reduce(
      (total, product) => total + product.price_cents * quantities.get(product.id),
      0
    );
    const { rows: [order] } = await client.query(
      `INSERT INTO orders (customer_name, email, phone, shipping_address, total_cents)
       VALUES ($1, $2, $3, $4, $5) RETURNING id, total_cents`,
      [name, email, phone, address, totalCents]
    );

    for (const product of products) {
      const quantity = quantities.get(product.id);
      await client.query(
        `INSERT INTO order_items (order_id, product_id, quantity, unit_price_cents)
         VALUES ($1, $2, $3, $4)`,
        [order.id, product.id, quantity, product.price_cents]
      );
      await client.query(
        'UPDATE products SET stock = stock - $1 WHERE id = $2',
        [quantity, product.id]
      );
    }

    await client.query('COMMIT');
    transactionStarted = false;
    response.status(201).json({
      orderId: order.id,
      totalCents: order.total_cents,
      message: 'Your order has been placed.'
    });
  } catch (error) {
    if (client && transactionStarted) {
      await client.query('ROLLBACK').catch((rollbackError) => {
        console.error('Order rollback failed:', rollbackError);
      });
    }
    next(error);
  } finally {
    client?.release();
  }
});

app.use((error, _request, response, _next) => {
  console.error('Request failed:', error);
  response.status(500).json({ error: 'An unexpected server error occurred.' });
});

const server = app.listen(port, '0.0.0.0', () => {
  console.log(`AutoDrive API listening on port ${port}`);
});

function shutDown() {
  server.close(() => {
    pool.end().then(() => process.exit(0)).catch((error) => {
      console.error('Database shutdown failed:', error);
      process.exit(1);
    });
  });
}

process.on('SIGTERM', shutDown);
process.on('SIGINT', shutDown);
