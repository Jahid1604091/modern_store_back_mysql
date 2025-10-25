const express = require('express');
const dotenv = require('dotenv');
const cors = require('cors');
const { sequelize } = require('./config/db.js');
const { errHandler, notFound } = require('./middleware/errorHandler.js');
const productRoutes = require('./routes/productRoutes.js');
const userRoutes = require('./routes/userRoutes.js');
const orderRoutes = require('./routes/orderRoutes.js');
// const paymentRoutes = require('./routes/paymentRoutes.js');
const categoryRoutes = require('./routes/categoryRoutes.js');
// const brandRoutes = require('./routes/brandRoutes.js');
const path = require('path');


dotenv.config();
const PORT = process.env.PORT || 5000;
const app = express();
// connectDB();

try {
  sequelize.authenticate();
  console.log('MySQL connected...');
} catch (error) {
  console.error('Unable to connect to the database:', error);
  process.exit(1);
}

app.use(cors({
  // credentials: true,
  // origin: [process.env.DEV_DOMAIN, process.env.LIVE_DOMAIN, process.env.DEV_ADMIN, process.env.LIVE_ADMIN],
  origin: "*",
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'],
  allowedHeaders: ['Content-Type', '*'],
}));


app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use('/api/users', userRoutes);
app.use('/invoices', express.static(path.join(__dirname, './invoices')));
app.use('/images', express.static(path.join(__dirname, 'images')));
app.use('/api/products', productRoutes);
app.use('/api/orders', orderRoutes);
// app.use('/api/payments', paymentRoutes);
app.use('/api/categories', categoryRoutes);
// app.use('/api/brands', brandRoutes);

//use for integrated application
// if (process.env.NODE_ENV === 'prod') {
//   app.use(express.static(path.join(__dirname, '../frontend/build'))); // Adjust path here
//   app.get('*', (req, res) => {
//     res.sendFile(path.resolve(__dirname, '../frontend', 'build', 'index.html')); // Adjust path here
//   });
// }

app.get('', (req, res) => {
  res.send('Server is up...')
});


app.use(notFound);
app.use(errHandler);

app.listen(PORT, () => console.log(`Server running on port ${PORT}`));