const express = require('express');
const app = express();
const cors = require('cors');
require('dotenv').config()
const port = process.env.PORT || 5000;

// middleware
app.use(cors());
app.use(express.json());


const { MongoClient, ServerApiVersion } = require('mongodb');
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
        await client.connect();
        const classCollection = client.db("sportDb").collection("class");
        app.get('/classes', async (req, res) => {
            const query = {};
            // const query = { numberOfStudents: { $gt: 17 } };
            const options = {
                // sort matched documents in descending order by rating
                sort: { "numberOfStudents": -1 },
                // Include only the `title` and `imdb` fields in the returned document
                // projection: { _id: 0, title: 1, imdb: 1 },
            };
            const result = await classCollection.find(query,options).toArray()
            res.send(result)
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