// --- NODE 18 MONGODB CRYPTO PATCH ---
const crypto = require('crypto');
if (!global.crypto) {
    global.crypto = crypto.webcrypto;
}
// ------------------------------------

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

const PORT = process.env.PORT || 3004;
const MONGO_URI = process.env.MONGO_URI;
const RABBITMQ_URL = process.env.RABBITMQ_URL;

// 1. Connect to MongoDB
mongoose.connect(MONGO_URI)
    .then(() => logger.info('Connected to Notification Database'))
    .catch(err => logger.error('MongoDB Connection Error:', err));

// Define Schema for tracking notifications
const notificationSchema = new mongoose.Schema({
    notificationId: String,
    orderId: String,
    message: String,
    status: { type: String, default: 'Sent' },
    timestamp: { type: Date, default: Date.now }
});
const Notification = mongoose.model('Notification', notificationSchema);

// 2. Connect to RabbitMQ & Listen for Payment Events
async function connectRabbitMQ() {
    try {
        const connection = await amqp.connect(RABBITMQ_URL);
        const channel = await connection.createChannel();
        
        await channel.assertQueue('payment_events');

        logger.info('Connected to RabbitMQ - Listening for final payment events...');

        channel.consume('payment_events', async (msg) => {
            if (msg !== null) {
                const event = JSON.parse(msg.content.toString());
                
                let emailMessage = '';
                if (event.eventType === 'PaymentSuccess') {
                    emailMessage = `Your order ${event.orderId} has been successfully processed!`;
                } else if (event.eventType === 'PaymentFailed') {
                    emailMessage = `Action Required: Payment failed for your order ${event.orderId}.`;
                }

                if (emailMessage) {
                    logger.info(`\n[📧] SIMULATING EMAIL SEND...`);
                    logger.info(`To: customer@example.com`);
                    logger.info(`Subject: Update on Order ${event.orderId}`);
                    logger.info(`Body: ${emailMessage}`);
                    logger.info(`Correlation ID: ${event.correlationId}`);

                    // 3. Save Notification to Database using Native Mongoose ID
                    const newLog = new Notification({
                        notificationId: new mongoose.Types.ObjectId().toString(),
                        orderId: event.orderId,
                        message: emailMessage
                    });
                    await newLog.save();
                    logger.info(`[✔] Notification logged to database.`);
                }
                
                channel.ack(msg);
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
        service: 'Notification Service', 
        timestamp: new Date() 
    });
});
app.listen(PORT, async () => {
    logger.info(`Notification Service running on port ${PORT}`);
    await connectRabbitMQ();
});