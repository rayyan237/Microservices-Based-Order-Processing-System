---

# System Design Document: Order Processing System (BWD-3)

## 1. High-Level Architecture

The system follows a **Microservices-Based Architecture** , utilizing a **Database-per-Service** strategy to ensure domain isolation and independent scalability. Asynchronous communication is facilitated by a central RabbitMQ broker to ensure loose coupling.

## 2. Event Flow & Service Interaction

The system processes orders through an event-driven workflow:

1. **Order Service**: Receives a POST request, creates a "Pending" order, and publishes an `OrderCreated` event to the `order_events` queue.


2. **Inventory Service**: Consumes the event, validates stock, and publishes an `InventoryReserved` event to the `inventory_events` queue.


3. **Payment Service**: Consumes the event, processes the transaction via a **Circuit Breaker** (to handle failures), and publishes a `PaymentSuccess` or `PaymentFailed` event.


4. **Order Service (Saga Pattern)**: Consumes payment events to update the order status to "Completed" or "Failed".


5. **Notification Service**: Consumes payment events and dispatches simulated email notifications.



## 3. Resilience & Observability

To ensure the system remains reliable and maintainable:

* **Correlation IDs**: Every request is assigned a unique ID at the `Order Service` level, which is passed through every event header for end-to-end tracing.


* **Retry Handling**: All services implement an exponential backoff/retry strategy for RabbitMQ connection failures.


* **Structured Logging**: Every service uses `pino` to output JSON-formatted logs, providing observability into the state of distributed transactions.


* **Circuit Breaker**: The `Payment Service` prevents resource exhaustion by "tripping" when the simulated bank API fails.



---