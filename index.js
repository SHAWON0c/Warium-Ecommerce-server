const express = require('express');
const app = express();
require('dotenv').config();
const cors = require('cors');
const jwt = require('jsonwebtoken');

// middleware 
app.use(cors());
app.use(express.json());

// Declare a port (you can change 5000 to any available port)
const port = process.env.PORT || 5000;



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

     //JWT realted api 

     app.post('/jwt',async(req,res)=>{
      const user=req.body;
      const token = jwt.sign(user,process.env.ACCESS_TOKEN_SECRATE,
        {
          expiresIn:'1hr'
        }
      );
      res.send({token});

     })




    //products collection

    app.get('/products', async (req, res) => {
      const result = await ProductCollection.find().toArray();
      res.send(result);
    })

    //carts collection

    app.post('/carts', async (req, res) => {
      const cartItem = req.body;
      const result = await cartsCollection.insertOne(cartItem);
      res.send(result);

    })

    app.get('/carts', async (req, res) => {
      const email= req.query.email;
      const query={email:email};
      const result = await cartsCollection.find(query).toArray();
      res.send(result);
    });

    app.delete('/carts/:id',async (req,res)=>{
      const id=req.params.id;
      const query={_id:new ObjectId(id)};
      const result=await cartsCollection.deleteOne(query);
      res.send(result);


    })

    //middlewares
    const verifyToken = (req, res , next)=>{
       console.log('inside verify token',req.headers.authorization);

       if(!req.headers.authorization)
       {
        return res.status(401).send({message: 'forbiden'});
       }
       const token = req.headers.authorization.split(' ')[1];
      //  if(!token)
      //  {
      //   return res.status(401).send({message: 'forbiden'});
      //  }

      jwt.verify(token,process.env.ACCESS_TOKEN_SECRATE,(err, decoded)=>{
        if (err){
          return   res.status(401).send({message: ' token invailid'});
        }
        req.decoded=decoded;
           next();
      });


    

    }

    //user realted API
 app.post('/users',  async (req, res) => {
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

app.get('/users', verifyToken,async(req,res)=>{
 
  const result= await userCollection.find().toArray();
  res.send(result);

})

//dashboard related API

app.delete('/users/:id',async(req,res)=>{
  const id = req.params.id;
  const query ={_id: new ObjectId(id)}
  const result= await userCollection.deleteOne(query);
  res.send(result);

})

app.patch('/users/admin/:id', async (req, res) => {
  const id = req.params.id;
  const filter = { _id: new ObjectId(id) };
  const updatedDoc = {
    $set: {
      role: 'admin',
    },
  };

  const result = await userCollection.updateOne(filter, updatedDoc);
  res.send(result);
});







    await client.db("admin").command({ ping: 1 });
    console.log("Pinged your deployment. You successfully connected to MongoDB!");
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
  console.log(`Server is running on port ${port}`);
});
