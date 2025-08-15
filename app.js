const express = require('express');
const app = express();
const { Task, sequelize } = require('./models');
app.use(express.json());


sequelize.authenticate().then(() => {
    console.log("Database connection established successfully!");
}).catch((error) => {
    console.error("Unable to connect to the database:", error);
});


app.get('/', (req, res) => {
    res.send('Hello World');
});

// Updated to use database
app.get("/tasks", async (req, res) => {
    try {
        const tasks = await Task.findAll();
        res.json(tasks);
    } catch (error) {
        console.error('Error fetching tasks:', error);
        res.status(500).json({ error: "Failed to fetch tasks" });
    }
});

// Updated to use Task model and database
app.post("/task", async (req, res) => {
    try {
        console.log("Received request body:", req.body);

        const taskData = {
            title: req.body.title,
            description: req.body.description,
            status: req.body.status || "pending",
            dueDate: req.body.dueDate || null
        };

        console.log("Task data to create:", taskData);

        const newTask = await Task.create(taskData);
        console.log("Created task:", newTask.toJSON());

        res.status(201).json(newTask);
    } catch (error) {
        console.error('Error creating task:', error);
        res.status(400).json({ error: "Failed to create task", details: error.message });
    }
});

// Updated to use database
app.put("/task/:id", async (req, res) => {
    try {
        const taskId = parseInt(req.params.id);
        const { title, description, status, dueDate } = req.body;

        const task = await Task.findByPk(taskId);
        if (!task) {
            return res.status(404).json({ error: "Task not found" });
        }

        // Update only provided fields
        if (title !== undefined) task.title = title;
        if (description !== undefined) task.description = description;
        if (status !== undefined) task.status = status;
        if (dueDate !== undefined) task.dueDate = dueDate;

        await task.save();
        res.json(task);
    } catch (error) {
        console.error('Error updating task:', error);
        res.status(500).json({ error: "Failed to update task" });
    }
});

// Updated to use database
app.delete("/task/:id", async (req, res) => {
    try {
        const taskId = parseInt(req.params.id);
        const task = await Task.findByPk(taskId);

        if (!task) {
            return res.status(404).json({ error: "Task not found" });
        }

        await task.destroy();
        res.json({ message: "Task deleted successfully" });
    } catch (error) {
        console.error('Error deleting task:', error);
        res.status(500).json({ error: "Failed to delete task" });
    }
});

const PORT = 3000;
app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
});