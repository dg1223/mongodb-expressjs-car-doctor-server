const express = require("express");
const cors = require("cors");
const jwt = require("jsonwebtoken");
const { MongoClient, ServerApiVersion, ObjectId } = require("mongodb");
require("dotenv").config();
const app = express();
const port = process.env.PORT || 5000;

// middleware
app.use(cors());
app.use(express.json());

// connect to MongoDB
const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@dg1223.za2ri3i.mongodb.net/?retryWrites=true&w=majority`;

// Create a MongoClient with a MongoClientOptions object to set the Stable API version
const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  },
});

// Verrify access token coming from client
const verifyJWT = (req, res, next) => {
  const authorization = req.headers.authorization;
  // Prevent access without a token/header
  if (!authorization) {
    return res
      .status(401)
      .send({ error: true, message: "unauthorized access" });
  }
  const token = authorization.split(" ")[1];
  // Verify token
  jwt.verify(token, process.env.ACCESS_TOKEN_SECRET, (error, decoded) => {
    if (error) {
      return res
        .status(401)
        .send({ error: true, message: "Unauthorized access" });
    }
    req.decoded = decoded;
    next();
  });
};

async function run() {
  try {
    // Connect the client to the server	(optional starting in v4.7)
    // DO NOT use this if deploying through Vercel
    // await client.connect();

    const serviceCollection = client.db("carDoctor").collection("services");
    const bookingCollection = client.db("carDoctor").collection("bookings");

    // JWT
    app.post("/jwt", (req, res) => {
      const user = req.body;
      console.log(user);
      const token = jwt.sign(user, process.env.ACCESS_TOKEN_SECRET, {
        // be careful about the data type here
        // seconds -> integer, hours -> string
        expiresIn: "1h",
      });
      // console.log(token);
      res.send({ token });
    });

    // services routes
    app.get("/services", async (req, res) => {
      const sort = req.query.sort;
      const search = req.query.search;
      console.log(search);
      // const query = {};
      // const query = { price: { $gte: 50, $lte: 150 } };
      // db.InspirationalWomen.find({first_name: { $regex: /Harriet/i} })
      const query = { title: { $regex: search, $options: "i" } };
      const options = {
        // sort matched documents in descending order by rating
        sort: {
          "price": sort === "asc" ? 1 : -1,
        },
      };
      const cursor = serviceCollection.find(query, options);
      const result = await cursor.toArray();
      res.send(result);
    });

    app.get("/services/:id", async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) };

      const options = {
        // Include only specific fields in the returned document
        projection: { title: 1, imdb: 1, price: 1, service_id: 1, img: 1 },
      };

      const result = await serviceCollection.findOne(query, options);
      res.send(result);
    });

    /* booking routes */
    // use query paramters to read partial data
    app.get("/bookings", verifyJWT, async (req, res) => {
      const decoded = req.decoded;
      console.log("came back after verifying", decoded);

      if (decoded.email !== req.query.email) {
        return res.status(403).send({ error: 1, message: "Forbidden access" });
      }

      let query = {};
      if (req.query?.email) {
        query = { email: req.query.email };
      }
      const result = await bookingCollection.find(query).toArray();
      res.send(result);
    });

    app.post("/bookings", async (req, res) => {
      const booking = req.body;
      console.log(booking);
      const result = await bookingCollection.insertOne(booking);
      res.send(result);
    });

    // different than documentation for upsert
    // no options required since we are doing partial update
    app.patch("/bookings/:id", async (req, res) => {
      const id = req.params.id;
      const filter = { _id: new ObjectId(id) };
      const updatedBooking = req.body;
      console.log(updatedBooking);
      const updatedDoc = {
        $set: {
          status: updatedBooking.status,
        },
      };
      const result = await bookingCollection.updateOne(filter, updatedDoc);
      res.send(result);
    });

    app.delete("/bookings/:id", async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) };
      const result = await bookingCollection.deleteOne(query);
      res.send(result);
    });

    // Send a ping to confirm a successful connection
    await client.db("admin").command({ ping: 1 });
    console.log(
      "Pinged your deployment. You successfully connected to MongoDB!"
    );
  } finally {
    // Ensures that the client will close when you finish/error
    // await client.close();
  }
}
run().catch(console.dir);

// REST
app.get("/", (req, res) => {
  res.send("Doctor is running...");
});

app.listen(port, () => {
  console.log(`Car doctor server is running on port ${port}`);
});
