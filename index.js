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

async function initializeDatabase() {
  try {
    if (users.length > 0) {
      const usersResult = await db.query("SELECT * FROM users");
      users = usersResult.rows;
      return users[0];
    } else {
      return { user_id: 1, name: "Default", color: "Default" };
    }
  } catch (error) {
    console.error("Error initializing database:", error);
  }
}

let items = [];
let users = [];
let currentUser = await initializeDatabase();
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
    users = usersResult.rows;

    const itemsResult = await db.query(
      "SELECT item_id, title FROM items WHERE user_id = $1 ORDER BY item_id",
      [currentUser.user_id]
    );
    items = itemsResult.rows;

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
    try {
      const userResult = await db.query(
        "SELECT * FROM users WHERE user_id = $1",
        [userId]
      );
      const userToEdit = userResult.rows[0];
      res.render("newUser.ejs", { userToEdit: userToEdit });
    } catch (error) {
      console.error("Error fetching user for edit:", error);
      res.redirect("/");
    }
  }
});

app.post("/addUser", async (req, res) => {
  res.render("newUser.ejs");
});

app.post("/createUser", async (req, res) => {
  let newUserName = req.body.username.trim();
  let selectedColor = req.body.color;

  if (req.body.action === "create") {
    if (!newUserName) {
      return res.redirect("/addUser");
    }

    try {
      const countResult = await db.query(
        "SELECT COUNT(*) FROM users WHERE name = $1",
        [newUserName]
      );

      if (parseInt(countResult.rows[0].count) > 0) {
        // User already exists
        return res.render("newUser.ejs", {
          userAlreadyExists: "Username already exists, please choose another.",
        });
      }
      if (!selectedColor) {
        return res.render("newUser.ejs", {
          userAlreadyExists: "Please select a color.",
        });
      }
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
  } else if (req.body.action === "update") {
    const userId = req.body.userId;
    if (!newUserName || isNaN(userId)) {
      return res.redirect("/");
    }

    try {
      const result = await db.query("SELECT * FROM users WHERE user_id = $1", [
        userId,
      ]);
      const oldUser = result.rows[0];
      const oldUserName = oldUser ? oldUser.name : "Unknown";
      const oldColor = oldUser ? oldUser.color : "Unknown";
      newUserName = newUserName || oldUserName;
      selectedColor = selectedColor || oldColor;

      try {
        const otherUsers = await db.query(
          "SELECT * FROM users WHERE user_id != $1",
          [userId]
        );
        for (let otherUser of otherUsers.rows) {
          if (otherUser.name === newUserName) {
            console.error("Username already exists:", newUserName);
            return res.render("newUser.ejs", {
              userToEdit: oldUser,
              userAlreadyExists:
                "Username already exists, please choose another.",
            });
          }
        }
      } catch (error) {
        console.error("Error fetching users:", error);
      }

      await db.query(
        "UPDATE users SET name = $1, color = $2 WHERE user_id = $3",
        [newUserName, selectedColor, userId]
      );

      currentUser = {
        user_id: parseInt(userId),
        name: newUserName,
        color: selectedColor,
      };
      res.redirect("/");
    } catch (error) {
      console.error("Error updating user:", error);
      res.redirect("/");
    }
  }
});
