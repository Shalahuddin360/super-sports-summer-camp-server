const express = require('express');
const app = express();
const cors = require('cors');
const jwt = require('jsonwebtoken');
require('dotenv').config()
const stripe = require('stripe')(process.env.PAYMENT_SECRET_KEY)
const port = process.env.PORT || 5000;

// middleware
// app.use(cors());
const corsConfig = {
    origin: '*',
    credentials: true,
    method: [
        "GET",
        "POST",
        "PUT",
        "PATCH",
        "DELETE",
        "OPTIONS"
    ]
}
app.use(cors(corsConfig));
app.options("", cors(corsConfig))
app.use(express.json());

const verifyJWT = (req, res, next) => {
    const authorization = req.headers.authorization;
    if (!authorization) {
        return res.status(401).send({ error: true, message: 'unauthorized access' });
    }
    const token = authorization.split(' ')[1];
    jwt.verify(token, process.env.ACCESS_TOKEN_SECRET, (err, decoded) => {
        if (err) {
            return res.status(401).send({ error: true, message: 'unauthorized access' })
        }
        req.decoded = decoded;
        next()
    })
}

const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');
const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.pjz0bfk.mongodb.net/?retryWrites=true&w=majority`;

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
        client.connect();
        const usersCollection = client.db("sportDb").collection("users");
        const classCollection = client.db("sportDb").collection("class");
        const selectCollection = client.db("sportDb").collection("select");
        const paymentCollection = client.db("sportDb").collection("payments");

        app.post('/jwt', (req, res) => {
            const user = req.body;
            const token = jwt.sign(user, process.env.ACCESS_TOKEN_SECRET, { expiresIn: '1h' })
            res.send({ token })
        })

        // student related apis 
        app.get('/users', async (req, res) => {
            const result = await usersCollection.find().toArray();
            res.send(result)
        })

        app.post('/users', async (req, res) => {
            const user = req.body;
            console.log(user);
            const query = { email: user.email }
            const existingUser = await usersCollection.findOne(query);
            console.log('existingUser', existingUser);
            if (existingUser) {
                return res.send({ message: 'user already exists' })
            }
            const result = await usersCollection.insertOne(user);
            res.send(result);
        })
        //1.security layer:verifyJWT
        //2.email same
        //3.check admin
        app.get('/users/admin/:email', verifyJWT, async (req, res) => {
            const email = req.params.email;
            if (req.decoded.email !== email) {
                res.send({ admin: false })
            }
            const query = { email: email };
            const user = await usersCollection.findOne(query);
            const result = { admin: user.role === 'admin' };
            res.send(result);
        })
        app.get('/users/instructor/:email', verifyJWT, async (req, res) => {
            const email = req.params.email;
            if (req.decoded.email !== email) {

                res.send({ instructor: false })
            }
            const query = { email: email }
            const user = await usersCollection.findOne(query);
            const result = { instructor: user.role === 'instructor' };
            res.send(result);
        })
        app.patch('/users/admin/:id', async (req, res) => {
            const id = req.params.id;
            const query = { _id: new ObjectId(id) }
            const updateDoc = {
                $set: {
                    role: "admin"
                },
            };
            const result = await usersCollection.updateOne(query, updateDoc);
            res.send(result);
        })

        app.patch('/users/instructor/:id', async (req, res) => {
            const id = req.params.id;
            const query = { _id: new ObjectId(id) }
            const updateDoc = {
                $set: {
                    role: "instructor"
                },
            };
            const result = await usersCollection.updateOne(query, updateDoc);
            res.send(result);
        })

        //class related apis
        app.get('/classes', async (req, res) => {
            const query = {};
            // const query = { numberOfStudents: { $gt: 17 } };
            const options = {
                // sort matched documents in descending order by rating
                sort: { "numberOfStudents": -1 },
                // Include only the `title` and `imdb` fields in the returned document
                // projection: { _id: 0, title: 1, imdb: 1 },
            };
            const result = await classCollection.find(query, options).toArray()
            res.send(result);
        })
        app.post('/classes', async (req, res) => {
            const newClass = req.body;
            const result = await classCollection.insertOne(newClass)
            res.send(result);
        })

        app.patch('/classes/approve/:id',async(req,res)=>{
            const id = req.params.id;
           const query = { _id: new ObjectId(id) }
           console.log(query)
           const updateDoc = {
            $set: {
                status: "approve"
            },
        };
        const result = await usersCollection.updateOne(query, updateDoc);
        res.send(result);
        })

        //deny 
        app.patch('/classes/deny/:id',async(req,res)=>{
            const id = req.params.id;
            console.log(id)
           const query = { _id: new ObjectId(id) }
           const updateDoc = {
            $set: {
                status: "deny"
            },
        };
        const result = await usersCollection.updateOne(query, updateDoc);
        res.send(result);
        })


        //select class collection apis
        app.get('/select', verifyJWT, async (req, res) => {
            const email = req.query.email;
            // console.log(email);
            if (!email) {
                res.send([]);
            }
            const decodedEmail = req.decoded.email;
            if (email !== decodedEmail) {
                return res.status(401).send({ error: true, message: 'forbidden access' })
            }
            const query = { email: email };
            const result = await selectCollection.find(query).toArray();
            res.send(result);
        })

        app.post('/select', async (req, res) => {
            const course = req.body;
            const result = await selectCollection.insertOne(course);
            res.send(result);
        })
        app.delete('/select/:id', async (req, res) => {
            const id = req.params.id;
            const query = { _id: new ObjectId(id) }
            const result = await selectCollection.deleteOne(query);
            res.send(result);
        })
        //create payment intent
        app.post('/create-payment-intent',verifyJWT,async(req,res)=>{
            const {price} = req.body;
            const amount = price *100;
            const paymentIntent = await stripe.paymentIntents.create({
                amount : amount,
                currency : 'usd',
                payment_method_types:['card']
            });
            res.send({
                clientSecret : paymentIntent.client_secret
            })
        })
        app.get('/payments',async(req,res)=>{
            const result = await paymentCollection.find().toArray();
            res.send(result)
        })
        app.post('/payments',async(req,res)=>{
            const payment = req.body;
            const insertResult = await paymentCollection.insertOne(payment);
            const query = {_id:{$in:payment.classesId.map(id=>new ObjectId(id))}}
            const deleteResult = await selectCollection.deleteOne(query)
            res.send({insertResult,deleteResult});
        })
        // Send a ping to confirm a successful connection
        await client.db("admin").command({ ping: 1 });
        console.log("Pinged your deployment. You successfully connected to MongoDB!");
    } finally {
        // Ensures that the client will close when you finish/error
        // await client.close();
    }
}
run().catch(console.dir);

app.get('/', (req, res) => {
    res.send('super sport camp is starting');
})
app.listen(port, () => {
    console.log(`super sport is running on port ${port}`);
})