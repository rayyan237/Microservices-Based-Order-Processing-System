
---

# Database Schemas (MongoDB)

In compliance with the microservices database-per-service constraint, each service maintains its own independent MongoDB database. Below are the Mongoose schema definitions for the core collections.

## 1. Order Database (`order_db`)

**Collection:** `orders`
**Description:** Stores the customer's order details and tracks the distributed transaction status (Saga state).

```javascript
const orderSchema = new mongoose.Schema({
    orderId: { type: String, required: true, unique: true },
    userId: { type: String, required: true },
    items: [{
        productId: { type: String, required: true },
        quantity: { type: Number, required: true },
        price: { type: Number, required: true }
    }],
    totalAmount: { type: Number, required: true },
    status: { 
        type: String, 
        enum: ['Pending', 'Completed', 'Failed'], 
        default: 'Pending' 
    },
    createdAt: { type: Date, default: Date.now }
});

```

---

## 2. Inventory Database (`inventory_db`)

**Collection:** `inventories`
**Description:** Manages product stock levels. It uses a soft-reservation system so stock isn't permanently deducted until payment succeeds.

```javascript
const inventorySchema = new mongoose.Schema({
    productId: { type: String, required: true, unique: true },
    productName: { type: String, required: true },
    availableStock: { type: Number, required: true, default: 0 },
    reservedStock: { type: Number, required: true, default: 0 },
    lastUpdated: { type: Date, default: Date.now }
});

```

---

## 3. Payment Database (`payment_db`)

**Collection:** `transactions`
**Description:** Logs all simulated payment attempts processed through the Circuit Breaker.

```javascript
const transactionSchema = new mongoose.Schema({
    transactionId: { type: String, required: true, unique: true },
    orderId: { type: String, required: true },
    amount: { type: Number, required: true },
    status: { 
        type: String, 
        enum: ['Success', 'Failed'], 
        required: true 
    },
    timestamp: { type: Date, default: Date.now }
});

```

---

## 4. Notification Database (`notification_db`)

**Collection:** `notifications`
**Description:** Serves as a ledger for all outbound communications (emails/alerts) sent to customers based on their order state.

```javascript
const notificationSchema = new mongoose.Schema({
    notificationId: { type: String, required: true, unique: true },
    orderId: { type: String, required: true },
    message: { type: String, required: true },
    status: { type: String, default: 'Sent' },
    timestamp: { type: Date, default: Date.now }
});

```

---

