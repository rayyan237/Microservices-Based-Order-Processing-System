---

# API Documentation: Order Processing System (BWD-3)

This document outlines the REST API endpoints exposed by the microservices. Note that inter-service communication is handled asynchronously via RabbitMQ events, minimizing synchronous HTTP dependencies.

## 1. Order Service API

This is the primary entry point for the system, responsible for initiating the order lifecycle and triggering the Saga pattern.

### Create a New Order

* **Endpoint:** `/api/orders`
* **Method:** `POST`
* **Port:** `3001`
* **Description:** Accepts an order payload, saves it to the Order Database with a `Pending` status, and emits an `OrderCreated` event to the broker.

**Request Body (JSON):**

```json
{
  "userId": "usr_98765",
  "items": [
    {
      "productId": "prod_101",
      "quantity": 2,
      "price": 49.99
    }
  ],
  "totalAmount": 99.98
}

```

**Success Response (201 Created):**

```json
{
  "message": "Order successfully placed and is pending processing.",
  "orderId": "6a1b16128e5d9acfd62a71f4",
  "correlationId": "corr_8f7d6e5c4b3a2"
}

```

---

## 2. Global Health Check API

Implemented across all core services for container orchestration monitoring and routing validation.

### Service Health Check

* **Endpoint:** `/health`
* **Method:** `GET`
* **Ports:** `3001` (Order), `3002` (Inventory), `3003` (Payment), `3004` (Notification)
* **Description:** Returns the current operational status of the service. Used by Docker Compose to verify if a container is healthy before routing traffic.

**Success Response (200 OK):**

```json
{
  "status": "UP",
  "service": "Order Service", 
  "timestamp": "2026-05-30T21:56:03.123Z"
}

```

---

## 3. Asynchronous Event Definitions (RabbitMQ)

While not REST APIs, the following internal events act as the data contracts between the services:

* **`OrderCreated`**: Emitted by Order Service. Contains order details and triggers inventory validation.
* **`InventoryReserved`**: Emitted by Inventory Service. Confirms stock availability and triggers payment processing.
* **`PaymentSuccess` / `PaymentFailed`**: Emitted by Payment Service. Triggers the final Saga state update in the Order Service and prompts the Notification Service to dispatch the corresponding email.

---