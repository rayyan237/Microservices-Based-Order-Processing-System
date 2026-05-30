# Microservices-Based Order Processing System (BWD-3)

## Overview

This project is a distributed, event-driven order processing system developed as part of the Teyzix Core internship. It simulates a modern e-commerce backend infrastructure to address the limitations of monolithic architectures, focusing on scalability and domain isolation.

## System Architecture

The system is composed of four independent services, each with its own database, communicating asynchronously via RabbitMQ.

### Core Services

* **Order Service**: Manages customer order lifecycles and publishes order events.


* **Inventory Service**: Validates product availability and handles stock updates.


* **Payment Service**: Processes transactions and handles success/failed events using a **Circuit Breaker** pattern.


* **Notification Service**: Consumes events to send simulated notifications and tracks delivery logs.



## Technical Stack

* **Runtime**: Node.js / Express 


* **Messaging**: RabbitMQ 


* **Database**: MongoDB (Database-per-service architecture) 


* **Infrastructure**: Docker & Docker Compose 


* **Observability**: Pino (Structured Logging) 



## Getting Started

1. **Clone the repository**.
2. **Ensure Docker is running**.
3. **Launch the system** from the root directory:
```bash
docker-compose up --build

```


4. **Verify services** via the health-check endpoint:
`GET http://localhost:3001/health`

## Implementation Features

* **Saga Pattern**: Distributed transaction management across services.


* **Circuit Breaker**: Fault tolerance in the Payment Service.


* **Correlation IDs**: Tracing requests across the entire service chain.


* **Graceful Recovery**: Automatic retry logic for broker connections.