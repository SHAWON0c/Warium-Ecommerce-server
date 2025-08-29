const express = require('express');
const app = express();
require('dotenv').config();
const cors = require('cors');
const jwt = require('jsonwebtoken');
const multer = require('multer');
const fileUpload = require("express-fileupload");


// middleware 
// middleware
// app.use(cors({
//   origin: "https://warium-792f8.web.app",
//   methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
//   allowedHeaders: ["Content-Type", "Authorization"] // ✅ allow JWT header
// }));


const allowedOrigins = [
  "https://warium-792f8.web.app", // production
  "http://localhost:5173"          // local dev
];

// CORS middleware
app.use((req, res, next) => {
  const origin = req.headers.origin;
  if (allowedOrigins.includes(origin)) {
    res.setHeader("Access-Control-Allow-Origin", origin);
  }
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
  res.setHeader("Access-Control-Allow-Credentials", "true"); // important if using cookies or auth
  // allow preflight requests
  if (req.method === "OPTIONS") {
    return res.sendStatus(200);
  }
  next();
});


app.use(express.json());
app.use(express.urlencoded({ extended: true }));




// Declare a port (you can change 5000 to any available port)
const port = process.env.PORT || 5000;

const imageHostingKey = process.env.IMAGE_HOSTING_KEY;


const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');
const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.i01ualw.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0`

// Create a MongoClient with a MongoClientOptions object to set the Stable API version
const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  }
});

async function run() {
  try {
    // Connect the client to the server	(optional starting in v4.7)
    await client.connect();
    // Send a ping to confirm a successful connection

    const database = client.db("WariumDB");
    const ProductCollection = database.collection("Products");
    const cartsCollection = database.collection("Carts");
    const userCollection = database.collection("Users");
    const roleRequestCollection = database.collection("RoleRquest");

    //JWT realted api 

    app.post('/jwt', async (req, res) => {
      const user = req.body;
      const token = jwt.sign(user, process.env.ACCESS_TOKEN_SECRATE,
        {
          expiresIn: '1hr'
        }
      );
      res.send({ token });

    })


    //file upload 
    app.post("/upload-image", async (req, res) => {
      try {
        if (!req.files || !req.files.image) {
          return res.status(400).json({ error: "No image file uploaded" });
        }

        const image = req.files.image.data;
        const formData = new FormData();
        formData.append("image", image.toString("base64"));

        const response = await axios.post(
          `https://api.imgbb.com/1/upload?key=${process.env.IMGBB_API_KEY}`,
          formData,
          { headers: formData.getHeaders() }
        );

        res.json(response.data);
      } catch (err) {
        console.error("Image upload failed:", err);
        res.status(500).json({ error: "Upload failed" });
      }
    });



    // Role request collection
    app.post('/role-requests', async (req, res) => {
      const userInfo = req.body; // use lowercase consistently
      try {
        const result = await roleRequestCollection.insertOne(userInfo);
        res.send(result);
      } catch (error) {
        console.error('Error inserting role request:', error);
        res.status(500).send({ message: 'Internal Server Error' });
      }
    });

    app.delete('/role-requests/:id', async (req, res) => {
      const id = req.params.id;

      try {
        const result = await roleRequestCollection.deleteOne({ _id: new ObjectId(id) });

        if (result.deletedCount === 1) {
          res.send({ success: true, message: 'Role request deleted successfully.' });
        } else {
          res.status(404).send({ success: false, message: 'Role request not found.' });
        }
      } catch (error) {
        console.error('Error deleting role request:', error);
        res.status(500).send({ message: 'Internal Server Error' });
      }
    });




    //products collection
    const upload = multer(); // for non-file form data

    app.post('/products', upload.none(), async (req, res) => {
      try {
        const productData = { ...req.body };

        // -----------------------------
        // Ensure sizes is an array
        // -----------------------------
        if (productData.sizes) {
          if (typeof productData.sizes === "string") {
            try {
              // Try parsing as JSON (frontend might send stringified JSON)
              productData.sizes = JSON.parse(productData.sizes);
            } catch {
              // Otherwise, assume comma-separated string
              productData.sizes = productData.sizes.split(",").map(s => s.trim());
            }
          } else if (!Array.isArray(productData.sizes)) {
            productData.sizes = [];
          }
        } else {
          productData.sizes = [];
        }

        // -----------------------------
        // Ensure colors is an array
        // -----------------------------
        if (productData.colors) {
          if (typeof productData.colors === "string") {
            try {
              productData.colors = JSON.parse(productData.colors);
            } catch {
              productData.colors = productData.colors.split(",").map(c => c.trim());
            }
          } else if (!Array.isArray(productData.colors)) {
            productData.colors = [];
          }
        } else {
          productData.colors = [];
        }

        // -----------------------------
        // Ensure tags is an array
        // -----------------------------
        if (productData.tags) {
          if (typeof productData.tags === "string") {
            productData.tags = productData.tags.split(",").map(t => t.trim());
          } else if (!Array.isArray(productData.tags)) {
            productData.tags = [];
          }
        } else {
          productData.tags = [];
        }

        // -----------------------------
        // Collect images
        // -----------------------------
        const images = [];
        Object.keys(productData).forEach((key) => {
          if (key.startsWith("image")) {
            images.push(productData[key]);
            delete productData[key]; // remove individual image fields
          }
        });
        if (productData.images) {
          if (typeof productData.images === "string") {
            try {
              productData.images = JSON.parse(productData.images);
            } catch {
              productData.images = [productData.images];
            }
          } else if (!Array.isArray(productData.images)) {
            productData.images = [];
          }
        }
        productData.images = [...images, ...(productData.images || [])];

        // -----------------------------
        // Insert into MongoDB
        // -----------------------------
        const result = await ProductCollection.insertOne(productData);
        res.status(201).send(result);
      } catch (error) {
        console.error("❌ Backend error:", error);
        res.status(500).send({ success: false, message: error.message });
      }
    });






    app.get('/products', async (req, res) => {
      res.setHeader("Access-Control-Allow-Origin", "https://warium-792f8.web.app");
      res.setHeader("Access-Control-Allow-Methods", "GET,POST,PUT,DELETE,OPTIONS");
      res.setHeader("Access-Control-Allow-Headers", "Content-Type,Authorization");
      const result = await ProductCollection.find().toArray();
      res.send(result);
    })


    app.get("/api/products/:id", async (req, res) => {
      try {
        const product = await ProductCollection.findById(req.params.id);
        if (!product) return res.status(404).json({ message: "Product not found" });
        res.json(product);
      } catch (err) {
        res.status(500).json({ message: "Server error", error: err });
      }
    });



    //carts collection

    app.post('/carts', async (req, res) => {
      const cartItem = req.body;
      const result = await cartsCollection.insertOne(cartItem);
      res.send(result);

    })

    app.get('/carts', async (req, res) => {
      const email = req.query.email;
      const query = { email: email };
      const result = await cartsCollection.find(query).toArray();
      res.send(result);
    });

    app.delete('/carts/:id', async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) };
      const result = await cartsCollection.deleteOne(query);
      res.send(result);


    })

    //middlewares
    const verifyToken = (req, res, next) => {
      //('inside verify token', req.headers.authorization);

      if (!req.headers.authorization) {
        return res.status(401).send({ message: 'forbiden' });
      }
      const token = req.headers.authorization.split(' ')[1];
      //  if(!token)
      //  {
      //   return res.status(401).send({message: 'forbiden'});
      //  }

      jwt.verify(token, process.env.ACCESS_TOKEN_SECRATE, (err, decoded) => {
        if (err) {
          return res.status(401).send({ message: ' token invailid' });
        }
        req.decoded = decoded;
        next();
      });

    };

    const verifyAdmin = async (req, res, next) => {
      try {
        //('Decoded token:', req.decoded);
        const email = req.decoded?.email;
        if (!email) {
          return res.status(401).send({ message: 'Unauthorized: No email in token' });
        }

        const user = await userCollection.findOne({ email });
        //('User found:', user);

        if (!user || user.role !== 'admin') {
          return res.status(403).send({ message: 'Forbidden access: Admins only' });
        }

        next();
      } catch (error) {
        console.error('Error in verifyAdmin:', error);
        res.status(500).send({ message: 'Internal server error in admin check' });
      }
    };

    //user realted API
    app.post('/users', async (req, res) => {
      try {
        const userInfo = req.body;

        const query = { email: userInfo.email };
        const existingUser = await userCollection.findOne(query);

        if (existingUser) {
          return res.status(200).send({ message: 'User already exists' });
        }

        const result = await userCollection.insertOne(userInfo);
        res.status(201).send(result); // 201 for "created"
      } catch (error) {
        console.error('Error inserting user:', error);
        res.status(500).send({ message: 'Server error while saving user' });
      }
    });

    app.get('/users',  async (req, res) => {

      const result = await userCollection.find().toArray();
      res.send(result);

    })


    //get user via email
    app.get('/users/:email', async (req, res) => {
      const email = req.params.email;

      try {
        const user = await userCollection.findOne({ email });

        if (!user) {
          return res.status(404).send({ message: 'User not found' });
        }

        res.send(user);
      } catch (error) {
        console.error('Error fetching user:', error);
        res.status(500).send({ message: 'Internal server error' });
      }
    });
    app.get('/requested-users', async (req, res) => {

      const result = await roleRequestCollection.find().toArray();
      res.send(result);

    })



    //dashboard related API

    app.delete('/users/:id', async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) }
      const result = await userCollection.deleteOne(query);
      res.send(result);

    })

    app.get('/users/admin/:email', async (req, res) => {
      const email = req.params.email;
      if (email !== req.decoded.email) {
        return res.status(403).send({ message: 'unothorized access' })
      }
      const query = { email: email };
      const user = await userCollection.findOne(query);
      let admin = false
      if (user) {
        admin = user.role === 'admin';

      }
      res.send({ admin });

    })

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


    ////////////////////
    app.patch('/users/vendor/:id', async (req, res) => {
      const id = req.params.id;
      ("Vendor route hit:", req.params.id);
      const filter = { _id: new ObjectId(id) };
      const updatedDoc = {
        $set: {
          role: 'vendor',
        },
      };
      const result = await userCollection.updateOne(filter, updatedDoc);
      res.send(result);
    });




    /////////////////////////////////////////////

    app.patch('/users/admin/:id', async (req, res) => {
      const id = req.params.id;
      ("Vendor route hit:", req.params.id);
      const filter = { _id: new ObjectId(id) };
      const updatedDoc = {
        $set: {
          role: 'admin',
        },
      };

      const result = await userCollection.updateOne(filter, updatedDoc);
      res.send(result);
    });
    ///////////////////////////////////////////////////////////////////////////////////////////
    app.patch('/users/moderator/:id', async (req, res) => {
      const id = req.params.id;
      const filter = { _id: new ObjectId(id) };
      const updatedDoc = {
        $set: {
          role: 'moderator',
        },
      };

      const result = await userCollection.updateOne(filter, updatedDoc);
      res.send(result);
    });


    await client.db("admin").command({ ping: 1 });
    //("Pinged your deployment. You successfully connected to MongoDB!");
  } finally {
    // Ensures that the client will close when you finish/error
    // await client.close();
  }
}
run().catch(console.dir);

app.get('/', (req, res) => {
  res.send('Server is working');
});

app.listen(port, () => {
  //(`Server is running on port ${port}`);
});
