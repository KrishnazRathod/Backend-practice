const express = require('express');
const app = express();

app.use(express.json());

const tasks = [
    { id: 1, title: "Task 1", description: "Description 1" },
    { id: 2, title: "Task 2", description: "Description 2" },
    { id: 3, title: "Task 3", description: "Description 3" },
];


const newId = tasks.length + 1;
app.get('/', (req, res) => {
    res.send('Hello World');
});


app.get("/tasks", (req, res) => {
    res.json(tasks);
});

app.post("/task", (req, res) => {
    console.log(req.body)
    const newTask = {
        id: newId,
        title: req.body.title,
        description: req.body.description,
    };
    tasks.push(newTask);
    res.status(201).json(newTask);
});

app.put("/task/:id", (req, res) => {
    const taskId = parseInt(req.params.id)
    const { title, description } = req.body
    const task = tasks.find(t => t.id === taskId)
    if (!task) {
        return res.status((404).json({ error: "task not found" }))
    }
    if (title !== undefined) task.title = title
    if (description !== undefined) task.description = description

    res.json(task)
})

app.delete("/task/:id", (req, res) => {
    const taskId = parseInt(req.params.id)
    const index = tasks.findIndex(t => t.id === taskId)
    if (index === -1) {
        return res.status((404).json({ error: "task not found" }))
    }
    const deleteTask = tasks.splice(index, 1)[0]
    res.json(deleteTask)
})

const PORT = 3000;
app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
});