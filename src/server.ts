import express, { Response } from "express";
import { Pool } from "pg";
import dotenv from "dotenv";
import path from "path";

dotenv.config();

const app = express();
const port: number = Number(process.env.PORT);
const dbUser: string = String(process.env.DB_USER);
const dbPass: string = String(process.env.DB_PASS);
const dbHost: string = String(process.env.DB_HOST);
const dbName: string = String(process.env.DB_NAME);
const dbPort: number = Number(process.env.DB_PORT);
const pool = new Pool({
  user: dbUser,
  password: dbPass,
  host: dbHost,
  database: dbName,
  port: dbPort,
  max: 20,
  idleTimeoutMillis: 30000,
});

app.set("view engine", "ejs");
app.set("views", path.join(process.cwd(), "views"));

app.use(express.static(path.join(process.cwd(), "public")));
app.use(express.urlencoded({ extended: true }));

interface IList {
  id: number;
  title: string;
}

let items: IList[] = [];

app.get("/", async (req, res) => {
  renderIndex(res);
});

app.post("/add", async (req, res) => {
  const userInput = req.body.newItem;

  try {
    if (!userInput || userInput.trim() === "")
      return renderIndex(res, {
        type: "warning",
        message: "Please enter a task name!",
      });

    const newItem =
      userInput.charAt(0).toUpperCase() + userInput.slice(1).toLowerCase();

    const idResult = await pool.query("SELECT id FROM items ORDER BY id ASC");
    const existingIds = idResult.rows.map((row) => row.id);
    console.log(existingIds);

    let nextId: number = 1;
    for (const id of existingIds) {
      if (id === nextId) {
        nextId++;
      } else {
        break;
      }
    }

    await pool.query(
      "INSERT INTO items(id, title) OVERRIDING SYSTEM VALUE VALUES ($1, $2)",
      [nextId, newItem],
    );

    await renderIndex(res, {
      type: "success",
      message: "Added a new task successfully",
    });
  } catch (error: any) {
    res.status(500).send("SERVER ERROR!");
    console.log("Error Adding Data" + error.message);
  }
});

app.post("/edit", async (req, res) => {
  const id = Number(req.body.updatedItemId);
  const newTitle = req.body.updatedItemTitle;

  try {
    await pool.query("UPDATE items SET title = $1 WHERE id = $2", [
      newTitle,
      id,
    ]);
    renderIndex(res, {
      type: "success",
      message: "Updated the task successfully",
    });
  } catch (error: any) {
    res.status(500).send("SERVER ERROR!");
    console.log("Error Updating Data" + error.message);
  }
});

app.post("/delete", async (req, res) => {
  const id = Number(req.body.deleteItemId);

  try {
    await pool.query("DELETE FROM items WHERE id = $1", [id]);
    await pool.query(
      "SELECT setval(pg_get_serial_sequence('items', 'id'), COALESCE(MAX(id), 0) + 1, false) FROM items",
    );
    renderIndex(res, {
      type: "success",
      message: "Deleted the task successfully",
    });
  } catch (error: any) {
    res.status(500).send("SERVER ERROR!");
    console.log("Error Deleting Data" + error.message);
  }
});

app.listen(port, () => {
  console.log(`Server is running on http://localhost:${port}`);
});

async function getItems() {
  const listItems = await pool.query("SELECT * FROM items ORDER BY id ASC");
  const result = listItems.rows;
  return result;
}

async function renderIndex(res: Response, notification: any = null) {
  items = await getItems();

  res.render("index", {
    listTitle: "Today",
    listItems: items,
    notification,
  });
}
