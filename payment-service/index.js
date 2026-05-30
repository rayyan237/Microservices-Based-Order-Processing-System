const express = require('express');
const mongoose = require('mongoose');
const amqp = require('amqplib');
require('dotenv').config();

const logger = require('pino')({
  transport: {
    target: 'pino-pretty',
    options: { colorize: true }
  }
});

const app = express();
app.use(express.json());

const PORT = process.env.PORT || 3003;
const MONGO_URI = process.env.MONGO_URI;
const RABBITMQ_URL = process.env.RABBITMQ_URL;

let channel;

// 1. Connect to MongoDB
mongoose.connect(MONGO_URI)
    .then(() => logger.info('Connected to Payment Database'))
    .catch(err => logger.error('MongoDB Connection Error:', err));

// --- PURE JS CIRCUIT BREAKER ---
class CircuitBreaker {
    constructor(requestFunction, failureThreshold = 3, recoveryTimeout = 10000) {
        this.requestFunction = requestFunction;
        this.failureThreshold = failureThreshold;
        this.recoveryTimeout = recoveryTimeout;
        
        this.state = 'CLOSED'; // CLOSED (normal), OPEN (failing), HALF_OPEN (testing recovery)
        this.failureCount = 0;
        this.nextAttempt = Date.now();
    }

    async fire(...args) {
        if (this.state === 'OPEN') {
            if (Date.now() > this.nextAttempt) {
                this.state = 'HALF_OPEN';
                logger.info('Circuit Breaker is HALF_OPEN: Testing the service...');
            } else {
                throw new Error('Circuit Breaker is OPEN: Service is currently unavailable.');
            }
        }

        try {
            const result = await this.requestFunction(...args);
            this.onSuccess();
            return result;
        } catch (error) {
            this.onFailure();
            throw error;
        }
    }

    onSuccess() {
        this.failureCount = 0;
        if (this.state !== 'CLOSED') {
            this.state = 'CLOSED';
            logger.info('Circuit Breaker is CLOSED: Service fully recovered.');
        }
    }

    onFailure() {
        this.failureCount++;
        if (this.failureCount >= this.failureThreshold) {
            this.state = 'OPEN';
            this.nextAttempt = Date.now() + this.recoveryTimeout;
            logger.error(`Circuit Breaker is OPEN: Threshold reached. Pausing requests for ${this.recoveryTimeout / 1000} seconds.`);
        }
    }
}


// 2. Connect to RabbitMQ & Listen for Inventory Events
async function connectRabbitMQ() {
    try {
        const connection = await amqp.connect(RABBITMQ_URL);
        channel = await connection.createChannel();
        
        await channel.assertQueue('inventory_events');
        await channel.assertQueue('payment_events');

        logger.info('Connected to RabbitMQ - Listening for inventory events...');

        // Initialize the Breaker (3 failures, 10s timeout)
        const paymentBreaker = new CircuitBreaker(async () => {
            if (Math.random() > 0.8) throw new Error('Bank API Timeout');
            return true;
        }, 3, 10000);

        channel.consume('inventory_events', async (msg) => {
            if (msg !== null) {
                const event = JSON.parse(msg.content.toString());
                
                if (event.eventType === 'InventoryReserved') {
                    logger.info(`\n[↓] Received InventoryReserved for Order: ${event.orderId}`);
                    
                    let isSuccess = false;
                    try {
                        // Use the Circuit Breaker to "fire" the payment attempt
                        isSuccess = await paymentBreaker.fire();
                        logger.info(`[✔] Payment Processed Successfully.`);
                    } catch (error) {
                        logger.error({ err: error.message }, `[✖] Payment FAILED via Circuit Breaker.`);
                        isSuccess = false;
                    }
                    
                    const replyEvent = {
                        eventType: isSuccess ? 'PaymentSuccess' : 'PaymentFailed',
                        orderId: event.orderId,
                        correlationId: event.correlationId,
                        timestamp: new Date()
                    };

                    // 3. Publish Payment Event
                    channel.sendToQueue('payment_events', Buffer.from(JSON.stringify(replyEvent)));
                    logger.info(`[↑] Sent ${replyEvent.eventType} event.`);
                    
                    channel.ack(msg);
                }
            }
        });
    } catch (error) {
        logger.error('RabbitMQ Connection Error...', error.message);
        setTimeout(connectRabbitMQ, 5000);
    }
}
// --- HEALTH CHECK ENDPOINT ---
app.get('/health', (req, res) => {
    res.status(200).json({ 
        status: 'UP', 
        service: 'Payment Service', 
        timestamp: new Date() 
    });
});
app.listen(PORT, async () => {
    logger.info(`Payment Service running on port ${PORT}`);
    await connectRabbitMQ();
});