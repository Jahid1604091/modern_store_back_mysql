const express = require('express');
const dotenv = require('dotenv');
const cors = require('cors');
const rateLimit = require('express-rate-limit');
const { sequelize } = require('./config/db.js');
const { errHandler, notFound } = require('./middleware/errorHandler.js');
const productRoutes = require('./routes/productRoutes.js');
const userRoutes = require('./routes/userRoutes.js');
const orderRoutes = require('./routes/orderRoutes.js');
const paymentRoutes = require('./routes/paymentRoutes.js');
const categoryRoutes = require('./routes/categoryRoutes.js');
const companyRoutes = require('./routes/companyRoutes.js');
const authRoutes = require('./routes/authRoutes.js');
const subscriptionRequestRoutes = require('./routes/subscriptionRequestRoutes.js');
const path = require('path');


dotenv.config();
const PORT = process.env.PORT || 5000;
const app = express();

try {
  sequelize.authenticate();
  console.log('MySQL connected...');
} catch (error) {
  console.error('Unable to connect to the database:', error);
  process.exit(1);
}

const allowedOrigins = process.env.ALLOWED_ORIGINS
  ? process.env.ALLOWED_ORIGINS.split(',').map(o => o.trim())
  : ['http://localhost:5173', 'http://localhost:3000', 'http://localhost:3005'];

app.use(cors({
  credentials: true,
  origin: (origin, callback) => {
    if (!origin || allowedOrigins.includes(origin)) return callback(null, true);
    callback(new Error(`CORS: origin ${origin} not allowed`));
  },
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'],
  allowedHeaders: ['Content-Type', 'Authorization'],
}));

// Global rate limit: 200 req / 15 min per IP
app.use(rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 200,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, message: 'Too many requests, please try again later.' },
}));

// Tighter limit for auth endpoints
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, message: 'Too many auth attempts, please try again later.' },
});


app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use('/api/auth', authLimiter, authRoutes);
app.use('/api/users', userRoutes);
app.use('/invoices', express.static(path.join(__dirname, './invoices')));
app.use('/images', express.static(path.join(__dirname, 'images')));
app.use('/api/products', productRoutes);
app.use('/api/orders', orderRoutes);
app.use('/api/payments', paymentRoutes);
app.use('/api/categories', categoryRoutes);
app.use('/api/companies', companyRoutes);
app.use('/api/subscription-requests', subscriptionRequestRoutes);
// app.use('/api/brands', brandRoutes);

//use for integrated application
// if (process.env.NODE_ENV === 'prod') {
//   app.use(express.static(path.join(__dirname, '../frontend/build'))); // Adjust path here
//   app.get('*', (req, res) => {
//     res.sendFile(path.resolve(__dirname, '../frontend', 'build', 'index.html')); // Adjust path here
//   });
// }

app.get('/', (req, res) => {
  res.send('Server is up...')
});


app.use(notFound);
app.use(errHandler);

app.listen(PORT, () => console.log(`Server running on port ${PORT}`));