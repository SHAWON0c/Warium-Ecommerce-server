// index.js
const express = require('express');
const app = express();
require('dotenv').config();
const cors = require('cors');
const jwt = require('jsonwebtoken');
const multer = require('multer');
const fileUpload = require('express-fileupload');
const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');
const axios = require('axios');
const FormData = require('form-data');

// -------------------- MIDDLEWARE --------------------
app.use(cors({ origin: ["https://warium-792f8.web.app", "http://localhost:3000"] }));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(fileUpload());

// -------------------- PORT --------------------
const PORT = process.env.PORT || 5000;

// -------------------- MONGODB --------------------
const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.i01ualw.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0`;

const client = new MongoClient(uri, {
  serverApi: { version: ServerApiVersion.v1, strict: true, deprecationErrors: true }
});

let ProductCollection, CartsCollection, UserCollection, RoleRequestCollection;

async function connectDB() {
  try {
    await client.connect();
    const db = client.db("WariumDB");
    ProductCollection = db.collection("Products");
    CartsCollection = db.collection("Carts");
    UserCollection = db.collection("Users");
    RoleRequestCollection = db.collection("RoleRquest");
    console.log("✅ MongoDB connected");
  } catch (err) {
    console.error("❌ MongoDB connection error:", err);
  }
}

// -------------------- JWT MIDDLEWARE --------------------
const verifyToken = (req, res, next) => {
  const authHeader = req.headers.authorization;
  if (!authHeader) return res.status(401).send({ message: 'Forbidden' });

  const token = authHeader.split(' ')[1];
  jwt.verify(token, process.env.ACCESS_TOKEN_SECRATE, (err, decoded) => {
    if (err) return res.status(401).send({ message: 'Invalid token' });
    req.decoded = decoded;
    next();
  });
};

const verifyAdmin = async (req, res, next) => {
  try {
    const email = req.decoded?.email;
    if (!email) return res.status(401).send({ message: 'Unauthorized' });

    const user = await UserCollection.findOne({ email });
    if (!user || user.role !== 'admin') return res.status(403).send({ message: 'Admins only' });

    next();
  } catch (err) {
    console.error(err);
    res.status(500).send({ message: 'Server error in admin check' });
  }
};

// -------------------- ROUTES --------------------

// Root test route
app.get('/', (req, res) => res.send("Server is working"));

// JWT generation
app.post('/jwt', (req, res) => {
  const user = req.body;
  const token = jwt.sign(user, process.env.ACCESS_TOKEN_SECRATE, { expiresIn: '1h' });
  res.send({ token });
});

// -------------------- USERS --------------------
app.post('/users', async (req, res) => {
  try {
    const userInfo = req.body;
    const existingUser = await UserCollection.findOne({ email: userInfo.email });
    if (existingUser) return res.status(200).send({ message: 'User already exists' });
    const result = await UserCollection.insertOne(userInfo);
    res.status(201).send(result);
  } catch (err) {
    console.error(err);
    res.status(500).send({ message: 'Server error while saving user' });
  }
});

app.get('/users', async (req, res) => {
  const users = await UserCollection.find().toArray();
  res.send(users);
});

app.get('/users/:email', async (req, res) => {
  const email = req.params.email;
  const user = await UserCollection.findOne({ email });
  if (!user) return res.status(404).send({ message: 'User not found' });
  res.send(user);
});



   // GET all moderators - protected route example
    app.get('/moderators', async (req, res) => {
      try {
        const moderators = await userCollection.find({ role: 'moderator' }).toArray();
        res.send(moderators);
      } catch (error) {
        console.error('Error fetching moderators:', error);
        res.status(500).send({ message: 'Internal server error' });
      }
    });
    //get all the vendors
    app.get('/vendors', async (req, res) => {
      try {
        const moderators = await userCollection.find({ role: 'vendor' }).toArray();
        res.send(moderators);
      } catch (error) {
        console.error('Error fetching moderators:', error);
        res.status(500).send({ message: 'Internal server error' });
      }
    });

    

// Admin check
app.get('/users/admin/:email', verifyToken, async (req, res) => {
  const email = req.params.email;
  if (email !== req.decoded.email) return res.status(403).send({ message: 'Unauthorized' });
  const user = await UserCollection.findOne({ email });
  res.send({ admin: user?.role === 'admin' });
});

// Update roles
app.patch('/users/vendor/:id', async (req, res) => {
  const id = req.params.id;
  const result = await UserCollection.updateOne({ _id: new ObjectId(id) }, { $set: { role: 'vendor' } });
  res.send(result);
});
app.patch('/users/admin/:id', async (req, res) => {
  const id = req.params.id;
  const result = await UserCollection.updateOne({ _id: new ObjectId(id) }, { $set: { role: 'admin' } });
  res.send(result);
});
app.patch('/users/moderator/:id', async (req, res) => {
  const id = req.params.id;
  const result = await UserCollection.updateOne({ _id: new ObjectId(id) }, { $set: { role: 'moderator' } });
  res.send(result);
});

// Delete user
app.delete('/users/:id', async (req, res) => {
  const id = req.params.id;
  const result = await UserCollection.deleteOne({ _id: new ObjectId(id) });
  res.send(result);
});

// -------------------- ROLE REQUESTS --------------------
app.post('/role-requests', async (req, res) => {
  try {
    const result = await RoleRequestCollection.insertOne(req.body);
    res.send(result);
  } catch (err) {
    console.error(err);
    res.status(500).send({ message: 'Internal Server Error' });
  }
});
app.delete('/role-requests/:id', async (req, res) => {
  const id = req.params.id;
  const result = await RoleRequestCollection.deleteOne({ _id: new ObjectId(id) });
  if (result.deletedCount === 1) res.send({ success: true, message: 'Deleted' });
  else res.status(404).send({ success: false, message: 'Not found' });
});
app.get('/requested-users', async (req, res) => {
  const requests = await RoleRequestCollection.find().toArray();
  res.send(requests);
});

// -------------------- PRODUCTS --------------------
const upload = multer();
app.post('/products', upload.none(), async (req, res) => {
  try {
    let productData = { ...req.body };

    // Parse arrays
    ['sizes', 'colors', 'tags'].forEach(field => {
      if (productData[field]) {
        if (typeof productData[field] === "string") {
          try { productData[field] = JSON.parse(productData[field]); }
          catch { productData[field] = productData[field].split(',').map(x => x.trim()); }
        } else if (!Array.isArray(productData[field])) productData[field] = [];
      } else productData[field] = [];
    });

    // Handle images
    const images = [];
    Object.keys(productData).forEach(key => { if (key.startsWith("image")) { images.push(productData[key]); delete productData[key]; } });
    if (productData.images) {
      if (typeof productData.images === "string") {
        try { productData.images = JSON.parse(productData.images); }
        catch { productData.images = [productData.images]; }
      } else if (!Array.isArray(productData.images)) productData.images = [];
    }
    productData.images = [...images, ...(productData.images || [])];

    const result = await ProductCollection.insertOne(productData);
    res.status(201).send(result);
  } catch (err) {
    console.error(err);
    res.status(500).send({ message: err.message });
  }
});

app.get('/products', async (req, res) => {
  const products = await ProductCollection.find().toArray();
  res.send(products);
});

app.get('/products/:id', async (req, res) => {
  try {
    const product = await ProductCollection.findOne({ _id: new ObjectId(req.params.id) });
    if (!product) return res.status(404).send({ message: 'Product not found' });
    res.send(product);
  } catch (err) {
    res.status(500).send({ message: 'Server error', error: err });
  }
});

// -------------------- CARTS --------------------
app.post('/carts', async (req, res) => {
  const result = await CartsCollection.insertOne(req.body);
  res.send(result);
});
app.get('/carts', async (req, res) => {
  const email = req.query.email;
  const carts = await CartsCollection.find({ email }).toArray();
  res.send(carts);
});
app.delete('/carts/:id', async (req, res) => {
  const result = await CartsCollection.deleteOne({ _id: new ObjectId(req.params.id) });
  res.send(result);
});

// -------------------- FILE UPLOAD --------------------
app.post('/upload-image', async (req, res) => {
  try {
    if (!req.files || !req.files.image) return res.status(400).send({ error: "No image uploaded" });
    const image = req.files.image.data;
    const formData = new FormData();
    formData.append("image", image.toString("base64"));
    const response = await axios.post(`https://api.imgbb.com/1/upload?key=${process.env.IMGBB_API_KEY}`, formData, { headers: formData.getHeaders() });
    res.send(response.data);
  } catch (err) {
    console.error(err);
    res.status(500).send({ error: "Upload failed" });
  }
});

// -------------------- START SERVER --------------------
async function startServer() {
  await connectDB();
  app.listen(PORT, () => console.log(`🚀 Server running on port ${PORT}`));
}

startServer();
