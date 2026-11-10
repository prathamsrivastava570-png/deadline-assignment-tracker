const dns = require("dns");
dns.setServers(["8.8.8.8", "1.1.1.1"]);
require("dotenv").config();
const express = require("express");
const mongoose = require("mongoose");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const Assignment = require("./models/Assignment");
const User = require("./models/User");

const app = express();
app.use(express.json());
app.use(express.static("public"));

mongoose
  .connect(process.env.MONGO_URI)
  .then(() => console.log("MongoDB connected"))
  .catch((err) => console.log("MongoDB connection error:", err.message));

// ---------- Auth middleware: checks the token on every protected route ----------
function auth(req, res, next) {
  const token = (req.headers.authorization || "").replace("Bearer ", "");
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.userId = decoded.id;
    next();
  } catch (err) {
    res.status(401).json({ error: "Please log in" });
  }
}

// ---------- Register ----------
app.post("/register", async (req, res) => {
  try {
    const { name, email, password } = req.body;
    if (!name || !email || !password) {
      return res.status(400).json({ error: "All fields are required" });
    }
    const exists = await User.findOne({ email });
    if (exists) return res.status(400).json({ error: "Email already registered" });
    const hashed = await bcrypt.hash(password, 10);
    await User.create({ name, email, password: hashed });
    res.status(201).json({ message: "Registered" });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// ---------- Login ----------
app.post("/login", async (req, res) => {
  try {
    const { email, password } = req.body;
    const user = await User.findOne({ email });
    if (!user || !(await bcrypt.compare(password, user.password))) {
      return res.status(401).json({ error: "Wrong email or password" });
    }
    const token = jwt.sign({ id: user._id }, process.env.JWT_SECRET, { expiresIn: "7d" });
    res.json({ token, name: user.name });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// ---------- Urgency logic ----------
function getUrgency(a) {
  if (a.status === "done") return "done";
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const daysLeft = Math.floor((new Date(a.dueDate) - today) / (1000 * 60 * 60 * 24));
  if (daysLeft < 0) return "overdue";
  if (daysLeft <= 2) return "due-soon";
  return "on-track";
}

// ---------- Assignments (all protected, each user sees only their own) ----------
app.post("/assignments", auth, async (req, res) => {
  try {
    const { title, subject, dueDate } = req.body;
    const a = await Assignment.create({ title, subject, dueDate, user: req.userId });
    res.status(201).json({ ...a.toObject(), urgency: getUrgency(a) });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

app.get("/assignments", auth, async (req, res) => {
  const list = await Assignment.find({ user: req.userId }).sort({ dueDate: 1 });
  let result = list.map((a) => ({ ...a.toObject(), urgency: getUrgency(a) }));
  if (req.query.urgency) {
    result = result.filter((a) => a.urgency === req.query.urgency);
  }
  res.json(result);
});

app.put("/assignments/:id", auth, async (req, res) => {
  try {
    const { title, subject, dueDate, status } = req.body;
    const a = await Assignment.findOneAndUpdate(
      { _id: req.params.id, user: req.userId },
      { title, subject, dueDate, status },
      { new: true, runValidators: true }
    );
    if (!a) return res.status(404).json({ error: "Not found" });
    res.json({ ...a.toObject(), urgency: getUrgency(a) });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

app.delete("/assignments/:id", auth, async (req, res) => {
  try {
    const a = await Assignment.findOneAndDelete({ _id: req.params.id, user: req.userId });
    if (!a) return res.status(404).json({ error: "Not found" });
    res.json({ message: "Deleted" });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

app.listen(3000, () => {
  console.log("Server started on port 3000");
});