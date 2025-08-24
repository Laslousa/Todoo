import express from "express";
import pg from "pg";

const app = express();
const port = 3000;

app.use(express.urlencoded({ extended: true }));
app.use(express.static("public"));

const db = new pg.Client({
  user: "postgres",
  host: "localhost",
  database: "permalist",
  password: "Laslousa+2005",
  port: 5433,
});

db.connect()
  .then(() => console.log("Connected to PostgreSQL database"))
  .catch((err) => console.error("Database connection error:", err));

let items = [];
let users = [];
let currentUser = { user_id: 1, name: "Default", color: "Default" };
let addOk = "New Item";
let currentDate = new Date().toLocaleDateString("en-US", {
  weekday: "long",
});
app.get("/", async (req, res) => {
  let firstLoad = false;
  try {
    const countResult = await db.query("SELECT COUNT(*) FROM users");
    const count = parseInt(countResult.rows[0].count);
    if (count === 0) {
      firstLoad = true;
    }

    const usersResult = await db.query("SELECT * from users ORDER BY user_id");
    const itemsResult = await db.query(
      "SELECT item_id, title FROM items WHERE user_id = $1 ORDER BY item_id",
      [currentUser.user_id]
    );

    items = itemsResult.rows;
    users = usersResult.rows;

    // Récupérer les informations de l'utilisateur actuel
    if (users.length > 0) {
      const user = users.find((u) => u.user_id === currentUser.user_id);
      if (user) {
        currentUser = user;
      } else {
        currentUser = users[0]; // Fallback au premier utilisateur
      }
    }

    res.render("index.ejs", {
      listTitle: currentDate,
      listItems: items,
      addOk: addOk,
      users: users,
      currentUser: currentUser,
      firstLoad: firstLoad,
    });
  } catch (error) {
    console.error("Error fetching items:", error);
    res.render("index.ejs", {
      listTitle: currentDate,
      listItems: [],
      addOk: "Error loading items",
      users: [],
      currentUser: currentUser,
      firstLoad: firstLoad,
    });
  }
});

app.post("/add", async (req, res) => {
  try {
    const newItem = req.body.newItem.trim();
    if (newItem === "") {
      addOk = "Please enter a valid item.";
      return res.redirect("/");
    }
    await db.query("INSERT INTO items (title, user_id) VALUES ($1, $2)", [
      newItem,
      currentUser.user_id,
    ]);
    addOk = "New Item";
    res.redirect("/");
  } catch (error) {
    console.error("Error adding item:", error);
    addOk = "Error adding item";
    res.redirect("/");
  }
});

app.post("/edit", async (req, res) => {
  const updatedItemId = parseInt(req.body.updatedItemId);
  const updatedItemTitle = req.body.updatedItemTitle.trim();
  if (updatedItemTitle === "") {
    return res.redirect("/");
  }
  try {
    await db.query("UPDATE items SET title = $1 WHERE item_id = $2", [
      updatedItemTitle,
      updatedItemId,
    ]);
    res.redirect("/");
  } catch (error) {
    console.error("Error updating item:", error);
  }
});

app.post("/delete", async (req, res) => {
  const deletedItemId = parseInt(req.body.deleteItemId);
  try {
    await db.query("DELETE FROM items WHERE item_id = $1", [deletedItemId]);
    res.redirect("/");
  } catch (error) {
    console.error("Error deleting item:", error);
  }
});

app.listen(port, () => {
  console.log(`Server running on port ${port}`);
});

app.post("/changeUser", async (req, res) => {
  const liste = JSON.parse(req.body.mode);
  const mode = liste[0];
  const userId = liste[1];
  if (mode === "select") {
    if (isNaN(userId)) {
      console.error("Invalid user ID:", userId);
      return res.redirect("/");
    }
    try {
      // Récupérer les informations de l'utilisateur sélectionné
      const userResult = await db.query(
        "SELECT * FROM users WHERE user_id = $1",
        [userId]
      );
      if (userResult.rows.length > 0) {
        currentUser = userResult.rows[0];
      }
      res.redirect("/");
    } catch (error) {
      console.error("Error changing user:", error);
      res.redirect("/");
    }
  } else if (mode === "delete") {
    if (isNaN(userId)) {
      console.error("Invalid user ID:", userId);
      return res.redirect("/");
    }
    try {
      try {
        await db.query("DELETE FROM items WHERE user_id = $1", [userId]);
      } catch (error) {
        console.error("Error deleting items for this user:", error);
      }
      await db.query("DELETE FROM users WHERE user_id = $1", [userId]);
      // Si l'utilisateur supprimé est l'utilisateur actuel, revenir au premier utilisateur
      if (currentUser.user_id === userId) {
        try {
          const usersResult = await db.query(
            "SELECT * from users ORDER BY user_id"
          );
          if (usersResult.rows.length > 0) {
            currentUser = usersResult.rows[0];
          }
        } catch (error) {
          console.error("Error fetching users:", error);
        }
      }
      res.redirect("/");
    } catch (error) {
      console.error("Error deleting user:", error);
      res.redirect("/");
    }
  } else if (mode === "edit") {
    









  }
});

app.post("/addUser", async (req, res) => {
  res.render("newUser.ejs");
});

app.post("/createUser", async (req, res) => {
  const newUserName = req.body.username.trim();
  const selectedColor = req.body.color;

  if (!newUserName) {
    return res.redirect("/addUser");
  }

  try {
    const result = await db.query(
      "INSERT INTO users (name, color) VALUES ($1, $2) RETURNING *",
      [newUserName, selectedColor]
    );

    // Changer vers le nouvel utilisateur créé
    if (result.rows.length > 0) {
      currentUser = result.rows[0];
    }

    res.redirect("/");
  } catch (error) {
    console.error("Error creating user:", error);
    res.redirect("/");
  }
});
