const express = require('express');
const mysql = require('mysql2/promise');
const cors = require('cors');
const session = require('express-session');
const bcrypt = require('bcryptjs');
const crypto = require('crypto');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 5000;

// Allow React to communicate with Express
app.use(cors({
    origin: 'http://localhost:5173',
    credentials: true
}));

app.use(express.json());

// Login session settings
app.use(session({
    secret: process.env.SESSION_SECRET,
    resave: false,
    saveUninitialized: false,
    cookie: {
        httpOnly: true,
        secure: false,
        sameSite: 'lax'
    }
}));

// Connect to MySQL
const db = mysql.createPool({
    host: process.env.DB_HOST,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
    waitForConnections: true,
    connectionLimit: 10
});

// Test route
app.get('/api/health', (req, res) => {
    res.json({
        message: 'GiftWish server is running!'
    });
});

// Register a new account
app.post('/api/register', async (req, res) => {
    try {
        const { name, email, password } = req.body;

        if (!name || !email || !password) {
            return res.status(400).json({
                message: 'Please fill in all fields.'
            });
        }

        if (password.length < 6) {
            return res.status(400).json({
                message: 'Password must be at least 6 characters.'
            });
        }

        const hashedPassword = await bcrypt.hash(password, 10);

        await db.execute(
            'INSERT INTO users (name, email, password_hash) VALUES (?, ?, ?)',
            [name.trim(), email.trim().toLowerCase(), hashedPassword]
        );

        res.status(201).json({
            message: 'Account created successfully!'
        });

    } catch (error) {
        if (error.code === 'ER_DUP_ENTRY') {
            return res.status(409).json({
                message: 'That email is already registered.'
            });
        }

        console.error(error);
        res.status(500).json({
            message: 'Something went wrong during registration.'
        });
    }
});

// Login
app.post('/api/login', async (req, res) => {
    try {
        const { email, password } = req.body;

        if (!email || !password) {
            return res.status(400).json({
                message: 'Please enter your email and password.'
            });
        }

        const [users] = await db.execute(
            'SELECT * FROM users WHERE email = ?',
            [email.trim().toLowerCase()]
        );

        if (users.length === 0) {
            return res.status(401).json({
                message: 'Invalid email or password.'
            });
        }

        const user = users[0];

        const passwordMatch = await bcrypt.compare(
            password,
            user.password_hash
        );

        if (!passwordMatch) {
            return res.status(401).json({
                message: 'Invalid email or password.'
            });
        }

        req.session.user = {
            user_id: user.user_id,
            name: user.name,
            email: user.email
        };

        res.json({
            message: 'Login successful!',
            user: req.session.user
        });

    } catch (error) {
        console.error(error);
        res.status(500).json({
            message: 'Something went wrong during login.'
        });
    }
});

// Check if a user is logged in
app.get('/api/me', (req, res) => {
    if (!req.session.user) {
        return res.status(401).json({
            message: 'You are not logged in.'
        });
    }

    res.json({
        user: req.session.user
    });
});

// Logout
app.post('/api/logout', (req, res) => {
    req.session.destroy((error) => {
        if (error) {
            return res.status(500).json({
                message: 'Could not log out.'
            });
        }

        res.clearCookie('connect.sid');

        res.json({
            message: 'Logged out successfully!'
        });
    });
});
// Create a new gift exchange
app.post('/api/exchanges', async (req, res) => {
    try {
        // Check if the user is logged in
        if (!req.session.user) {
            return res.status(401).json({
                message: 'Please log in first.'
            });
        }

        const { event_name, event_date, gift_budget } = req.body;

        if (!event_name || !event_name.trim()) {
            return res.status(400).json({
                message: 'Please enter an event name.'
            });
        }

        if (gift_budget !== null && gift_budget !== undefined &&
            (gift_budget === '' || !Number.isFinite(Number(gift_budget)) ||
            Number(gift_budget) < 0)) {
            return res.status(400).json({
                message: 'Please enter a valid gift budget.'
            });
        }

        // Generate a random invitation code
        const inviteCode = crypto.randomBytes(4).toString('hex').toUpperCase();

        // Save the exchange in MySQL
        const [result] = await db.execute(
            `INSERT INTO exchanges
            (organizer_id, event_name, invite_code, event_date, gift_budget)
            VALUES (?, ?, ?, ?, ?)`,
            [
                req.session.user.user_id,
                event_name.trim(),
                inviteCode,
                event_date || null,
                gift_budget === '' || gift_budget === undefined
                    ? null
                    : gift_budget
            ]
        );

        res.status(201).json({
            message: 'Gift exchange created successfully!',
            exchange: {
                exchange_id: result.insertId,
                event_name: event_name.trim(),
                invite_code: inviteCode,
                event_date: event_date || null,
                gift_budget: gift_budget || null
            }
        });

    } catch (error) {
        console.error(error);

        res.status(500).json({
            message: 'Could not create the gift exchange.'
        });
    }
});
// Join an existing gift exchange
app.post('/api/exchanges/join', async (req, res) => {
    try {
        // Check if the user is logged in
        if (!req.session.user) {
            return res.status(401).json({
                message: 'Please log in first.'
            });
        }

        const { invite_code } = req.body;

        if (!invite_code || !invite_code.trim()) {
            return res.status(400).json({
                message: 'Please enter an invitation code.'
            });
        }

        // Find the exchange using its invitation code
        const [exchanges] = await db.execute(
            'SELECT * FROM exchanges WHERE invite_code = ?',
            [invite_code.trim().toUpperCase()]
        );

        if (exchanges.length === 0) {
            return res.status(404).json({
                message: 'Invalid invitation code.'
            });
        }

        const exchange = exchanges[0];

        if (exchange.status !== 'open') {
            return res.status(400).json({
                message: 'This exchange is no longer accepting participants.'
            });
        }

        // Add the logged-in user as a participant
        await db.execute(
            'INSERT INTO participants (exchange_id, user_id) VALUES (?, ?)',
            [exchange.exchange_id, req.session.user.user_id]
        );

        res.status(201).json({
            message: 'You joined the gift exchange successfully!',
            event_name: exchange.event_name
        });

    } catch (error) {
        if (error.code === 'ER_DUP_ENTRY') {
            return res.status(409).json({
                message: 'You already joined this exchange.'
            });
        }

        console.error(error);
        res.status(500).json({
            message: 'Could not join the gift exchange.'
        });
    }
});
// View participants in an exchange
app.get('/api/exchanges/:id/participants', async (req, res) => {
    try {
        if (!req.session.user) {
            return res.status(401).json({
                message: 'Please log in first.'
            });
        }

        const exchangeId = req.params.id;
        const userId = req.session.user.user_id;

        // Check if the user is the organizer
        const [exchanges] = await db.execute(
            'SELECT * FROM exchanges WHERE exchange_id = ?',
            [exchangeId]
        );

        if (exchanges.length === 0) {
            return res.status(404).json({
                message: 'Exchange not found.'
            });
        }

        const isOrganizer =
            Number(exchanges[0].organizer_id) === Number(userId);

        // Check if the user is a participant
        const [membership] = await db.execute(
            'SELECT participant_id FROM participants WHERE exchange_id = ? AND user_id = ?',
            [exchangeId, userId]
        );

        if (!isOrganizer && membership.length === 0) {
            return res.status(403).json({
                message: 'You are not part of this exchange.'
            });
        }

        // Get the participants
        const [participants] = await db.execute(
            `SELECT users.user_id, users.name, users.email
             FROM participants
             JOIN users ON participants.user_id = users.user_id
             WHERE participants.exchange_id = ?`,
            [exchangeId]
        );

        res.json({
            event_name: exchanges[0].event_name,
            participants: participants
        });

    } catch (error) {
        console.error(error);
        res.status(500).json({
            message: 'Could not load participants.'
        });
    }
});
// Add an item to the user's wishlist
app.post('/api/wishlist', async (req, res) => {
    try {
        if (!req.session.user) {
            return res.status(401).json({
                message: 'Please log in first.'
            });
        }

        const { exchange_id, item_name, description } = req.body;

        if (!exchange_id || !item_name || !item_name.trim()) {
            return res.status(400).json({
                message: 'Please enter a gift name.'
            });
        }

        // Check if the user joined this exchange
        const [participants] = await db.execute(
            `SELECT participant_id
             FROM participants
             WHERE exchange_id = ? AND user_id = ?`,
            [exchange_id, req.session.user.user_id]
        );

        if (participants.length === 0) {
            return res.status(403).json({
                message: 'You must join this exchange first.'
            });
        }

        // Save the wishlist item
        await db.execute(
            `INSERT INTO wishlist_items
             (participant_id, item_name, description)
             VALUES (?, ?, ?)`,
            [
                participants[0].participant_id,
                item_name.trim(),
                description ? description.trim() : null
            ]
        );

        res.status(201).json({
            message: 'Wishlist item added successfully!'
        });

    } catch (error) {
        console.error(error);
        res.status(500).json({
            message: 'Could not add wishlist item.'
        });
    }
});
// View the user's wishlist
app.get('/api/wishlist/:exchangeId', async (req, res) => {
    try {
        if (!req.session.user) {
            return res.status(401).json({
                message: 'Please log in first.'
            });
        }

        const exchangeId = req.params.exchangeId;

        // Check if the user joined this exchange
        const [participants] = await db.execute(
            `SELECT participant_id
             FROM participants
             WHERE exchange_id = ? AND user_id = ?`,
            [exchangeId, req.session.user.user_id]
        );

        if (participants.length === 0) {
            return res.status(403).json({
                message: 'You must join this exchange first.'
            });
        }

        // Get the user's wishlist
        const [items] = await db.execute(
            `SELECT item_id, item_name, description
             FROM wishlist_items
             WHERE participant_id = ?`,
            [participants[0].participant_id]
        );

        res.json({ wishlist: items });

    } catch (error) {
        console.error(error);
        res.status(500).json({
            message: 'Could not load wishlist.'
        });
    }
});
// Edit a wishlist item
app.put('/api/wishlist/:itemId', async (req, res) => {
    try {
        if (!req.session.user) {
            return res.status(401).json({
                message: 'Please log in first.'
            });
        }

        const { item_name, description } = req.body;
        const itemId = req.params.itemId;

        if (!item_name || !item_name.trim()) {
            return res.status(400).json({
                message: 'Please enter a gift name.'
            });
        }

        // Make sure the item belongs to the logged-in user
        const [items] = await db.execute(
            `SELECT wishlist_items.item_id
             FROM wishlist_items
             JOIN participants
             ON wishlist_items.participant_id = participants.participant_id
             WHERE wishlist_items.item_id = ? AND participants.user_id = ?`,
            [itemId, req.session.user.user_id]
        );

        if (items.length === 0) {
            return res.status(404).json({
                message: 'Wishlist item not found.'
            });
        }

        await db.execute(
            `UPDATE wishlist_items
             SET item_name = ?, description = ?
             WHERE item_id = ?`,
            [
                item_name.trim(),
                description ? description.trim() : null,
                itemId
            ]
        );

        res.json({
            message: 'Wishlist item updated successfully!'
        });

    } catch (error) {
        console.error(error);
        res.status(500).json({
            message: 'Could not update wishlist item.'
        });
    }
});
// Delete a wishlist item
app.delete('/api/wishlist/:itemId', async (req, res) => {
    try {
        if (!req.session.user) {
            return res.status(401).json({
                message: 'Please log in first.'
            });
        }

        const itemId = req.params.itemId;

        // Check if the item belongs to the logged-in user
        const [items] = await db.execute(
            `SELECT wishlist_items.item_id
             FROM wishlist_items
             JOIN participants
             ON wishlist_items.participant_id = participants.participant_id
             WHERE wishlist_items.item_id = ?
             AND participants.user_id = ?`,
            [itemId, req.session.user.user_id]
        );

        if (items.length === 0) {
            return res.status(404).json({
                message: 'Wishlist item not found.'
            });
        }

        // Delete the wishlist item
        await db.execute(
            'DELETE FROM wishlist_items WHERE item_id = ?',
            [itemId]
        );

        res.json({
            message: 'Wishlist item deleted successfully!'
        });

    } catch (error) {
        console.error(error);
        res.status(500).json({
            message: 'Could not delete wishlist item.'
        });
    }
});
// Start the Secret Santa draw
app.post('/api/exchanges/:id/draw', async (req, res) => {
    const connection = await db.getConnection();

    try {
        if (!req.session.user) {
            return res.status(401).json({
                message: 'Please log in first.'
            });
        }

        await connection.beginTransaction();

        const exchangeId = req.params.id;

        // Check if the logged-in user is the organizer
        const [exchanges] = await connection.execute(
            `SELECT * FROM exchanges
             WHERE exchange_id = ? AND organizer_id = ?`,
            [exchangeId, req.session.user.user_id]
        );

        if (exchanges.length === 0) {
            await connection.rollback();
            return res.status(403).json({
                message: 'Only the organizer can start the draw.'
            });
        }

        if (exchanges[0].status !== 'open') {
            await connection.rollback();
            return res.status(400).json({
                message: 'The draw has already started or completed.'
            });
        }

        // Automatically include the organizer
        await connection.execute(
            `INSERT IGNORE INTO participants (exchange_id, user_id)
             VALUES (?, ?)`,
            [exchangeId, req.session.user.user_id]
        );

        // Get everyone participating
        const [participants] = await connection.execute(
            `SELECT participant_id
             FROM participants
             WHERE exchange_id = ?`,
            [exchangeId]
        );

        if (participants.length < 2) {
            await connection.rollback();
            return res.status(400).json({
                message: 'At least two participants are needed.'
            });
        }

        // Shuffle participants until nobody gets themselves
        let recipients;
        let attempts = 0;

        do {
            recipients = [...participants];

            for (let i = recipients.length - 1; i > 0; i--) {
                const j = crypto.randomInt(i + 1);
                [recipients[i], recipients[j]] =
                    [recipients[j], recipients[i]];
            }

            attempts++;
        } while (
            recipients.some((person, index) =>
                person.participant_id === participants[index].participant_id
            ) && attempts < 1000
        );

        if (recipients.some((person, index) =>
            person.participant_id === participants[index].participant_id
        )) {
            throw new Error('Could not generate valid assignments.');
        }

        // Save all assignments
        for (let i = 0; i < participants.length; i++) {
            await connection.execute(
                `INSERT INTO assignments
                 (exchange_id, giver_participant_id, recipient_participant_id)
                 VALUES (?, ?, ?)`,
                [
                    exchangeId,
                    participants[i].participant_id,
                    recipients[i].participant_id
                ]
            );
        }

        // Update exchange status
        await connection.execute(
            `UPDATE exchanges SET status = 'assigned'
             WHERE exchange_id = ?`,
            [exchangeId]
        );

        await connection.commit();

        res.json({
            message: 'Secret Santa draw completed successfully!'
        });

    } catch (error) {
        await connection.rollback();
        console.error(error);

        res.status(500).json({
            message: 'Could not complete the Secret Santa draw.'
        });

    } finally {
        connection.release();
    }
});
// View my Secret Santa recipient
app.get('/api/exchanges/:id/my-recipient', async (req, res) => {
    try {
        if (!req.session.user) {
            return res.status(401).json({
                message: 'Please log in first.'
            });
        }

        const exchangeId = req.params.id;

        // Find the logged-in user's participant record
        const [participants] = await db.execute(
            `SELECT participant_id
             FROM participants
             WHERE exchange_id = ? AND user_id = ?`,
            [exchangeId, req.session.user.user_id]
        );

        if (participants.length === 0) {
            return res.status(403).json({
                message: 'You are not part of this exchange.'
            });
        }

        // Check if the draw has started
        const [exchanges] = await db.execute(
            `SELECT status FROM exchanges
             WHERE exchange_id = ?`,
            [exchangeId]
        );

        if (exchanges.length === 0 ||
            exchanges[0].status === 'open') {
            return res.status(400).json({
                message: 'The Secret Santa draw has not started yet.'
            });
        }

        // Find only this user's assigned recipient
        const [assignments] = await db.execute(
            `SELECT users.name, participants.participant_id
             FROM assignments
             JOIN participants
             ON assignments.recipient_participant_id =
                participants.participant_id
             JOIN users
             ON participants.user_id = users.user_id
             WHERE assignments.exchange_id = ?
             AND assignments.giver_participant_id = ?`,
            [exchangeId, participants[0].participant_id]
        );

        if (assignments.length === 0) {
            return res.status(404).json({
                message: 'No recipient assignment found.'
            });
        }

        // Get the recipient's wishlist
        const [wishlist] = await db.execute(
            `SELECT item_name, description
             FROM wishlist_items
             WHERE participant_id = ?`,
            [assignments[0].participant_id]
        );

        res.json({
            recipient_name: assignments[0].name,
            wishlist: wishlist
        });

    } catch (error) {
        console.error(error);
        res.status(500).json({
            message: 'Could not load your recipient.'
        });
    }
});
// Mark a gift exchange as completed
app.put('/api/exchanges/:id/complete', async (req, res) => {
    try {
        if (!req.session.user) {
            return res.status(401).json({
                message: 'Please log in first.'
            });
        }

        const exchangeId = req.params.id;

        // Check if the user is the organizer
        const [exchanges] = await db.execute(
            `SELECT status FROM exchanges
             WHERE exchange_id = ? AND organizer_id = ?`,
            [exchangeId, req.session.user.user_id]
        );

        if (exchanges.length === 0) {
            return res.status(403).json({
                message: 'Only the organizer can complete this exchange.'
            });
        }

        if (exchanges[0].status !== 'assigned') {
            return res.status(400).json({
                message: 'This exchange is not ready to be completed.'
            });
        }

        await db.execute(
            `UPDATE exchanges
             SET status = 'completed'
             WHERE exchange_id = ?`,
            [exchangeId]
        );

        res.json({
            message: 'Gift exchange completed successfully!'
        });

    } catch (error) {
        console.error(error);
        res.status(500).json({
            message: 'Could not complete the exchange.'
        });
    }
});
// Reveal the user's Secret Santa
app.get('/api/exchanges/:id/my-secret-santa', async (req, res) => {
    try {
        if (!req.session.user) {
            return res.status(401).json({
                message: 'Please log in first.'
            });
        }

        const exchangeId = req.params.id;

        // Check if the user is a participant
        const [participants] = await db.execute(
            `SELECT participant_id
             FROM participants
             WHERE exchange_id = ? AND user_id = ?`,
            [exchangeId, req.session.user.user_id]
        );

        if (participants.length === 0) {
            return res.status(403).json({
                message: 'You are not part of this exchange.'
            });
        }

        // Check if the exchange is completed
        const [exchanges] = await db.execute(
            `SELECT status FROM exchanges
             WHERE exchange_id = ?`,
            [exchangeId]
        );

        if (exchanges.length === 0 ||
            exchanges[0].status !== 'completed') {
            return res.status(403).json({
                message: 'Your Secret Santa will be revealed after the exchange is completed.'
            });
        }

        // Find only this user's Secret Santa
        const [givers] = await db.execute(
            `SELECT users.name
             FROM assignments
             JOIN participants
             ON assignments.giver_participant_id =
                participants.participant_id
             JOIN users
             ON participants.user_id = users.user_id
             WHERE assignments.exchange_id = ?
             AND assignments.recipient_participant_id = ?`,
            [exchangeId, participants[0].participant_id]
        );

        if (givers.length === 0) {
            return res.status(404).json({
                message: 'No Secret Santa assignment found.'
            });
        }

        res.json({
            message: 'Your Secret Santa has been revealed!',
            secret_santa: givers[0].name
        });

    } catch (error) {
        console.error(error);
        res.status(500).json({
            message: 'Could not reveal your Secret Santa.'
        });
    }
});
// Get exchanges belonging to the logged-in user

app.get('/api/exchanges', async (req, res) => {
    try {
        if (!req.session.user) {
            return res.status(401).json({
                message: 'Please log in first.'
            });
        }

        const [exchanges] = await db.execute(
            `SELECT
                exchanges.exchange_id,
                exchanges.event_name,
                exchanges.invite_code,
                exchanges.event_date,
                exchanges.gift_budget,
                exchanges.status,
                exchanges.organizer_id,
                users.name AS organizer_name,
                COUNT(DISTINCT participants.user_id) AS participant_count
             FROM exchanges
             JOIN users
                ON exchanges.organizer_id = users.user_id
             LEFT JOIN participants
                ON exchanges.exchange_id = participants.exchange_id
             WHERE exchanges.organizer_id = ?
                OR participants.user_id = ?
             GROUP BY exchanges.exchange_id
             ORDER BY exchanges.created_at DESC`,
            [
                req.session.user.user_id,
                req.session.user.user_id
            ]
        );

        res.json({ exchanges });

    } catch (error) {
        console.error(error);
        res.status(500).json({
            message: 'Could not load your exchanges.'
        });
    }
}); 

// Start server and check database
async function startServer() {
    try {
        const connection = await db.getConnection();

        console.log('MySQL connected successfully!');

        connection.release();
// Disband an exchange
app.delete('/api/exchanges/:id', async (req, res) => {
    let connection;

    try {
        if (!req.session.user) {
            return res.status(401).json({
                message: 'Please log in first.'
            });
        }

        connection = await db.getConnection();
        await connection.beginTransaction();

        const exchangeId = req.params.id;
        const userId = req.session.user.user_id;

        // Find the exchange and lock it while checking
        const [exchanges] = await connection.execute(
            `SELECT organizer_id, status
             FROM exchanges
             WHERE exchange_id = ?
             FOR UPDATE`,
            [exchangeId]
        );

        if (exchanges.length === 0) {
            await connection.rollback();
            return res.status(404).json({
                message: 'Exchange not found.'
            });
        }

        const exchange = exchanges[0];

        // Only the organizer can disband
        if (Number(exchange.organizer_id) !== Number(userId)) {
            await connection.rollback();
            return res.status(403).json({
                message: 'Only the organizer can disband this exchange.'
            });
        }

        // Only open exchanges can be disbanded
        if (exchange.status !== 'open') {
            await connection.rollback();
            return res.status(400).json({
                message: 'This exchange can no longer be disbanded.'
            });
        }

        // Check whether participants are still in the exchange
        const [participants] = await connection.execute(
            `SELECT COUNT(*) AS total
             FROM participants
             WHERE exchange_id = ?`,
            [exchangeId]
        );

        if (participants[0].total > 0) {
            await connection.rollback();
            return res.status(400).json({
                message: 'You can only disband an exchange when you are the only person left.'
            });
        }

        // Delete the exchange
        await connection.execute(
            'DELETE FROM exchanges WHERE exchange_id = ?',
            [exchangeId]
        );

        await connection.commit();

        res.json({
            message: 'Exchange disbanded successfully!'
        });

    } catch (error) {
        if (connection) {
            await connection.rollback();
        }

        console.error(error);

        res.status(500).json({
            message: 'Could not disband the exchange.'
        });

    } finally {
        if (connection) {
            connection.release();
        }
    }
});
        app.listen(PORT, () => {
            console.log(`GiftWish server running on port ${PORT}`);
        });

    } catch (error) {
        console.error('Database connection failed:', error.message);
    }
}

startServer();