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

const PORT = process.env.PORT || 3001;
const MONGO_URI = process.env.MONGO_URI;
const RABBITMQ_URL = process.env.RABBITMQ_URL;

let channel;

async function connectRabbitMQ() {
    try {
        const connection = await amqp.connect(RABBITMQ_URL);
        channel = await connection.createChannel();
        
        // Existing outgoing queue
        await channel.assertQueue('order_events'); 
        
        // NEW: Incoming queue for the Saga Pattern
        await channel.assertQueue('payment_events');

        logger.info('Connected to RabbitMQ');

        // NEW: Saga Pattern Consumer
        channel.consume('payment_events', async (msg) => {
            if (msg !== null) {
                const event = JSON.parse(msg.content.toString());
                
                if (event.eventType === 'PaymentSuccess') {
                    await Order.findOneAndUpdate(
                        { orderId: event.orderId },
                        { status: 'Completed' }
                    );
                    logger.info(`[✔] Saga: Order ${event.orderId} marked as Completed.`);
                } else if (event.eventType === 'PaymentFailed') {
                    await Order.findOneAndUpdate(
                        { orderId: event.orderId },
                        { status: 'Failed' }
                    );
                    logger.error(`[X] Saga: Order ${event.orderId} marked as Failed. Payment declined.`);
                }
                
                channel.ack(msg);
            }
        });

    } catch (error) {
        logger.error({ err: error.message }, 'RabbitMQ Connection Error, retrying in 5 seconds...');
        setTimeout(connectRabbitMQ, 5000);
    }
}

mongoose.connect(MONGO_URI)
    .then(() => logger.info('Connected to Order Database'))
    .catch(err => logger.error('MongoDB Connection Error:', err));

const orderSchema = new mongoose.Schema({
    orderId: String,
    customerId: String,
    items: Array,
    totalAmount: Number,
    status: { type: String, default: 'Pending' }
});
const Order = mongoose.model('Order', orderSchema);

app.post('/api/orders', async (req, res) => {
    try {
        const { customerId, items, totalAmount } = req.body;
        
        // Native Mongoose ID
        const correlationId = new mongoose.Types.ObjectId().toString(); 

        const newOrder = new Order({
            orderId: new mongoose.Types.ObjectId().toString(),
            customerId,
            items,
            totalAmount
        });

        await newOrder.save();

        const event = {
            eventType: 'OrderCreated',
            data: newOrder,
            correlationId,
            timestamp: new Date()
        };

        if (channel) {
            channel.sendToQueue('order_events', Buffer.from(JSON.stringify(event)));
            logger.info(`[x] Sent OrderCreated event with Correlation ID: ${correlationId}`);
        }

        res.status(201).json({ message: 'Order created successfully', order: newOrder, correlationId });
    } catch (error) {
        console.log("THE HIDDEN ERROR IS:", error);
        logger.error("CRITICAL ERROR IN POST /api/orders:", error);
        res.status(500).json({ error: 'Internal Server Error', details: error.message });
    }
});
// --- HEALTH CHECK ENDPOINT ---
app.get('/health', (req, res) => {
    res.status(200).json({ 
        status: 'UP', 
        service: 'Order Service', 
        timestamp: new Date() 
    });
});
app.listen(PORT, async () => {
    logger.info(`Order Service running on port ${PORT}`);
    await connectRabbitMQ();
});