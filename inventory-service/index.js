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

const PORT = process.env.PORT || 3002;
const MONGO_URI = process.env.MONGO_URI;
const RABBITMQ_URL = process.env.RABBITMQ_URL;

let channel;

// 1. Connect to MongoDB
mongoose.connect(MONGO_URI)
    .then(() => logger.info('Connected to Inventory Database'))
    .catch(err => logger.error('MongoDB Connection Error:', err));

// 2. Connect to RabbitMQ & Listen for Events
async function connectRabbitMQ() {
    try {
        const connection = await amqp.connect(RABBITMQ_URL);
        channel = await connection.createChannel();
        
        // Assert the queues we need
        await channel.assertQueue('order_events');
        await channel.assertQueue('inventory_events'); 

        logger.info('Connected to RabbitMQ - Listening for events...');

        // 3. Consume the OrderCreated Event
        channel.consume('order_events', async (msg) => {
            if (msg !== null) {
                const event = JSON.parse(msg.content.toString());
                
                if (event.eventType === 'OrderCreated') {
                    logger.info(`[↓] Received OrderCreated for Order: ${event.data.orderId}`);
                    logger.info(`Correlation ID: ${event.correlationId}`);

                    // Simulate Inventory Check (Always passes for now)
                    logger.info(`Checking stock for items... Stock is available!`);

                    // 4. Publish InventoryReserved Event
                    const replyEvent = {
                        eventType: 'InventoryReserved',
                        orderId: event.data.orderId,
                        correlationId: event.correlationId,
                        timestamp: new Date()
                    };

                    channel.sendToQueue('inventory_events', Buffer.from(JSON.stringify(replyEvent)));
                    logger.info(`[↑] Sent InventoryReserved event.`);
                    
                    // Acknowledge the message so RabbitMQ removes it from the queue
                    channel.ack(msg);
                }
            }
        });
    } catch (error) {
        logger.error('RabbitMQ Connection Error, retrying...', error.message);
        setTimeout(connectRabbitMQ, 5000);
    }
}
// --- HEALTH CHECK ENDPOINT ---
app.get('/health', (req, res) => {
    res.status(200).json({ 
        status: 'UP', 
        service: 'Inventory Service', 
        timestamp: new Date() 
    });
});
app.listen(PORT, async () => {
    logger.info(`Inventory Service running on port ${PORT}`);
    await connectRabbitMQ();
});